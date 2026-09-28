import { randomUUID } from "node:crypto";
import { Client } from "colyseus.js";

const endpoint = process.env.LOAD_TEST_URL ?? "ws://127.0.0.1:2567";
const playerCount = Number(process.env.RELIABILITY_PLAYERS ?? 8);
const rounds = Number(process.env.RELIABILITY_ROUNDS ?? 2);
const gameMode = process.env.RELIABILITY_MODE === "friends" ? "friends" : "classic";
const timeoutMs = Number(process.env.RELIABILITY_TIMEOUT_MS ?? 90_000);
const rooms = [];
const errors = [];
const revealCounts = new Map();

function answerFor(question) {
  const options = [...(question?.options ?? [])];
  if (question?.qType === "ordering") return options.map((_, index) => index);
  if (["estimate", "closest_answer"].includes(question?.qType)) return 1;
  return options[0] ?? "duplicate-test";
}

function drive(room) {
  const acted = new Set();
  room.onStateChange((state) => {
    const key = `${state.currentRoundIndex}:${state.phase}`;
    if (acted.has(key)) return;
    acted.add(key);
    if (state.phase === "question") {
      const value = answerFor(state.currentQuestion);
      for (let index = 0; index < 12; index += 1) room.send("submitAnswer", { value });
    } else if (state.phase === "confidence") {
      for (let index = 0; index < 12; index += 1) room.send("submitConfidence", { value: index % 2 ? 1 : 3 });
    } else if (state.phase === "board_sidebet") {
      for (let index = 0; index < 12; index += 1) room.send("skipSideBet");
    } else if (state.phase === "reveal") {
      const count = state.revealResults.length;
      revealCounts.set(state.currentRoundIndex, count);
      if (count !== playerCount) errors.push(`Round ${state.currentRoundIndex} produced ${count} results for ${playerCount} players`);
      const ids = [...state.revealResults].map((result) => result.playerId);
      if (new Set(ids).size !== ids.length) errors.push(`Round ${state.currentRoundIndex} contains duplicate reveal rows`);
    }
  });
}

async function waitFor(condition, message, waitMs = timeoutMs) {
  const deadline = Date.now() + waitMs;
  while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  if (!condition()) throw new Error(message());
}

try {
  const host = await new Client(endpoint).create("confidence_trivia", {
    deviceId: randomUUID(), name: "Reliability Host", roundCount: rounds, locale: "en", gameMode, visibility: "private",
    friendsTeamMode: gameMode === "friends" ? "duos" : undefined,
    friendCategories: gameMode === "friends" ? ["science", "history"] : undefined,
    customQuestions: gameMode === "friends" ? [{ question: "Type reliability", answer: "reliability" }] : undefined,
  });
  rooms.push(host); drive(host);
  for (let index = 1; index < playerCount; index += 1) {
    const guest = await new Client(endpoint).joinById(host.roomId, { deviceId: randomUUID(), name: `Reliability ${index}` });
    rooms.push(guest); drive(guest);
  }
  await waitFor(() => host.state.players.size === playerCount, () => `Expected ${playerCount} players, received ${host.state.players.size}`);
  if (gameMode === "friends") {
    const teams = [...host.state.players.values()].reduce((counts, player) => ({ ...counts, [player.team]: (counts[player.team] ?? 0) + 1 }), {});
    if (teams.A !== playerCount / 2 || teams.B !== playerCount / 2) errors.push(`Unbalanced Duos assignment: ${JSON.stringify(teams)}`);
  }
  host.send("startGame");
  await waitFor(() => host.state.gameEnded, () => `Timed out in ${host.state.phase}`);
  if (revealCounts.size !== rounds) errors.push(`Expected ${rounds} reveal phases, observed ${revealCounts.size}`);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
} finally {
  await Promise.allSettled(rooms.map((room) => room.leave(true)));
}

const report = { gameMode, playerCount, rounds, duplicateMessagesPerAction: 12, revealCounts: Object.fromEntries(revealCounts), errors, passed: errors.length === 0 };
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
