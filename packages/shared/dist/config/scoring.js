"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIFFICULTY_REWARDS = exports.DEFAULT_BASE_POINTS = exports.SIDE_BET_SCORING = exports.CONFIDENCE_SCORING = void 0;
/**
 * Canonical initial scoring table (project spec §47).
 * Do not change these values casually — they were explicitly balanced.
 * Everything reads from here; nothing hardcodes points elsewhere.
 */
exports.CONFIDENCE_SCORING = {
    none: { correct: 1, wrong: 0 },
    1: { correct: 1, wrong: -1 },
    3: { correct: 2, wrong: -2 },
    5: { correct: 3, wrong: -4 },
    6: { correct: 4, wrong: -5 },
};
exports.SIDE_BET_SCORING = {
    correct: 1, // bettor's prediction was right
    wrong: -1, // bettor's prediction was wrong
};
/** Base points for a normal question. Special/hard questions may override
 * this per-question via QuestionRecord.basePoints — the confidence table
 * above is a modifier applied on top of, not instead of, basePoints. */
exports.DEFAULT_BASE_POINTS = 1;
exports.DIFFICULTY_REWARDS = {
    easy: 1,
    medium: 2,
    hard: 3,
};
