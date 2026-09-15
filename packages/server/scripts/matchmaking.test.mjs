import assert from "node:assert/strict";
import test from "node:test";
import { MATCHMAKING_FILTERS } from "../dist/rooms/matchmaking.js";

test("language preference does not split matchmaking queues", () => {
  assert.equal(MATCHMAKING_FILTERS.includes("locale"), false);
});

test("mode, wager, and friend challenges remain isolated", () => {
  assert.deepEqual([...MATCHMAKING_FILTERS], ["gameMode", "damageWager", "challengeId"]);
});
