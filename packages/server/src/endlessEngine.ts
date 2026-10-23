import { randomInt, randomUUID } from "crypto";
import { ENDLESS_FEEDBACK_MS, ENDLESS_MILESTONES, ENDLESS_TIMERS, EndlessDifficulty, EndlessRun } from "@confidence-trivia/shared";
import { ENDLESS_QUESTIONS, EndlessContent } from "./content/endlessQuestions";

export interface StoredEndlessRun extends Omit<EndlessRun, "question"> {
  usedIds: string[];
  question: (NonNullable<EndlessRun["question"]> & { contentId: string; correctIndex: number }) | null;
}
export type EndlessCommand = { type: "sync" } | { type: "start"; requestId: string } |
  { type: "answer"; runId: string; token: string; answer: number | null } |
  { type: "next"; runId: string; token: string };

const TIERS: EndlessDifficulty[] = ["easy", "medium", "hard", "expert"];
export function desiredDifficulty(number: number, random: () => number = Math.random): EndlessDifficulty {
  // Blend only near each boundary; never roll Easy questions as Expert.
  const stage = number <= 10 ? 0 : number <= 25 ? 1 : number <= 50 ? 2 : 3;
  const boundary = [10, 25, 50][stage];
  if (boundary && number > boundary - 4 && random() < (number - boundary + 4) / 8) return TIERS[stage + 1];
  if (stage > 0 && number <= [0, 14, 29, 54][stage] && random() < 0.2) return TIERS[stage - 1];
  return TIERS[stage];
}
export function selectQuestion(number: number, used: string[], bank = ENDLESS_QUESTIONS, random: () => number = Math.random): EndlessContent | null {
  const seen = new Set(used);
  const available = bank.filter((q) => !seen.has(q.id) && TIERS.includes(q.difficulty));
  if (!available.length) return null;
  const desired = TIERS.indexOf(desiredDifficulty(number, random));
  // Fall back to the nearest real difficulty, preferring harder on an equal distance.
  const distance = Math.min(...available.map((q) => Math.abs(TIERS.indexOf(q.difficulty) - desired)));
  const tiers = available.filter((q) => Math.abs(TIERS.indexOf(q.difficulty) - desired) === distance);
  const tier = Math.max(...tiers.map((q) => TIERS.indexOf(q.difficulty)));
  const pool = tiers.filter((q) => TIERS.indexOf(q.difficulty) === tier);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function advanceEndless(run: StoredEndlessRun, now: number, bank = ENDLESS_QUESTIONS): void {
  const content = selectQuestion(run.usedIds.length + 1, run.usedIds, bank);
  if (!content) { run.phase = "finished"; run.endReason = "exhausted"; return; }
  const indices = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = randomInt(i + 1); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  const duration = ENDLESS_TIMERS[content.difficulty];
  run.usedIds.push(content.id);
  run.phase = "question";
  run.feedback = null;
  run.question = { token: randomUUID(), contentId: content.id, number: run.usedIds.length, text: content.text, options: indices.map((i) => content.options[i]), correctIndex: indices.indexOf(content.correctIndex), category: content.category, difficulty: content.difficulty, duration, deadline: now + duration * 1000 };
}
export function createEndlessRun(id: string, best: number, now: number, bank = ENDLESS_QUESTIONS): StoredEndlessRun {
  const run: StoredEndlessRun = { id, score: 0, lives: 3, previousBest: best, phase: "question", endReason: null, question: null, feedback: null, rewards: [], usedIds: [] };
  advanceEndless(run, now, bank);
  return run;
}
export function settleEndless(run: StoredEndlessRun, answer: number | null, now: number): void {
  if (run.phase !== "question" || !run.question) return;
  const timedOut = now >= run.question.deadline;
  if (answer === null && !timedOut) return;
  const selectedIndex = timedOut ? null : answer;
  const correct = selectedIndex === run.question.correctIndex;
  if (correct) run.score += 1;
  else run.lives -= 1;
  run.feedback = { correctIndex: run.question.correctIndex, selectedIndex, correct, timedOut, readyAt: now + ENDLESS_FEEDBACK_MS };
  run.phase = run.lives === 0 ? "finished" : "feedback";
  if (run.lives === 0) run.endReason = "lives";
}
export function applyEndlessCommand(run: StoredEndlessRun, command: EndlessCommand, now: number): void {
  // Expiration is lazy but authoritative: reconnecting charges the expired
  // question exactly once. No unseen next question starts while disconnected.
  if (run.phase === "question" && run.question && now >= run.question.deadline) settleEndless(run, null, now);
  if (command.type === "answer" && command.runId === run.id && command.token === run.question?.token) settleEndless(run, command.answer, now);
  if (command.type === "next" && command.runId === run.id && command.token === run.question?.token && run.phase === "feedback" && now >= (run.feedback?.readyAt ?? Infinity)) advanceEndless(run, now);
}
export function publicEndlessRun(run: StoredEndlessRun): EndlessRun {
  const { usedIds, question, ...safe } = run;
  if (!question) return { ...safe, question: null };
  const { correctIndex, contentId, ...publicQuestion } = question;
  return { ...safe, question: publicQuestion };
}
export function unclaimedEndlessRewards(best: number, claimed: number[]) {
  return ENDLESS_MILESTONES.filter((m) => m.score <= best && !claimed.includes(m.score));
}
