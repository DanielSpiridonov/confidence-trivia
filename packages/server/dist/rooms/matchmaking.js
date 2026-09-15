"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATCHMAKING_FILTERS = void 0;
/**
 * Fields that define whether an open room is eligible for joinOrCreate().
 *
 * Locale is intentionally absent: a player's display language must never split
 * Ranked or Damage matchmaking into separate queues.
 */
exports.MATCHMAKING_FILTERS = ["gameMode", "damageWager", "challengeId"];
