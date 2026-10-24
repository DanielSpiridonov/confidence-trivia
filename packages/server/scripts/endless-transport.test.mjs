import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import { ENDLESS_PROTOCOL_VERSION } from "@confidence-trivia/shared";

const require = createRequire(import.meta.url);
async function mobileModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  new Function("require", "exports", outputText)(require, exports);
  return exports;
}
const { createEndlessTransport, EndlessRequestError } = await mobileModule("../../mobile/src/network/endlessTransport.ts");
const { createEndlessCache } = await mobileModule("../../mobile/src/network/endlessCache.ts");
const snapshot = (overrides = {}) => ({ protocolVersion: ENDLESS_PROTOCOL_VERSION, serverNow: 100, personalBest: 25, claimed: [10,25], stars: 125, run: null, ...overrides });
const response = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", ...headers } });
const transport = (fetch, options = {}) => createEndlessTransport({ baseUrl: "http://endless.test", getAccessToken: async () => "valid", fetch, ...options });
const isFailure = (kind) => (error) => error instanceof EndlessRequestError && error.kind === kind;

test("legacy state is rejected before Start, heartbeat or abandon can be sent", async () => {
  const calls = [];
  const client = transport(async (url, options) => {
    calls.push({ url, method: options.method });
    const legacy = snapshot(); delete legacy.protocolVersion;
    return response(legacy);
  });
  await assert.rejects(async () => {
    await client.state("player");
    await client.action("player", { type: "start", requestId: "new" });
  }, isFailure("protocol"));
  assert.equal(calls.length, 1); assert.equal(calls[0].method, "GET");
});

test("incompatible reads never enter the cache and a fresh retry recovers after server update", async () => {
  let updated = false; const calls = []; const cache = createEndlessCache(() => 0);
  const client = transport(async (url, options) => {
    calls.push(options.method);
    if (!updated) { const legacy = snapshot(); delete legacy.protocolVersion; return response(legacy); }
    return response(snapshot());
  });
  const read = () => cache.read("player", () => client.state("player"));
  await assert.rejects(read(), isFailure("protocol")); assert.equal(cache.peek("player"), null);
  updated = true; await read();
  assert.equal(cache.peek("player").personalBest, 25); assert.deepEqual(calls, ["GET", "GET"]);
});

test("an old API rejecting heartbeat/abandon is a compatibility failure, not lost connectivity", async () => {
  for (const type of ["heartbeat", "abandon"]) {
    const client = transport(async () => response({ error: "Invalid Endless action." }, 400));
    await assert.rejects(client.action("player", { type, runId: "run" }), isFailure("protocol"));
    // A retry reads state; it does not repeat the rejected action.
  }
});

test("a rejected abandon does not poison a subsequent state-only retry", async () => {
  let first = true; const calls = [];
  const client = transport(async (url, options) => {
    calls.push(options.method);
    if (first) { first = false; return response({ error: "Invalid Endless action." }, 400); }
    return response(snapshot());
  });
  await assert.rejects(client.action("player", { type: "abandon", runId: "old" }), isFailure("protocol"));
  assert.equal((await client.state("player")).protocolVersion, ENDLESS_PROTOCOL_VERSION);
  assert.deepEqual(calls, ["POST", "GET"]);
});

test("a matching server rejecting an action preserves the invalid-action error", async () => {
  const client = transport(async () => response({ error: "Invalid Endless action." }, 400, { "X-Endless-Protocol": String(ENDLESS_PROTOCOL_VERSION) }));
  await assert.rejects(client.action("player", { type: "heartbeat", runId: "bad" }), isFailure("invalid-action"));
});

test("missing active-run connection deadlines are rejected without fabricating a timeout", async () => {
  const client = transport(async () => response(snapshot({ run: { id: "run", phase: "question", lives: 3 } })));
  await assert.rejects(client.state("player"), isFailure("protocol"));
});

test("a compatible state with an active connection deadline passes through unchanged", async () => {
  const expected = snapshot({ run: { id: "run", phase: "question", connectionDeadline: 10100, lives: 3 } });
  const client = transport(async () => response(expected));
  assert.deepEqual(await client.state("player"), expected);
});

test("auth errors stay auth errors and cannot trigger a reconnect loop", async () => {
  for (const status of [401,403]) {
    const client = transport(async () => response({ error: "Please sign in again." }, status));
    await assert.rejects(client.state("player"), isFailure("auth"));
  }
  let calls = 0;
  const client = transport(async () => { calls++; }, { getAccessToken: async () => null });
  await assert.rejects(client.state("player"), isFailure("auth")); assert.equal(calls, 0);
});

test("offline failures recover with a fresh read and no hidden action retries", async () => {
  let offline = true; let calls = 0;
  const client = transport(async () => { calls++; if (offline) throw new TypeError("Network request failed"); return response(snapshot()); });
  await assert.rejects(client.state("player"), isFailure("connection"));
  offline = false; assert.equal((await client.state("player")).personalBest, 25); assert.equal(calls, 2);
});

test("heartbeat aborts are retryable connection errors", async () => {
  const client = transport(async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })), { heartbeatTimeoutMs: 5 });
  await assert.rejects(client.action("player", { type: "heartbeat", runId: "run" }), isFailure("connection"));
});

test("non-JSON backend failures are server failures and leaderboard responses need no run handshake", async () => {
  const failed = transport(async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(failed.state("player"), isFailure("server"));
  const board = { top: [], currentPlayer: null };
  assert.deepEqual(await transport(async () => response(board)).leaderboard("player"), board);
});
