"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRoundResults = computeRoundResults;
const scoring_1 = require("../config/scoring");
const streaks_1 = require("../config/streaks");
/**
 * Pure function: given the round's submissions and the correct answer,
 * returns every score event and the updated streak values. No I/O, no
 * randomness, no server/framework dependency — safe to unit test directly
 * and safe for the server to call at reveal without duplicating logic
 * anywhere else.
 */
function computeRoundResults(input) {
    const { correctAnswer, answers, sideBets, currentStreaks, isAnswerCorrect } = input;
    const basePoints = input.basePoints ?? scoring_1.DEFAULT_BASE_POINTS;
    const scoreEvents = [];
    const streakUpdates = { ...currentStreaks };
    const correctnessByPlayer = new Map();
    // --- Answer + confidence scoring ---
    for (const answer of answers) {
        const correct = isAnswerCorrect(answer.value, correctAnswer);
        correctnessByPlayer.set(answer.playerId, correct);
        const table = scoring_1.CONFIDENCE_SCORING[answer.confidence];
        // Difficulty increases only the reward for a correct answer. Confidence
        // penalties remain canonical, avoiding extreme hard-question losses.
        let delta = correct
            ? table.correct + (basePoints - scoring_1.DEFAULT_BASE_POINTS)
            : table.wrong;
        const priorStreak = currentStreaks[answer.playerId] ?? 0;
        const isHighConfidence = streaks_1.STREAK_QUALIFYING_CONFIDENCE.includes(answer.confidence);
        if (streaks_1.STREAK_MECHANICS_ENABLED && isHighConfidence) {
            if (correct) {
                // Defensive reduction doesn't apply on a correct answer; the streak
                // bonus does, once the player already has a qualifying streak.
                if (priorStreak >= streaks_1.STREAK_REWARDS.bonusAtStreak) {
                    delta += streaks_1.STREAK_REWARDS.bonusPoints;
                    scoreEvents.push({
                        playerId: answer.playerId,
                        reason: "streak_bonus",
                        delta: streaks_1.STREAK_REWARDS.bonusPoints,
                        detail: `Streak bonus (streak ${priorStreak})`,
                    });
                }
                streakUpdates[answer.playerId] = priorStreak + 1;
            }
            else {
                if (priorStreak >= streaks_1.STREAK_REWARDS.defensiveAtStreak) {
                    delta += streaks_1.STREAK_REWARDS.defensiveReduction; // reduces the (negative) penalty
                }
                streakUpdates[answer.playerId] = 0;
            }
        }
        else if (!correct) {
            // Any wrong answer, even at low/no confidence, does not build a
            // streak — but only high-confidence answers reset one that exists.
            // Per spec §15, only 5/6 participate in streaks at all, so low
            // confidence answers simply leave the streak untouched.
        }
        scoreEvents.push({
            playerId: answer.playerId,
            reason: "answer",
            delta,
            detail: correct
                ? `Correct${answer.confidence !== "none" ? ` + Confidence ${answer.confidence}` : ""}`
                : `Wrong${answer.confidence !== "none" ? ` — Confidence ${answer.confidence}` : ""}`,
        });
    }
    // --- Side bet scoring ---
    for (const bet of sideBets) {
        const targetCorrect = correctnessByPlayer.get(bet.targetId);
        if (targetCorrect === undefined)
            continue; // target didn't answer somehow; skip
        const bettorPredictedCorrect = bet.prediction === "correct";
        const won = bettorPredictedCorrect === targetCorrect;
        scoreEvents.push({
            playerId: bet.bettorId,
            reason: "sidebet",
            delta: won ? scoring_1.SIDE_BET_SCORING.correct : scoring_1.SIDE_BET_SCORING.wrong,
            detail: `Side bet: target was ${targetCorrect ? "correct" : "wrong"}`,
        });
    }
    return {
        correctAnswer,
        answers,
        sideBets,
        scoreEvents,
        streakUpdates,
    };
}
