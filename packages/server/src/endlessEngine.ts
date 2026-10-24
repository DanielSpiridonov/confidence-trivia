import { randomInt, randomUUID } from "crypto";
import { ENDLESS_FEEDBACK_MS, ENDLESS_MILESTONES, ENDLESS_RECONNECT_MS, ENDLESS_TIMERS, EndlessDifficulty, EndlessRun, isAnswerCorrect, isValidAnswerValue, VISUAL_READY_TIMEOUT_MS, normalizeGeographyAnswer } from "@confidence-trivia/shared";
import { ENDLESS_QUESTIONS, EndlessContent } from "./content/endlessQuestions";

export interface StoredEndlessRun extends Omit<EndlessRun, "question"> {
  usedIds: string[];
  skippedIds?: string[];
  question: (NonNullable<EndlessRun["question"]> & { contentId: string; correctIndex: number; correctAnswer?: unknown; loadingExpiresAt?: number }) | null;
}
export type EndlessCommand = { type: "sync" } | { type: "start"; requestId: string } |
  { type: "heartbeat" | "abandon"; runId: string } |
  { type: "ready" | "visualFailed"; runId: string; token: string } |
  { type: "answer"; runId: string; token: string; answer: number | string | null } |
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
  const content = selectQuestion(run.usedIds.length + 1, [...run.usedIds, ...(run.skippedIds ?? [])], bank);
  if (!content) { run.phase = "finished"; run.endReason = "exhausted"; return; }
  const indices = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = randomInt(i + 1); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  const duration = ENDLESS_TIMERS[content.difficulty];
  run.usedIds.push(content.id);
  run.phase = content.presentation ? "loading" : "question";
  run.feedback = null;
  const choice = !content.answerType || content.answerType === "multiple_choice";
  const correctIndex = choice ? indices.indexOf(content.correctIndex) : -1;
  run.question = { token: randomUUID(), contentId: content.id, number: run.usedIds.length, text: content.text, options: choice ? indices.map((i) => content.options[i]) : [], correctIndex, correctAnswer: choice ? correctIndex : content.correctAnswer, answerType: content.answerType ?? "multiple_choice", ...(content.presentation ? { presentation: content.presentation } : {}), category: content.category, difficulty: content.difficulty, duration, startedAt: content.presentation ? 0 : now, loadingExpiresAt: content.presentation ? now + VISUAL_READY_TIMEOUT_MS : undefined, deadline: content.presentation ? 0 : now + duration * 1000 };
}
export function createEndlessRun(id: string, best: number, now: number, bank = ENDLESS_QUESTIONS): StoredEndlessRun {
  const run: StoredEndlessRun = { id, score: 0, lives: 3, previousBest: best, phase: "question", endReason: null, connectionDeadline: now + ENDLESS_RECONNECT_MS, question: null, feedback: null, rewards: [], usedIds: [] };
  advanceEndless(run, now, bank);
  return run;
}
export function settleEndless(run: StoredEndlessRun, answer: number | string | null, now: number): void {
  if (run.phase !== "question" || !run.question) return;
  if (!validEndlessAnswer(run.question, answer)) return;
  const timedOut = now >= run.question.deadline;
  if (answer === null && !timedOut) return;
  const selectedIndex = timedOut || typeof answer !== "number" || run.question.answerType === "estimate" ? null : answer;
  const key = run.question.correctAnswer ?? run.question.correctIndex;
  const correct = !timedOut && answer !== null && isAnswerCorrect(run.question.answerType ?? "multiple_choice", answer, key, run.question.presentation?.format === "map_shapes" ? normalizeGeographyAnswer : undefined);
  if (correct) run.score += 1;
  else run.lives -= 1;
  const answerText = run.question.correctIndex >= 0 ? run.question.options[run.question.correctIndex] : String(Array.isArray(key) ? key[0] : key);
  run.feedback = { correctIndex: run.question.correctIndex, correctAnswerText: answerText, selectedIndex, correct, timedOut, readyAt: now + ENDLESS_FEEDBACK_MS };
  run.phase = run.lives === 0 ? "finished" : "feedback";
  if (run.lives === 0) run.endReason = "lives";
}
export function validEndlessAnswer(question: NonNullable<EndlessRun["question"]>, answer: unknown): boolean {
  if (answer === null) return true;
  return isValidAnswerValue(question.answerType ?? "multiple_choice", answer, question.options.length);
}
function skipEndlessVisual(run: StoredEndlessRun, now: number) {
  (run.skippedIds ??= []).push(run.usedIds.pop()!);
  advanceEndless(run, now, ENDLESS_QUESTIONS.filter((q) => !q.presentation));
}
function abandonEndless(run: StoredEndlessRun): void {
  run.phase = "finished";
  run.endReason = "abandoned";
  run.lives = 0;
  run.feedback = null;
}
export function expireEndlessConnection(run: StoredEndlessRun, now: number): boolean {
  if (run.phase === "finished") return false;
  // Legacy saved runs have no lease and must not become unlimited resumes.
  if (!Number.isFinite(run.connectionDeadline) || now >= run.connectionDeadline) {
    abandonEndless(run);
    return true;
  }
  return false;
}
export function applyEndlessCommand(run: StoredEndlessRun, command: EndlessCommand, now: number): void {
  // Check BEFORE renewing the lease: a late heartbeat/answer cannot revive it.
  if (expireEndlessConnection(run, now) || run.phase === "finished") return;
  if (run.phase === "loading" && now >= (run.question?.loadingExpiresAt ?? 0)) skipEndlessVisual(run, now);
  if ((command.type === "ready" || command.type === "visualFailed") && command.runId === run.id && command.token === run.question?.token && run.phase === "loading") {
    run.connectionDeadline = now + ENDLESS_RECONNECT_MS;
    if (command.type === "ready") { run.phase = "question"; run.question.startedAt = now; run.question.deadline = now + run.question.duration * 1000; }
    else {
      skipEndlessVisual(run, now);
    }
    return;
  }
  if ((command.type === "abandon" || command.type === "heartbeat") && command.runId === run.id) {
    if (command.type === "abandon") { abandonEndless(run); return; }
    run.connectionDeadline = now + ENDLESS_RECONNECT_MS;
  }
  // Reads, Starts and stale tokens never keep a run alive. Accepted answers
  // and next-question actions count as activity, using server time only.
  if ((command.type === "answer" || command.type === "next") && command.runId === run.id && command.token === run.question?.token &&
    ((command.type === "answer" && run.phase === "question" && command.answer !== null && !!run.question && validEndlessAnswer(run.question, command.answer)) ||
      (command.type === "next" && run.phase === "feedback" && now >= (run.feedback?.readyAt ?? Infinity)))) {
    run.connectionDeadline = now + ENDLESS_RECONNECT_MS;
  }
  if (run.phase === "question" && run.question && now >= run.question.deadline) settleEndless(run, null, now);
  if (command.type === "answer" && command.runId === run.id && command.token === run.question?.token) settleEndless(run, command.answer, now);
  if (command.type === "next" && command.runId === run.id && command.token === run.question?.token && run.phase === "feedback" && now >= (run.feedback?.readyAt ?? Infinity)) advanceEndless(run, now);
}
export function publicEndlessRun(run: StoredEndlessRun): EndlessRun {
  const { usedIds, skippedIds, question, ...safe } = run;
  if (!question) return { ...safe, question: null };
  const { correctIndex, correctAnswer, loadingExpiresAt, contentId, ...publicQuestion } = question;
  return { ...safe, question: publicQuestion };
}
export function unclaimedEndlessRewards(best: number, claimed: number[]) {
  return ENDLESS_MILESTONES.filter((m) => m.score <= best && !claimed.includes(m.score));
}
