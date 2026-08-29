import postgres from "postgres";
import { randomUUID } from "crypto";
import {
  DAILY_REWARD_MAX_STREAK_DAY,
  getDailyStarReward,
  getPlacementStartingLp,
  getRankedDivision,
  RANKED_LP_BY_PLACEMENT,
  RANKED_PLACEMENT_MATCHES,
  RANKED_PLACEMENT_POINTS,
} from "@confidence-trivia/shared";

const databaseUrl = process.env.DATABASE_URL;

// A missing database is allowed during local gameplay development. Render gets
// DATABASE_URL as a secret, never as a value committed to the repository.
const sql = databaseUrl
  ? postgres(databaseUrl, { max: 3, idle_timeout: 20 })
  : null;

export type DatabaseStatus = "connected" | "not_configured" | "unavailable";

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (!sql) return "not_configured";
  try {
    await sql`select 1`;
    return "connected";
  } catch (error) {
    console.error("Database health check failed", error);
    return "unavailable";
  }
}

export interface CompletedMatchPlayer {
  deviceId: string;
  displayName: string;
  finalScore: number;
  finalRank: number;
}

export interface CompletedMatch {
  id: string;
  roomCode: string;
  gameMode: string;
  locale: string;
  roundCount: number;
  startedAt: Date;
  players: CompletedMatchPlayer[];
}

export interface PlayerProgressUpdate {
  stars: number;
  starsEarned: number;
  rewardedGamesToday: number;
}

export interface DailyRewardStatus {
  stars: number;
  available: boolean;
  amount: number;
  streakDay: number;
  nextClaimAt: string;
}

export interface RankedLeaderboardEntry {
  playerId: string;
  displayName: string;
  lp: number;
  rankKey: string;
  wins: number;
  position: number | null;
  placementMatches: number;
}

export interface RankedLeaderboardResponse {
  top: RankedLeaderboardEntry[];
  currentPlayer: RankedLeaderboardEntry | null;
}

export async function getRankedLeaderboard(deviceId: string): Promise<RankedLeaderboardResponse | null> {
  if (!sql) return null;

  try {
    const rows = await sql<{
      id: string;
      display_name: string;
      ranked_lp: number;
      wins: number;
      ranked_placement_matches: number;
      position: number;
    }[]>`
      select id, display_name, ranked_lp, wins, ranked_placement_matches, position::int
      from (
        select id, display_name, ranked_lp, wins, ranked_placement_matches,
          row_number() over (order by ranked_lp desc, wins desc, created_at asc) as position
        from public.players
        where ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES}
      ) ranked
      order by position
      limit 10
    `;

    const top = rows.map((player) => ({
      playerId: player.id,
      displayName: player.display_name,
      lp: player.ranked_lp,
      rankKey: getRankedDivision(player.ranked_lp).key,
      wins: player.wins,
      position: player.position,
      placementMatches: player.ranked_placement_matches,
    }));

    const [current] = await sql<{
      id: string;
      display_name: string;
      ranked_lp: number;
      wins: number;
      ranked_placement_matches: number;
      position: number | null;
    }[]>`
      select p.id, p.display_name, p.ranked_lp, p.wins, p.ranked_placement_matches,
        case when p.ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES} then (
          select count(*)::int + 1
          from public.players ahead
          where ahead.ranked_placement_matches >= ${RANKED_PLACEMENT_MATCHES}
            and (
              ahead.ranked_lp > p.ranked_lp
              or (ahead.ranked_lp = p.ranked_lp and ahead.wins > p.wins)
              or (ahead.ranked_lp = p.ranked_lp and ahead.wins = p.wins and ahead.created_at < p.created_at)
            )
        end as position
      from public.players p
      where p.id = ${deviceId}
    `;

    const currentPlayer = current ? {
      playerId: current.id,
      displayName: current.display_name,
      lp: current.ranked_lp,
      rankKey: current.ranked_placement_matches < RANKED_PLACEMENT_MATCHES
        ? "novice"
        : getRankedDivision(current.ranked_lp).key,
      wins: current.wins,
      position: current.position,
      placementMatches: current.ranked_placement_matches,
    } : null;

    return { top, currentPlayer };
  } catch (error) {
    console.error("Could not load ranked leaderboard", error);
    return null;
  }
}

function nextUtcDayIso(): string {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

export async function upsertPlayer(deviceId: string, displayName: string): Promise<number | null> {
  if (!sql) return null;

  try {
    const [player] = await sql<{ stars: number }[]>`
      insert into public.players (id, display_name, last_seen_at)
      values (${deviceId}, ${displayName}, now())
      on conflict (id) do update
      set display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
      returning stars
    `;
    return player?.stars ?? 0;
  } catch (error) {
    // Persistence must never prevent a player from joining a live game.
    console.error("Could not persist player profile", error);
    return null;
  }
}

export async function getPlayerStars(deviceId: string): Promise<number | null> {
  if (!sql) return null;

  try {
    const [player] = await sql<{ stars: number }[]>`
      select stars
      from public.players
      where id = ${deviceId}
    `;
    return player?.stars ?? 0;
  } catch (error) {
    console.error("Could not load player stars", error);
    return null;
  }
}

export async function getDailyRewardStatus(deviceId: string): Promise<DailyRewardStatus | null> {
  if (!sql) return null;

  try {
    const [player] = await sql<{
      stars: number;
      claimed_today: boolean;
      claimed_yesterday: boolean;
      last_streak_day: number | null;
      last_amount: number | null;
    }[]>`
      select p.stars,
        coalesce(last_claim.reward_day = (now() at time zone 'UTC')::date, false) as claimed_today,
        coalesce(last_claim.reward_day = (now() at time zone 'UTC')::date - 1, false) as claimed_yesterday,
        last_claim.reward_streak_day as last_streak_day,
        last_claim.amount as last_amount
      from public.players p
      left join lateral (
        select reward_day, reward_streak_day, amount
        from public.star_transactions
        where player_id = p.id and reason = 'daily_claim'
        order by reward_day desc
        limit 1
      ) last_claim on true
      where p.id = ${deviceId}
    `;
    const lastStreakDay = player?.last_streak_day ?? 1;
    const streakDay = player?.claimed_today
      ? lastStreakDay
      : player?.claimed_yesterday
        ? Math.min(DAILY_REWARD_MAX_STREAK_DAY, lastStreakDay + 1)
        : 1;
    return {
      stars: player?.stars ?? 0,
      available: !player?.claimed_today,
      amount: player?.claimed_today ? (player.last_amount ?? getDailyStarReward(streakDay)) : getDailyStarReward(streakDay),
      streakDay,
      nextClaimAt: nextUtcDayIso(),
    };
  } catch (error) {
    console.error("Could not load daily reward status", error);
    return null;
  }
}

export async function claimDailyReward(deviceId: string, displayName: string): Promise<DailyRewardStatus | null> {
  if (!sql) return null;

  try {
    return await sql.begin(async (transaction) => {
      await transaction`
        insert into public.players (id, display_name, last_seen_at)
        values (${deviceId}, ${displayName || "Player"}, now())
        on conflict (id) do update set last_seen_at = excluded.last_seen_at
      `;
      await transaction`select id from public.players where id = ${deviceId} for update`;

      const [lastClaim] = await transaction<{
        claimed_today: boolean;
        claimed_yesterday: boolean;
        streak_day: number;
        amount: number;
      }[]>`
        select
          reward_day = (now() at time zone 'UTC')::date as claimed_today,
          reward_day = (now() at time zone 'UTC')::date - 1 as claimed_yesterday,
          coalesce(reward_streak_day, 1)::int as streak_day,
          amount
        from public.star_transactions
        where player_id = ${deviceId} and reason = 'daily_claim'
        order by reward_day desc
        limit 1
      `;

      if (lastClaim?.claimed_today) {
        const [player] = await transaction<{ stars: number }[]>`
          select stars from public.players where id = ${deviceId}
        `;
        return {
          stars: player?.stars ?? 0,
          available: false,
          amount: lastClaim.amount,
          streakDay: lastClaim.streak_day,
          nextClaimAt: nextUtcDayIso(),
        };
      }

      const streakDay = lastClaim?.claimed_yesterday
        ? Math.min(DAILY_REWARD_MAX_STREAK_DAY, lastClaim.streak_day + 1)
        : 1;
      const rewardAmount = getDailyStarReward(streakDay);

      const inserted = await transaction<{ id: string }[]>`
        insert into public.star_transactions (
          id, player_id, amount, reason, reward_day, reward_streak_day
        ) values (
          ${randomUUID()}, ${deviceId}, ${rewardAmount}, 'daily_claim',
          (now() at time zone 'UTC')::date, ${streakDay}
        )
        on conflict do nothing
        returning id
      `;

      if (inserted.length > 0) {
        await transaction`
          update public.players set stars = stars + ${rewardAmount} where id = ${deviceId}
        `;
      }

      const [player] = await transaction<{ stars: number }[]>`
        select stars from public.players where id = ${deviceId}
      `;
      return {
        stars: player?.stars ?? 0,
        available: false,
        amount: rewardAmount,
        streakDay,
        nextClaimAt: nextUtcDayIso(),
      };
    });
  } catch (error) {
    console.error("Could not claim daily reward", error);
    return null;
  }
}

export async function saveCompletedMatch(match: CompletedMatch): Promise<Map<string, PlayerProgressUpdate>> {
  const progressUpdates = new Map<string, PlayerProgressUpdate>();
  if (!sql || match.players.length === 0) return progressUpdates;

  try {
    await sql.begin(async (transaction) => {
      const insertedMatches = await transaction<{ id: string }[]>`
        insert into public.matches (
          id, room_code, game_mode, locale, round_count, started_at
        ) values (
          ${match.id}, ${match.roomCode}, ${match.gameMode}, ${match.locale},
          ${match.roundCount}, ${match.startedAt}
        )
        on conflict (id) do nothing
        returning id
      `;

      // Makes retries safe if the same room attempts to persist twice.
      if (insertedMatches.length === 0) return;

      for (const player of match.players) {
        await transaction`
          insert into public.players (id, display_name, last_seen_at)
          values (${player.deviceId}, ${player.displayName}, now())
          on conflict (id) do update
          set display_name = excluded.display_name,
              last_seen_at = excluded.last_seen_at
        `;

        await transaction`
          insert into public.match_players (
            match_id, player_id, display_name, final_score, final_rank
          ) values (
            ${match.id}, ${player.deviceId}, ${player.displayName},
            ${player.finalScore}, ${player.finalRank}
          )
        `;

        await transaction`
          update public.players
          set games_played = games_played + 1,
              wins = wins + ${player.finalRank === 1 ? 1 : 0}
          where id = ${player.deviceId}
        `;

        // Serialize currency decisions per player so two matches finishing at
        // the same time cannot both claim the fifth daily reward slot.
        await transaction`
          select id from public.players where id = ${player.deviceId} for update
        `;

        if (match.gameMode === "ranked") {
          const [rankedPlayer] = await transaction<{
            ranked_lp: number;
            ranked_placement_matches: number;
            ranked_placement_points: number;
          }[]>`
            select ranked_lp, ranked_placement_matches, ranked_placement_points
            from public.players
            where id = ${player.deviceId}
          `;

          if (rankedPlayer) {
            const placement = Math.min(4, Math.max(1, player.finalRank));
            const isPlacementMatch = rankedPlayer.ranked_placement_matches < RANKED_PLACEMENT_MATCHES;
            const placementPointsAwarded = isPlacementMatch ? (RANKED_PLACEMENT_POINTS[placement] ?? 0) : 0;
            const placementMatchesAfter = isPlacementMatch
              ? rankedPlayer.ranked_placement_matches + 1
              : rankedPlayer.ranked_placement_matches;
            const placementPointsAfter = isPlacementMatch
              ? rankedPlayer.ranked_placement_points + placementPointsAwarded
              : rankedPlayer.ranked_placement_points;
            const lpAfter = isPlacementMatch
              ? placementMatchesAfter === RANKED_PLACEMENT_MATCHES
                ? getPlacementStartingLp(placementPointsAfter)
                : rankedPlayer.ranked_lp
              : Math.max(0, rankedPlayer.ranked_lp + (RANKED_LP_BY_PLACEMENT[placement] ?? 0));
            const lpDelta = lpAfter - rankedPlayer.ranked_lp;

            await transaction`
              insert into public.ranked_match_results (
                match_id, player_id, placement, was_placement_match,
                placement_points_awarded, lp_before, lp_delta, lp_after
              ) values (
                ${match.id}, ${player.deviceId}, ${placement}, ${isPlacementMatch},
                ${placementPointsAwarded}, ${rankedPlayer.ranked_lp}, ${lpDelta}, ${lpAfter}
              )
            `;

            await transaction`
              update public.players
              set ranked_lp = ${lpAfter},
                  ranked_placement_matches = ${placementMatchesAfter},
                  ranked_placement_points = ${placementPointsAfter}
              where id = ${player.deviceId}
            `;
          }
        }

        const [dailyCount] = await transaction<{ count: number }[]>`
          select count(*)::int as count
          from public.star_transactions
          where player_id = ${player.deviceId}
            and reason = 'game_completion'
            and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
            and created_at < (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '1 day'
        `;

        let starsEarned = 0;
        let rewardedGamesToday = dailyCount?.count ?? 0;
        if (rewardedGamesToday < 5) {
          const insertedRewards = await transaction<{ id: string }[]>`
            insert into public.star_transactions (
              id, player_id, amount, reason, source_match_id
            ) values (
              ${randomUUID()}, ${player.deviceId}, 10, 'game_completion', ${match.id}
            )
            on conflict (player_id, reason, source_match_id) do nothing
            returning id
          `;
          if (insertedRewards.length > 0) {
            starsEarned = 10;
            rewardedGamesToday += 1;
            await transaction`
              update public.players set stars = stars + 10 where id = ${player.deviceId}
            `;
          }
        }

        const [updatedPlayer] = await transaction<{ stars: number }[]>`
          select stars from public.players where id = ${player.deviceId}
        `;
        if (updatedPlayer) {
          progressUpdates.set(player.deviceId, {
            stars: updatedPlayer.stars,
            starsEarned,
            rewardedGamesToday,
          });
        }
      }
    });
  } catch (error) {
    // Final results remain valid in-room even when persistence is unavailable.
    console.error("Could not persist completed match", error);
  }

  return progressUpdates;
}
