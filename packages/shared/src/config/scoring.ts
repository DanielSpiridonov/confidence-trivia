import { ConfidenceValue } from "../types";

/**
 * Canonical initial scoring table (project spec §47).
 * Do not change these values casually — they were explicitly balanced.
 * Everything reads from here; nothing hardcodes points elsewhere.
 */
export const CONFIDENCE_SCORING: Record<ConfidenceValue, { correct: number; wrong: number }> = {
  none: { correct: 0, wrong: 0 },
  1: { correct: 1, wrong: -1 },
  3: { correct: 2, wrong: -2 },
  5: { correct: 3, wrong: -4 },
  6: { correct: 4, wrong: -5 },
};

export const SIDE_BET_SCORING = {
  correct: 1, // bettor's prediction was right
  wrong: -1,  // bettor's prediction was wrong
};

/** Base points for a normal question. Special/hard questions may override
 * this per-question via QuestionRecord.basePoints — the confidence table
 * above is a modifier applied on top of, not instead of, basePoints. */
export const DEFAULT_BASE_POINTS = 1;

export const DIFFICULTY_REWARDS = {
  easy: 1,
  medium: 2,
  hard: 3,
} as const;
