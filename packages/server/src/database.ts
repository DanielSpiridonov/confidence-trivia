import postgres from "postgres";
import { randomUUID } from "crypto";

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
