"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECONNECT_GRACE_MS = exports.DEFAULT_ROUND_COUNT = exports.GAME_START_COUNTDOWN_MS = exports.SIDEBET_ALL_DECIDED_COUNTDOWN_MS = exports.CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS = exports.QUESTION_ALL_ANSWERED_COUNTDOWN_MS = exports.PHASE_DURATIONS_MS = void 0;
/**
 * All round-phase durations in milliseconds. The server is authoritative —
 * these values determine when the server advances the phase; clients only
 * render a countdown derived from the server-broadcast `phaseEndsAt`.
 */
exports.PHASE_DURATIONS_MS = {
    question: 30000,
    confidence: 15000,
    board_sidebet: 15000,
    reveal: 10000,
};
exports.QUESTION_ALL_ANSWERED_COUNTDOWN_MS = 3000;
exports.CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS = 5000;
exports.SIDEBET_ALL_DECIDED_COUNTDOWN_MS = 5000;
exports.GAME_START_COUNTDOWN_MS = 3000;
exports.DEFAULT_ROUND_COUNT = 10;
/** Grace period before a disconnected player is treated as unresponsive
 * for the current round (their answer/confidence/sidebet stays "no answer"
 * but the room keeps their seat for this long before removing them). */
exports.RECONNECT_GRACE_MS = 30000;
