/**
 * All round-phase durations in milliseconds. The server is authoritative —
 * these values determine when the server advances the phase; clients only
 * render a countdown derived from the server-broadcast `phaseEndsAt`.
 */
export declare const PHASE_DURATIONS_MS: {
    readonly question: 30000;
    readonly confidence: 15000;
    readonly board_sidebet: 15000;
    readonly reveal: 10000;
};
export declare const QUESTION_ALL_ANSWERED_COUNTDOWN_MS = 3000;
export declare const CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS = 5000;
export declare const SIDEBET_ALL_DECIDED_COUNTDOWN_MS = 5000;
export declare const GAME_START_COUNTDOWN_MS = 3000;
export declare const DEFAULT_ROUND_COUNT = 10;
/** Grace period before a disconnected player is treated as unresponsive
 * for the current round (their answer/confidence/sidebet stays "no answer"
 * but the room keeps their seat for this long before removing them). */
export declare const RECONNECT_GRACE_MS = 30000;
