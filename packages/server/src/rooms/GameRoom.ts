import { Room, Client, matchMaker } from "colyseus";
import { randomUUID } from "crypto";
import {
  PHASE_DURATIONS_MS,
  QUESTION_ALL_ANSWERED_COUNTDOWN_MS,
  CONFIDENCE_ALL_DECIDED_COUNTDOWN_MS,
  SIDEBET_ALL_DECIDED_COUNTDOWN_MS,
  GAME_START_COUNTDOWN_MS,
  DAMAGE_REVEAL_DURATION_MS,
  DEFAULT_ROUND_COUNT,
  MIN_PLAYERS_TO_START,
  ALLOW_SOLO_CUSTOM_TESTING,
  RECONNECT_GRACE_MS,
  computeRoundResults,
  isAnswerCorrect,
  ConfidenceValue,
  PlayerAnswer,
  SideBet,
  QuestionRecord,
  Locale,
  GameMode,
  DIFFICULTY_REWARDS,
  RANKED_FIXED_ROUND_COUNT,
  RANKED_PLAYER_COUNT,
  DEFAULT_DAMAGE_WAGER,
  isDamageWager,
  isOffensivePlayerName,
  imageRevealPoints,
  isValidAnswerValue,
  VISUAL_READY_TIMEOUT_MS,
  normalizeGeographyAnswer,
} from "@confidence-trivia/shared";
import {
  RoomStateSchema,
  PlayerSchema,
  ConfidenceBoardEntrySchema,
  RevealEntrySchema,
} from "../state/schema";
import { getLocalizedCorrectAnswer, getQuestionSet, localize, localizeAnswer, localizeAnswerItems } from "../content/questions";
import { canPlayerEnterGame, getAcceptedChallengeParticipantRole, getPlayerCustomization, isAuthenticatedPlayer, reserveDamageWager, saveCompletedMatch, settleDamageWager, upsertPlayer } from "../database";
import { verifySupabaseIdentity } from "../auth";
import { logServerError } from "../logging";

interface JoinOptions {
  deviceId?: string;
  name?: string;
  accessToken?: string;
}

interface CreateOptions extends JoinOptions {
  roundCount?: number;
  locale?: Locale;
  gameMode?: GameMode;
  excludeQuestionIds?: string[];
  visibility?: "private" | "public";
  damageWager?: number;
  challengeId?: string;
  friendsTeamMode?: "ffa" | "duos";
  friendCategories?: string[];
  customQuestions?: Array<{ question?: string; answer?: string }>;
}

const PLAYER_NAME_PATTERN = /^[\p{L}\p{N} ]+$/u;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPlayerName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 20 && PLAYER_NAME_PATTERN.test(trimmed) && !isOffensivePlayerName(trimmed);
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
  private challengeId = "";
  private questionSet: QuestionRecord[] = [];

  // Server-only, per-round scratch data. Not synced — the client only
  // sees the public projections (schema.currentQuestion, confidenceBoard,
  // revealResults) that we derive from this at the right phase.
  private roundAnswers = new Map<string, PlayerAnswer>();
  private roundAnswerDrafts = new Map<string, string | number[]>();
  private roundConfidenceDecisions = new Set<string>();
  private roundSideBets = new Map<string, SideBet>();
  private roundSideBetDecisions = new Set<string>();
  private phaseTimeout?: NodeJS.Timeout;
  // Stable installation identifiers stay server-only. Connection-scoped
  // session IDs remain the room keys and public gameplay identifiers.
  private deviceIds = new Map<string, string>();
  private challengeRoles = new Map<string, "challenger" | "challenged">();
  private matchId = randomUUID();
  private gameStartedAt = new Date();
  private resultsPersisted = false;
  private damageKnockout = false;
  private damageWagerReserved = false;
  private gameStartPending = false;
  private lobbyWasPublic = false;
  private hasCustomQuestions = false;
  private visualReady = new Set<string>();

  async onCreate(options: CreateOptions = {}) {
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
    this.state.serverNow = Date.now();
    this.clock.setInterval(() => { this.state.serverNow = Date.now(); }, 500);
    this.challengeId = typeof options.challengeId === "string" && DEVICE_ID_PATTERN.test(options.challengeId) ? options.challengeId : "";
    this.state.isChallenge = Boolean(this.challengeId);
    this.state.code = this.roomId;
    this.state.gameMode = options.gameMode === "damage"
      ? "damage"
      : options.gameMode === "ranked"
        ? "ranked"
        : options.gameMode === "friends" ? "friends" : "classic";
    this.state.friendsTeamMode = this.state.gameMode === "friends" && options.friendsTeamMode === "duos" ? "duos" : "ffa";
    this.state.damageWager = this.state.gameMode === "damage" && isDamageWager(options.damageWager)
      ? options.damageWager
      : this.state.gameMode === "damage" ? DEFAULT_DAMAGE_WAGER : 0;
    this.state.damagePot = this.state.damageWager * 2;
    if (this.state.gameMode === "damage") this.maxClients = 2;
    if (this.state.gameMode === "ranked") this.maxClients = RANKED_PLAYER_COUNT;
    this.state.totalRounds = this.state.gameMode === "damage"
      ? 0
      : this.state.gameMode === "ranked"
        ? RANKED_FIXED_ROUND_COUNT
        : options.roundCount ?? DEFAULT_ROUND_COUNT;
    this.locale = options.locale ?? "en";
    const customQuestions = this.state.gameMode === "friends"
      ? (options.customQuestions ?? []).slice(0, 10).flatMap((item, index): QuestionRecord[] => {
          const question = typeof item.question === "string" ? item.question.trim().slice(0, 160) : "";
          const answer = typeof item.answer === "string" ? item.answer.trim().slice(0, 48) : "";
          if (!question || !answer) return [];
          return [{ id: `custom-${this.matchId}-${index}`, type: "word", category: "custom", difficulty: "medium", correctAnswer: answer, basePoints: DIFFICULTY_REWARDS.medium, translations: { en: { text: question }, bg: { text: question } } }];
        })
      : [];
    this.hasCustomQuestions = customQuestions.length > 0;
    this.state.customQuestionsEnabled = this.hasCustomQuestions;
    this.isPublic = options.visibility === "public" && customQuestions.length === 0;
    this.state.isPublic = this.isPublic;
    const requestedCategories = this.state.gameMode === "friends" && Array.isArray(options.friendCategories)
      ? options.friendCategories.filter((category): category is string => typeof category === "string").slice(0, 20)
      : [];
    const standardQuestions = getQuestionSet(this.state.gameMode === "damage" ? 100 : Math.max(0, this.state.totalRounds - customQuestions.length), options.excludeQuestionIds ?? [], requestedCategories);
    this.questionSet = [...customQuestions, ...standardQuestions].slice(0, this.state.gameMode === "damage" ? 100 : this.state.totalRounds);
    // Matchmade rooms stay available to joinOrCreate, but are filtered out
    // of the user-facing public lobby browser.
    const isMatchmade = this.state.gameMode === "ranked" || this.state.gameMode === "damage";
    await this.setPrivate(isMatchmade ? false : !this.isPublic);
    await this.updateLobbyMetadata();

    this.onMessage("toggleReady", (client) => this.handleToggleReady(client));
    this.onMessage("toggleRoomVisibility", (client) => void this.handleToggleRoomVisibility(client));
    this.onMessage("startGame", (client) => void this.handleStartGame(client));
    this.onMessage("submitAnswer", (client, msg) => this.handleSubmitAnswer(client, msg));
    this.onMessage("visualReady", (client, msg) => this.handleVisualReady(client, msg));
    this.onMessage("saveAnswerDraft", (client, msg) => this.handleSaveAnswerDraft(client, msg));
    this.onMessage("submitConfidence", (client, msg) => this.handleSubmitConfidence(client, msg));
    this.onMessage("submitSideBet", (client, msg) => this.handleSubmitSideBet(client, msg));
    this.onMessage("skipSideBet", (client) => this.handleSkipSideBet(client));
  }

  async onAuth(client: Client, options: JoinOptions = {}) {
    // Reconnecting players use Colyseus' reconnection flow and do not pass
    // through this admission path. New players may only enter the lobby.
    const basicAdmissionAllowed = !this.state.gameStarted
      && isValidPlayerName(options.name)
      && isValidDeviceId(options.deviceId)
      && ![...this.deviceIds.values()].includes(options.deviceId);
    if (!basicAdmissionAllowed) return false;
    const identity = options.accessToken
      ? await verifySupabaseIdentity(`Bearer ${options.accessToken}`)
      : null;
    if (!await canPlayerEnterGame(options.deviceId!, identity?.userId ?? null)) return false;
    if (this.challengeId) {
      if (!identity || !await isAuthenticatedPlayer(options.deviceId!, identity.userId)) return false;
      const role = await getAcceptedChallengeParticipantRole(this.challengeId, options.deviceId!);
      if (!role) return false;
      this.challengeRoles.set(client.sessionId, role);
      return true;
    }
    if (this.state.gameMode !== "ranked") return true;
    if (process.env.NODE_ENV === "test" && process.env.RANKED_TEST_AUTH_BYPASS === "true") return true;
    return Boolean(identity && await isAuthenticatedPlayer(options.deviceId!, identity.userId));
  }

  async onJoin(client: Client, options: JoinOptions = {}) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = isValidPlayerName(options.name) ? options.name.trim() : "Player";
    this.deviceIds.set(client.sessionId, options.deviceId ?? "");
    const deviceId = options.deviceId ?? "";
    const challengeRole = this.challengeRoles.get(client.sessionId) ?? null;
    player.isHost = this.challengeId ? challengeRole === "challenger" : this.state.players.size === 0;
    player.health = 15;
    if (this.state.gameMode === "friends" && this.state.friendsTeamMode === "duos") {
      const teamACount = [...this.state.players.values()].filter((existing) => existing.team === "A").length;
      const teamBCount = [...this.state.players.values()].filter((existing) => existing.team === "B").length;
      player.team = teamACount <= teamBCount ? "A" : "B";
    }
    if (player.isHost) {
      this.state.players.forEach((existingPlayer) => { existingPlayer.isHost = false; });
      this.state.hostId = player.id;
    }
    this.state.players.set(client.sessionId, player);
    this.challengeRoles.delete(client.sessionId);
    // Return the join handshake immediately; database work must not hold the
    // second player's queue screen behind profile loading or wager reservation.
    void this.finishJoining(player, deviceId).catch((error) => logServerError("Could not finish joining room", error));
    void this.updateLobbyMetadata();
  }

  private async finishJoining(player: PlayerSchema, deviceId: string) {
    const [stars, customization] = await Promise.all([
      upsertPlayer(deviceId, player.name),
      getPlayerCustomization(deviceId),
    ]);
    if (this.state.players.get(player.id) !== player) return;
    if (stars !== null && !this.damageWagerReserved) player.stars = stars;
    if (customization) {
      player.nameColor = customization.nameColor;
      player.avatarId = customization.avatarId;
      player.frameId = customization.frameId;
    }
    void this.updateLobbyMetadata();
    if (this.state.gameMode === "ranked" && this.state.players.size === RANKED_PLAYER_COUNT && !this.state.gameStarted) {
      await this.lock();
      this.beginGame();
    }
    if (this.state.gameMode === "damage" && !this.state.isChallenge && this.state.players.size === 2 && !this.state.gameStarted) {
      const host = this.clients.find((roomClient) => roomClient.sessionId === this.state.hostId);
      if (host) await this.handleStartGame(host);
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = false;
    if (this.state.phase === "visual_loading") this.beginVisualIfReady();
    // Final standings remain authoritative even as clients exit the room.
    if (this.state.gameEnded) return;
    if (this.state.phase === "starting" && !this.hasEnoughPlayers()) {
      await this.cancelStarting();
    }
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
      const closesLobby = this.state.gameMode !== "ranked" && player.isHost && !this.state.gameStarted;
      this.deviceIds.delete(client.sessionId);
      this.state.players.delete(client.sessionId);
      if (closesLobby) {
        this.isPublic = false;
        await this.setPrivate(true);
        await this.disconnect();
        return;
      }
      if (this.state.gameMode === "ranked" && this.state.players.size === 0) {
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
      if (this.state.phase === "lobby" && this.hasEnoughPlayers()) {
        if (this.state.gameMode === "ranked") this.beginGame();
        else if (this.state.gameMode === "damage" && !this.state.isChallenge) {
          const host = this.clients.find((candidate) => candidate.sessionId === this.state.hostId);
          if (host) void this.handleStartGame(host);
        }
      }
    } catch {
      if (this.state.gameEnded) return;
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
      damageWager: this.state.damageWager,
      challengeId: this.challengeId,
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
    if (this.hasCustomQuestions) return;
    const nextIsPublic = !this.isPublic;
    await this.setPrivate(!nextIsPublic);
    this.isPublic = nextIsPublic;
    this.state.isPublic = nextIsPublic;
  }

  private async handleStartGame(client: Client) {
    if (client.sessionId !== this.state.hostId) return; // only host may start
    if (this.state.gameStarted || this.gameStartPending) return;
    if (!this.hasEnoughPlayers()) {
      client.send("gameStartError", { code: "not_enough_players" });
      return;
    }
    if (this.state.gameMode === "damage") {
      this.gameStartPending = true;
      const playerEntries = [...this.state.players.values()].flatMap((player) => {
        const deviceId = this.deviceIds.get(player.id);
        return deviceId ? [{ player, deviceId }] : [];
      });
      // A cancelled countdown may already have a refunded wager, so each new
      // attempt needs a fresh match id while keeping the wager linked to it.
      this.matchId = randomUUID();
      const reservation = await reserveDamageWager(this.matchId, playerEntries.map(({ deviceId }) => deviceId), this.state.damageWager);
      if (!reservation.ok) {
        this.gameStartPending = false;
        const insufficientNames = playerEntries.filter(({ deviceId }) => reservation.insufficientPlayerIds.includes(deviceId)).map(({ player }) => player.name);
        this.broadcast("gameStartError", { code: "insufficient_stars", names: insufficientNames, stake: this.state.damageWager });
        return;
      }
      playerEntries.forEach(({ player, deviceId }) => {
        const balance = reservation.balances.get(deviceId);
        if (balance !== undefined) player.stars = balance;
      });
      this.damageWagerReserved = true;
      if (!this.hasEnoughPlayers() || playerEntries.some(({ player }) => this.state.players.get(player.id) !== player)) {
        await this.refundStartingWager();
        this.gameStartPending = false;
        return;
      }
      this.gameStartPending = false;
    }
    this.beginGame();
  }

  private beginGame() {
    if (this.state.gameStarted || !this.hasEnoughPlayers()) return;
    this.lobbyWasPublic = this.isPublic;
    this.state.gameStarted = true;
    this.gameStartedAt = new Date();
    this.isPublic = false;
    this.state.isPublic = false;
    void this.setPrivate(true);
    this.state.currentRoundIndex = -1;
    this.setPhase("starting", GAME_START_COUNTDOWN_MS);
  }

  private hasEnoughPlayers() {
    const count = [...this.state.players.values()].filter((player) => player.connected).length;
    if (this.state.gameMode === "damage") return count === 2;
    if (this.state.gameMode === "ranked") return count === RANKED_PLAYER_COUNT;
    if (this.state.gameMode === "friends" && this.state.friendsTeamMode === "duos") return count >= 4 && count % 2 === 0;
    if (ALLOW_SOLO_CUSTOM_TESTING && this.state.gameMode === "friends") return count >= 1;
    return count >= MIN_PLAYERS_TO_START;
  }

  private async refundStartingWager() {
    if (!this.damageWagerReserved) return;
    const balances = await settleDamageWager(this.matchId, null);
    this.damageWagerReserved = false;
    for (const player of this.state.players.values()) {
      const balance = balances.get(this.deviceIds.get(player.id) ?? "");
      if (balance !== undefined) player.stars = balance;
    }
  }

  private async cancelStarting() {
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout);
    this.gameStartPending = true;
    this.state.phase = "lobby";
    this.state.phaseEndsAt = 0;
    this.state.gameStarted = false;
    await this.refundStartingWager();
    this.isPublic = this.lobbyWasPublic;
    this.state.isPublic = this.isPublic;
    await this.setPrivate(!this.isPublic);
    await this.unlock();
    this.gameStartPending = false;
  }

  // ---------------------------------------------------------------------
  // Round flow
  // ---------------------------------------------------------------------

  private advanceToNextRound() {
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
    for (const p of this.state.players.values()) p.hasActedThisPhase = false;

    this.presentCurrentQuestion();
  }

  private presentCurrentQuestion() {
    const record = this.questionSet[this.state.currentRoundIndex % this.questionSet.length];
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
    this.state.currentQuestion.visualFormat = localized.presentation?.format ?? "";
    this.state.currentQuestion.visualAssetId = localized.presentation?.assetId ?? "";
    this.state.currentQuestion.startedAt = 0;
    this.state.currentQuestion.durationMs = PHASE_DURATIONS_MS.question;
    this.state.currentQuestion.options.clear();
    (localized.options ?? []).forEach((o) => this.state.currentQuestion.options.push(o));

    this.visualReady = new Set();
    if (record.presentation) this.setPhase("visual_loading", VISUAL_READY_TIMEOUT_MS);
    else this.beginQuestion();
  }

  private beginQuestion() {
    this.state.currentQuestion.startedAt = Date.now();
    this.state.serverNow = Date.now();
    this.setPhase("question", this.state.currentQuestion.durationMs);
  }

  private handleVisualReady(client: Client, msg: { questionId?: string; failed?: boolean }) {
    if (this.state.phase !== "visual_loading" || msg?.questionId !== this.state.currentQuestion.id || !this.state.players.get(client.sessionId)?.connected) return;
    if (msg.failed) { this.replaceUnavailableVisual(); return; }
    this.visualReady.add(client.sessionId);
    this.beginVisualIfReady();
  }

  private beginVisualIfReady() {
    const connected = [...this.state.players.values()].filter((p) => p.connected);
    if (this.state.phase === "visual_loading" && connected.length && connected.every((p) => this.visualReady.has(p.id))) this.beginQuestion();
  }

  private replaceUnavailableVisual() {
    const record = this.questionSet[this.state.currentRoundIndex % this.questionSet.length];
    const fallback = getQuestionSet(1, this.questionSet.map((q) => q.id), record ? [record.category] : [], false)[0];
    if (!fallback) { this.endGame(); return; }
    this.questionSet[this.state.currentRoundIndex % this.questionSet.length] = fallback;
    this.presentCurrentQuestion();
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
      case "visual_loading":
        this.replaceUnavailableVisual();
        break;
      case "starting":
        if (!this.hasEnoughPlayers()) {
          void this.cancelStarting();
          break;
        }
        this.advanceToNextRound();
        break;
      case "question":
        this.finalizeAnswerDrafts();
        if (this.state.gameMode === "damage") {
          this.resolveDamageRound();
          this.setPhase("reveal", DAMAGE_REVEAL_DURATION_MS);
          break;
        }
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
        if (this.state.gameMode === "damage" && this.damageKnockout) this.endGame();
        else this.advanceToNextRound();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------
  // Player actions (validated intents)
  // ---------------------------------------------------------------------

  private handleSubmitAnswer(client: Client, msg: { value: unknown; questionId?: string }) {
    if (this.state.phase !== "question") return;
    if (Date.now() >= this.state.phaseEndsAt || !this.state.players.has(client.sessionId)) return;
    if (msg?.questionId !== undefined && msg.questionId !== this.state.currentQuestion.id) return;
    if (!isValidAnswerValue(this.state.currentQuestion.qType, msg?.value, this.state.currentQuestion.options.length)) return;
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
    if (questionType === "ordering") {
      const value = msg?.value;
      const count = this.state.currentQuestion.options.length;
      if (!Array.isArray(value) || value.length !== count || new Set(value).size !== count
        || !value.every((index) => Number.isInteger(index) && index >= 0 && index < count)) return;
      this.roundAnswerDrafts.set(client.sessionId, [...value]);
      return;
    }
    if (!["word", "estimate", "closest_answer"].includes(questionType)) return;
    if (typeof msg?.value !== "string") return;
    this.roundAnswerDrafts.set(client.sessionId, msg.value.slice(0, questionType === "word" ? 64 : 12));
  }

  private finalizeAnswerDrafts() {
    const questionType = this.state.currentQuestion.qType;
    for (const [playerId, draft] of this.roundAnswerDrafts) {
      if (this.roundAnswers.has(playerId)) continue;
      const trimmed = typeof draft === "string" ? draft.trim() : draft;
      if (!trimmed) continue;

      const value = Array.isArray(trimmed) ? trimmed : questionType === "word" ? trimmed : Number(trimmed.replace(",", "."));
      if (questionType !== "word" && questionType !== "ordering" && !Number.isFinite(value)) continue;
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

  private resolveDamageRound() {
    const record = this.questionSet[this.state.currentRoundIndex % this.questionSet.length];
    const damageValue = DIFFICULTY_REWARDS[record.difficulty];
    const correctAnswer = getLocalizedCorrectAnswer(record, this.locale);
    const closestValues = record.type === "closest_answer" ? this.getClosestAnswerWinningValues(correctAnswer) : null;
    const isWinningAnswer = (value: unknown) => record.type === "closest_answer"
      ? Number.isFinite(Number(value)) && Boolean(closestValues?.has(Number(value)))
      : isAnswerCorrect(record.type, value, correctAnswer, record.presentation?.format === "map_shapes" ? normalizeGeographyAnswer : undefined);
    const correctness = new Map<string, boolean>();
    const attacks = new Map<string, number>();
    const attackBonuses = new Map<string, number>();
    const lethalAttackers = new Set<string>();

    for (const player of this.state.players.values()) {
      const answer = this.roundAnswers.get(player.id);
      const correct = answer ? isWinningAnswer(answer.value) : false;
      correctness.set(player.id, correct);
      if (!correct) {
        if (!player.shieldPending) player.damageStreak = 0;
        continue;
      }

      if (!player.shieldPending) {
        player.damageStreak += 1;
        if (player.damageStreak >= 3) {
          player.shieldPending = true;
          player.damageStreak = 0;
        }
      }
    }

    const correctPlayers = [...this.state.players.values()].filter((player) => correctness.get(player.id));
    const isMutualCorrectDraw = this.state.players.size === 2 && correctPlayers.length === 2;
    if (isMutualCorrectDraw) {
      this.state.pendingDamageBonus += 1;
    } else if (correctPlayers.length === 1) {
      const attackerId = correctPlayers[0].id;
      attackBonuses.set(attackerId, this.state.pendingDamageBonus);
      const answer = this.roundAnswers.get(attackerId)!;
      const base = record.presentation?.format === "image_reveal" ? imageRevealPoints(this.state.currentQuestion.startedAt, this.state.currentQuestion.durationMs, answer.submittedAt) : damageValue;
      attacks.set(attackerId, base + this.state.pendingDamageBonus);
      this.state.pendingDamageBonus = 0;
    }

    for (const attacker of this.state.players.values()) {
      const damage = attacks.get(attacker.id) ?? 0;
      if (damage <= 0) continue;
      const target = [...this.state.players.values()].find((player) => player.id !== attacker.id);
      if (!target) continue;
      const absorbed = target.shieldPending ? damage : Math.min(target.shield, damage);
      if (target.shieldPending) target.shieldPending = false;
      else target.shield -= absorbed;
      const healthBeforeAttack = target.health;
      target.health = Math.max(0, target.health - (damage - absorbed));
      if (healthBeforeAttack > 0 && target.health <= 0) lethalAttackers.add(attacker.id);
      attacker.score += damage;
    }

    this.state.revealResults.clear();
    for (const player of this.state.players.values()) {
      const answer = this.roundAnswers.get(player.id);
      const entry = new RevealEntrySchema();
      entry.playerId = player.id;
      entry.answerText = answer ? localizeAnswer(record, this.locale, answer.value) : "";
      entry.correct = correctness.get(player.id) ?? false;
      entry.scoreDelta = attacks.get(player.id) ?? 0;
      entry.damageDealt = attacks.get(player.id) ?? 0;
      entry.damageBonus = attackBonuses.get(player.id) ?? 0;
      entry.lethalHit = lethalAttackers.has(player.id);
      entry.shieldGained = 0;
      entry.newStreak = player.damageStreak;
      entry.detail = isMutualCorrectDraw
        ? `Draw; next hit bonus +${this.state.pendingDamageBonus}`
        : entry.correct ? `Damage ${entry.damageDealt}` : "No damage";
      this.state.revealResults.push(entry);
    }

    this.state.correctAnswerText = localizeAnswer(record, this.locale, correctAnswer);
    this.damageKnockout = [...this.state.players.values()].some((player) => player.health <= 0);
  }

  private resolveRound() {
    const record = this.questionSet[this.state.currentRoundIndex % this.questionSet.length];
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

      return isAnswerCorrect(record.type, value, correctAnswer, record.presentation?.format === "map_shapes" ? normalizeGeographyAnswer : undefined);
    };

    const result = computeRoundResults({
      correctAnswer,
      basePoints: record.basePoints,
      answerBasePoints: record.presentation?.format === "image_reveal" ? Object.fromEntries([...this.roundAnswers].map(([id, answer]) => [id, imageRevealPoints(this.state.currentQuestion.startedAt, this.state.currentQuestion.durationMs, answer.submittedAt)])) : undefined,
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
    if (this.state.gameEnded) return;
    this.state.phase = "final_results";
    this.state.gameEnded = true;
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout);
    void this.persistFinalResults();
  }

  private async persistFinalResults() {
    if (this.resultsPersisted) return;
    this.resultsPersisted = true;

    const rankingValueFor = (player: PlayerSchema) => this.state.gameMode === "friends" && this.state.friendsTeamMode === "duos"
      ? [...this.state.players.values()].filter((teammate) => teammate.team === player.team).reduce((total, teammate) => total + teammate.score, 0)
      : this.state.gameMode === "damage" ? player.health : player.score;
    const rankedPlayers = [...this.state.players.values()]
      .sort((left, right) => {
        if (this.state.gameMode === "ranked" && left.connected !== right.connected) return left.connected ? -1 : 1;
        return rankingValueFor(right) - rankingValueFor(left);
      });
    const completedPlayers = rankedPlayers.flatMap((player, index) => {
      const deviceId = this.deviceIds.get(player.id);
      if (!deviceId) return [];
      const priorPlayer = rankedPlayers[index - 1];
      const rankingValue = rankingValueFor(player);
      const priorRankingValue = priorPlayer ? rankingValueFor(priorPlayer) : null;
      const finalRank = this.state.gameMode === "ranked" && !player.connected
        ? 4
        : priorPlayer && priorPlayer.connected === player.connected && priorRankingValue === rankingValue
        ? rankedPlayers.findIndex((candidate) => rankingValueFor(candidate) === rankingValue) + 1
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
      await settleDamageWager(this.matchId, winners.length === 1 ? winners[0].deviceId : null);
    }

    const progressUpdates = await saveCompletedMatch({
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
