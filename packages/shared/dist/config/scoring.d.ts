import { ConfidenceValue } from "../types";
/**
 * Canonical initial scoring table (project spec §47).
 * Do not change these values casually — they were explicitly balanced.
 * Everything reads from here; nothing hardcodes points elsewhere.
 */
export declare const CONFIDENCE_SCORING: Record<ConfidenceValue, {
    correct: number;
    wrong: number;
}>;
export declare const SIDE_BET_SCORING: {
    correct: number;
    wrong: number;
};
/** Base points for a normal question. Special/hard questions may override
 * this per-question via QuestionRecord.basePoints — the confidence table
 * above is a modifier applied on top of, not instead of, basePoints. */
export declare const DEFAULT_BASE_POINTS = 1;
export declare const DIFFICULTY_REWARDS: {
    readonly easy: 1;
    readonly medium: 2;
    readonly hard: 3;
};
