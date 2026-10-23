import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import express from "express";
import { ENDLESS_PROTOCOL_VERSION } from "@confidence-trivia/shared";

const require = createRequire(import.meta.url);
const auth = require("../dist/auth.js");
const db = require("../dist/database.js");
const service = require("../dist/endless.js");
const logging = require("../dist/logging.js");
const originals = [auth.verifySupabaseIdentity, db.isAuthenticatedPlayer, service.endlessAction, service.endlessLeaderboard, logging.logServerError];
const playerId = randomUUID(), userId = randomUUID();
let server, url, lastAction, fail = false;
before(async () => {
  auth.verifySupabaseIdentity = async (header) => header === "Bearer valid" ? { userId } : null;
  db.isAuthenticatedPlayer = async (player, user) => player === playerId && user === userId;
  service.endlessAction = async (player, user, command) => { if (player !== playerId || user !== userId) throw new service.EndlessError(403, "This account cannot access Endless."); if (fail) throw new Error("private database detail"); lastAction = { player, user, command }; return { protocolVersion: ENDLESS_PROTOCOL_VERSION, run: null, personalBest: 0, claimed: [], stars: 0, serverNow: 123 }; };
  service.endlessLeaderboard = async () => ({ top: [], currentPlayer: null });
  logging.logServerError = () => {};
  const { endlessRouter } = require("../dist/endlessRoutes.js");
  const app = express(); app.use(express.json()); app.use("/endless", endlessRouter);
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  url = `http://127.0.0.1:${server.address().port}/endless`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  [auth.verifySupabaseIdentity, db.isAuthenticatedPlayer, service.endlessAction, service.endlessLeaderboard, logging.logServerError] = originals;
});
const request = (path = "state", options = {}, id = playerId) => fetch(`${url}/${path}?playerId=${id}`, { ...options, headers: { Authorization: "Bearer valid", "Content-Type": "application/json", ...options.headers } });

test("HTTP endpoints reject missing or invalid Supabase authorization", async () => {
  for (const token of ["", "Bearer invalid"]) assert.equal((await request("state", { headers: { Authorization: token } })).status, 401);
});
test("HTTP endpoints reject another player's identity", async () => {
  assert.equal((await request("state", {}, randomUUID())).status, 403);
  assert.equal((await request("leaderboard", {}, randomUUID())).status, 403);
});
test("state requests use verified identity, sync the run, and disable caching", async () => {
  const response = await request(); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); assert.deepEqual(lastAction, { player: playerId, user: userId, command: { type: "sync" } });
  const state = await response.json();
  assert.equal(state.personalBest, 0); assert.equal(state.protocolVersion, ENDLESS_PROTOCOL_VERSION);
  assert.equal(response.headers.get("X-Endless-Protocol"), String(ENDLESS_PROTOCOL_VERSION));
});

test("API compatibility headers are also present on rejected requests", async () => {
  const response = await request("state", { headers: { Authorization: "" } });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("X-Endless-Protocol"), String(ENDLESS_PROTOCOL_VERSION));
});
test("HTTP actions reject invalid answer indices and malformed tokens", async () => {
  for (const body of [{ type: "answer", runId: randomUUID(), token: randomUUID(), answer: 99 }, { type: "next", runId: "invalid", token: randomUUID() }]) assert.equal((await request("action", { method: "POST", body: JSON.stringify(body) })).status, 400);
});
test("HTTP actions discard client supplied score, reward, lives, and timestamps", async () => {
  const command = { type: "answer", runId: randomUUID(), token: randomUUID(), answer: 2 };
  const response = await request("action", { method: "POST", body: JSON.stringify({ ...command, score: 99999, lives: 99, stars: 999999, timestamp: 0 }) });
  assert.equal(response.status, 200); assert.deepEqual(lastAction.command, command);
});

test("heartbeat and abandon validate the run ID and discard client connection deadlines", async () => {
  for (const type of ["heartbeat", "abandon"]) {
    const command = { type, runId: randomUUID() };
    const response = await request("action", { method: "POST", body: JSON.stringify({ ...command, connectionDeadline: Number.MAX_SAFE_INTEGER, timestamp: 0 }) });
    assert.equal(response.status, 200); assert.deepEqual(lastAction.command, command);
    assert.equal((await request("action", { method: "POST", body: JSON.stringify({ type, runId: "invalid" }) })).status, 400);
  }
});
test("HTTP backend failures remain recoverable and hide internal database messages", async () => {
  fail = true;
  try { const response = await request(); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes("private database detail")); } finally { fail = false; }
});
test("Endless HTTP leaderboard remains a separate authenticated category", async () => {
  const response = await request("leaderboard"); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { top: [], currentPlayer: null });
});
