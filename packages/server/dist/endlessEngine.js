"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.desiredDifficulty = desiredDifficulty;
exports.selectQuestion = selectQuestion;
exports.advanceEndless = advanceEndless;
exports.createEndlessRun = createEndlessRun;
exports.settleEndless = settleEndless;
exports.validEndlessAnswer = validEndlessAnswer;
exports.expireEndlessConnection = expireEndlessConnection;
exports.applyEndlessCommand = applyEndlessCommand;
exports.publicEndlessRun = publicEndlessRun;
exports.unclaimedEndlessRewards = unclaimedEndlessRewards;
const crypto_1 = require("crypto");
const shared_1 = require("@confidence-trivia/shared");
const endlessQuestions_1 = require("./content/endlessQuestions");
const TIERS = ["easy", "medium", "hard", "expert"];
function desiredDifficulty(number, random = Math.random) {
    // Blend only near each boundary; never roll Easy questions as Expert.
    const stage = number <= 10 ? 0 : number <= 25 ? 1 : number <= 50 ? 2 : 3;
    const boundary = [10, 25, 50][stage];
    if (boundary && number > boundary - 4 && random() < (number - boundary + 4) / 8)
        return TIERS[stage + 1];
    if (stage > 0 && number <= [0, 14, 29, 54][stage] && random() < 0.2)
        return TIERS[stage - 1];
    return TIERS[stage];
}
function selectQuestion(number, used, bank = endlessQuestions_1.ENDLESS_QUESTIONS, random = Math.random) {
    const seen = new Set(used);
    const available = bank.filter((q) => !seen.has(q.id) && TIERS.includes(q.difficulty));
    if (!available.length)
        return null;
    const desired = TIERS.indexOf(desiredDifficulty(number, random));
    // Fall back to the nearest real difficulty, preferring harder on an equal distance.
    const distance = Math.min(...available.map((q) => Math.abs(TIERS.indexOf(q.difficulty) - desired)));
    const tiers = available.filter((q) => Math.abs(TIERS.indexOf(q.difficulty) - desired) === distance);
    const tier = Math.max(...tiers.map((q) => TIERS.indexOf(q.difficulty)));
    const pool = tiers.filter((q) => TIERS.indexOf(q.difficulty) === tier);
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
function advanceEndless(run, now, bank = endlessQuestions_1.ENDLESS_QUESTIONS) {
    const content = selectQuestion(run.usedIds.length + 1, [...run.usedIds, ...(run.skippedIds ?? [])], bank);
    if (!content) {
        run.phase = "finished";
        run.endReason = "exhausted";
        return;
    }
    const indices = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
        const j = (0, crypto_1.randomInt)(i + 1);
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const duration = shared_1.ENDLESS_TIMERS[content.difficulty];
    run.usedIds.push(content.id);
    run.phase = content.presentation ? "loading" : "question";
    run.feedback = null;
    const choice = !content.answerType || content.answerType === "multiple_choice";
    const correctIndex = choice ? indices.indexOf(content.correctIndex) : -1;
    run.question = { token: (0, crypto_1.randomUUID)(), contentId: content.id, number: run.usedIds.length, text: content.text, options: choice ? indices.map((i) => content.options[i]) : [], correctIndex, correctAnswer: choice ? correctIndex : content.correctAnswer, answerType: content.answerType ?? "multiple_choice", ...(content.presentation ? { presentation: content.presentation } : {}), category: content.category, difficulty: content.difficulty, duration, startedAt: content.presentation ? 0 : now, loadingExpiresAt: content.presentation ? now + shared_1.VISUAL_READY_TIMEOUT_MS : undefined, deadline: content.presentation ? 0 : now + duration * 1000 };
}
function createEndlessRun(id, best, now, bank = endlessQuestions_1.ENDLESS_QUESTIONS) {
    const run = { id, score: 0, lives: 3, previousBest: best, phase: "question", endReason: null, connectionDeadline: now + shared_1.ENDLESS_RECONNECT_MS, question: null, feedback: null, rewards: [], usedIds: [] };
    advanceEndless(run, now, bank);
    return run;
}
function settleEndless(run, answer, now) {
    if (run.phase !== "question" || !run.question)
        return;
    if (!validEndlessAnswer(run.question, answer))
        return;
    const timedOut = now >= run.question.deadline;
    if (answer === null && !timedOut)
        return;
    const selectedIndex = timedOut || typeof answer !== "number" || run.question.answerType === "estimate" ? null : answer;
    const key = run.question.correctAnswer ?? run.question.correctIndex;
    const correct = !timedOut && answer !== null && (0, shared_1.isAnswerCorrect)(run.question.answerType ?? "multiple_choice", answer, key, run.question.presentation?.format === "map_shapes" ? shared_1.normalizeGeographyAnswer : undefined);
    if (correct)
        run.score += 1;
    else
        run.lives -= 1;
    const answerText = run.question.correctIndex >= 0 ? run.question.options[run.question.correctIndex] : String(Array.isArray(key) ? key[0] : key);
    run.feedback = { correctIndex: run.question.correctIndex, correctAnswerText: answerText, selectedIndex, correct, timedOut, readyAt: now + shared_1.ENDLESS_FEEDBACK_MS };
    run.phase = run.lives === 0 ? "finished" : "feedback";
    if (run.lives === 0)
        run.endReason = "lives";
}
function validEndlessAnswer(question, answer) {
    if (answer === null)
        return true;
    return (0, shared_1.isValidAnswerValue)(question.answerType ?? "multiple_choice", answer, question.options.length);
}
function skipEndlessVisual(run, now) {
    (run.skippedIds ?? (run.skippedIds = [])).push(run.usedIds.pop());
    advanceEndless(run, now, endlessQuestions_1.ENDLESS_QUESTIONS.filter((q) => !q.presentation));
}
function abandonEndless(run) {
    run.phase = "finished";
    run.endReason = "abandoned";
    run.lives = 0;
    run.feedback = null;
}
function expireEndlessConnection(run, now) {
    if (run.phase === "finished")
        return false;
    // Legacy saved runs have no lease and must not become unlimited resumes.
    if (!Number.isFinite(run.connectionDeadline) || now >= run.connectionDeadline) {
        abandonEndless(run);
        return true;
    }
    return false;
}
function applyEndlessCommand(run, command, now) {
    // Check BEFORE renewing the lease: a late heartbeat/answer cannot revive it.
    if (expireEndlessConnection(run, now) || run.phase === "finished")
        return;
    if (run.phase === "loading" && now >= (run.question?.loadingExpiresAt ?? 0))
        skipEndlessVisual(run, now);
    if ((command.type === "ready" || command.type === "visualFailed") && command.runId === run.id && command.token === run.question?.token && run.phase === "loading") {
        run.connectionDeadline = now + shared_1.ENDLESS_RECONNECT_MS;
        if (command.type === "ready") {
            run.phase = "question";
            run.question.startedAt = now;
            run.question.deadline = now + run.question.duration * 1000;
        }
        else {
            skipEndlessVisual(run, now);
        }
        return;
    }
    if ((command.type === "abandon" || command.type === "heartbeat") && command.runId === run.id) {
        if (command.type === "abandon") {
            abandonEndless(run);
            return;
        }
        run.connectionDeadline = now + shared_1.ENDLESS_RECONNECT_MS;
    }
    // Reads, Starts and stale tokens never keep a run alive. Accepted answers
    // and next-question actions count as activity, using server time only.
    if ((command.type === "answer" || command.type === "next") && command.runId === run.id && command.token === run.question?.token &&
        ((command.type === "answer" && run.phase === "question" && command.answer !== null && !!run.question && validEndlessAnswer(run.question, command.answer)) ||
            (command.type === "next" && run.phase === "feedback" && now >= (run.feedback?.readyAt ?? Infinity)))) {
        run.connectionDeadline = now + shared_1.ENDLESS_RECONNECT_MS;
    }
    if (run.phase === "question" && run.question && now >= run.question.deadline)
        settleEndless(run, null, now);
    if (command.type === "answer" && command.runId === run.id && command.token === run.question?.token)
        settleEndless(run, command.answer, now);
    if (command.type === "next" && command.runId === run.id && command.token === run.question?.token && run.phase === "feedback" && now >= (run.feedback?.readyAt ?? Infinity))
        advanceEndless(run, now);
}
function publicEndlessRun(run) {
    const { usedIds, skippedIds, question, ...safe } = run;
    if (!question)
        return { ...safe, question: null };
    const { correctIndex, correctAnswer, loadingExpiresAt, contentId, ...publicQuestion } = question;
    return { ...safe, question: publicQuestion };
}
function unclaimedEndlessRewards(best, claimed) {
    return shared_1.ENDLESS_MILESTONES.filter((m) => m.score <= best && !claimed.includes(m.score));
}
