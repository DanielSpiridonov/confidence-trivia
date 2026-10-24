import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCreateOptions } from "../dist/rooms/options.js";
import { DEFAULT_ROUND_COUNT } from "@confidence-trivia/shared";

test("untrusted round counts cannot trigger unbounded question generation", () => {
  for (const roundCount of [Infinity, NaN, 1e9, -1, 0, 1.5, "999999999", {}, []]) {
    assert.equal(normalizeCreateOptions({ roundCount }).roundCount, DEFAULT_ROUND_COUNT);
  }
  for (const roundCount of [3, 5, 7, 9, 11, 13, 15]) {
    assert.equal(normalizeCreateOptions({ roundCount }).roundCount, roundCount);
  }
});

test("malformed room payloads and collections safely fall back", () => {
  for (const value of [null, false, 5, [], "options", { customQuestions: {}, excludeQuestionIds: {}, friendCategories: {} }]) {
    assert.doesNotThrow(() => normalizeCreateOptions(value));
  }
  const options = normalizeCreateOptions({
    customQuestions: [null, 1, {}, { question: "Valid", answer: "Yes" }],
    excludeQuestionIds: [1, null, "q1"], locale: "unknown", gameMode: "unknown",
  });
  assert.deepEqual(options.customQuestions, [{ question: "Valid", answer: "Yes" }]);
  assert.deepEqual(options.excludeQuestionIds, ["q1"]);
  assert.equal(options.locale, "en");
  assert.equal(options.gameMode, "classic");
});

test("room lists and custom question text are bounded", () => {
  const options = normalizeCreateOptions({
    customQuestions: Array(100).fill({ question: "q".repeat(1000), answer: "a".repeat(1000) }),
    friendCategories: Array(100).fill("science"), excludeQuestionIds: Array(1000).fill("q1"),
  });
  assert.equal(options.customQuestions.length, 10);
  assert.equal(options.customQuestions[0].question.length, 160);
  assert.equal(options.customQuestions[0].answer.length, 48);
  assert.equal(options.friendCategories.length, 20);
  assert.equal(options.excludeQuestionIds.length, 500);
});
