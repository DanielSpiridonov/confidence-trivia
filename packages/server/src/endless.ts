import { randomUUID } from "crypto";
import type postgres from "postgres";
import { ENDLESS_PROTOCOL_VERSION, EndlessLeaderboard, EndlessLeaderboardEntry, EndlessState } from "@confidence-trivia/shared";
import { databaseSql } from "./database";
import { applyEndlessCommand, createEndlessRun, EndlessCommand, expireEndlessConnection, publicEndlessRun, StoredEndlessRun, unclaimedEndlessRewards, validEndlessAnswer } from "./endlessEngine";

export class EndlessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Every action locks the same player row first, including initial creation.
// This works across Render instances and coordinates with existing Star writes.
export async function endlessAction(playerId: string, authUserId: string, command: EndlessCommand, database: postgres.Sql | null = databaseSql): Promise<EndlessState> {
  if (!database) throw new EndlessError(503, "Endless is temporarily unavailable.");
  return database.begin(async (tx) => {
    const [player] = await tx<{ stars: number }[]>`
      select stars from public.players where id = ${playerId} and auth_user_id = ${authUserId}
        and account_type = 'registered'
        and (moderation_status = 'active' or (moderation_status = 'suspended' and suspended_until <= clock_timestamp()))
      for update
    `;
    if (!player) throw new EndlessError(403, "Sign in with an eligible account to play Endless.");
    // Read after acquiring the lock, in a fresh statement snapshot. Combining
    // this with the lock query would read stale progress when another device
    // commits while this request is waiting for the player row.
    const [snapshot] = await tx<{ now: number; best_score: number; claimed: number[]; state: StoredEndlessRun | null }[]>`
      select (extract(epoch from clock_timestamp()) * 1000)::float8 as now,
        coalesce((select best_score from public.endless_records where player_id = ${playerId}), 0) as best_score,
        coalesce((select jsonb_agg(milestone order by milestone) from public.endless_reward_claims where player_id = ${playerId}), '[]'::jsonb) as claimed,
        (select state from public.endless_runs where player_id = ${playerId}
          order by finished asc, created_at desc, id limit 1) as state
    `;
    const now = Number(snapshot.now);
    let best = snapshot.best_score;
    const claimed = [...snapshot.claimed];
    let run = snapshot.state;
    let previousState = run ? JSON.stringify(run) : null;

    // Finish an expired lease before Start checks the one-active-run constraint.
    // Expiration also runs inside the engine on every other action.
    if (run && expireEndlessConnection(run, now)) {
      await tx`update public.endless_runs set state = ${tx.json(run as any)}, finished = true, updated_at = clock_timestamp() where id = ${run.id}`;
      previousState = JSON.stringify(run);
    }

    if (command.type === "start") {
      const [retry] = await tx<{ player_id: string; state: StoredEndlessRun }[]>`select player_id, state from public.endless_runs where id = ${command.requestId}`;
      if (retry && retry.player_id !== playerId) throw new EndlessError(409, "Please try starting again.");
      // A retried Start never replaces the active run, even after game over.
      if ((!run || run.phase === "finished") && !retry) {
        const state = createEndlessRun(command.requestId, best, now);
        await tx`insert into public.endless_records(player_id) values (${playerId}) on conflict do nothing`;
        await tx`insert into public.endless_runs(id, player_id, state, finished) values (${state.id}, ${playerId}, ${tx.json(state as any)}, ${state.phase === "finished"})`;
        run = state;
      }
    }
    if (run) {
      if (command.type === "answer" && command.runId === run.id && command.token === run.question?.token && !validEndlessAnswer(run.question, command.answer)) throw new EndlessError(400, "Invalid answer for this question.");
      applyEndlessCommand(run, command, now);
      if (run.score > best) {
        best = run.score;
        await tx`insert into public.endless_records(player_id, best_score, achieved_at)
          values (${playerId}, ${best}, clock_timestamp())
          on conflict (player_id) do update set best_score = excluded.best_score, achieved_at = excluded.achieved_at`;
      }
      let rewardStars = 0;
      for (const reward of unclaimedEndlessRewards(best, claimed)) {
        const transactionId = randomUUID();
        await tx`insert into public.star_transactions(id, player_id, amount, reason) values (${transactionId}, ${playerId}, ${reward.stars}, ${`endless_milestone_${reward.score}`})`;
        await tx`insert into public.endless_reward_claims(player_id, milestone, stars, run_id, transaction_id) values (${playerId}, ${reward.score}, ${reward.stars}, ${run.id}, ${transactionId})`;
        rewardStars += reward.stars;
        run.rewards.push({ ...reward });
        claimed.push(reward.score);
      }
      if (rewardStars > 0) {
        await tx`update public.players set stars = stars + ${rewardStars} where id = ${playerId}`;
        player.stars += rewardStars;
      }
      // One snapshot write per action. Retries and unchanged syncs need none.
      // Scoring, best, claims, ledger and currency still commit atomically.
      if (JSON.stringify(run) !== previousState) {
        await tx`update public.endless_runs set state = ${tx.json(run as any)}, finished = ${run.phase === "finished"}, updated_at = clock_timestamp() where id = ${run.id}`;
      }
    }
    return { protocolVersion: ENDLESS_PROTOCOL_VERSION, serverNow: now, personalBest: best, stars: player.stars, claimed, run: run ? publicEndlessRun(run) : null };
  }) as Promise<EndlessState>;
}

export async function endlessLeaderboard(playerId: string, database: postgres.Sql | null = databaseSql): Promise<EndlessLeaderboard> {
  if (!database) throw new EndlessError(503, "Endless leaderboard is temporarily unavailable.");
  const rows = await database<{ player_id: string; display_name: string; avatar_id: string; best_score: number; position: number }[]>`
    with board as (
      select r.player_id, p.display_name, r.best_score,
        coalesce((select cosmetic_id from public.player_cosmetics c where c.player_id = p.id and cosmetic_type = 'avatar' and equipped limit 1), 'smart_owl') as avatar_id,
        row_number() over (order by r.best_score desc, r.achieved_at asc, r.player_id asc)::int as position
      from public.endless_records r join public.players p on p.id = r.player_id
      where r.best_score > 0 and p.account_type = 'registered'
        and (p.moderation_status = 'active' or (p.moderation_status = 'suspended' and p.suspended_until <= clock_timestamp()))
    ) select * from board where position <= 100 or player_id = ${playerId} order by position
  `;
  const entries: EndlessLeaderboardEntry[] = rows.map((r) => ({ playerId: r.player_id, displayName: r.display_name, avatarId: r.avatar_id, score: r.best_score, position: r.position }));
  return { top: entries.filter((e) => e.position <= 100), currentPlayer: entries.find((e) => e.playerId === playerId) ?? null };
}
