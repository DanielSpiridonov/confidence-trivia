import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, validateQuestionBank } from "../dist/content/questions.js";

test("question bank has valid ids, translations, options, answers, and points", () => {
  assert.equal(QUESTIONS.length, 159);
  assert.doesNotThrow(() => validateQuestionBank());
});

test("question bank contains at least 50 questions at each difficulty", () => {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const question of QUESTIONS) counts[question.difficulty] += 1;
  assert.ok(counts.easy >= 50);
  assert.ok(counts.medium >= 50);
  assert.ok(counts.hard >= 50);
});
