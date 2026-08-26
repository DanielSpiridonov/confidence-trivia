import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { RoundPhase } from "@confidence-trivia/shared";

/** Public player info synced to every client. Never carries hidden data
 * (answers, side bet targets of others, etc. — those live server-side
 * only until reveal). */
export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") score: number = 0;
  @type("number") lifetimePoints: number = 0;
  @type("number") streak: number = 0;
  @type("boolean") connected: boolean = true;
  @type("boolean") ready: boolean = false;
  @type("boolean") isHost: boolean = false;
  @type("boolean") hasActedThisPhase: boolean = false; // for "waiting on X players" UI
}

/** What the client is allowed to see about the current question BEFORE
 * reveal — no correct answer field exists here. */
export class PublicQuestionSchema extends Schema {
  @type("string") id: string = "";
  @type("string") qType: string = "";
  @type("string") category: string = "";
  @type("string") difficulty: string = "";
  @type("string") text: string = "";
  @type(["string"]) options = new ArraySchema<string>();
  @type("number") basePoints: number = 1;
}

/** Confidence board entry — visible to everyone once the confidence phase
 * ends, per spec §11 (answers stay hidden, confidence does not). */
export class ConfidenceBoardEntrySchema extends Schema {
  @type("string") playerId: string = "";
  @type("string") confidence: string = "none"; // "none" | "1" | "3" | "5" | "6"
}

/** One reveal-time result row for a single player. */
export class RevealEntrySchema extends Schema {
  @type("string") playerId: string = "";
  @type("string") answerText: string = "";
  @type(["string"]) orderingItems = new ArraySchema<string>();
  @type(["boolean"]) orderingMatches = new ArraySchema<boolean>();
  @type("boolean") correct: boolean = false;
  @type("string") confidence: string = "none";
  @type("number") scoreDelta: number = 0;
  @type("string") detail: string = "";
  @type("number") newStreak: number = 0;
}

export class RoomStateSchema extends Schema {
  @type("string") code: string = "";
  @type("string") gameMode: string = "classic";
  @type("string") phase: RoundPhase = "lobby";
  @type("string") hostId: string = "";
  @type("boolean") isPublic: boolean = false;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();

  @type("number") currentRoundIndex: number = 0; // 0-based
  @type("number") totalRounds: number = 10;
  @type("number") phaseEndsAt: number = 0; // server epoch ms; client only renders from this

  @type(PublicQuestionSchema) currentQuestion = new PublicQuestionSchema();
  @type([ConfidenceBoardEntrySchema]) confidenceBoard = new ArraySchema<ConfidenceBoardEntrySchema>();
  @type([RevealEntrySchema]) revealResults = new ArraySchema<RevealEntrySchema>();
  @type("string") correctAnswerText: string = ""; // only populated once phase === "reveal"

  @type("boolean") gameStarted: boolean = false;
  @type("boolean") gameEnded: boolean = false;
}
