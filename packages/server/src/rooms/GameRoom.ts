import { Room, Client, matchMaker } from "colyseus";
import { randomUUID } from "crypto";
import {
  PHASE_DURATIONS_MS,
  QUESTION_ALL_ANSWERED_COUNTDOWN_MS,
  CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS,
  SIDEBET_ALL_DECIDED_COUNTDOWN_MS,
  GAME_START_COUNTDOWN_MS,
  DEFAULT_ROUND_COUNT,
  MIN_PLAYERS_TO_START,
  RECONNECT_GRACE_MS,
  computeRoundResults,
  isAnswerCorrect,
  ConfidenceValue,
  PlayerAnswer,
  SideBet,
  QuestionRecord,
  Locale,
  GameMode,
} from "@confidence-trivia/shared";
import {
  RoomStateSchema,
  PlayerSchema,
  ConfidenceBoardEntrySchema,
  RevealEntrySchema,
} from "../state/schema";
import { getLocalizedCorrectAnswer, getQuestionSet, localize, localizeAnswer, localizeAnswerItems } from "../content/questions";
import { saveCompletedMatch, upsertPlayer } from "../database";

interface JoinOptions {
  deviceId?: string;
  name?: string;
}

interface CreateOptions extends JoinOptions {
  roundCount?: number;
  locale?: Locale;
  gameMode?: GameMode;
  excludeQuestionIds?: string[];
  visibility?: "private" | "public";
}

const PLAYER_NAME_PATTERN = /^[\p{L}\p{N} ]+$/u;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPlayerName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 20 && PLAYER_NAME_PATTERN.test(trimmed);
}

function isValidDeviceId(deviceId: unknown): deviceId is string {
  return typeof deviceId === "string" && DEVICE_ID_PATTERN.test(deviceId);
}

/**
 * One GameRoom instance = one room-code game session. This class is the
 * ONLY place gameplay state mutates. Clients never set their own score,
 * confidence outcome, or see the answer key before reveal — every intent
 * is validated here first.
 */
export class GameRoom extends Room<RoomStateSchema> {
  maxClients = 16;

  private locale: Locale = "en";
  private isPublic = false;
  private questionSet: QuestionRecord[] = [];

  // Server-only, per-round scratch data. Not synced — the client only
  // sees the public projections (schema.currentQuestion, confidenceBoard,
  // revealResults) that we derive from this at the right phase.
  private roundAnswers = new Map<string, PlayerAnswer>();
  private roundAnswerDrafts = new Map<string, string>();
  private roundConfidenceDecisions = new Set<string>();
  private roundSideBets = new Map<string, SideBet>();
  private roundSideBetDecisions = new Set<string>();
  private phaseTimeout?: NodeJS.Timeout;
  // Stable installation identifiers stay server-only. Connection-scoped
  // session IDs remain the room keys and public gameplay identifiers.
  private deviceIds = new Map<string, string>();
  private readonly matchId = randomUUID();
  private gameStartedAt = new Date();
  private resultsPersisted = false;

  async onCreate(options: CreateOptions = {}) {
    if (options.gameMode === "friends") {
      throw new Error("Friends Mode is not available yet.");
    }
    // Use the public six-digit code as the actual Colyseus room id so
    // clients can continue joining directly through joinById().
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = String(Math.floor(100_000 + Math.random() * 900_000));
      const existingRooms = await matchMaker.query({ roomId: candidate });
      if (existingRooms.length === 0) {
        this.roomId = candidate;
        break;
      }
    }
    if (!/^\d{6}$/.test(this.roomId)) {
      throw new Error("Could not allocate a unique six-digit room code.");
    }

    this.setState(new RoomStateSchema());
    this.state.code = this.roomId;
    this.state.gameMode = "classic";
    this.state.totalRounds = options.roundCount ?? DEFAULT_ROUND_COUNT;
    this.locale = options.locale ?? "en";
    this.isPublic = options.visibility === "public";
    this.state.isPublic = this.isPublic;
    this.questionSet = getQuestionSet(this.state.totalRounds, options.excludeQuestionIds ?? []);
    await this.setPrivate(!this.isPublic);
    await this.updateLobbyMetadata();

    this.onMessage("toggleReady", (client) => this.handleToggleReady(client));
    this.onMessage("toggleRoomVisibility", (client) => void this.handleToggleRoomVisibility(client));
    this.onMessage("startGame", (client) => this.handleStartGame(client));
    this.onMessage("submitAnswer", (client, msg) => this.handleSubmitAnswer(client, msg));
    this.onMessage("saveAnswerDraft", (client, msg) => this.handleSaveAnswerDraft(client, msg));
    this.onMessage("submitConfidence", (client, msg) => this.handleSubmitConfidence(client, msg));
    this.onMessage("submitSideBet", (client, msg) => this.handleSubmitSideBet(client, msg));
    this.onMessage("skipSideBet", (client) => this.handleSkipSideBet(client));
  }

  onAuth(_client: Client, options: JoinOptions = {}) {
    // Reconnecting players use Colyseus' reconnection flow and do not pass
    // through this admission path. New players may only enter the lobby.
    return !this.state.gameStarted
      && isValidPlayerName(options.name)
      && isValidDeviceId(options.deviceId)
      && ![...this.deviceIds.values()].includes(options.deviceId);
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = isValidPlayerName(options.name) ? options.name.trim() : "Player";
    this.deviceIds.set(client.sessionId, options.deviceId ?? "");
    const deviceId = options.deviceId ?? "";
    void upsertPlayer(deviceId, player.name).then((stars) => {
      const joinedPlayer = this.state.players.get(client.sessionId);
      if (joinedPlayer && stars !== null) joinedPlayer.stars = stars;
    });
    player.isHost = this.state.players.size === 0;
    if (player.isHost) this.state.hostId = player.id;
    this.state.players.set(client.sessionId, player);
    void this.updateLobbyMetadata();
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = false;
    this.shortenConfidencePhaseIfEveryoneDecided();
    this.shortenSideBetPhaseIfEveryoneDecided();

    if (consented) {
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
      await this.allowReconnection(client, RECONNECT_GRACE_MS / 1000);
      player.connected = true;
      void this.updateLobbyMetadata();
    } catch {
      this.deviceIds.delete(client.sessionId);
      this.state.players.delete(client.sessionId);
      this.reassignHostIfNeeded();
      void this.updateLobbyMetadata();
    }
  }

  private reassignHostIfNeeded() {
    if (this.state.players.has(this.state.hostId)) return;
    const next = [...this.state.players.values()][0];
    if (next) {
      next.isHost = true;
      this.state.hostId = next.id;
    }
  }

  private async updateLobbyMetadata() {
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

  private handleToggleReady(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.gameStarted) return;
    player.ready = !player.ready;
  }

  private async handleToggleRoomVisibility(client: Client) {
    if (client.sessionId !== this.state.hostId || this.state.gameStarted || this.state.phase !== "lobby") return;
    const nextIsPublic = !this.isPublic;
    await this.setPrivate(!nextIsPublic);
    this.isPublic = nextIsPublic;
    this.state.isPublic = nextIsPublic;
  }

  private handleStartGame(client: Client) {
    if (client.sessionId !== this.state.hostId) return; // only host may start
    if (this.state.gameStarted) return;
    if (this.state.players.size < MIN_PLAYERS_TO_START) return;
    this.state.gameStarted = true;
    this.gameStartedAt = new Date();
    this.isPublic = false;
    this.state.isPublic = false;
    void this.setPrivate(true);
    this.state.currentRoundIndex = -1;
    this.setPhase("starting", GAME_START_COUNTDOWN_MS);
  }

  // ---------------------------------------------------------------------
  // Round flow
  // ---------------------------------------------------------------------

  private advanceToNextRound() {
    this.state.currentRoundIndex += 1;
    if (this.state.currentRoundIndex >= this.state.totalRounds) {
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
    for (const p of this.state.players.values()) p.hasActedThisPhase = false;

    const record = this.questionSet[this.state.currentRoundIndex];
    if (!record) {
      this.endGame();
      return;
    }
    const localized = localize(record, this.locale);
    this.state.currentQuestion.id = localized.id;
    this.state.currentQuestion.qType = localized.type;
    this.state.currentQuestion.category = localized.category;
    this.state.currentQuestion.difficulty = localized.difficulty;
    this.state.currentQuestion.text = localized.text;
    this.state.currentQuestion.basePoints = localized.basePoints;
    this.state.currentQuestion.options.clear();
    (localized.options ?? []).forEach((o) => this.state.currentQuestion.options.push(o));

    this.setPhase("question", PHASE_DURATIONS_MS.question);
  }

  private setPhase(phase: RoomStateSchema["phase"], durationMs: number) {
    this.state.phase = phase;
    this.state.phaseEndsAt = Date.now() + durationMs;
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout);
    this.phaseTimeout = setTimeout(() => this.advancePhase(), durationMs);
  }

  /** Server-driven phase transition — never triggered by a client message. */
  private advancePhase() {
    switch (this.state.phase) {
      case "starting":
        this.advanceToNextRound();
        break;
      case "question":
        this.finalizeAnswerDrafts();
        this.setPhase("confidence", PHASE_DURATIONS_MS.confidence);
        this.shortenConfidencePhaseIfEveryoneDecided();
        break;
      case "confidence":
        this.buildConfidenceBoard();
        this.setPhase("board_sidebet", PHASE_DURATIONS_MS.board_sidebet);
        break;
      case "board_sidebet":
        this.resolveRound();
        this.setPhase("reveal", PHASE_DURATIONS_MS.reveal);
        break;
      case "reveal":
        this.advanceToNextRound();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------
  // Player actions (validated intents)
  // ---------------------------------------------------------------------

  private handleSubmitAnswer(client: Client, msg: { value: unknown }) {
    if (this.state.phase !== "question") return;
    if (this.roundAnswers.has(client.sessionId)) return; // one answer per round
    this.roundAnswers.set(client.sessionId, {
      playerId: client.sessionId,
      value: msg.value as PlayerAnswer["value"],
      confidence: "none", // confidence is submitted separately, next phase
      submittedAt: Date.now(),
    });
    const player = this.state.players.get(client.sessionId);
    if (player) player.hasActedThisPhase = true;

    const connectedPlayers = [...this.state.players.values()].filter((p) => p.connected);
    const everyoneConnectedAnswered = connectedPlayers.length > 0
      && connectedPlayers.every((p) => this.roundAnswers.has(p.id));
    const remainingMs = this.state.phaseEndsAt - Date.now();

    if (everyoneConnectedAnswered && remainingMs > QUESTION_ALL_ANSWERED_COUNTDOWN_MS) {
      this.setPhase("question", QUESTION_ALL_ANSWERED_COUNTDOWN_MS);
    }
  }

  private handleSaveAnswerDraft(client: Client, msg: { value?: unknown }) {
    if (this.state.phase !== "question" || this.roundAnswers.has(client.sessionId)) return;
    const questionType = this.state.currentQuestion.qType;
    if (!["word", "estimate", "closest_answer"].includes(questionType)) return;
    if (typeof msg?.value !== "string") return;
    this.roundAnswerDrafts.set(client.sessionId, msg.value.slice(0, questionType === "word" ? 32 : 12));
  }

  private finalizeAnswerDrafts() {
    const questionType = this.state.currentQuestion.qType;
    for (const [playerId, draft] of this.roundAnswerDrafts) {
      if (this.roundAnswers.has(playerId)) continue;
      const trimmed = draft.trim();
      if (!trimmed) continue;

      const value = questionType === "word" ? trimmed : Number(trimmed.replace(",", "."));
      if (questionType !== "word" && !Number.isFinite(value)) continue;
      this.roundAnswers.set(playerId, {
        playerId,
        value: value as PlayerAnswer["value"],
        confidence: "none",
        submittedAt: Date.now(),
      });
    }
  }

  private handleSubmitConfidence(client: Client, msg: { value: ConfidenceValue }) {
    if (this.state.phase !== "confidence") return;
    const isRevision = this.roundConfidenceDecisions.has(client.sessionId);
    if (isRevision && this.state.phaseEndsAt - Date.now() <= CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS) return;
    const existing = this.roundAnswers.get(client.sessionId);
    if (!existing) return; // must have answered to set confidence
    if (![ "none", 1, 3, 5, 6 ].includes(msg.value)) return;
    existing.confidence = msg.value;
    this.roundConfidenceDecisions.add(client.sessionId);
    this.shortenConfidencePhaseIfEveryoneDecided();
  }

  private shortenConfidencePhaseIfEveryoneDecided() {
    if (this.state.phase !== "confidence") return;

    const connectedPlayers = [...this.state.players.values()].filter((player) => player.connected);
    const everyoneDecided = connectedPlayers.length > 0
      && connectedPlayers.every((player) => (
        !this.roundAnswers.has(player.id) || this.roundConfidenceDecisions.has(player.id)
      ));
    const remainingMs = this.state.phaseEndsAt - Date.now();

    if (everyoneDecided && remainingMs > CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS) {
      this.setPhase("confidence", CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS);
    }
  }

  private handleSubmitSideBet(client: Client, msg: { targetId: string; prediction: "correct" | "wrong" }) {
    if (this.state.phase !== "board_sidebet") return;
    const isRevision = this.roundSideBetDecisions.has(client.sessionId);
    if (isRevision && this.state.phaseEndsAt - Date.now() <= SIDEBET_ALL_DECIDED_COUNTDOWN_MS) return;
    if (msg.targetId === client.sessionId) return; // cannot bet on self
    if (!this.roundAnswers.has(msg.targetId)) return; // target must exist & have answered
    if (msg.prediction !== "correct" && msg.prediction !== "wrong") return;
    this.roundSideBets.set(client.sessionId, {
      bettorId: client.sessionId,
      targetId: msg.targetId,
      prediction: msg.prediction,
    });
    this.roundSideBetDecisions.add(client.sessionId);
    this.shortenSideBetPhaseIfEveryoneDecided();
  }

  private handleSkipSideBet(client: Client) {
    if (this.state.phase !== "board_sidebet") return;
    const isRevision = this.roundSideBetDecisions.has(client.sessionId);
    if (isRevision && this.state.phaseEndsAt - Date.now() <= SIDEBET_ALL_DECIDED_COUNTDOWN_MS) return;
    this.roundSideBets.delete(client.sessionId);
    this.roundSideBetDecisions.add(client.sessionId);
    this.shortenSideBetPhaseIfEveryoneDecided();
  }

  private shortenSideBetPhaseIfEveryoneDecided() {
    if (this.state.phase !== "board_sidebet") return;

    const connectedPlayers = [...this.state.players.values()].filter((player) => player.connected);
    const everyoneDecided = connectedPlayers.length > 0
      && connectedPlayers.every((player) => this.roundSideBetDecisions.has(player.id));
    const remainingMs = this.state.phaseEndsAt - Date.now();

    if (everyoneDecided && remainingMs > SIDEBET_ALL_DECIDED_COUNTDOWN_MS) {
      this.setPhase("board_sidebet", SIDEBET_ALL_DECIDED_COUNTDOWN_MS);
    }
  }

  // ---------------------------------------------------------------------
  // Phase transition side effects
  // ---------------------------------------------------------------------

  /** Confidence board (spec §11): everyone's confidence, nobody's answer. */
  private buildConfidenceBoard() {
    this.state.confidenceBoard.clear();
    for (const [playerId] of this.state.players.entries()) {
      const answer = this.roundAnswers.get(playerId);
      const entry = new ConfidenceBoardEntrySchema();
      entry.playerId = playerId;
      entry.confidence = String(answer?.confidence ?? "none");
      this.state.confidenceBoard.push(entry);
    }
  }

  private getClosestAnswerWinningValues(correctAnswer: unknown): Set<number> {
    const target = Number(correctAnswer);
    if (!Number.isFinite(target)) return new Set<number>();

    let closestDistance = Number.POSITIVE_INFINITY;
    const winningValues = new Set<number>();

    for (const answer of this.roundAnswers.values()) {
      const submittedValue = Number(answer.value);
      if (!Number.isFinite(submittedValue)) continue;

      const distance = Math.abs(submittedValue - target);
      if (distance < closestDistance) {
        closestDistance = distance;
        winningValues.clear();
        winningValues.add(submittedValue);
      } else if (distance === closestDistance) {
        winningValues.add(submittedValue);
      }
    }

    return winningValues;
  }

  private resolveRound() {
    const record = this.questionSet[this.state.currentRoundIndex];
    const correctAnswer = getLocalizedCorrectAnswer(record, this.locale);
    const currentStreaks: Record<string, number> = {};
    for (const [id, p] of this.state.players.entries()) currentStreaks[id] = p.streak;
    const closestAnswerWinningValues = record.type === "closest_answer"
      ? this.getClosestAnswerWinningValues(correctAnswer)
      : null;
    const isWinningAnswer = (value: unknown) => {
      if (record.type === "closest_answer") {
        const submittedValue = Number(value);
        return Number.isFinite(submittedValue) && Boolean(closestAnswerWinningValues?.has(submittedValue));
      }

      return isAnswerCorrect(record.type, value, correctAnswer);
    };

    const result = computeRoundResults({
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
      if (player) player.score += event.delta;
    }
    // Apply streak updates
    for (const [playerId, streak] of Object.entries(result.streakUpdates)) {
      const player = this.state.players.get(playerId);
      if (player) player.streak = streak;
    }

    // Build the public reveal projection (per-player: correct?, confidence,
    // total delta this round, human-readable detail, new streak).
    this.state.revealResults.clear();
    const deltaByPlayer = new Map<string, number>();
    const detailByPlayer = new Map<string, string[]>();
    for (const event of result.scoreEvents) {
      deltaByPlayer.set(event.playerId, (deltaByPlayer.get(event.playerId) ?? 0) + event.delta);
      const list = detailByPlayer.get(event.playerId) ?? [];
      list.push(event.detail);
      detailByPlayer.set(event.playerId, list);
    }
    for (const player of this.state.players.values()) {
      const answer = this.roundAnswers.get(player.id);
      const entry = new RevealEntrySchema();
      const details = detailByPlayer.get(player.id) ?? [];
      const submittedOrdering = Array.isArray(answer?.value) ? answer.value.map((value) => Number(value)) : null;
      const correctOrdering = Array.isArray(correctAnswer) ? correctAnswer.map((value) => Number(value)) : null;
      entry.playerId = player.id;
      entry.answerText = answer ? localizeAnswer(record, this.locale, answer.value) : "";
      if (record.type === "ordering" && submittedOrdering && correctOrdering) {
        const localizedItems = localizeAnswerItems(record, this.locale, submittedOrdering);
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

    this.state.correctAnswerText = localizeAnswer(record, this.locale, correctAnswer);
  }

  private endGame() {
    this.state.phase = "final_results";
    this.state.gameEnded = true;
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout);
    void this.persistFinalResults();
  }

  private async persistFinalResults() {
    if (this.resultsPersisted) return;
    this.resultsPersisted = true;

    const rankedPlayers = [...this.state.players.values()]
      .sort((left, right) => right.score - left.score);
    const completedPlayers = rankedPlayers.flatMap((player, index) => {
      const deviceId = this.deviceIds.get(player.id);
      if (!deviceId) return [];
      const priorPlayer = rankedPlayers[index - 1];
      const finalRank = priorPlayer && priorPlayer.score === player.score
        ? rankedPlayers.findIndex((candidate) => candidate.score === player.score) + 1
        : index + 1;
      return [{
        deviceId,
        displayName: player.name,
        finalScore: player.score,
        finalRank,
      }];
    });

    const progressUpdates = await saveCompletedMatch({
      id: this.matchId,
      roomCode: this.state.code,
      gameMode: this.state.gameMode,
      locale: this.locale,
      roundCount: this.state.totalRounds,
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
