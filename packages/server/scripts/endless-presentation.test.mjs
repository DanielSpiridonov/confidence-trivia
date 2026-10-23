import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Exercise the same pure presentation decisions used by the mobile screen.
// Transpile type-only imports without requiring a native React test runtime.
const source = await readFile(new URL("../../mobile/src/components/endlessPresentation.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { getEndlessOptionState, getEndlessOutcome } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const feedback = (overrides = {}) => ({ correctIndex: 1, selectedIndex: 0, correct: false, timedOut: false, readyAt: 1600, ...overrides });

test("wrong answers get an explicit life-loss outcome and a failure icon", () => {
  const result = getEndlessOutcome(feedback());
  assert.equal(result.kind, "wrong"); assert.equal(result.title, "Incorrect · −1 life"); assert.equal(result.icon, "close-circle");
});
test("revealing the right option never marks the player's wrong response as successful", () => {
  for (let correctIndex = 0; correctIndex < 4; correctIndex++) {
    for (let selectedIndex = 0; selectedIndex < 4; selectedIndex++) {
      if (correctIndex === selectedIndex) continue;
      const result = feedback({ correctIndex, selectedIndex });
      assert.equal(getEndlessOptionState(selectedIndex, null, result), "wrong");
      assert.equal(getEndlessOptionState(correctIndex, null, result), "revealed");
      assert.ok(![0,1,2,3].some((i) => getEndlessOptionState(i, null, result) === "correct"));
    }
  }
});
test("timeouts show a clock and a lost life, with a neutral answer reveal", () => {
  const result = feedback({ timedOut: true, selectedIndex: null });
  assert.equal(getEndlessOutcome(result).kind, "timeout"); assert.equal(getEndlessOutcome(result).icon, "time-outline");
  assert.equal(getEndlessOutcome(result).title, "Time’s up · −1 life");
  assert.equal(getEndlessOptionState(1, null, result), "revealed");
  assert.ok(![0,1,2,3].some((i) => getEndlessOptionState(i, null, result) === "correct"));
});
test("a confirmed correct answer alone gets the success treatment and point award", () => {
  const result = feedback({ correct: true, selectedIndex: 1 });
  assert.equal(getEndlessOutcome(result).title, "Correct · +1 point"); assert.equal(getEndlessOutcome(result).icon, "checkmark-circle");
  assert.equal(getEndlessOptionState(1, null, result), "correct"); assert.equal(getEndlessOptionState(0, null, result), "muted");
});
test("an unanswered question shows no outcome or suggested correct option", () => {
  assert.equal(getEndlessOutcome(null), null);
  for (let i=0; i<4; i++) assert.equal(getEndlessOptionState(i, null, null), "idle");
});
test("pending answers lock immediately without predicting correctness", () => {
  for (let i=0; i<4; i++) assert.equal(getEndlessOptionState(i, 2, null), i === 2 ? "pending" : "muted");
});
test("server feedback overrides a stale local selection", () => {
  const result = feedback();
  assert.equal(getEndlessOptionState(0, 1, result), "wrong"); assert.equal(getEndlessOptionState(1, 1, result), "revealed");
});
