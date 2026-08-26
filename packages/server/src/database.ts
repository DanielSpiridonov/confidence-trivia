import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

// A missing database is allowed during local gameplay development. Render gets
// DATABASE_URL as a secret, never as a value committed to the repository.
const sql = databaseUrl
  ? postgres(databaseUrl, { max: 3, idle_timeout: 20 })
  : null;

export async function upsertPlayer(deviceId: string, displayName: string): Promise<void> {
  if (!sql) return;

  try {
    await sql`
      insert into public.players (id, display_name, last_seen_at)
      values (${deviceId}, ${displayName}, now())
      on conflict (id) do update
      set display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
    `;
  } catch (error) {
    // Persistence must never prevent a player from joining a live game.
    console.error("Could not persist player profile", error);
  }
}
