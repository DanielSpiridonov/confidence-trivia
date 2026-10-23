import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createEndlessRun, applyEndlessCommand, publicEndlessRun, desiredDifficulty, selectQuestion, unclaimedEndlessRewards, advanceEndless } from "../dist/endlessEngine.js";
import { ENDLESS_QUESTIONS } from "../dist/content/endlessQuestions.js";
import { parseEndlessCommand } from "../dist/endlessRoutes.js";
import { ENDLESS_RECONNECT_MS, ENDLESS_TIMERS } from "@confidence-trivia/shared";

function run() { return createEndlessRun(randomUUID(), 25, 1000); }
function answer(r, value, now = 2000) { applyEndlessCommand(r, { type: "answer", runId: r.id, token: r.question.token, answer: value }, now); }
function next(r, now) { applyEndlessCommand(r, { type: "next", runId: r.id, token: r.question.token }, now); }
function heartbeat(r, now) { applyEndlessCommand(r, { type: "heartbeat", runId: r.id }, now); }
function keepAlive(r, until) {
  for (let now = r.connectionDeadline - ENDLESS_RECONNECT_MS + 2000; now <= until; now += 2000) heartbeat(r, now);
}

test("Endless starts with three lives and zero correct answers", () => {
  const r = run(); assert.equal(r.lives, 3); assert.equal(r.score, 0); assert.equal(r.previousBest, 25); assert.equal(r.question.number, 1);
});
test("only correct answers add one point; incorrect answers cost a life", () => {
  const r = run(); answer(r, r.question.correctIndex); assert.equal(r.score, 1); assert.equal(r.lives, 3);
  next(r, 4000); answer(r, (r.question.correctIndex + 1) % 4, 4100); assert.equal(r.score, 1); assert.equal(r.lives, 2); assert.equal(r.feedback.correctIndex, r.question.correctIndex);
});
test("duplicate and rapidly conflicting submissions settle only once", () => {
  const r = run(); const correct = r.question.correctIndex; answer(r, correct); answer(r, (correct + 1) % 4); answer(r, correct);
  assert.equal(r.score, 1); assert.equal(r.lives, 3);
});
test("the server deadline wins when an answer arrives at or after zero", () => {
  for (const late of [0, 1, 10000]) { const r = run(); keepAlive(r, r.question.deadline + late - 1); answer(r, r.question.correctIndex, r.question.deadline + late); assert.equal(r.score, 0); assert.equal(r.lives, 2); assert.equal(r.feedback.timedOut, true); }
});
test("client timeout before the deadline cannot skip a question", () => {
  const r = run(); answer(r, null); assert.equal(r.phase, "question"); assert.equal(r.lives, 3);
});
test("closing and reopening after the connection window ends the whole run", () => {
  let r = run(); const original = r.question.token; const deadline = r.question.deadline;
  r = JSON.parse(JSON.stringify(r)); applyEndlessCommand(r, { type: "sync" }, deadline + 100000);
  assert.equal(r.lives, 0); assert.equal(r.question.token, original); assert.equal(r.phase, "finished"); assert.equal(r.endReason, "abandoned");
  applyEndlessCommand(r, { type: "sync" }, deadline + 200000); assert.equal(r.lives, 0);
});

test("a brief disconnect can reconnect without pausing or extending the question", () => {
  const r = run(); const deadline = r.question.deadline, token = r.question.token;
  heartbeat(r, 1000 + ENDLESS_RECONNECT_MS - 1);
  assert.equal(r.phase, "question"); assert.equal(r.question.token, token); assert.equal(r.question.deadline, deadline);
  assert.equal(r.connectionDeadline, 1000 + ENDLESS_RECONNECT_MS * 2 - 1);
});

test("late heartbeats, answers, next, and Start cannot revive an expired run", () => {
  for (const type of ["heartbeat", "answer", "next", "start", "sync"]) {
    const r = run(); r.score = 9;
    applyEndlessCommand(r, { type, runId: r.id, token: r.question.token, answer: r.question.correctIndex, requestId: randomUUID() }, r.connectionDeadline);
    assert.equal(r.phase, "finished"); assert.equal(r.endReason, "abandoned"); assert.equal(r.score, 9); assert.equal(r.feedback, null);
    heartbeat(r, r.connectionDeadline + 1); assert.equal(r.phase, "finished");
  }
});

test("menu syncs, repeated Starts, stale tokens, and other run IDs do not renew a lease", () => {
  for (const command of [{ type: "sync" }, { type: "start", requestId: randomUUID() }, { type: "heartbeat", runId: randomUUID() }, { type: "answer", token: randomUUID(), answer: 0 }, { type: "next", token: randomUUID() }]) {
    const r = run(); const expires = r.connectionDeadline;
    applyEndlessCommand(r, { runId: r.id, ...command }, expires - 1);
    assert.equal(r.connectionDeadline, expires);
    heartbeat(r, expires); assert.equal(r.endReason, "abandoned");
  }
});

test("leaving the game immediately ends it once and preserves earned progress", () => {
  const r = run(); answer(r, r.question.correctIndex); r.rewards = [{ score: 10, stars: 10 }];
  applyEndlessCommand(r, { type: "abandon", runId: randomUUID() }, 2100); assert.equal(r.phase, "feedback");
  const command = { type: "abandon", runId: r.id };
  applyEndlessCommand(r, command, 2200); const finished = structuredClone(r);
  assert.equal(r.phase, "finished"); assert.equal(r.endReason, "abandoned"); assert.equal(r.lives, 0); assert.equal(r.score, 1); assert.deepEqual(r.rewards, [{ score: 10, stars: 10 }]);
  applyEndlessCommand(r, command, 2300); next(r, 4000); assert.deepEqual(r, finished);
});

test("disconnecting during feedback cannot save a run indefinitely", () => {
  const r = run(); answer(r, r.question.correctIndex);
  next(r, r.connectionDeadline); assert.equal(r.endReason, "abandoned"); assert.equal(r.question.number, 1); assert.equal(r.score, 1);
});

test("legacy runs without a connection deadline expire safely", () => {
  const r = run(); delete r.connectionDeadline;
  heartbeat(r, 2000); assert.equal(r.phase, "finished"); assert.equal(r.endReason, "abandoned");
});
test("feedback is enforced before advancing and stale tokens cannot answer the next question", () => {
  const r = run(); const old = r.question.token; answer(r, r.question.correctIndex); next(r, 2100); assert.equal(r.question.token, old);
  next(r, 4000); assert.notEqual(r.question.token, old);
  applyEndlessCommand(r, { type: "answer", runId: r.id, token: old, answer: r.question.correctIndex }, 4100); assert.equal(r.score, 1); assert.equal(r.phase, "question");
});
test("third lost life ends the run and cannot be restored by next/start commands", () => {
  const r = run(); let now = 2000;
  for (let i = 0; i < 3; i++) { answer(r, (r.question.correctIndex + 1) % 4, now); now += 2000; if (i < 2) next(r, now); now += 100; }
  assert.equal(r.phase, "finished"); assert.equal(r.lives, 0); assert.equal(r.endReason, "lives");
  next(r, now + 4000); applyEndlessCommand(r, { type: "start", requestId: randomUUID() }, now + 5000); assert.equal(r.lives, 0);
});
test("question tiers follow encountered questions rather than correct score", () => {
  for (const [n, expected] of [[1, "easy"], [10, "easy"], [11, "medium"], [25, "medium"], [26, "hard"], [50, "hard"], [51, "expert"], [900, "expert"]]) assert.equal(desiredDifficulty(n, () => 0.99), expected);
  assert.equal(desiredDifficulty(9, () => 0), "medium"); assert.equal(desiredDifficulty(49, () => 0), "expert");
});
test("timers always match actual selected difficulty, including pool fallback", () => {
  for (const difficulty of Object.keys(ENDLESS_TIMERS)) {
    const bank = ENDLESS_QUESTIONS.filter((q) => q.difficulty === difficulty).slice(0, 1);
    const r = createEndlessRun(randomUUID(), 0, 1000, bank);
    assert.equal(r.question.difficulty, difficulty); assert.equal(r.question.duration, ENDLESS_TIMERS[difficulty]); assert.equal(r.question.deadline, 1000 + ENDLESS_TIMERS[difficulty] * 1000);
  }
});
test("Endless never repeats a question and reports exhaustion", () => {
  const r = run(); const seen = new Set(); let now = 1000;
  while (r.phase !== "finished") {
    assert.ok(!seen.has(r.question.contentId)); seen.add(r.question.contentId);
    answer(r, r.question.correctIndex, now + 10); next(r, now + 2000); now += 2100;
  }
  assert.equal(r.endReason, "exhausted"); assert.equal(seen.size, ENDLESS_QUESTIONS.length); assert.equal(r.score, seen.size);
});
test("missing difficulty metadata is excluded and empty pools end safely", () => {
  assert.equal(selectQuestion(1, [], [{ ...ENDLESS_QUESTIONS[0], difficulty: undefined }]), null);
  const r = createEndlessRun(randomUUID(), 0, 0, []); assert.equal(r.phase, "finished"); assert.equal(r.endReason, "exhausted");
});
test("public payload never leaks answer keys, internal IDs, or used question bank", () => {
  const r = run(); const safe = publicEndlessRun(r);
  assert.equal(safe.feedback, null); assert.ok(!("correctIndex" in safe.question)); assert.ok(!("contentId" in safe.question)); assert.ok(!("usedIds" in safe));
});
test("Reward Road uses maximum single-run best and awards all new thresholds once", () => {
  let best = 0; let claimed = [];
  for (const [score, expected, thresholds] of [[50, 50, [10,25,50]], [35, 50, []], [75,75,[75]]]) {
    best = Math.max(best, score); const rewards = unclaimedEndlessRewards(best, claimed); assert.equal(best, expected); assert.deepEqual(rewards.map((r) => r.score), thresholds); claimed.push(...rewards.map((r) => r.score));
  }
  assert.deepEqual(unclaimedEndlessRewards(75, claimed), []);
});
test("API rejects malformed actions and strips fabricated score, timestamp, reward fields", () => {
  for (const answer of [-1, 4, 0.5, "0", {}, undefined]) assert.throws(() => parseEndlessCommand({ type: "answer", runId: randomUUID(), token: randomUUID(), answer }));
  assert.throws(() => parseEndlessCommand({ type: "start", requestId: "fake" }));
  const c = parseEndlessCommand({ type: "start", requestId: randomUUID(), score: 100000, stars: 99999 }); assert.deepEqual(Object.keys(c).sort(), ["requestId", "type"]);
});
