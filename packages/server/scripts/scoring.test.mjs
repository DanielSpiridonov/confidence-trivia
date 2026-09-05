import test from "node:test";
import assert from "node:assert/strict";
import { computeRoundResults } from "@confidence-trivia/shared";

const correct = (value, expected) => value === expected;
const answer = (playerId, value, confidence) => ({ playerId, value, confidence, submittedAt: 1 });

test("no-confidence always scores zero", () => {
  for (const value of [42, 0]) {
    const result = computeRoundResults({ correctAnswer: 42, basePoints: 3, answers: [answer("p", value, "none")], sideBets: [], currentStreaks: {}, isAnswerCorrect: correct });
    assert.equal(result.scoreEvents.find((event) => event.reason === "answer").delta, 0);
  }
});

test("difficulty increases correct rewards but not wrong penalties", () => {
  const easy = computeRoundResults({ correctAnswer: 42, basePoints: 1, answers: [answer("p", 42, "3")], sideBets: [], currentStreaks: {}, isAnswerCorrect: correct });
  const hard = computeRoundResults({ correctAnswer: 42, basePoints: 3, answers: [answer("p", 42, "3"), answer("q", 0, "3")], sideBets: [], currentStreaks: {}, isAnswerCorrect: correct });
  assert.equal(easy.scoreEvents.find((event) => event.playerId === "p").delta, 2);
  assert.equal(hard.scoreEvents.find((event) => event.playerId === "p").delta, 4);
  assert.equal(hard.scoreEvents.find((event) => event.playerId === "q").delta, -2);
});

test("side bets score both winning and losing predictions", () => {
  const result = computeRoundResults({ correctAnswer: 42, answers: [answer("target", 42, "1")], sideBets: [{ bettorId: "win", targetId: "target", prediction: "correct" }, { bettorId: "lose", targetId: "target", prediction: "wrong" }], currentStreaks: {}, isAnswerCorrect: correct });
  const bets = result.scoreEvents.filter((event) => event.reason === "sidebet");
  assert.equal(bets.find((event) => event.playerId === "win").delta, 1);
  assert.equal(bets.find((event) => event.playerId === "lose").delta, -1);
});

test("high-confidence streak advances and resets", () => {
  const win = computeRoundResults({ correctAnswer: 1, answers: [answer("p", 1, 5)], sideBets: [], currentStreaks: { p: 1 }, isAnswerCorrect: correct });
  const loss = computeRoundResults({ correctAnswer: 1, answers: [answer("p", 0, 5)], sideBets: [], currentStreaks: { p: 2 }, isAnswerCorrect: correct });
  assert.equal(win.streakUpdates.p, 2);
  assert.equal(loss.streakUpdates.p, 0);
});
