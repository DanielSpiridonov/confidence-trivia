"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
const colyseus_1 = require("colyseus");
const crypto_1 = require("crypto");
const shared_1 = require("@confidence-trivia/shared");
const schema_1 = require("../state/schema");
const questions_1 = require("../content/questions");
const database_1 = require("../database");
const PLAYER_NAME_PATTERN = /^[\p{L}\p{N} ]+$/u;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidPlayerName(name) {
    if (typeof name !== "string")
        return false;
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= 20 && PLAYER_NAME_PATTERN.test(trimmed);
}
function isValidDeviceId(deviceId) {
    return typeof deviceId === "string" && DEVICE_ID_PATTERN.test(deviceId);
}
/**
 * One GameRoom instance = one room-code game session. This class is the
 * ONLY place gameplay state mutates. Clients never set their own score,
 * confidence outcome, or see the answer key before reveal — every intent
 * is validated here first.
 */
class GameRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 16;
        this.locale = "en";
        this.isPublic = false;
        this.questionSet = [];
        // Server-only, per-round scratch data. Not synced — the client only
        // sees the public projections (schema.currentQuestion, confidenceBoard,
        // revealResults) that we derive from this at the right phase.
        this.roundAnswers = new Map();
        this.roundAnswerDrafts = new Map();
        this.roundConfidenceDecisions = new Set();
        this.roundSideBets = new Map();
        this.roundSideBetDecisions = new Set();
        // Stable installation identifiers stay server-only. Connection-scoped
        // session IDs remain the room keys and public gameplay identifiers.
        this.deviceIds = new Map();
        this.matchId = (0, crypto_1.randomUUID)();
        this.gameStartedAt = new Date();
        this.resultsPersisted = false;
        this.damageKnockout = false;
        this.damageWagerReserved = false;
        this.gameStartPending = false;
    }
    async onCreate(options = {}) {
        if (options.gameMode === "friends") {
            throw new Error("Friends Mode is not available yet.");
        }
        // Use the public six-digit code as the actual Colyseus room id so
        // clients can continue joining directly through joinById().
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const candidate = String(Math.floor(100000 + Math.random() * 900000));
            const existingRooms = await colyseus_1.matchMaker.query({ roomId: candidate });
            if (existingRooms.length === 0) {
                this.roomId = candidate;
                break;
            }
        }
        if (!/^\d{6}$/.test(this.roomId)) {
            throw new Error("Could not allocate a unique six-digit room code.");
        }
        this.setState(new schema_1.RoomStateSchema());
        this.state.code = this.roomId;
        this.state.gameMode = options.gameMode === "damage"
            ? "damage"
            : options.gameMode === "ranked"
                ? "ranked"
                : "classic";
        this.state.damageWager = this.state.gameMode === "damage" && (0, shared_1.isDamageWager)(options.damageWager)
            ? options.damageWager
            : this.state.gameMode === "damage" ? shared_1.DEFAULT_DAMAGE_WAGER : 0;
        this.state.damagePot = this.state.damageWager * 2;
        if (this.state.gameMode === "damage")
            this.maxClients = 2;
        if (this.state.gameMode === "ranked")
            this.maxClients = shared_1.RANKED_PLAYER_COUNT;
        this.state.totalRounds = this.state.gameMode === "damage"
            ? 0
            : this.state.gameMode === "ranked"
                ? shared_1.RANKED_FIXED_ROUND_COUNT
                : options.roundCount ?? shared_1.DEFAULT_ROUND_COUNT;
        this.locale = options.locale ?? "en";
        this.isPublic = options.visibility === "public";
        this.state.isPublic = this.isPublic;
        this.questionSet = (0, questions_1.getQuestionSet)(this.state.gameMode === "damage" ? 100 : this.state.totalRounds, options.excludeQuestionIds ?? []);
        await this.setPrivate(!this.isPublic);
        await this.updateLobbyMetadata();
        this.onMessage("toggleReady", (client) => this.handleToggleReady(client));
        this.onMessage("toggleRoomVisibility", (client) => void this.handleToggleRoomVisibility(client));
        this.onMessage("startGame", (client) => void this.handleStartGame(client));
        this.onMessage("submitAnswer", (client, msg) => this.handleSubmitAnswer(client, msg));
        this.onMessage("saveAnswerDraft", (client, msg) => this.handleSaveAnswerDraft(client, msg));
        this.onMessage("submitConfidence", (client, msg) => this.handleSubmitConfidence(client, msg));
        this.onMessage("submitSideBet", (client, msg) => this.handleSubmitSideBet(client, msg));
        this.onMessage("skipSideBet", (client) => this.handleSkipSideBet(client));
    }
    onAuth(_client, options = {}) {
        // Reconnecting players use Colyseus' reconnection flow and do not pass
        // through this admission path. New players may only enter the lobby.
        return !this.state.gameStarted
            && isValidPlayerName(options.name)
            && isValidDeviceId(options.deviceId)
            && ![...this.deviceIds.values()].includes(options.deviceId);
    }
    async onJoin(client, options = {}) {
        const player = new schema_1.PlayerSchema();
        player.id = client.sessionId;
        player.name = isValidPlayerName(options.name) ? options.name.trim() : "Player";
        this.deviceIds.set(client.sessionId, options.deviceId ?? "");
        const deviceId = options.deviceId ?? "";
        player.isHost = this.state.players.size === 0;
        player.health = 15;
        if (player.isHost)
            this.state.hostId = player.id;
        this.state.players.set(client.sessionId, player);
        const stars = await (0, database_1.upsertPlayer)(deviceId, player.name);
        if (stars !== null)
            player.stars = stars;
        void this.updateLobbyMetadata();
    }
    async onLeave(client, consented) {
        const player = this.state.players.get(client.sessionId);
        if (!player)
            return;
        player.connected = false;
        this.shortenConfidencePhaseIfEveryoneDecided();
        this.shortenSideBetPhaseIfEveryoneDecided();
        if (consented) {
            if (this.state.gameMode === "damage" && this.state.gameStarted && !this.state.gameEnded) {
                player.health = 0;
                this.damageKnockout = true;
                this.endGame();
                void this.updateLobbyMetadata();
                return;
            }
            if (this.state.gameMode === "ranked" && this.state.gameStarted) {
                void this.updateLobbyMetadata();
                return;
            }
            const closesLobby = player.isHost && !this.state.gameStarted;
            this.deviceIds.delete(client.sessionId);
            this.state.players.delete(client.sessionId);
            if (closesLobby) {
                this.isPublic = false;
                await this.setPrivate(true);
                await this.disconnect();
                return;
            }
            this.reassignHostIfNeeded();
            void this.updateLobbyMetadata();
            return;
        }
        try {
            // Allow a real reconnect (app backgrounded, network blip) within the
            // grace window before treating the seat as vacated. The round loop
            // does not pause for this — an unresponsive player is simply scored
            // as "no answer" for whichever phase is active, per spec §31.
            await this.allowReconnection(client, shared_1.RECONNECT_GRACE_MS / 1000);
            player.connected = true;
            void this.updateLobbyMetadata();
        }
        catch {
            if (this.state.gameMode === "damage" && this.state.gameStarted && !this.state.gameEnded) {
                player.health = 0;
                this.damageKnockout = true;
                this.endGame();
                void this.updateLobbyMetadata();
                return;
            }
            if (this.state.gameMode === "ranked" && this.state.gameStarted) {
                void this.updateLobbyMetadata();
                return;
            }
            this.deviceIds.delete(client.sessionId);
            this.state.players.delete(client.sessionId);
            this.reassignHostIfNeeded();
            void this.updateLobbyMetadata();
        }
    }
    reassignHostIfNeeded() {
        if (this.state.players.has(this.state.hostId))
            return;
        const next = [...this.state.players.values()][0];
        if (next) {
            next.isHost = true;
            this.state.hostId = next.id;
        }
    }
    async updateLobbyMetadata() {
        const host = this.state.players.get(this.state.hostId);
        await this.setMetadata({
            leaderName: host?.name ?? "",
            playerCount: [...this.state.players.values()].filter((player) => player.connected).length,
            roundCount: this.state.totalRounds,
            locale: this.locale,
            gameMode: this.state.gameMode,
        });
    }
    // ---------------------------------------------------------------------
    // Lobby
    // ---------------------------------------------------------------------
    handleToggleReady(client) {
        const player = this.state.players.get(client.sessionId);
        if (!player || this.state.gameStarted)
            return;
        player.ready = !player.ready;
    }
    async handleToggleRoomVisibility(client) {
        if (client.sessionId !== this.state.hostId || this.state.gameStarted || this.state.phase !== "lobby")
            return;
        const nextIsPublic = !this.isPublic;
        await this.setPrivate(!nextIsPublic);
        this.isPublic = nextIsPublic;
        this.state.isPublic = nextIsPublic;
    }
    async handleStartGame(client) {
        if (client.sessionId !== this.state.hostId)
            return; // only host may start
        if (this.state.gameStarted || this.gameStartPending)
            return;
        if (this.state.gameMode === "damage" ? this.state.players.size !== 2 : this.state.players.size < shared_1.MIN_PLAYERS_TO_START)
            return;
        if (this.state.gameMode === "damage") {
            this.gameStartPending = true;
            const playerEntries = [...this.state.players.values()].flatMap((player) => {
                const deviceId = this.deviceIds.get(player.id);
                return deviceId ? [{ player, deviceId }] : [];
            });
            const reservation = await (0, database_1.reserveDamageWager)(this.matchId, playerEntries.map(({ deviceId }) => deviceId), this.state.damageWager);
            this.gameStartPending = false;
            if (!reservation.ok) {
                const insufficientNames = playerEntries.filter(({ deviceId }) => reservation.insufficientPlayerIds.includes(deviceId)).map(({ player }) => player.name);
                this.broadcast("gameStartError", { code: "insufficient_stars", names: insufficientNames, stake: this.state.damageWager });
                return;
            }
            playerEntries.forEach(({ player, deviceId }) => {
                const balance = reservation.balances.get(deviceId);
                if (balance !== undefined)
                    player.stars = balance;
            });
            this.damageWagerReserved = true;
        }
        this.beginGame();
    }
    beginGame() {
        if (this.state.gameStarted)
            return;
        this.state.gameStarted = true;
        this.gameStartedAt = new Date();
        this.isPublic = false;
        this.state.isPublic = false;
        void this.setPrivate(true);
        this.state.currentRoundIndex = -1;
        this.setPhase("starting", shared_1.GAME_START_COUNTDOWN_MS);
    }
    // ---------------------------------------------------------------------
    // Round flow
    // ---------------------------------------------------------------------
    advanceToNextRound() {
        this.state.currentRoundIndex += 1;
        if (this.state.gameMode !== "damage" && this.state.currentRoundIndex >= this.state.totalRounds) {
            this.endGame();
            return;
        }
        this.roundAnswers.clear();
        this.roundAnswerDrafts.clear();
        this.roundConfidenceDecisions.clear();
        this.roundSideBets.clear();
        this.roundSideBetDecisions.clear();
        this.state.revealResults.clear();
        this.state.confidenceBoard.clear();
        this.state.correctAnswerText = "";
        for (const p of this.state.players.values())
            p.hasActedThisPhase = false;
        const record = this.questionSet[this.state.currentRoundIndex % this.questionSet.length];
        if (!record) {
            this.endGame();
            return;
        }
        const localized = (0, questions_1.localize)(record, this.locale);
        this.state.currentQuestion.id = localized.id;
        this.state.currentQuestion.qType = localized.type;
        this.state.currentQuestion.category = localized.category;
        this.state.currentQuestion.difficulty = localized.difficulty;
        this.state.currentQuestion.text = localized.text;
        this.state.currentQuestion.basePoints = localized.basePoints;
        this.state.currentQuestion.options.clear();
        (localized.options ?? []).forEach((o) => this.state.currentQuestion.options.push(o));
        this.setPhase("question", shared_1.PHASE_DURATIONS_MS.question);
    }
    setPhase(phase, durationMs) {
        this.state.phase = phase;
        this.state.phaseEndsAt = Date.now() + durationMs;
        if (this.phaseTimeout)
            clearTimeout(this.phaseTimeout);
        this.phaseTimeout = setTimeout(() => this.advancePhase(), durationMs);
    }
    /** Server-driven phase transition — never triggered by a client message. */
    advancePhase() {
        switch (this.state.phase) {
            case "starting":
                this.advanceToNextRound();
                break;
            case "question":
                this.finalizeAnswerDrafts();
                if (this.state.gameMode === "damage") {
                    this.resolveDamageRound();
                    this.setPhase("reveal", shared_1.PHASE_DURATIONS_MS.reveal);
                    break;
                }
                this.setPhase("confidence", shared_1.PHASE_DURATIONS_MS.confidence);
                this.shortenConfidencePhaseIfEveryoneDecided();
                break;
            case "confidence":
                this.buildConfidenceBoard();
                this.setPhase("board_sidebet", shared_1.PHASE_DURATIONS_MS.board_sidebet);
                break;
            case "board_sidebet":
                this.resolveRound();
                this.setPhase("reveal", shared_1.PHASE_DURATIONS_MS.reveal);
                break;
            case "reveal":
                if (this.state.gameMode === "damage" && this.damageKnockout)
                    this.endGame();
                else
                    this.advanceToNextRound();
                break;
            default:
                break;
        }
    }
    // ---------------------------------------------------------------------
    // Player actions (validated intents)
    // ---------------------------------------------------------------------
    handleSubmitAnswer(client, msg) {
        if (this.state.phase !== "question")
            return;
        if (this.roundAnswers.has(client.sessionId))
            return; // one answer per round
        this.roundAnswers.set(client.sessionId, {
            playerId: client.sessionId,
            value: msg.value,
            confidence: "none", // confidence is submitted separately, next phase
            submittedAt: Date.now(),
        });
        const player = this.state.players.get(client.sessionId);
        if (player)
            player.hasActedThisPhase = true;
        const connectedPlayers = [...this.state.players.values()].filter((p) => p.connected);
        const everyoneConnectedAnswered = connectedPlayers.length > 0
            && connectedPlayers.every((p) => this.roundAnswers.has(p.id));
        const remainingMs = this.state.phaseEndsAt - Date.now();
        if (everyoneConnectedAnswered && remainingMs > shared_1.QUESTION_ALL_ANSWERED_COUNTDOWN_MS) {
            this.setPhase("question", shared_1.QUESTION_ALL_ANSWERED_COUNTDOWN_MS);
        }
    }
    handleSaveAnswerDraft(client, msg) {
        if (this.state.phase !== "question" || this.roundAnswers.has(client.sessionId))
            return;
        const questionType = this.state.currentQuestion.qType;
        if (!["word", "estimate", "closest_answer"].includes(questionType))
            return;
        if (typeof msg?.value !== "string")
            return;
        this.roundAnswerDrafts.set(client.sessionId, msg.value.slice(0, questionType === "word" ? 32 : 12));
    }
    finalizeAnswerDrafts() {
        const questionType = this.state.currentQuestion.qType;
        for (const [playerId, draft] of this.roundAnswerDrafts) {
            if (this.roundAnswers.has(playerId))
                continue;
            const trimmed = draft.trim();
            if (!trimmed)
                continue;
            const value = questionType === "word" ? trimmed : Number(trimmed.replace(",", "."));
            if (questionType !== "word" && !Number.isFinite(value))
                continue;
            this.roundAnswers.set(playerId, {
                playerId,
                value: value,
                confidence: "none",
                submittedAt: Date.now(),
            });
        }
    }
    handleSubmitConfidence(client, msg) {
        if (this.state.phase !== "confidence")
            return;
        const isRevision = this.roundConfidenceDecisions.has(client.sessionId);
        if (isRevision && this.state.phaseEndsAt - Date.now() <= shared_1.CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS)
            return;
        const existing = this.roundAnswers.get(client.sessionId);
        if (!existing)
            return; // must have answered to set confidence
        if (!["none", 1, 3, 5, 6].includes(msg.value))
            return;
        existing.confidence = msg.value;
        this.roundConfidenceDecisions.add(client.sessionId);
        this.shortenConfidencePhaseIfEveryoneDecided();
    }
    shortenConfidencePhaseIfEveryoneDecided() {
        if (this.state.phase !== "confidence")
            return;
        const connectedPlayers = [...this.state.players.values()].filter((player) => player.connected);
        const everyoneDecided = connectedPlayers.length > 0
            && connectedPlayers.every((player) => (!this.roundAnswers.has(player.id) || this.roundConfidenceDecisions.has(player.id)));
        const remainingMs = this.state.phaseEndsAt - Date.now();
        if (everyoneDecided && remainingMs > shared_1.CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS) {
            this.setPhase("confidence", shared_1.CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS);
        }
    }
    handleSubmitSideBet(client, msg) {
        if (this.state.phase !== "board_sidebet")
            return;
        const isRevision = this.roundSideBetDecisions.has(client.sessionId);
        if (isRevision && this.state.phaseEndsAt - Date.now() <= shared_1.SIDEBET_ALL_DECIDED_COUNTDOWN_MS)
            return;
        if (msg.targetId === client.sessionId)
            return; // cannot bet on self
        if (!this.roundAnswers.has(msg.targetId))
            return; // target must exist & have answered
        if (msg.prediction !== "correct" && msg.prediction !== "wrong")
            return;
        this.roundSideBets.set(client.sessionId, {
            bettorId: client.sessionId,
            targetId: msg.targetId,
            prediction: msg.prediction,
        });
        this.roundSideBetDecisions.add(client.sessionId);
        this.shortenSideBetPhaseIfEveryoneDecided();
    }
    handleSkipSideBet(client) {
        if (this.state.phase !== "board_sidebet")
            return;
        const isRevision = this.roundSideBetDecisions.has(client.sessionId);
        if (isRevision && this.state.phaseEndsAt - Date.now() <= shared_1.SIDEBET_ALL_DECIDED_COUNTDOWN_MS)
            return;
        this.roundSideBets.delete(client.sessionId);
        this.roundSideBetDecisions.add(client.sessionId);
        this.shortenSideBetPhaseIfEveryoneDecided();
    }
    shortenSideBetPhaseIfEveryoneDecided() {
        if (this.state.phase !== "board_sidebet")
            return;
        const connectedPlayers = [...this.state.players.values()].filter((player) => player.connected);
        const everyoneDecided = connectedPlayers.length > 0
            && connectedPlayers.every((player) => this.roundSideBetDecisions.has(player.id));
        const remainingMs = this.state.phaseEndsAt - Date.now();
        if (everyoneDecided && remainingMs > shared_1.SIDEBET_ALL_DECIDED_COUNTDOWN_MS) {
            this.setPhase("board_sidebet", shared_1.SIDEBET_ALL_DECIDED_COUNTDOWN_MS);
        }
    }
    // ---------------------------------------------------------------------
    // Phase transition side effects
    // ---------------------------------------------------------------------
    /** Confidence board (spec §11): everyone's confidence, nobody's answer. */
    buildConfidenceBoard() {
        this.state.confidenceBoard.clear();
        for (const [playerId] of this.state.players.entries()) {
            const answer = this.roundAnswers.get(playerId);
            const entry = new schema_1.ConfidenceBoardEntrySchema();
            entry.playerId = playerId;
            entry.confidence = String(answer?.confidence ?? "none");
            this.state.confidenceBoard.push(entry);
        }
    }
    getClosestAnswerWinningValues(correctAnswer) {
        const target = Number(correctAnswer);
        if (!Number.isFinite(target))
            return new Set();
        let closestDistance = Number.POSITIVE_INFINITY;
        const winningValues = new Set();
        for (const answer of this.roundAnswers.values()) {
            const submittedValue = Number(answer.value);
            if (!Number.isFinite(submittedValue))
                continue;
            const distance = Math.abs(submittedValue - target);
            if (distance < closestDistance) {
                closestDistance = distance;
                winningValues.clear();
                winningValues.add(submittedValue);
            }
            else if (distance === closestDistance) {
                winningValues.add(submittedValue);
            }
        }
        return winningValues;
    }
    resolveDamageRound() {
        const record = this.questionSet[this.state.currentRoundIndex % this.questionSet.length];
        const damageValue = shared_1.DIFFICULTY_REWARDS[record.difficulty];
        const correctAnswer = (0, questions_1.getLocalizedCorrectAnswer)(record, this.locale);
        const closestValues = record.type === "closest_answer" ? this.getClosestAnswerWinningValues(correctAnswer) : null;
        const isWinningAnswer = (value) => record.type === "closest_answer"
            ? Number.isFinite(Number(value)) && Boolean(closestValues?.has(Number(value)))
            : (0, shared_1.isAnswerCorrect)(record.type, value, correctAnswer);
        const correctness = new Map();
        const attacks = new Map();
        for (const player of this.state.players.values()) {
            const answer = this.roundAnswers.get(player.id);
            const correct = answer ? isWinningAnswer(answer.value) : false;
            correctness.set(player.id, correct);
            if (!correct) {
                if (!player.shieldPending)
                    player.damageStreak = 0;
                continue;
            }
            attacks.set(player.id, damageValue);
            if (!player.shieldPending) {
                player.damageStreak += 1;
                if (player.damageStreak >= 3) {
                    player.shieldPending = true;
                    player.damageStreak = 0;
                }
            }
        }
        for (const attacker of this.state.players.values()) {
            const damage = attacks.get(attacker.id) ?? 0;
            if (damage <= 0)
                continue;
            const target = [...this.state.players.values()].find((player) => player.id !== attacker.id);
            if (!target)
                continue;
            const absorbed = target.shieldPending ? damage : Math.min(target.shield, damage);
            if (target.shieldPending)
                target.shieldPending = false;
            else
                target.shield -= absorbed;
            target.health = Math.max(0, target.health - (damage - absorbed));
            attacker.score += damage;
        }
        this.state.revealResults.clear();
        for (const player of this.state.players.values()) {
            const answer = this.roundAnswers.get(player.id);
            const entry = new schema_1.RevealEntrySchema();
            entry.playerId = player.id;
            entry.answerText = answer ? (0, questions_1.localizeAnswer)(record, this.locale, answer.value) : "";
            entry.correct = correctness.get(player.id) ?? false;
            entry.scoreDelta = attacks.get(player.id) ?? 0;
            entry.damageDealt = attacks.get(player.id) ?? 0;
            entry.shieldGained = 0;
            entry.newStreak = player.damageStreak;
            entry.detail = entry.correct ? `Damage ${entry.damageDealt}` : "No damage";
            this.state.revealResults.push(entry);
        }
        this.state.correctAnswerText = (0, questions_1.localizeAnswer)(record, this.locale, correctAnswer);
        this.damageKnockout = [...this.state.players.values()].some((player) => player.health <= 0);
    }
    resolveRound() {
        const record = this.questionSet[this.state.currentRoundIndex % this.questionSet.length];
        const correctAnswer = (0, questions_1.getLocalizedCorrectAnswer)(record, this.locale);
        const currentStreaks = {};
        for (const [id, p] of this.state.players.entries())
            currentStreaks[id] = p.streak;
        const closestAnswerWinningValues = record.type === "closest_answer"
            ? this.getClosestAnswerWinningValues(correctAnswer)
            : null;
        const isWinningAnswer = (value) => {
            if (record.type === "closest_answer") {
                const submittedValue = Number(value);
                return Number.isFinite(submittedValue) && Boolean(closestAnswerWinningValues?.has(submittedValue));
            }
            return (0, shared_1.isAnswerCorrect)(record.type, value, correctAnswer);
        };
        const result = (0, shared_1.computeRoundResults)({
            correctAnswer,
            basePoints: record.basePoints,
            answers: [...this.roundAnswers.values()],
            sideBets: [...this.roundSideBets.values()],
            currentStreaks,
            isAnswerCorrect: (value) => isWinningAnswer(value),
        });
        // Apply score deltas
        for (const event of result.scoreEvents) {
            const player = this.state.players.get(event.playerId);
            if (player)
                player.score += event.delta;
        }
        // Apply streak updates
        for (const [playerId, streak] of Object.entries(result.streakUpdates)) {
            const player = this.state.players.get(playerId);
            if (player)
                player.streak = streak;
        }
        // Build the public reveal projection (per-player: correct?, confidence,
        // total delta this round, human-readable detail, new streak).
        this.state.revealResults.clear();
        const deltaByPlayer = new Map();
        const detailByPlayer = new Map();
        for (const event of result.scoreEvents) {
            deltaByPlayer.set(event.playerId, (deltaByPlayer.get(event.playerId) ?? 0) + event.delta);
            const list = detailByPlayer.get(event.playerId) ?? [];
            list.push(event.detail);
            detailByPlayer.set(event.playerId, list);
        }
        for (const player of this.state.players.values()) {
            const answer = this.roundAnswers.get(player.id);
            const entry = new schema_1.RevealEntrySchema();
            const details = detailByPlayer.get(player.id) ?? [];
            const submittedOrdering = Array.isArray(answer?.value) ? answer.value.map((value) => Number(value)) : null;
            const correctOrdering = Array.isArray(correctAnswer) ? correctAnswer.map((value) => Number(value)) : null;
            entry.playerId = player.id;
            entry.answerText = answer ? (0, questions_1.localizeAnswer)(record, this.locale, answer.value) : "";
            if (record.type === "ordering" && submittedOrdering && correctOrdering) {
                const localizedItems = (0, questions_1.localizeAnswerItems)(record, this.locale, submittedOrdering);
                localizedItems.forEach((itemText, index) => {
                    entry.orderingItems.push(itemText);
                    entry.orderingMatches.push(submittedOrdering[index] === correctOrdering[index]);
                });
            }
            entry.correct = answer ? isWinningAnswer(answer.value) : false;
            entry.confidence = String(answer?.confidence ?? "none");
            entry.scoreDelta = deltaByPlayer.get(player.id) ?? 0;
            entry.detail = answer ? details.join(" · ") : ["No answer", ...details].join(" · ");
            entry.newStreak = result.streakUpdates[player.id] ?? 0;
            this.state.revealResults.push(entry);
        }
        this.state.correctAnswerText = (0, questions_1.localizeAnswer)(record, this.locale, correctAnswer);
    }
    endGame() {
        this.state.phase = "final_results";
        this.state.gameEnded = true;
        if (this.phaseTimeout)
            clearTimeout(this.phaseTimeout);
        void this.persistFinalResults();
    }
    async persistFinalResults() {
        if (this.resultsPersisted)
            return;
        this.resultsPersisted = true;
        const rankedPlayers = [...this.state.players.values()]
            .sort((left, right) => {
            if (this.state.gameMode === "ranked" && left.connected !== right.connected)
                return left.connected ? -1 : 1;
            return this.state.gameMode === "damage" ? right.health - left.health : right.score - left.score;
        });
        const completedPlayers = rankedPlayers.flatMap((player, index) => {
            const deviceId = this.deviceIds.get(player.id);
            if (!deviceId)
                return [];
            const priorPlayer = rankedPlayers[index - 1];
            const rankingValue = this.state.gameMode === "damage" ? player.health : player.score;
            const priorRankingValue = priorPlayer ? (this.state.gameMode === "damage" ? priorPlayer.health : priorPlayer.score) : null;
            const finalRank = this.state.gameMode === "ranked" && !player.connected
                ? 4
                : priorPlayer && priorPlayer.connected === player.connected && priorRankingValue === rankingValue
                    ? rankedPlayers.findIndex((candidate) => (this.state.gameMode === "damage" ? candidate.health : candidate.score) === rankingValue) + 1
                    : index + 1;
            return [{
                    deviceId,
                    displayName: player.name,
                    finalScore: this.state.gameMode === "damage" ? player.health : player.score,
                    finalRank,
                }];
        });
        if (this.state.gameMode === "damage" && this.damageWagerReserved) {
            const winners = completedPlayers.filter((player) => player.finalRank === 1);
            await (0, database_1.settleDamageWager)(this.matchId, winners.length === 1 ? winners[0].deviceId : null);
        }
        const progressUpdates = await (0, database_1.saveCompletedMatch)({
            id: this.matchId,
            roomCode: this.state.code,
            gameMode: this.state.gameMode,
            locale: this.locale,
            roundCount: this.state.gameMode === "damage" ? this.state.currentRoundIndex + 1 : this.state.totalRounds,
            startedAt: this.gameStartedAt,
            players: completedPlayers,
        });
        for (const player of this.state.players.values()) {
            const deviceId = this.deviceIds.get(player.id);
            const update = deviceId ? progressUpdates.get(deviceId) : undefined;
            if (update) {
                player.stars = update.stars;
                player.starsEarnedThisGame = update.starsEarned;
                player.rewardedGamesToday = update.rewardedGamesToday;
            }
        }
    }
}
exports.GameRoom = GameRoom;
