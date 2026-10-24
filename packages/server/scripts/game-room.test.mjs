import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const database = require("../dist/database.js");
const { GameRoom } = require("../dist/rooms/GameRoom.js");
const { matchMaker } = require("colyseus");
const { RoomStateSchema, PlayerSchema } = require("../dist/state/schema.js");

// Exercise real room transitions with transport and storage replaced. Avoid
// starting Colyseus timers or connecting to the production database.
function roomFor(mode = "classic", count = 2) {
  const room = Object.create(GameRoom.prototype);
  Object.assign(room, {
    state: new RoomStateSchema(), clients: [], deviceIds: new Map(), startErrors: [],
    challengeRoles: new Map(), roundAnswers: new Map(), roundAnswerDrafts: new Map(),
    roundConfidenceDecisions: new Set(), roundSideBets: new Map(), roundSideBetDecisions: new Set(),
    gameStartPending: false, damageWagerReserved: false, lobbyWasPublic: true,
    isPublic: true, matchId: "match",
    updateLobbyMetadata: async () => {}, setPrivate: async () => {},
    unlock: async () => {}, lock: async () => {}, disconnect: async () => {},
    persistFinalResults: async () => {}, broadcast: () => {},
  });
  room.state.gameMode = mode;
  room.state.phaseEndsAt = Date.now() + 30_000;
  for (let index = 0; index < count; index += 1) {
    const player = new PlayerSchema();
    player.id = `p${index}`;
    player.name = `Player ${index}`;
    player.isHost = index === 0;
    room.state.players.set(player.id, player);
    room.deviceIds.set(player.id, `device${index}`);
    room.clients.push({ sessionId: player.id, send: (type, message) => room.startErrors.push({ type, message }) });
  }
  room.state.hostId = "p0";
  return room;
}

function starting(room) {
  room.state.phase = "starting";
  room.state.gameStarted = true;
  room.state.phaseEndsAt = Date.now() + 3000;
}

test("a single player cannot start Classic", async () => {
  const room = roomFor("classic", 1);
  await room.handleStartGame(room.clients[0]);
  assert.equal(room.state.gameStarted, false);
  assert.equal(room.state.phase, "lobby");
  assert.deepEqual(room.startErrors, [{ type: "gameStartError", message: { code: "not_enough_players" } }]);
});

test("a single player cannot start Custom", async () => {
  const room = roomFor("friends",1);
  room.state.friendsTeamMode = "ffa";
  await room.handleStartGame(room.clients[0]);
  assert.equal(room.state.gameStarted, false);
  assert.equal(room.state.phase, "lobby");
  assert.deepEqual(room.startErrors, [{ type: "gameStartError", message: { code: "not_enough_players" } }]);
});

test("Custom starts and advances through countdown with two connected players", async () => {
  const room = roomFor("friends", 2);
  room.state.friendsTeamMode = "ffa";
  room.setPhase = (phase) => { room.state.phase = phase; };
  let advanced = false;
  room.advanceToNextRound = () => { advanced = true; };
  await room.handleStartGame(room.clients[0]);
  assert.equal(room.state.gameStarted,true);
  assert.equal(room.state.phase,"starting");
  room.advancePhase();
  assert.equal(advanced,true);
});

test("duos, Ranked, Damage and disconnected Custom hosts cannot start alone", async () => {
  for (const mode of ["friends","ranked","damage"]) {
    const room = roomFor(mode,1);
    if (mode === "friends") room.state.friendsTeamMode = "duos";
    await room.handleStartGame(room.clients[0]);
    assert.equal(room.state.gameStarted,false);
  }
  const room = roomFor("friends",1);
  room.state.friendsTeamMode = "ffa";
  room.state.players.get("p0").connected = false;
  await room.handleStartGame(room.clients[0]);
  assert.equal(room.state.gameStarted,false);
});

test("Classic countdown continues when two players remain", async () => {
  const room = roomFor("classic", 3);
  starting(room);
  await room.onLeave(room.clients[2], true);
  assert.equal(room.state.gameStarted, true);
  assert.equal(room.state.phase, "starting");
  assert.equal(room.state.players.size, 2);
});

test("leaving during countdown returns a one-player lobby to waiting", async () => {
  const room = roomFor();
  starting(room);
  let advanced = false;
  room.advanceToNextRound = () => { advanced = true; };
  await room.onLeave(room.clients[1], true);
  room.advancePhase();
  assert.equal(room.state.phase, "lobby");
  assert.equal(room.state.gameStarted, false);
  assert.equal(room.state.players.size, 1);
  assert.equal(advanced, false);
  assert.equal(room.state.isPublic, true);
});

test("countdown expiry checks connected players even before leave cleanup", async () => {
  const room = roomFor("ranked", 4);
  starting(room);
  room.state.players.get("p3").connected = false;
  room.advanceToNextRound = () => assert.fail("must not start with three connected players");
  room.advancePhase();
  assert.equal(room.state.phase, "lobby");
  assert.equal(room.state.gameStarted, false);
});

test("Damage countdown cancellation refunds stakes without awarding a win", async (t) => {
  const room = roomFor("damage");
  starting(room);
  room.damageWagerReserved = true;
  const settlements = [];
  t.mock.method(database, "settleDamageWager", async (...args) => {
    settlements.push(args);
    return new Map([["device0", 100], ["device1", 100]]);
  });
  await room.onLeave(room.clients[1], true);
  assert.deepEqual(settlements, [["match", null]]);
  assert.equal(room.state.gameEnded, false);
  assert.equal(room.state.players.get("p0").stars, 100);
  assert.equal(room.damageWagerReserved, false);
});

test("a departure while stakes are being reserved cancels and refunds the start", async (t) => {
  const room = roomFor("damage");
  let finishReservation;
  t.mock.method(database, "reserveDamageWager", () => new Promise((resolve) => { finishReservation = resolve; }));
  let refunded = false;
  t.mock.method(database, "settleDamageWager", async (_id, winner) => {
    assert.equal(winner, null);
    refunded = true;
    return new Map();
  });
  const start = room.handleStartGame(room.clients[0]);
  await room.onLeave(room.clients[1], true);
  finishReservation({ ok: true, balances: new Map(), insufficientPlayerIds: [] });
  await start;
  assert.equal(refunded, true);
  assert.equal(room.state.gameStarted, false);
  assert.equal(room.state.phase, "lobby");
});

test("temporary countdown disconnection pauses the start during reconnect grace", async () => {
  const room = roomFor();
  starting(room);
  let reconnect;
  room.allowReconnection = () => new Promise((resolve) => { reconnect = resolve; });
  const leave = room.onLeave(room.clients[1], false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(room.state.phase, "lobby");
  assert.equal(room.state.gameStarted, false);
  reconnect();
  await leave;
  assert.equal(room.state.players.get("p1").connected, true);
});

for (const mode of ["classic", "friends", "ranked", "damage"]) {
  test(`${mode} final standings survive players leaving`, async () => {
    const room = roomFor(mode);
    const winner = room.state.players.get("p0");
    winner.score = 20;
    winner.health = 10;
    room.endGame();
    await room.onLeave(room.clients[0], true);
    await room.onLeave(room.clients[1], false);
    assert.equal(room.state.players.size, 2);
    assert.equal(room.state.players.get("p0"), winner);
    assert.equal(winner.score, 20);
    assert.equal(winner.health, 10);
    assert.equal(room.deviceIds.size, 2);
  });
}

test("a reconnect that expires after the match ends preserves the final rows", async () => {
  const room = roomFor();
  room.state.phase = "question";
  room.state.gameStarted = true;
  let expire;
  room.allowReconnection = () => new Promise((_resolve, reject) => { expire = reject; });
  const leave = room.onLeave(room.clients[1], false);
  room.endGame();
  expire(new Error("expired"));
  await leave;
  assert.equal(room.state.players.size, 2);
});

test("Damage question timeout submits the latest ordering draft", () => {
  const room = roomFor("damage");
  room.state.phase = "question";
  room.state.currentQuestion.qType = "ordering";
  room.state.currentQuestion.options.push("A", "B", "C", "D");
  room.handleSaveAnswerDraft(room.clients[0], { value: [0, 1, 2, 3] });
  room.handleSaveAnswerDraft(room.clients[0], { value: [3, 2, 0, 1] });
  room.resolveDamageRound = () => {
    assert.deepEqual(room.roundAnswers.get("p0").value, [3, 2, 0, 1]);
  };
  room.setPhase = (phase) => { room.state.phase = phase; };
  room.advancePhase();
  assert.equal(room.state.phase, "reveal");
});

test("invalid ordering drafts cannot replace a valid draft", () => {
  const room = roomFor("damage");
  room.state.phase = "question";
  room.state.currentQuestion.qType = "ordering";
  room.state.currentQuestion.options.push("A", "B", "C", "D");
  room.handleSaveAnswerDraft(room.clients[0], { value: [3, 2, 1, 0] });
  for (const value of [[0, 0, 1, 2], [0, 1, 2, 4], [0, 1], "0,1,2,3", [0, 1, 2, 3.5]]) {
    room.handleSaveAnswerDraft(room.clients[0], { value });
  }
  room.finalizeAnswerDrafts();
  assert.deepEqual(room.roundAnswers.get("p0").value, [3, 2, 1, 0]);
});

test("manual submissions take precedence over drafts", () => {
  const room = roomFor("damage");
  room.state.phase = "question";
  room.state.currentQuestion.qType = "word";
  room.handleSaveAnswerDraft(room.clients[0], { value: "draft" });
  room.roundAnswers.set("p0", { playerId: "p0", value: "locked", confidence: "none", submittedAt: 1 });
  room.finalizeAnswerDrafts();
  assert.equal(room.roundAnswers.get("p0").value, "locked");
});

test("Damage text and numeric drafts auto-submit on timeout", () => {
  for (const [type, input, expected] of [["word", " answer ", "answer"], ["estimate", "12,5", 12.5], ["closest_answer", "42", 42]]) {
    const room = roomFor("damage");
    room.state.phase = "question";
    room.state.currentQuestion.qType = type;
    room.handleSaveAnswerDraft(room.clients[0], { value: input });
    room.finalizeAnswerDrafts();
    assert.equal(room.roundAnswers.get("p0").value, expected);
  }
});

test("second player enters the queue before profile loading finishes", async (t) => {
  const room = roomFor("damage", 1);
  let finishProfile;
  t.mock.method(database, "upsertPlayer", () => new Promise((resolve) => { finishProfile = resolve; }));
  t.mock.method(database, "getPlayerCustomization", async () => null);
  let started = false;
  room.handleStartGame = async () => { started = true; };
  await room.onJoin({ sessionId: "p1" }, { name: "Second", deviceId: "00000000-0000-4000-8000-000000000001" });
  assert.equal(room.state.players.size, 2);
  assert.equal(started, false);
  finishProfile(100);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, true);
});

test("duplicate installations cannot occupy two seats, including UUID case variants", async () => {
  const room = roomFor("classic", 0);
  room.finishJoining = async () => {};
  const deviceId = "abcdef00-0000-4000-8000-000000000001";
  const joins = await Promise.allSettled([
    room.onJoin({ sessionId: "first" }, { deviceId, name: "First" }),
    room.onJoin({ sessionId: "second" }, { deviceId: deviceId.toUpperCase(), name: "Second" }),
  ]);
  assert.deepEqual(joins.map((join) => join.status), ["fulfilled", "rejected"]);
  assert.equal(room.state.players.size, 1);
});

test("a player authenticated during the lobby cannot join after the game starts", async () => {
  const room = roomFor();
  room.state.gameStarted = true;
  await assert.rejects(room.onJoin({ sessionId: "late" }, {
    deviceId: "00000000-0000-4000-8000-000000000001", name: "Late",
  }));
  assert.equal(room.state.players.size, 2);
});

test("malformed confidence and side-bet messages do not throw", () => {
  const room = roomFor();
  room.roundAnswers.set("p0", { playerId: "p0", value: "answer", confidence: "none" });
  for (const payload of [null, undefined, false, 1, [], {}]) {
    room.state.phase = "confidence";
    assert.doesNotThrow(() => room.handleSubmitConfidence(room.clients[0], payload));
    room.state.phase = "board_sidebet";
    assert.doesNotThrow(() => room.handleSubmitSideBet(room.clients[0], payload));
  }
  assert.equal(room.roundConfidenceDecisions.size, 0);
  assert.equal(room.roundSideBets.size, 0);
});

test("drafts, confidence and side bets cannot be changed after their deadline", () => {
  const room = roomFor();
  room.state.phaseEndsAt = Date.now() - 1;
  room.state.phase = "question";
  room.state.currentQuestion.qType = "word";
  room.handleSaveAnswerDraft(room.clients[0], { value: "late" });
  room.roundAnswers.set("p0", { playerId: "p0", value: "answer", confidence: "none" });
  room.state.phase = "confidence";
  room.handleSubmitConfidence(room.clients[0], { value: 6 });
  room.state.phase = "board_sidebet";
  room.handleSubmitSideBet(room.clients[1], { targetId: "p0", prediction: "correct" });
  room.handleSkipSideBet(room.clients[1]);
  assert.equal(room.roundAnswerDrafts.size, 0);
  assert.equal(room.roundAnswers.get("p0").confidence, "none");
  assert.equal(room.roundSideBets.size, 0);
  assert.equal(room.roundSideBetDecisions.size, 0);
});

test("solo practice sessions cannot persist completion Stars or recorded wins", async (t) => {
  const room = roomFor("friends", 1);
  room.practiceMatch = true;
  t.mock.method(database, "saveCompletedMatch", () => assert.fail("practice must not persist rewards"));
  await GameRoom.prototype.persistFinalResults.call(room);
  assert.equal(room.resultsPersisted, true);
});

test("room creation bounds malicious counts before generating the question set", async () => {
  await matchMaker.setup();
  const room = roomFor("classic", 0);
  Object.defineProperty(room, "roomId", { value: "123456", writable: true });
  room.clock = { setInterval: () => {} };
  room.setState = (state) => { room.state = state; };
  room.onMessage = () => {};
  await room.onCreate({ roundCount: 1_000_000_000, customQuestions: [null], excludeQuestionIds: {} });
  assert.equal(room.state.totalRounds, 10);
  assert.equal(room.questionSet.length, 10);
});

test("disposing a room cancels its phase timer and prevents scheduling more", async () => {
  const room = roomFor();
  let transitions = 0;
  room.advancePhase = () => { transitions++; };
  room.setPhase("question", 10);
  room.onDispose();
  room.setPhase("reveal", 10);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(transitions, 0);
  assert.equal(room.state.phase, "question");
});
