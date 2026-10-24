import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, validateQuestionBank } from "../dist/content/questions.js";
import { STORAGE_IMAGE_QUESTIONS } from "../dist/content/storageImageQuestions.js";
import { getQuestionSet } from "../dist/content/questions.js";
import { VISUAL_TEST_CATEGORIES } from "@confidence-trivia/shared";

test("temporary Custom filters select only the requested visual format and photo category", () => {
  for (const filter of VISUAL_TEST_CATEGORIES) {
    const selected = getQuestionSet(15, [], [filter.id]);
    assert.equal(selected.length,15);
    assert.ok(selected.every(q => q.presentation?.format === filter.format && (!("category" in filter) || q.category === filter.category)));
  }
  const combined = getQuestionSet(29, [], ["test_map_shapes", "test_image_reveal"]);
  assert.equal(new Set(combined.map(q => q.id)).size,29);
  assert.ok(combined.every(q => q.presentation));
  assert.ok(getQuestionSet(15, [], ["science"]).every(q => q.category === "science"));
  assert.ok(getQuestionSet(1, [], ["test_image_reveal"], false).every(q => !q.presentation));
});

test("question bank has valid ids, translations, options, answers, and points", () => {
  assert.equal(QUESTIONS.length, 170 + STORAGE_IMAGE_QUESTIONS.length);
  assert.doesNotThrow(() => validateQuestionBank());
});

test("question bank contains at least 50 questions at each difficulty", () => {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const question of QUESTIONS) counts[question.difficulty] += 1;
  assert.ok(counts.easy >= 50);
  assert.ok(counts.medium >= 50);
  assert.ok(counts.hard >= 50);
});
