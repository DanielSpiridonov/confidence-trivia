"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STREAK_REWARDS = exports.STREAK_MECHANICS_ENABLED = exports.STREAK_QUALIFYING_CONFIDENCE = void 0;
/**
 * Streak system config (project spec §15–16). Kept isolated so mechanical
 * rewards can be disabled during playtesting while the visual streak
 * (the 🔥 counter itself) stays on regardless.
 *
 * NOTE: This module is scaffolded for Phase 3. The Phase 1 GameRoom
 * increments/resets the raw streak counter (needed for the reveal screen's
 * "streak changes" display) but does not yet apply STREAK_BONUS or
 * DEFENSIVE_REDUCTION — that lands with the rest of Phase 3.
 */
/** A streak only advances on a *correct* answer at one of these confidence
 * levels. Confidence "none" and 1 never advance it; any wrong answer at a
 * high-confidence level resets it to 0. */
exports.STREAK_QUALIFYING_CONFIDENCE = [5, 6];
exports.STREAK_MECHANICS_ENABLED = true;
exports.STREAK_REWARDS = {
    /** At streak >= 2, the next successful high-confidence answer also gets
     * this flat bonus on top of normal confidence scoring. */
    bonusAtStreak: 2,
    bonusPoints: 1,
    /** At streak >= 3, the next wrong high-confidence answer has its penalty
     * reduced by this many points (a small defensive cushion), before the
     * streak resets. */
    defensiveAtStreak: 3,
    defensiveReduction: 1,
};
