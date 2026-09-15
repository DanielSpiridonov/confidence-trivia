/**
 * Fields that define whether an open room is eligible for joinOrCreate().
 *
 * Locale is intentionally absent: a player's display language must never split
 * Ranked or Damage matchmaking into separate queues.
 */
export const MATCHMAKING_FILTERS = ["gameMode", "damageWager", "challengeId"] as const;

