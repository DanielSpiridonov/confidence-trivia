import test from "node:test";
import assert from "node:assert/strict";
import { ADDITIONAL_QUESTIONS } from "../dist/content/additionalQuestions.js";
import { QUESTIONS, getQuestionSet, getLocalizedCorrectAnswer, localize } from "../dist/content/questions.js";

test("reviewed additions enter the normal bank and category selection in both languages", () => {
  assert.equal(ADDITIONAL_QUESTIONS.length, 145);
  assert.equal(new Set(ADDITIONAL_QUESTIONS.map(q => q.id)).size, 145);
  assert.ok(!QUESTIONS.some(q => q.id === "new_tf_004"));
  for (const q of ADDITIONAL_QUESTIONS) {
    assert.ok(QUESTIONS.some(record => record.id === q.id));
    for (const locale of ["en", "bg"]) assert.ok(localize(q, locale).text.length > 0);
  }
  for (const category of ["space", "literature"]) {
    const available = QUESTIONS.filter(q => q.category === category);
    assert.ok(available.length > 0);
    const selected = getQuestionSet(available.length, [], [category]);
    assert.deepEqual(new Set(selected.map(q => q.id)), new Set(available.map(q => q.id)));
  }
});

test("corrected numerical answers and localized word answers survive import", () => {
  const find = id => QUESTIONS.find(q => q.id === id);
  assert.equal(find("new_closest_001").correctAnswer, 330);
  assert.match(find("new_closest_001").translations.en.text, /2022/);
  assert.equal(find("new_closest_003").correctAnswer, Math.round(33.57));
  assert.equal(find("new_closest_006").correctAnswer, Math.round(29.78 / 5));
  assert.equal(find("new_closest_008").correctAnswer, Math.round(6.02214076e23 / 1e20));
  assert.equal(find("new_estimate_008").correctAnswer, Math.round(273.15));
  assert.equal(find("new_tf_005").correctAnswer, 0);
  assert.match(find("new_tf_005").translations.en.text, /identified as a planet in 1846/);
  assert.ok(getLocalizedCorrectAnswer(find("new_word_007"), "bg").includes("митохондрията"));
  assert.ok(getLocalizedCorrectAnswer(find("new_word_002"), "bg").includes("гепард"));
});

test("second batch fixes factual keys and keeps solutions out of prompts", () => {
  const find = id => QUESTIONS.find(q => q.id === id);
  assert.equal(find("new_tf_016").correctAnswer, 0); // Discovered in 1799, in the 18th century.
  assert.equal(find("new_closest_015").correctAnswer, 6650);
  for (const locale of ["en", "bg"]) {
    assert.doesNotMatch(find("new_closest_015").translations[locale].text, /6[ ,]?650/);
    assert.ok(find("new_ordering_014").translations[locale].options.every(option => !/\d{4}/.test(option)));
  }
  assert.ok(!QUESTIONS.some(q => q.id === "new_ordering_010"));
  assert.equal(find("new_closest_013").correctAnswer, Math.round(142984 / 1000) * 1000);
  assert.equal(find("new_estimate_015").correctAnswer, 2 ** 12);
  assert.equal(find("new_tf_015").correctAnswer, 0); // 238 - uranium's atomic number 92 = 146.
  assert.deepEqual(getLocalizedCorrectAnswer(find("new_word_015"), "bg"), ["ентропия", "ентропията"]);
});

test("third batch excludes flagged questions and scopes variable measurements", () => {
  const find = id => QUESTIONS.find(q => q.id === id);
  for (const id of ["new_estimate_018", "new_closest_018", "new_closest_023"]) assert.equal(find(id), undefined);
  assert.equal(find("new_closest_019").correctAnswer, Math.round(4805.59));
  for (const locale of ["en", "bg"]) {
    assert.match(find("new_closest_019").translations[locale].text, /2023/);
    for (const id of ["new_ordering_023", "new_ordering_024"]) {
      assert.ok(find(id).translations[locale].options.every(option => !/\d{3,4}/.test(option)));
    }
  }
  assert.equal(find("new_estimate_023").correctAnswer, 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2);
  assert.equal(find("new_closest_021").correctAnswer, Math.round(27.3));
  assert.ok(getLocalizedCorrectAnswer(find("new_word_017"), "en").includes("african bush elephant"));
  assert.ok(getLocalizedCorrectAnswer(find("new_word_023"), "bg").includes("рибозомите"));
});
