import { CONFIDENCE_SCORING, SIDE_BET_SCORING, DEFAULT_BASE_POINTS } from "../config/scoring";
import {
  STREAK_QUALIFYING_CONFIDENCE,
  STREAK_MECHANICS_ENABLED,
  STREAK_REWARDS,
} from "../config/streaks";
import {
  PlayerAnswer,
  SideBet,
  PlayerScoreEvent,
  RoundResult,
  ConfidenceValue,
} from "../types";

interface ComputeInput {
  correctAnswer: unknown;
  basePoints?: number; // defaults to DEFAULT_BASE_POINTS (1)
  answers: PlayerAnswer[];
  sideBets: SideBet[];
  currentStreaks: Record<string, number>; // playerId -> streak going in
  isAnswerCorrect: (value: unknown, correctAnswer: unknown) => boolean;
}

/**
 * Pure function: given the round's submissions and the correct answer,
 * returns every score event and the updated streak values. No I/O, no
 * randomness, no server/framework dependency — safe to unit test directly
 * and safe for the server to call at reveal without duplicating logic
 * anywhere else.
 */
export function computeRoundResults(input: ComputeInput): RoundResult {
  const { correctAnswer, answers, sideBets, currentStreaks, isAnswerCorrect } = input;
  const basePoints = input.basePoints ?? DEFAULT_BASE_POINTS;

  const scoreEvents: PlayerScoreEvent[] = [];
  const streakUpdates: Record<string, number> = { ...currentStreaks };
  const correctnessByPlayer = new Map<string, boolean>();

  // --- Answer + confidence scoring ---
  for (const answer of answers) {
    const correct = isAnswerCorrect(answer.value, correctAnswer);
    correctnessByPlayer.set(answer.playerId, correct);

    const table = CONFIDENCE_SCORING[answer.confidence as ConfidenceValue];
    // Difficulty increases only the reward for a correct answer. Confidence
    // penalties remain canonical, avoiding extreme hard-question losses.
    // "No confidence" is a true opt-out: no reward, penalty, or difficulty
    // bonus regardless of whether the submitted answer happens to be right.
    let delta = answer.confidence === "none"
      ? 0
      : correct
        ? table.correct + (basePoints - DEFAULT_BASE_POINTS)
        : table.wrong;

    const priorStreak = currentStreaks[answer.playerId] ?? 0;
    const isHighConfidence = STREAK_QUALIFYING_CONFIDENCE.includes(answer.confidence);

    if (STREAK_MECHANICS_ENABLED && isHighConfidence) {
      if (correct) {
        // Defensive reduction doesn't apply on a correct answer; the streak
        // bonus does, once the player already has a qualifying streak.
        if (priorStreak >= STREAK_REWARDS.bonusAtStreak) {
          delta += STREAK_REWARDS.bonusPoints;
          scoreEvents.push({
            playerId: answer.playerId,
            reason: "streak_bonus",
            delta: STREAK_REWARDS.bonusPoints,
            detail: `Streak bonus (streak ${priorStreak})`,
          });
        }
        streakUpdates[answer.playerId] = priorStreak + 1;
      } else {
        if (priorStreak >= STREAK_REWARDS.defensiveAtStreak) {
          delta += STREAK_REWARDS.defensiveReduction; // reduces the (negative) penalty
        }
        streakUpdates[answer.playerId] = 0;
      }
    } else if (!correct) {
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
    if (targetCorrect === undefined) continue; // target didn't answer somehow; skip
    const bettorPredictedCorrect = bet.prediction === "correct";
    const won = bettorPredictedCorrect === targetCorrect;
    scoreEvents.push({
      playerId: bet.bettorId,
      reason: "sidebet",
      delta: won ? SIDE_BET_SCORING.correct : SIDE_BET_SCORING.wrong,
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
