/**
 * All round-phase durations in milliseconds. The server is authoritative —
 * these values determine when the server advances the phase; clients only
 * render a countdown derived from the server-broadcast `phaseEndsAt`.
 */
export const PHASE_DURATIONS_MS = {
  question: 30_000,
  confidence: 15_000,
  board_sidebet: 15_000,
  reveal: 10_000,
} as const;

export const QUESTION_ALL_ANSWERED_COUNTDOWN_MS = 3_000;
export const CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS = 5_000;
export const SIDEBET_ALL_DECIDED_COUNTDOWN_MS = 5_000;
export const GAME_START_COUNTDOWN_MS = 3_000;

export const DEFAULT_ROUND_COUNT = 10;

/** Grace period before a disconnected player is treated as unresponsive
 * for the current round (their answer/confidence/sidebet stays "no answer"
 * but the room keeps their seat for this long before removing them). */
export const RECONNECT_GRACE_MS = 30_000;
