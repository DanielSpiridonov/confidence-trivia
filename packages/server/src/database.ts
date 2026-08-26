import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

// A missing database is allowed during local gameplay development. Render gets
// DATABASE_URL as a secret, never as a value committed to the repository.
const sql = databaseUrl
  ? postgres(databaseUrl, { max: 3, idle_timeout: 20 })
  : null;

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

export async function upsertPlayer(deviceId: string, displayName: string): Promise<number | null> {
  if (!sql) return null;

  try {
    const [player] = await sql<{ total_points: number }[]>`
      insert into public.players (id, display_name, last_seen_at)
      values (${deviceId}, ${displayName}, now())
      on conflict (id) do update
      set display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
      returning total_points
    `;
    return player?.total_points ?? 0;
  } catch (error) {
    // Persistence must never prevent a player from joining a live game.
    console.error("Could not persist player profile", error);
    return null;
  }
}

export async function saveCompletedMatch(match: CompletedMatch): Promise<Map<string, number>> {
  const lifetimePoints = new Map<string, number>();
  if (!sql || match.players.length === 0) return lifetimePoints;

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

        const [updatedPlayer] = await transaction<{ total_points: number }[]>`
          update public.players
          set total_points = total_points + ${player.finalScore},
              games_played = games_played + 1,
              wins = wins + ${player.finalRank === 1 ? 1 : 0}
          where id = ${player.deviceId}
          returning total_points
        `;
        if (updatedPlayer) lifetimePoints.set(player.deviceId, updatedPlayer.total_points);
      }
    });
  } catch (error) {
    // Final results remain valid in-room even when persistence is unavailable.
    console.error("Could not persist completed match", error);
  }

  return lifetimePoints;
}
