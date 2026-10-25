import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

async function loadMobile(path, mocks, globals = {}) {
  const source = await readFile(new URL(`../../mobile/${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => mocks(name), setTimeout, clearTimeout, ...globals });
  return exports;
}

test("native socket errors keep useful diagnostics and preserve normal transport events", async () => {
  class BaseTransport { constructor(events) { this.events = events; } }
  const { WebSocketTransport, normalizeSocketError } = await loadMobile("src/network/colyseusWebSocketTransport.ts", () => ({ WebSocketTransport: BaseTransport }));
  const normalized = normalizeSocketError({ nativeEvent: { message: "Connection refused" } });
  assert.equal(normalized.code, 1006);
  assert.equal(normalized.reason, "Connection refused");
  assert.equal(normalizeSocketError({ code: 401, reason: "Not authorized" }).code, 401);
  assert.ok(normalizeSocketError({}).reason.length > 0);
  let received;
  const message = () => {};
  const events = { onmessage: message };
  const transport = new WebSocketTransport(events);
  events.onerror = error => { received = error; }; // Room installs handlers after construction.
  transport.events.onerror({ message: "Socket closed" });
  assert.equal(received.reason, "Socket closed");
  assert.equal(transport.events.onmessage, message);
});

test("combat warming requests only selected fighters, with bases before effects", async () => {
  const ids = new Map();
  const assets = await loadMobile("src/components/combatAssets.ts", name => {
    if (!ids.has(name)) ids.set(name, ids.size + 1);
    return ids.get(name);
  });
  const sources = [...assets.combatImagesForPlayers([{ avatarId: "clever_fox" }, { avatarId: "quiz_bot" }])];
  assert.equal(sources.length, 6);
  assert.deepEqual(sources.slice(0, 2), [assets.DAMAGE_AVATARS.clever_fox, assets.DAMAGE_AVATARS.quiz_bot]);
  assert.ok(!sources.includes(assets.DAMAGE_AVATARS.smart_owl));
  assert.equal(assets.combatImagesForPlayers([{ avatarId: "clever_fox" }, { avatarId: "clever_fox" }]).length, 3);
  assert.equal(assets.combatImagesForPlayers([{ avatarId: "unknown" }])[0], assets.DAMAGE_AVATARS.smart_owl);
});

test("image warming bounds concurrent requests, deduplicates and retries failed downloads", async () => {
  const calls = [];
  const waiting = [];
  const cache = await loadMobile("src/utils/warmImageSources.ts", () => ({ Image: {
    resolveAssetSource: source => ({ uri: `asset:${source}` }),
    prefetch: uri => { calls.push(uri); return new Promise(resolve => waiting.push(resolve)); },
  } }), { setTimeout: callback => { queueMicrotask(callback); return 0; } });
  cache.warmImageSources([1, 2, 3, 1]);
  cache.warmImageSources([1, 2]);
  assert.deepEqual(calls, ["asset:1", "asset:2"]);
  waiting.shift()(true);
  await new Promise(setImmediate);
  assert.deepEqual(calls, ["asset:1", "asset:2", "asset:3"]);
  waiting.shift()(false);
  await new Promise(setImmediate);
  assert.deepEqual(calls, ["asset:1", "asset:2", "asset:3", "asset:2"]);
  waiting.shift()(true);
  waiting.shift()(true);
  await new Promise(setImmediate);
  cache.warmImageSources([1, 2, 3]);
  assert.equal(calls.length, 4);
});

test("ordering responders survive rerenders and use the latest callbacks and scale", async () => {
  const source = await readFile(new URL("../../mobile/src/screens/QuestionScreen.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("QuestionScreen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let method;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "getCardPanResponder") method = node.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(method);
  const { outputText } = ts.transpileModule(method, { compilerOptions: { target: ts.ScriptTarget.ES2020 } });
  const calls = [];
  let created = 0;
  const context = vm.createContext({
    cardScales: { current: new Map() }, cardResponders: { current: new Map() },
    lockedRef: { current: false }, draggingCardIndexRef: { current: 0 },
    dragDelta: { current: {} }, dragPreparation: { current: null },
    dragActions: { current: { beginDrag: () => {} } },
    PanResponder: { create: handlers => { created++; return { panHandlers: handlers }; } },
  });
  vm.runInContext(`${outputText}\nthis.getResponder = getCardPanResponder;`, context);
  const first = context.getResponder(0, 1);
  // Simulate a rerender while the finger is down.
  vm.runInContext(`${outputText}\nthis.getResponder = getCardPanResponder;`, context);
  context.dragActions.current = { beginDrag: (...args) => calls.push(args), moveDrag: (...args) => calls.push(args), finishDrag: (...args) => calls.push(args) };
  assert.equal(context.getResponder(0, 0.8), first);
  assert.equal(created, 1);
  first.panHandlers.onPanResponderGrant();
  first.panHandlers.onPanResponderMove(null, { dx: 40, dy: 10 });
  first.panHandlers.onPanResponderRelease(null, { dx: 40, dy: 10 });
  assert.deepEqual(calls, [[0, 0.8], [40, 10], [0, 40, 10]]);
  assert.equal(first.panHandlers.onPanResponderTerminationRequest(), false);
  context.lockedRef.current = true;
  assert.equal(first.panHandlers.onStartShouldSetPanResponder(), false);
});
