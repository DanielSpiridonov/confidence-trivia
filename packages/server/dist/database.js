"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertPlayer = upsertPlayer;
const postgres_1 = __importDefault(require("postgres"));
const databaseUrl = process.env.DATABASE_URL;
// A missing database is allowed during local gameplay development. Render gets
// DATABASE_URL as a secret, never as a value committed to the repository.
const sql = databaseUrl
    ? (0, postgres_1.default)(databaseUrl, { max: 3, idle_timeout: 20 })
    : null;
async function upsertPlayer(deviceId, displayName) {
    if (!sql)
        return;
    try {
        await sql `
      insert into public.players (id, display_name, last_seen_at)
      values (${deviceId}, ${displayName}, now())
      on conflict (id) do update
      set display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
    `;
    }
    catch (error) {
        // Persistence must never prevent a player from joining a live game.
        console.error("Could not persist player profile", error);
    }
}
