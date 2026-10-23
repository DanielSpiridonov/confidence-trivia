"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndlessError = void 0;
exports.endlessAction = endlessAction;
exports.endlessLeaderboard = endlessLeaderboard;
const crypto_1 = require("crypto");
const database_1 = require("./database");
const endlessEngine_1 = require("./endlessEngine");
class EndlessError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.EndlessError = EndlessError;
// Every action locks the same player row first, including initial creation.
// This works across Render instances and coordinates with existing Star writes.
async function endlessAction(playerId, authUserId, command, database = database_1.databaseSql) {
    if (!database)
        throw new EndlessError(503, "Endless is temporarily unavailable.");
    return database.begin(async (tx) => {
        const [player] = await tx `
      select stars from public.players where id = ${playerId} and auth_user_id = ${authUserId}
        and account_type = 'registered'
        and (moderation_status = 'active' or (moderation_status = 'suspended' and suspended_until <= clock_timestamp()))
      for update
    `;
        if (!player)
            throw new EndlessError(403, "Sign in with an eligible account to play Endless.");
        const [clock] = await tx `select (extract(epoch from clock_timestamp()) * 1000)::float8 as now`;
        const now = Number(clock.now);
        await tx `insert into public.endless_records(player_id) values (${playerId}) on conflict do nothing`;
        const [record] = await tx `select best_score from public.endless_records where player_id = ${playerId}`;
        let best = record.best_score;
        let [stored] = await tx `
      select state from public.endless_runs where player_id = ${playerId}
      order by finished asc, created_at desc, id limit 1
    `;
        if (command.type === "start") {
            const [retry] = await tx `select player_id, state from public.endless_runs where id = ${command.requestId}`;
            if (retry && retry.player_id !== playerId)
                throw new EndlessError(409, "Please try starting again.");
            // A retried Start never replaces the active run, even after game over.
            if ((!stored || stored.state.phase === "finished") && !retry) {
                const state = (0, endlessEngine_1.createEndlessRun)(command.requestId, best, now);
                await tx `insert into public.endless_runs(id, player_id, state, finished) values (${state.id}, ${playerId}, ${tx.json(state)}, ${state.phase === "finished"})`;
                stored = { state };
            }
        }
        const run = stored?.state ?? null;
        if (run) {
            (0, endlessEngine_1.applyEndlessCommand)(run, command, now);
            if (run.score > best) {
                best = run.score;
                await tx `update public.endless_records set best_score = ${best}, achieved_at = clock_timestamp() where player_id = ${playerId}`;
            }
            // Persist before inserting the claim FK; transaction rollback includes all
            // scoring, currency, ledger, and progression writes if any step fails.
            await tx `update public.endless_runs set state = ${tx.json(run)}, finished = ${run.phase === "finished"}, updated_at = clock_timestamp() where id = ${run.id}`;
        }
        const claimedRows = await tx `select milestone from public.endless_reward_claims where player_id = ${playerId}`;
        const claimed = claimedRows.map((c) => c.milestone);
        if (run) {
            for (const reward of (0, endlessEngine_1.unclaimedEndlessRewards)(best, claimed)) {
                const transactionId = (0, crypto_1.randomUUID)();
                await tx `insert into public.star_transactions(id, player_id, amount, reason) values (${transactionId}, ${playerId}, ${reward.stars}, ${`endless_milestone_${reward.score}`})`;
                await tx `insert into public.endless_reward_claims(player_id, milestone, stars, run_id, transaction_id) values (${playerId}, ${reward.score}, ${reward.stars}, ${run.id}, ${transactionId})`;
                await tx `update public.players set stars = stars + ${reward.stars} where id = ${playerId}`;
                player.stars += reward.stars;
                run.rewards.push({ ...reward });
                claimed.push(reward.score);
            }
            await tx `update public.endless_runs set state = ${tx.json(run)} where id = ${run.id}`;
        }
        return { serverNow: now, personalBest: best, stars: player.stars, claimed, run: run ? (0, endlessEngine_1.publicEndlessRun)(run) : null };
    });
}
async function endlessLeaderboard(playerId, database = database_1.databaseSql) {
    if (!database)
        throw new EndlessError(503, "Endless leaderboard is temporarily unavailable.");
    const rows = await database `
    with board as (
      select r.player_id, p.display_name, r.best_score,
        coalesce((select cosmetic_id from public.player_cosmetics c where c.player_id = p.id and cosmetic_type = 'avatar' and equipped limit 1), 'smart_owl') as avatar_id,
        row_number() over (order by r.best_score desc, r.achieved_at asc, r.player_id asc)::int as position
      from public.endless_records r join public.players p on p.id = r.player_id
      where r.best_score > 0 and p.account_type = 'registered'
        and (p.moderation_status = 'active' or (p.moderation_status = 'suspended' and p.suspended_until <= clock_timestamp()))
    ) select * from board where position <= 100 or player_id = ${playerId} order by position
  `;
    const entries = rows.map((r) => ({ playerId: r.player_id, displayName: r.display_name, avatarId: r.avatar_id, score: r.best_score, position: r.position }));
    return { top: entries.filter((e) => e.position <= 100), currentPlayer: entries.find((e) => e.playerId === playerId) ?? null };
}
