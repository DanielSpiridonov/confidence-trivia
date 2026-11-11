import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { BOT_ACCURACY, botRandom, decideBot, wagerBotSkill } = require('../dist/bots.js');
const { GameRoom } = require('../dist/rooms/GameRoom.js');
const { RoomStateSchema, PlayerSchema } = require('../dist/state/schema.js');
const { isAnswerCorrect, isValidAnswerValue, DAMAGE_WAGER_OPTIONS } = require('@confidence-trivia/shared');
const { getQuestionSet, getLocalizedCorrectAnswer } = require('../dist/content/questions.js');
function question(type, difficulty='medium') {
  const correctAnswer = type==='ordering' ? [2,0,1] : type==='word' ? ['Paris','PARIS'] : ['estimate','closest_answer'].includes(type) ? 100 : 1;
  return {id:'q',type,difficulty,category:'test',basePoints:1,correctAnswer,translations:{en:{text:'?',options:['a','b','c']},bg:{text:'?',options:['a','b','c']}}};
}
for (const skill of Object.keys(BOT_ACCURACY)) for (const difficulty of ['easy','medium','hard']) {
  test(`accuracy ${skill}/${difficulty} follows configured rate`, () => {
    const random=botRandom('accuracy'); const q=question('multiple_choice',difficulty); let hits=0;
    for(let i=0;i<15000;i++) { const d=decideBot(q,'en',skill,random); hits+=Number(d.value===1); assert.ok(d.responseMs>=2500&&d.responseMs<13000); }
    assert.ok(Math.abs(hits/15000-BOT_ACCURACY[skill][difficulty])<0.015);
  });
}
for(const type of ['multiple_choice','true_false','estimate','closest_answer','ordering','word','visual']) {
 test(`bot supports ${type} with both correct and incorrect valid answers`,()=>{
   const q=question(type); const correct=decideBot(q,'en','normal',()=>0); const wrong=decideBot(q,'en','normal',()=>0.999);
   assert.ok(isValidAnswerValue(type,correct.value,3)); assert.ok(isValidAnswerValue(type,wrong.value,3));
   assert.ok(isAnswerCorrect(type,correct.value,q.correctAnswer)); assert.ok(!isAnswerCorrect(type,wrong.value,q.correctAnswer));
 });
}
test('all live question types and localized keys produce valid bot answers',()=>{
 for(const q of getQuestionSet(10000)) for(const locale of ['en','bg']) {
   const d=decideBot(q,locale,'hard',()=>0);
   assert.ok(isValidAnswerValue(q.type,d.value,q.translations[locale].options?.length??0),q.id);
   assert.ok(isAnswerCorrect(q.type,d.value,getLocalizedCorrectAnswer(q,locale)),q.id);
 }
});
test('seeded decisions reproduce exactly and wager tiers never weaken',()=>{
 const a=botRandom('same'),b=botRandom('same');for(let i=0;i<100;i++)assert.equal(a(),b());
 const levels={easy:0,normal:1,hard:2};let prior=-1;
 for(const wager of DAMAGE_WAGER_OPTIONS){ const level=levels[wagerBotSkill(wager)];assert.ok(level>=prior);prior=level; }
 assert.equal(prior,2);
});
function roomFor(mode='damage') {
 const room=Object.create(GameRoom.prototype);
 Object.assign(room,{state:new RoomStateSchema(),maxClients:mode==='damage'?2:16,botTimers:new Set(),botDecisions:new Map(),roundAnswers:new Map(),roundConfidenceDecisions:new Set(),roundSideBetDecisions:new Set(),roundSideBets:new Map(),deviceIds:new Map(),questionSet:[question('multiple_choice')],locale:'en',matchId:'seed',clients:[],lock:async()=>{},unlock:async()=>{},setPrivate:async()=>{},updateLobbyMetadata:async()=>{},broadcast:()=>{}});
 room.state.gameMode=mode;room.state.damageWager=500;room.state.hostId='human';room.state.botAvailableAt=Date.now()+5000;
 const human=new PlayerSchema();human.id='human';human.isHost=true;room.state.players.set(human.id,human);room.deviceIds.set(human.id,'device');
 return room;
}
const actor={sessionId:'human'};
test('fallback waits five seconds, then starts and locks a practice bot game',async()=>{
 const r=roomFor();let locks=0;r.lock=async()=>{locks++};r.setPhase=phase=>{r.state.phase=phase};
 await r.handleBotRequest(actor,true);assert.equal(locks,0);assert.equal(r.state.players.size,1);
 r.state.botAvailableAt=Date.now()-1;await r.handleBotRequest(actor,true);
 assert.equal(locks,1);assert.equal(r.state.phase,'starting');assert.equal(r.state.botPractice,true);assert.equal(r.state.damagePot,0);
 assert.equal([...r.state.players.values()][1].botSkill,'hard');
 await r.handleBotRequest(actor,true);assert.equal(r.state.players.size,2);
});
test('human arrival wins the race before fallback; bot fallback cannot replace them',async()=>{
 const r=roomFor();r.state.botAvailableAt=0;const p=new PlayerSchema();p.id='other';r.state.players.set(p.id,p);
 await r.handleBotRequest(actor,true);assert.equal(r.state.botPractice,false);assert.equal(r.state.players.size,2);
});
test('in-flight human admission is rejected during fallback lock',async()=>{
 const r=roomFor();r.state.botAvailableAt=0;let release;r.lock=()=>new Promise(resolve=>{release=resolve});r.setPhase=phase=>{r.state.phase=phase};
 const pending=r.handleBotRequest(actor,true);
 await assert.rejects(r.onJoin({sessionId:'other'},{deviceId:'11111111-1111-4111-8111-111111111111',name:'Other'}));
 release();await pending;assert.equal(r.state.players.size,2);
});
test('disconnect while locking leaves the human queue available',async()=>{
 const r=roomFor();r.state.botAvailableAt=0;let unlocked=false;r.lock=async()=>{r.state.players.get('human').connected=false};r.unlock=async()=>{unlocked=true};
 await r.handleBotRequest(actor,true);assert.equal(r.state.players.size,1);assert.ok(unlocked);assert.equal(r.gameStartPending,false);
});
test('private hosts choose skills independently of avatar, guests/public/ranked cannot add bots',async()=>{
 const r=roomFor('friends');await r.handleBotRequest({sessionId:'guest'},false,'hard');assert.equal(r.state.players.size,1);
 await r.handleBotRequest(actor,false,'__proto__');assert.equal(r.state.players.size,1);
 await r.handleBotRequest(actor,false,'easy');assert.equal([...r.state.players.values()][1].botSkill,'easy');
 r.isPublic=true;await r.handleBotRequest(actor,false,'hard');assert.equal(r.state.players.size,2);
 const ranked=roomFor('ranked');await ranked.handleBotRequest(actor,false,'hard');assert.equal(ranked.state.players.size,1);
});
test('bot practice never reserves, settles, saves progression, or changes stars',async()=>{
 const db=require('../dist/database.js');const keys=['reserveDamageWager','settleDamageWager','saveCompletedMatch'];const old=keys.map(k=>db[k]);
 try {
  for(const k of keys)db[k]=()=>{throw new Error('Unexpected transaction '+k)};
  const r=roomFor();r.addBot('normal');r.setPhase=phase=>{r.state.phase=phase};r.state.players.get('human').stars=42;
  await r.handleStartGame(actor);assert.equal(r.state.phase,'starting');await r.persistFinalResults();await r.persistFinalResults();assert.equal(r.state.players.get('human').stars,42);
 }finally{keys.forEach((k,i)=>db[k]=old[i])}
});
test('bot timers submit through existing answer/confidence handlers and stop on dispose',t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const r=roomFor('classic');r.addBot('normal');r.state.currentQuestion.id='q';r.state.currentQuestion.qType='multiple_choice';r.state.currentQuestion.options.push('a','b','c');r.state.currentQuestion.startedAt=Date.now();
 r.state.players.get('human').connected=false;
 r.setPhase('question',30000);t.mock.timers.tick(13000);
 const bot=[...r.state.players.values()].find(p=>p.isBot);assert.ok(r.roundAnswers.has(bot.id));
 r.setPhase('confidence',10000);t.mock.timers.tick(3000);assert.ok(r.roundConfidenceDecisions.has(bot.id));
 r.setPhase('board_sidebet',10000);t.mock.timers.tick(1000);assert.ok(r.roundSideBetDecisions.has(bot.id));
 r.onDispose();assert.equal(r.botTimers.size,0);assert.ok(r.disposed);
});

test('bots acknowledge visual readiness without a socket',()=>{
 const r=roomFor('classic');r.addBot('normal');r.visualReady=new Set(['human']);r.state.phase='visual_loading';let begun=false;r.beginQuestion=()=>{begun=true};r.beginVisualIfReady();assert.ok(begun);
});
test('private duo bots balance teams and keep host ownership human',async()=>{
 const r=roomFor('friends');r.state.friendsTeamMode='duos';r.state.players.get('human').team='A';
 for(let i=0;i<3;i++)await r.handleBotRequest(actor,false,'normal');
 assert.equal([...r.state.players.values()].filter(p=>p.team==='A').length,2);
 assert.equal([...r.state.players.values()].filter(p=>p.team==='B').length,2);
 assert.ok(r.hasEnoughPlayers());assert.equal(r.state.hostId,'human');
});
test('bot answers accumulate scores through the normal round resolver',()=>{
 const r=roomFor('classic');r.addBot('normal');const bot=[...r.state.players.values()].find(p=>p.isBot);
 r.roundAnswers.set(bot.id,{playerId:bot.id,value:1,confidence:3,submittedAt:Date.now()});
 r.resolveRound();assert.ok(bot.score>0);assert.ok(r.state.revealResults.find(row=>row.playerId===bot.id).correct);
});
test('bot match ends when its last human forfeits and clears timers',()=>{
 const r=roomFor('friends');r.addBot('normal');r.state.gameStarted=true;r.state.phase='question';
 r.botTimers.add(setTimeout(()=>assert.fail('orphan bot timer'),5000));r.persistFinalResults=async()=>{};
 assert.ok(r.finishPlayerDeparture(r.state.players.get('human')));assert.equal(r.state.gameEnded,true);assert.equal(r.botTimers.size,0);
});
