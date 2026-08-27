"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseStatus = getDatabaseStatus;
exports.upsertPlayer = upsertPlayer;
exports.getPlayerStars = getPlayerStars;
exports.saveCompletedMatch = saveCompletedMatch;
const postgres_1 = __importDefault(require("postgres"));
const crypto_1 = require("crypto");
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
