import test from "node:test";
import { ADDITIONAL_QUESTIONS } from "../dist/content/additionalQuestions.js";
import assert from "node:assert/strict";
import { QUESTIONS, validateQuestionBank } from "../dist/content/questions.js";
import { STORAGE_IMAGE_QUESTIONS } from "../dist/content/storageImageQuestions.js";
import { getQuestionSet } from "../dist/content/questions.js";

test("normal categories include visual questions alongside existing question types", () => {
  for (const category of ["geography", "animals", "landmarks", "objects", "science"]) {
    const count = QUESTIONS.filter(q => q.category === category).length;
    const selected = getQuestionSet(count, [], [category]);
    assert.equal(selected.length, count);
    assert.ok(selected.every(q => q.category === category));
    assert.equal(new Set(selected.map(q => q.id)).size, count);
  }
  const combined = getQuestionSet(QUESTIONS.length);
  assert.ok(combined.some(q => q.presentation?.format === "map_shapes"));
  assert.ok(combined.some(q => q.presentation?.format === "image_reveal"));
  assert.ok(combined.some(q => !q.presentation));
  assert.ok(getQuestionSet(10, [], [], false).every(q => !q.presentation));
});

test("question bank has valid ids, translations, options, answers, and points", () => {
  assert.equal(QUESTIONS.length, 170 + STORAGE_IMAGE_QUESTIONS.length + ADDITIONAL_QUESTIONS.length);
  assert.doesNotThrow(() => validateQuestionBank());
});

test("question bank contains at least 50 questions at each difficulty", () => {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const question of QUESTIONS) counts[question.difficulty] += 1;
  assert.ok(counts.easy >= 50);
  assert.ok(counts.medium >= 50);
  assert.ok(counts.hard >= 50);
});
