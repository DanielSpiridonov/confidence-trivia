import { randomUUID } from "node:crypto";
import { Client } from "colyseus.js";

const endpoint = process.env.LOAD_TEST_URL ?? "ws://127.0.0.1:2567";
const playerCount = Number(process.env.RANKED_TEST_PLAYERS ?? 8);
const clients = Array.from({ length: playerCount }, () => new Client(endpoint));
const rooms = [];
const deadline = Date.now() + 20_000;
try {
  const joined = await Promise.all(clients.map((client, index) => client.joinOrCreate("confidence_trivia", { gameMode: "ranked", deviceId: randomUUID(), name: `Ranked Bot ${index}`, accessToken: "test" })));
  rooms.push(...joined);
  while (joined.some((room) => !room.state.gameStarted) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  const grouped = new Map();
  for (const room of joined) grouped.set(room.roomId, room.state.players.size);
  const result = { requestedPlayers: playerCount, matches: [...grouped.entries()].map(([roomId, players]) => ({ roomId, players })), allStarted: joined.every((room) => room.state.gameStarted), passed: grouped.size === playerCount / 4 && [...grouped.values()].every((size) => size === 4) && joined.every((room) => room.state.gameStarted) };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  await Promise.allSettled(rooms.map((room) => room.leave(true)));
}
