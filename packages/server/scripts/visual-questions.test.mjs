import test from "node:test";
import { ADDITIONAL_QUESTIONS } from "../dist/content/additionalQuestions.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { VISUAL_ASSETS, hasVisualAsset, imageRevealStage, imageRevealPoints, isAnswerCorrect, isValidAnswerValue, ENDLESS_TIMERS, computeRoundResults, normalizeGeographyAnswer } from "@confidence-trivia/shared";
import { VISUAL_QUESTIONS } from "../dist/content/visualQuestions.js";
import { STORAGE_IMAGE_QUESTIONS } from "../dist/content/storageImageQuestions.js";
import { ENDLESS_QUESTIONS } from "../dist/content/endlessQuestions.js";
import { QUESTIONS, getQuestionSet, validateQuestionBank, localize } from "../dist/content/questions.js";
import { createEndlessRun, applyEndlessCommand, publicEndlessRun, validEndlessAnswer } from "../dist/endlessEngine.js";
const require = createRequire(import.meta.url);
const { GameRoom } = require("../dist/rooms/GameRoom.js");
const { RoomStateSchema, PlayerSchema } = require("../dist/state/schema.js");

function roomFor(record, mode = "classic") {
  const room = Object.create(GameRoom.prototype);
  Object.assign(room, { state: new RoomStateSchema(), clients: [], locale: "en", questionSet: [record], visualReady: new Set(), roundAnswers: new Map(), roundAnswerDrafts: new Map(), roundConfidenceDecisions: new Set(), roundSideBets: new Map(), roundSideBetDecisions: new Set(), setPhase(phase,duration) { this.state.phase = phase; this.state.phaseEndsAt = Date.now()+duration; }, endGame() { this.state.gameEnded = true; } });
  room.state.gameMode = mode;
  for (const id of ["p0","p1"]) { const player = new PlayerSchema(); player.id = id; room.state.players.set(id, player); room.clients.push({ sessionId: id }); }
  room.presentCurrentQuestion();
  return room;
}
const image = VISUAL_QUESTIONS.find((q) => q.id === "reveal_pyramids");
function ready(room) { for (const client of room.clients) room.handleVisualReady(client, { questionId: room.state.currentQuestion.id }); }
function endless(question, now = 1000) { return createEndlessRun(randomUUID(), 0, now, [question]); }
function command(run, type, now, answer) { applyEndlessCommand(run, { type, runId: run.id, token: run.question.token, answer }, now); }

test("sample content covers countries, continents, all visual input methods and difficulties", () => {
  assert.equal(VISUAL_QUESTIONS.length, 11 + STORAGE_IMAGE_QUESTIONS.length);
  assert.deepEqual(new Set(VISUAL_QUESTIONS.map((q) => q.difficulty)), new Set(["easy","medium","hard"]));
  for (const [format, types] of [["map_shapes",["multiple_choice","word"]],["image_reveal",["multiple_choice","word","estimate"]]]) {
    for (const type of types) assert.ok(VISUAL_QUESTIONS.some((q) => q.presentation.format === format && q.type === type));
  }
  assert.ok(VISUAL_QUESTIONS.some((q) => q.presentation.geography?.kind === "continent"));
  assert.doesNotThrow(() => validateQuestionBank());
  assert.equal(QUESTIONS.length, 170 + STORAGE_IMAGE_QUESTIONS.length + ADDITIONAL_QUESTIONS.length);
});
test("every raster sample has a real bundled PNG matching its manifest and source drawing", async () => {
  for (const id of ["scene_01","scene_02","scene_03"]) {
    const bytes = await readFile(new URL(`../../mobile/assets/visual/${id}.png`, import.meta.url));
    assert.equal(bytes.subarray(1,4).toString(),"PNG");
    assert.equal(bytes.readUInt32BE(16), VISUAL_ASSETS[id].width);
    assert.equal(bytes.readUInt32BE(20), VISUAL_ASSETS[id].height);
    const source = await readFile(new URL(`../../mobile/assets/visual/${id}.svg`, import.meta.url),"utf8");
    assert.ok(source.includes('viewBox="0 0 300 220"'));
  }
});
test("country and continent geometry is bundled, fitted inside consistent bounds, and preserves islands", () => {
  for (const question of VISUAL_QUESTIONS.filter((q) => q.presentation.format === "map_shapes")) {
    const asset = VISUAL_ASSETS[question.presentation.assetId];
    assert.equal(asset.viewBox, "0 0 300 220"); assert.ok(asset.paths.length);
    const coords = asset.paths.flatMap((p) => [...p.d.matchAll(/([\d.]+),([\d.]+)/g)]);
    assert.ok(coords.length > 10);
    for (const [,x,y] of coords) { assert.ok(+x >= 0 && +x <= 300); assert.ok(+y >= 0 && +y <= 220); }
  }
  assert.ok(VISUAL_ASSETS.geo_country_JP.paths.length > 1);
  assert.ok(VISUAL_ASSETS.geo_country_NZ.paths.length > 1);
});
test("missing image or geography references are rejected at authoring validation", () => {
  assert.equal(hasVisualAsset("missing"), false);
  assert.throws(() => validateQuestionBank([{ ...image, presentation: { format: "image_reveal", assetId: "missing" } }]));
  assert.throws(() => validateQuestionBank([{ ...image, type: "closest_answer" }]));
});
test("written geography accepts explicit aliases, case, accents and punctuation without fuzzy countries", () => {
  assert.ok(isAnswerCorrect("word", "  NEW-ZEALAND! ", ["New Zealand","Aotearoa"], normalizeGeographyAnswer));
  assert.ok(isAnswerCorrect("word", "AOTEAROA", ["New Zealand","Aotearoa"]));
  assert.ok(isAnswerCorrect("word", "Nippon", ["Japan","Nippon","Nihon"]));
  assert.ok(isAnswerCorrect("word", "São-Tomé", ["Sao Tome"], normalizeGeographyAnswer));
  assert.ok(!isAnswerCorrect("word", "China", ["Japan","Nippon","Nihon"]));
  assert.ok(!isAnswerCorrect("word", "Democratic Republic of the Congo", ["Republic of the Congo"]));
});
test("existing written answers keep their punctuation-sensitive semantics", () => {
  assert.ok(isAnswerCorrect("word", " C++ ", "C++"));
  assert.ok(!isAnswerCorrect("word", "C", "C++"));
  assert.ok(!isAnswerCorrect("word", "C#", "C++"));
});
test("numeric image counts are exact and choice inputs remain bounded", () => {
  assert.ok(isAnswerCorrect("estimate",4,4)); assert.ok(!isAnswerCorrect("estimate",3,4));
  for (const value of [-1,4,0.5,"0",{},undefined]) assert.equal(isValidAnswerValue("multiple_choice",value,4),false);
  assert.equal(isValidAnswerValue("estimate",4,0),true); assert.equal(isValidAnswerValue("estimate",Infinity,0),false);
});
test("reveal stages use precise thirds for 30, 25, 20 and 15 seconds", () => {
  for (const duration of [30000,25000,20000,15000]) {
    const start = 1234;
    for (const [elapsed,stage] of [[0,1],[duration/3-0.001,1],[duration/3,2],[2*duration/3-0.001,2],[2*duration/3,3],[duration,3]]) {
      assert.equal(imageRevealStage(start,duration,start+elapsed),stage);
      assert.equal(imageRevealPoints(start,duration,start+elapsed),4-stage);
    }
  }
});
test("multiplayer waits for all current artwork acknowledgements; duplicates cannot restart time", () => {
  const room = roomFor(image);
  assert.equal(room.state.phase,"visual_loading"); assert.equal(room.state.currentQuestion.startedAt,0);
  room.handleVisualReady(room.clients[0],{questionId:"stale"}); assert.equal(room.visualReady.size,0);
  room.handleSubmitAnswer(room.clients[0],{value:0}); assert.equal(room.roundAnswers.size,0);
  room.handleVisualReady(room.clients[0],{questionId:image.id}); assert.equal(room.state.phase,"visual_loading");
  room.handleVisualReady(room.clients[1],{questionId:image.id}); assert.equal(room.state.phase,"question");
  const time = room.state.currentQuestion.startedAt;
  room.handleVisualReady(room.clients[1],{questionId:image.id}); assert.equal(room.state.currentQuestion.startedAt,time);
  assert.equal(room.state.currentQuestion.durationMs,30000);
  assert.equal(localize(image,"en").presentation.assetId, image.presentation.assetId);
  assert.ok(!("correctAnswer" in room.state.currentQuestion));
});
test("failed or late-loading artwork replaces the question for everyone without scoring", () => {
  for (const failure of [true,false]) {
    const room = roomFor(image); room.state.currentRoundIndex = 0;
    if (failure) room.handleVisualReady(room.clients[0],{questionId:image.id,failed:true}); else room.advancePhase();
    assert.equal(room.state.phase,"question"); assert.equal(room.state.currentQuestion.visualFormat,"");
    assert.equal(room.roundAnswers.size,0); assert.equal(room.state.players.get("p0").score,0); assert.equal(room.state.currentRoundIndex,0);
  }
});
test("reconnecting during Image Reveal preserves the shared timeline and current stage", async () => {
  const room = roomFor(image); ready(room);
  room.state.gameStarted = true;
  room.state.currentQuestion.startedAt = Date.now()-15000;
  const startedAt = room.state.currentQuestion.startedAt, deadline = room.state.phaseEndsAt;
  room.updateLobbyMetadata = async () => {};
  room.allowReconnection = async () => { assert.equal(room.state.players.get("p0").connected,false); return room.clients[0]; };
  await room.onLeave(room.clients[0],false);
  assert.equal(room.state.players.get("p0").connected,true);
  assert.equal(room.state.phase,"question"); assert.equal(room.state.currentQuestion.startedAt,startedAt); assert.equal(room.state.phaseEndsAt,deadline);
  room.handleVisualReady(room.clients[0],{questionId:image.id});
  assert.equal(room.state.currentQuestion.startedAt,startedAt);
  assert.equal(imageRevealStage(startedAt,room.state.currentQuestion.durationMs,Date.now()),2);
});
test("all confidence modes use each answer's server timestamp for stage points", () => {
  for (const mode of ["classic","friends","ranked"]) {
    const room = roomFor(image,mode); ready(room);
    room.state.currentQuestion.startedAt = 1000; room.state.currentQuestion.durationMs = 30000;
    room.roundAnswers.set("p0",{playerId:"p0",value:0,confidence:1,submittedAt:10999});
    room.roundAnswers.set("p1",{playerId:"p1",value:0,confidence:1,submittedAt:21000});
    room.resolveRound(); assert.equal(room.state.players.get("p0").score,3); assert.equal(room.state.players.get("p1").score,1);
  }
});
test("wrong-answer confidence penalties and no-confidence opt-out are unchanged", () => {
  const result = computeRoundResults({ correctAnswer:0, answerBasePoints:{wrong:3,none:3}, answers:[{playerId:"wrong",value:1,confidence:5,submittedAt:0},{playerId:"none",value:0,confidence:"none",submittedAt:0}], sideBets:[], currentStreaks:{}, isAnswerCorrect:(value,key)=>value===key });
  assert.deepEqual(result.scoreEvents.map((e)=>e.delta),[-4,0]);
});
test("Damage uses 3/2/1 stage damage, preserving carry bonuses and mutual-correct draws", () => {
  for (const [at,damage] of [[1001,3],[11000,2],[21000,1]]) {
    const room = roomFor(image,"damage"); ready(room); room.state.currentQuestion.startedAt=1000;
    room.roundAnswers.set("p0",{playerId:"p0",value:0,confidence:"none",submittedAt:at});
    room.roundAnswers.set("p1",{playerId:"p1",value:1,confidence:"none",submittedAt:at});
    room.state.pendingDamageBonus=2; room.resolveDamageRound();
    assert.equal(room.state.revealResults[0].damageDealt,damage+2); assert.equal(room.state.players.get("p1").health,15-damage-2);
  }
  const room=roomFor(image,"damage"); ready(room);
  for(const id of ["p0","p1"])room.roundAnswers.set(id,{playerId:id,value:0,confidence:"none",submittedAt:room.state.currentQuestion.startedAt+1});
  room.resolveDamageRound(); assert.equal(room.state.pendingDamageBonus,1); assert.equal(room.state.players.get("p0").health,15);
});
test("client-supplied reveal stages/points and duplicate or stale answers cannot affect scoring", () => {
  const room = roomFor(image); ready(room); room.state.currentQuestion.startedAt = Date.now()-21000;
  room.handleSubmitAnswer(room.clients[0],{value:0,questionId:"old",stage:1,points:999}); assert.equal(room.roundAnswers.size,0);
  room.handleSubmitAnswer(room.clients[0],{value:0,questionId:image.id,stage:1,points:999,timestamp:0});
  room.handleSubmitAnswer(room.clients[0],{value:1,questionId:image.id});
  room.roundAnswers.get("p0").confidence=1; room.resolveRound(); assert.equal(room.state.players.get("p0").score,1);
});
test("Endless visuals wait for readiness, keep actual difficulty timers and never leak answer keys", () => {
  for (const content of ENDLESS_QUESTIONS.filter((q)=>q.presentation)) {
    const run = endless(content); assert.equal(run.phase,"loading"); assert.equal(run.question.deadline,0);
    const safe=publicEndlessRun(run); assert.ok(!("correctAnswer" in safe.question)); assert.ok(!("correctIndex" in safe.question)); assert.ok(!("contentId" in safe.question));
    command(run,"ready",2000); assert.equal(run.question.deadline,2000+ENDLESS_TIMERS[content.difficulty]*1000);
    command(run,"ready",2100); assert.equal(run.question.startedAt,2000);
  }
});
test("Endless correct answers add exactly one in every reveal stage and every input method", () => {
  for (const content of ENDLESS_QUESTIONS.filter((q)=>q.presentation)) for (const stage of [1,2,3]) {
    const run=endless(content); command(run,"ready",2000);
    const time=2000+(stage-1)*run.question.duration*1000/3+1;
    for(let at=4000;at<time;at+=2000)command(run,"heartbeat",at);
    const key=run.question.correctAnswer; command(run,"answer",time,Array.isArray(key)?key[0]:key);
    assert.equal(run.score,1); assert.equal(run.lives,3); assert.equal(run.feedback.correct,true);
  }
});
test("Endless wrong visual answers and timeouts lose one life, failures lose none", () => {
  for(const content of ENDLESS_QUESTIONS.filter((q)=>q.presentation)) {
    const run=endless(content); command(run,"ready",2000);
    const wrong=content.answerType==="word"?"wrong country":content.answerType==="estimate"?999:(run.question.correctIndex+1)%4;
    command(run,"answer",2100,wrong); assert.equal(run.lives,2); assert.equal(run.score,0);
    const timeout=endless(content); command(timeout,"ready",2000);
    for(let at=4000;at<timeout.question.deadline;at+=2000)command(timeout,"heartbeat",at);
    command(timeout,"answer",timeout.question.deadline,null); assert.equal(timeout.lives,2); assert.equal(timeout.feedback.timedOut,true);
    const failed=endless(content); command(failed,"visualFailed",2000); assert.equal(failed.lives,3); assert.equal(failed.question.number,1); assert.equal(failed.phase,"question"); assert.equal(failed.question.presentation,undefined);
  }
});
test("Endless loading cannot be held forever or invalid choice values used to renew it", () => {
  const content=ENDLESS_QUESTIONS.find((q)=>q.presentation); const run=endless(content);
  command(run,"heartbeat",4000); command(run,"heartbeat",7000); command(run,"ready",9000);
  assert.equal(run.phase,"question"); assert.equal(run.question.presentation,undefined); assert.equal(run.lives,3);
  assert.equal(validEndlessAnswer(run.question,99),false); assert.equal(validEndlessAnswer(run.question,"0"),false);
});
test("a preparation timeout preserves live heartbeats and never swallows abandonment", () => {
  const content=ENDLESS_QUESTIONS.find((q)=>q.presentation);
  const active=endless(content); command(active,"heartbeat",9000);
  assert.equal(active.phase,"question"); assert.equal(active.connectionDeadline,19000);
  command(active,"heartbeat",11000); assert.equal(active.phase,"question"); assert.equal(active.lives,3);
  const leaving=endless(content); command(leaving,"abandon",9000);
  assert.equal(leaving.phase,"finished"); assert.equal(leaving.endReason,"abandoned");
});
test("question selection includes visual formats and can exclude them for safe fallback", () => {
  const all=getQuestionSet(QUESTIONS.length); assert.equal(new Set(all.map((q)=>q.id)).size,QUESTIONS.length);
  assert.ok(all.some((q)=>q.presentation?.format==="map_shapes")); assert.ok(all.some((q)=>q.presentation?.format==="image_reveal"));
  assert.ok(getQuestionSet(30,[],[],false).every((q)=>!q.presentation));
});
