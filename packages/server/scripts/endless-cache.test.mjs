import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../../mobile/src/network/endlessCache.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { createEndlessCache } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const state = (serverNow = 100, personalBest = 10) => ({ serverNow, personalBest, stars: 20, claimed: [10], run: null });

test("Endless cache never shares account snapshots", () => {
  const cache = createEndlessCache(() => 0);
  cache.remember("a", state()); assert.equal(cache.peek("a").personalBest, 10); assert.equal(cache.peek("b"), null);
});
test("home prefetch and menu refresh share one in-flight read", async () => {
  const cache = createEndlessCache(() => 0); let calls = 0; let resolve;
  const load = () => { calls++; return new Promise((done) => { resolve = done; }); };
  const prefetch = cache.read("a", load); const refresh = cache.read("a", load);
  assert.equal(prefetch, refresh); assert.equal(calls, 1); resolve(state()); await refresh;
  assert.equal(cache.peek("a").personalBest, 10);
});
test("old background responses cannot replace newer verified run progress", async () => {
  const cache = createEndlessCache(() => 0); let resolve;
  const read = cache.read("a", () => new Promise((done) => { resolve = done; }));
  cache.remember("a", state(200, 25)); resolve(state(100, 10)); await read;
  assert.equal(cache.peek("a").personalBest, 25);
});
test("failed prefetch can be retried without caching a false personal best", async () => {
  const cache = createEndlessCache(() => 0);
  await assert.rejects(cache.read("a", async () => { throw new Error("offline"); }), /offline/);
  assert.equal(cache.peek("a"), null);
  await cache.read("a", async () => state()); assert.equal(cache.peek("a").personalBest, 10);
});
test("cached display clocks advance without changing server snapshots or scores", () => {
  let clock = 1000; const cache = createEndlessCache(() => clock); const original = state(); cache.remember("a", original);
  clock += 5000; assert.equal(cache.peek("a").serverNow, 5100); assert.equal(original.serverNow, 100);
  assert.equal(cache.peek("a").personalBest, 10); assert.equal(cache.peek("a").stars, 20);
});
