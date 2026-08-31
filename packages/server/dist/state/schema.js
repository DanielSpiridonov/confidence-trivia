"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomStateSchema = exports.RevealEntrySchema = exports.ConfidenceBoardEntrySchema = exports.PublicQuestionSchema = exports.PlayerSchema = void 0;
const schema_1 = require("@colyseus/schema");
/** Public player info synced to every client. Never carries hidden data
 * (answers, side bet targets of others, etc. — those live server-side
 * only until reveal). */
class PlayerSchema extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.id = "";
        this.name = "";
        this.nameColor = "#FFFFFF";
        this.avatarId = "smart_owl";
        this.frameId = "";
        this.score = 0;
        this.stars = 0;
        this.starsEarnedThisGame = 0;
        this.rewardedGamesToday = 0;
        this.streak = 0;
        this.health = 15;
        this.shield = 0;
        this.damageStreak = 0;
        this.shieldPending = false;
        this.connected = true;
        this.ready = false;
        this.isHost = false;
        this.hasActedThisPhase = false; // for "waiting on X players" UI
    }
}
exports.PlayerSchema = PlayerSchema;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PlayerSchema.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PlayerSchema.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PlayerSchema.prototype, "nameColor", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PlayerSchema.prototype, "avatarId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PlayerSchema.prototype, "frameId", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "score", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "stars", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "starsEarnedThisGame", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "rewardedGamesToday", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "streak", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "health", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "shield", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PlayerSchema.prototype, "damageStreak", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PlayerSchema.prototype, "shieldPending", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PlayerSchema.prototype, "connected", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PlayerSchema.prototype, "ready", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PlayerSchema.prototype, "isHost", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PlayerSchema.prototype, "hasActedThisPhase", void 0);
/** What the client is allowed to see about the current question BEFORE
 * reveal — no correct answer field exists here. */
class PublicQuestionSchema extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.id = "";
        this.qType = "";
        this.category = "";
        this.difficulty = "";
        this.text = "";
        this.options = new schema_1.ArraySchema();
        this.basePoints = 1;
    }
}
exports.PublicQuestionSchema = PublicQuestionSchema;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PublicQuestionSchema.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PublicQuestionSchema.prototype, "qType", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PublicQuestionSchema.prototype, "category", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PublicQuestionSchema.prototype, "difficulty", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PublicQuestionSchema.prototype, "text", void 0);
__decorate([
    (0, schema_1.type)(["string"]),
    __metadata("design:type", Object)
], PublicQuestionSchema.prototype, "options", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PublicQuestionSchema.prototype, "basePoints", void 0);
/** Confidence board entry — visible to everyone once the confidence phase
 * ends, per spec §11 (answers stay hidden, confidence does not). */
class ConfidenceBoardEntrySchema extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.playerId = "";
        this.confidence = "none"; // "none" | "1" | "3" | "5" | "6"
    }
}
exports.ConfidenceBoardEntrySchema = ConfidenceBoardEntrySchema;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], ConfidenceBoardEntrySchema.prototype, "playerId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], ConfidenceBoardEntrySchema.prototype, "confidence", void 0);
/** One reveal-time result row for a single player. */
class RevealEntrySchema extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.playerId = "";
        this.answerText = "";
        this.orderingItems = new schema_1.ArraySchema();
        this.orderingMatches = new schema_1.ArraySchema();
        this.correct = false;
        this.confidence = "none";
        this.scoreDelta = 0;
        this.detail = "";
        this.newStreak = 0;
        this.damageDealt = 0;
        this.shieldGained = 0;
    }
}
exports.RevealEntrySchema = RevealEntrySchema;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RevealEntrySchema.prototype, "playerId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RevealEntrySchema.prototype, "answerText", void 0);
__decorate([
    (0, schema_1.type)(["string"]),
    __metadata("design:type", Object)
], RevealEntrySchema.prototype, "orderingItems", void 0);
__decorate([
    (0, schema_1.type)(["boolean"]),
    __metadata("design:type", Object)
], RevealEntrySchema.prototype, "orderingMatches", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], RevealEntrySchema.prototype, "correct", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RevealEntrySchema.prototype, "confidence", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RevealEntrySchema.prototype, "scoreDelta", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RevealEntrySchema.prototype, "detail", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RevealEntrySchema.prototype, "newStreak", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RevealEntrySchema.prototype, "damageDealt", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RevealEntrySchema.prototype, "shieldGained", void 0);
class RoomStateSchema extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.code = "";
        this.gameMode = "classic";
        this.phase = "lobby";
        this.hostId = "";
        this.isPublic = false;
        this.damageWager = 0;
        this.damagePot = 0;
        this.pendingDamageBonus = 0;
        this.players = new schema_1.MapSchema();
        this.currentRoundIndex = 0; // 0-based
        this.totalRounds = 10;
        this.phaseEndsAt = 0; // server epoch ms; client only renders from this
        this.currentQuestion = new PublicQuestionSchema();
        this.confidenceBoard = new schema_1.ArraySchema();
        this.revealResults = new schema_1.ArraySchema();
        this.correctAnswerText = ""; // only populated once phase === "reveal"
        this.gameStarted = false;
        this.gameEnded = false;
    }
}
exports.RoomStateSchema = RoomStateSchema;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RoomStateSchema.prototype, "code", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RoomStateSchema.prototype, "gameMode", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RoomStateSchema.prototype, "phase", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RoomStateSchema.prototype, "hostId", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], RoomStateSchema.prototype, "isPublic", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RoomStateSchema.prototype, "damageWager", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RoomStateSchema.prototype, "damagePot", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RoomStateSchema.prototype, "pendingDamageBonus", void 0);
__decorate([
    (0, schema_1.type)({ map: PlayerSchema }),
    __metadata("design:type", Object)
], RoomStateSchema.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RoomStateSchema.prototype, "currentRoundIndex", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RoomStateSchema.prototype, "totalRounds", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], RoomStateSchema.prototype, "phaseEndsAt", void 0);
__decorate([
    (0, schema_1.type)(PublicQuestionSchema),
    __metadata("design:type", Object)
], RoomStateSchema.prototype, "currentQuestion", void 0);
__decorate([
    (0, schema_1.type)([ConfidenceBoardEntrySchema]),
    __metadata("design:type", Object)
], RoomStateSchema.prototype, "confidenceBoard", void 0);
__decorate([
    (0, schema_1.type)([RevealEntrySchema]),
    __metadata("design:type", Object)
], RoomStateSchema.prototype, "revealResults", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], RoomStateSchema.prototype, "correctAnswerText", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], RoomStateSchema.prototype, "gameStarted", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], RoomStateSchema.prototype, "gameEnded", void 0);
