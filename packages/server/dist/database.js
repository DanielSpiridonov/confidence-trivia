"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseStatus = getDatabaseStatus;
exports.upsertPlayer = upsertPlayer;
exports.getPlayerStars = getPlayerStars;
exports.getDailyRewardStatus = getDailyRewardStatus;
exports.claimDailyReward = claimDailyReward;
exports.saveCompletedMatch = saveCompletedMatch;
const postgres_1 = __importDefault(require("postgres"));
const crypto_1 = require("crypto");
const shared_1 = require("@confidence-trivia/shared");
const databaseUrl = process.env.DATABASE_URL;
// A missing database is allowed during local gameplay development. Render gets
// DATABASE_URL as a secret, never as a value committed to the repository.
const sql = databaseUrl
    ? (0, postgres_1.default)(databaseUrl, { max: 3, idle_timeout: 20 })
    : null;
async function getDatabaseStatus() {
    if (!sql)
        return "not_configured";
    try {
        await sql `select 1`;
        return "connected";
    }
    catch (error) {
        console.error("Database health check failed", error);
        return "unavailable";
    }
}
function nextUtcDayIso() {
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    return next.toISOString();
}
async function upsertPlayer(deviceId, displayName) {
    if (!sql)
        return null;
    try {
        const [player] = await sql `
      insert into public.players (id, display_name, last_seen_at)
      values (${deviceId}, ${displayName}, now())
      on conflict (id) do update
      set display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
      returning stars
    `;
        return player?.stars ?? 0;
    }
    catch (error) {
        // Persistence must never prevent a player from joining a live game.
        console.error("Could not persist player profile", error);
        return null;
    }
}
async function getPlayerStars(deviceId) {
    if (!sql)
        return null;
    try {
        const [player] = await sql `
      select stars
      from public.players
      where id = ${deviceId}
    `;
        return player?.stars ?? 0;
    }
    catch (error) {
        console.error("Could not load player stars", error);
        return null;
    }
}
async function getDailyRewardStatus(deviceId) {
    if (!sql)
        return null;
    try {
        const [player] = await sql `
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
                ? Math.min(shared_1.DAILY_REWARD_MAX_STREAK_DAY, lastStreakDay + 1)
                : 1;
        return {
            stars: player?.stars ?? 0,
            available: !player?.claimed_today,
            amount: player?.claimed_today ? (player.last_amount ?? (0, shared_1.getDailyStarReward)(streakDay)) : (0, shared_1.getDailyStarReward)(streakDay),
            streakDay,
            nextClaimAt: nextUtcDayIso(),
        };
    }
    catch (error) {
        console.error("Could not load daily reward status", error);
        return null;
    }
}
async function claimDailyReward(deviceId, displayName) {
    if (!sql)
        return null;
    try {
        return await sql.begin(async (transaction) => {
            await transaction `
        insert into public.players (id, display_name, last_seen_at)
        values (${deviceId}, ${displayName || "Player"}, now())
        on conflict (id) do update set last_seen_at = excluded.last_seen_at
      `;
            await transaction `select id from public.players where id = ${deviceId} for update`;
            const [lastClaim] = await transaction `
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
                const [player] = await transaction `
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
                ? Math.min(shared_1.DAILY_REWARD_MAX_STREAK_DAY, lastClaim.streak_day + 1)
                : 1;
            const rewardAmount = (0, shared_1.getDailyStarReward)(streakDay);
            const inserted = await transaction `
        insert into public.star_transactions (
          id, player_id, amount, reason, reward_day, reward_streak_day
        ) values (
          ${(0, crypto_1.randomUUID)()}, ${deviceId}, ${rewardAmount}, 'daily_claim',
          (now() at time zone 'UTC')::date, ${streakDay}
        )
        on conflict do nothing
        returning id
      `;
            if (inserted.length > 0) {
                await transaction `
          update public.players set stars = stars + ${rewardAmount} where id = ${deviceId}
        `;
            }
            const [player] = await transaction `
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
    }
    catch (error) {
        console.error("Could not claim daily reward", error);
        return null;
    }
}
async function saveCompletedMatch(match) {
    const progressUpdates = new Map();
    if (!sql || match.players.length === 0)
        return progressUpdates;
    try {
        await sql.begin(async (transaction) => {
            const insertedMatches = await transaction `
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
            if (insertedMatches.length === 0)
                return;
            for (const player of match.players) {
                await transaction `
          insert into public.players (id, display_name, last_seen_at)
          values (${player.deviceId}, ${player.displayName}, now())
          on conflict (id) do update
          set display_name = excluded.display_name,
              last_seen_at = excluded.last_seen_at
        `;
                await transaction `
          insert into public.match_players (
            match_id, player_id, display_name, final_score, final_rank
          ) values (
            ${match.id}, ${player.deviceId}, ${player.displayName},
            ${player.finalScore}, ${player.finalRank}
          )
        `;
                await transaction `
          update public.players
          set games_played = games_played + 1,
              wins = wins + ${player.finalRank === 1 ? 1 : 0}
          where id = ${player.deviceId}
        `;
                // Serialize currency decisions per player so two matches finishing at
                // the same time cannot both claim the fifth daily reward slot.
                await transaction `
          select id from public.players where id = ${player.deviceId} for update
        `;
                const [dailyCount] = await transaction `
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
                    const insertedRewards = await transaction `
            insert into public.star_transactions (
              id, player_id, amount, reason, source_match_id
            ) values (
              ${(0, crypto_1.randomUUID)()}, ${player.deviceId}, 10, 'game_completion', ${match.id}
            )
            on conflict (player_id, reason, source_match_id) do nothing
            returning id
          `;
                    if (insertedRewards.length > 0) {
                        starsEarned = 10;
                        rewardedGamesToday += 1;
                        await transaction `
              update public.players set stars = stars + 10 where id = ${player.deviceId}
            `;
                    }
                }
                const [updatedPlayer] = await transaction `
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
    }
    catch (error) {
        // Final results remain valid in-room even when persistence is unavailable.
        console.error("Could not persist completed match", error);
    }
    return progressUpdates;
}
