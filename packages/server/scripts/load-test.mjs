import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Client } from "colyseus.js";

const endpoint = process.env.LOAD_TEST_URL ?? "ws://127.0.0.1:2567";
const roomCount = Number(process.env.LOAD_TEST_ROOMS ?? 10);
const botsPerRoom = Number(process.env.LOAD_TEST_BOTS_PER_ROOM ?? 10);
const rounds = Number(process.env.LOAD_TEST_ROUNDS ?? 3);
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 120_000);
const rooms = [];
const metrics = { actions: 0, errors: [], completedRooms: 0, peakConnected: 0 };

function answerFor(question) {
  const options = [...(question?.options ?? [])];
  if (question?.qType === "ordering") return options.map((_, index) => index);
  if (["estimate", "closest_answer"].includes(question?.qType)) return 1;
  return options[0] ?? "load-test";
}

function drive(room) {
  let lastAction = "";
  room.onStateChange((state) => {
    metrics.peakConnected = Math.max(metrics.peakConnected, state.players.size);
    const key = `${state.currentRoundIndex}:${state.phase}`;
    if (key === lastAction) return;
    lastAction = key;
    if (state.phase === "question") room.send("submitAnswer", { value: answerFor(state.currentQuestion) });
    else if (state.phase === "confidence") room.send("submitConfidence", { value: 1 });
    else if (state.phase === "board_sidebet") room.send("skipSideBet");
    else return;
    metrics.actions += 1;
  });
}

async function waitForPlayerCount(room, expected, waitMs = 10_000) {
  const deadline = Date.now() + waitMs;
  while (room.state.players.size !== expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function createLobby(lobbyIndex) {
  const client = new Client(endpoint);
  const host = await client.create("confidence_trivia", { deviceId: randomUUID(), name: `Bot ${lobbyIndex} 0`, roundCount: rounds, locale: "en", gameMode: "classic", visibility: "private" });
  drive(host);
  const guests = await Promise.all(Array.from({ length: botsPerRoom - 1 }, async (_, index) => {
    const guest = await new Client(endpoint).joinById(host.roomId, { deviceId: randomUUID(), name: `Bot ${lobbyIndex} ${index + 1}` });
    drive(guest); return guest;
  }));
  const all = [host, ...guests];
  await waitForPlayerCount(host, botsPerRoom);
  if (host.state.players.size !== botsPerRoom) throw new Error(`Lobby ${lobbyIndex} expected ${botsPerRoom} players, got ${host.state.players.size}`);
  host.send("startGame");
  rooms.push(all);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Lobby ${lobbyIndex} timed out in phase ${host.state.phase}`)), timeoutMs);
    host.onStateChange((state) => {
      if (!state.gameEnded) return;
      clearTimeout(timer); metrics.completedRooms += 1; resolve();
    });
  });
}

const started = performance.now();
try {
  await Promise.all(Array.from({ length: roomCount }, (_, index) => createLobby(index)));
} catch (error) {
  metrics.errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await Promise.allSettled(rooms.flat().map((room) => room.leave(true)));
}
const elapsedMs = Math.round(performance.now() - started);
const report = { endpoint, requestedPlayers: roomCount * botsPerRoom, roomCount, botsPerRoom, rounds, elapsedMs, ...metrics, passed: metrics.errors.length === 0 && metrics.completedRooms === roomCount };
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
