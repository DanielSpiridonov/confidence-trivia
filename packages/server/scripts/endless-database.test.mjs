import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { endlessAction, endlessLeaderboard } from "../dist/endless.js";
import { ENDLESS_PROTOCOL_VERSION } from "@confidence-trivia/shared";
import { createEndlessRun } from "../dist/endlessEngine.js";
import { ENDLESS_QUESTIONS } from "../dist/content/endlessQuestions.js";

// Real PostgreSQL SQL/constraints/transactions in WASM. Only the postgres.js
// transport is adapted. All production service queries and migration 023 run
// unchanged. PGlite queues transactions on one connection: these tests validate
// concurrent request semantics, not multi-instance lock contention/performance.
const pg = new PGlite();
let statementCount = 0;
function adapter(connection) {
  const sql = async (strings, ...values) => {
    statementCount++;
    const query = strings.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
    return (await connection.query(query, values)).rows;
  };
  sql.json = (value) => JSON.stringify(value);
  sql.begin = (callback) => pg.transaction((tx) => callback(adapter(tx)));
  return sql;
}
const sql = adapter(pg);
const playerId = randomUUID(), userId = randomUUID();
const sync = () => endlessAction(playerId, userId, { type: "sync" }, sql);
const start = async (requestId = randomUUID()) => {
  const result = await endlessAction(playerId, userId, { type: "start", requestId }, sql);
  return result.run?.phase === "loading" ? endlessAction(playerId, userId, { type: "ready", runId: result.run.id, token: result.run.question.token }, sql) : result;
};
async function storedRun() { return (await pg.query("select state from endless_runs where player_id = $1 order by finished, created_at desc limit 1", [playerId])).rows[0].state; }
async function setRun(state) { await pg.query("update endless_runs set state = $1::jsonb, finished = $2 where id = $3", [JSON.stringify(state), state.phase === "finished", state.id]); }
function correctInput(run) {
  const key = run.question.correctAnswer ?? run.question.correctIndex;
  return Array.isArray(key) ? key[0] : key;
}
async function answerCorrect() {
  const r = await storedRun();
  return endlessAction(playerId, userId, { type: "answer", runId: r.id, token: r.question.token, answer: correctInput(r) }, sql);
}

before(async () => {
  // Dependencies belong to earlier migrations; minimal fixture keeps tests
  // independent of external Supabase Auth and pg_cron infrastructure.
  await pg.exec(`
    create role anon; create role authenticated;
    create table players(id uuid primary key, auth_user_id uuid, display_name text default 'Player', account_type text default 'registered', moderation_status text default 'active', suspended_until timestamptz, stars integer not null default 0 check(stars >= 0));
    create table star_transactions(id uuid primary key, player_id uuid references players(id) on delete set null, amount integer not null check(amount <> 0), reason text not null);
    create table player_cosmetics(player_id uuid references players(id) on delete cascade, cosmetic_id text, cosmetic_type text, equipped boolean);
  `);
  await pg.exec(await readFile(new URL("../../../supabase/migrations/023_create_endless.sql", import.meta.url), "utf8"));
});
beforeEach(async () => {
  await pg.exec("truncate players cascade");
  await pg.query("insert into players(id, auth_user_id, stars) values ($1, $2, 100)", [playerId, userId]);
});
after(async () => { await pg.close(); });

test("migration creates private tables with RLS and no API privileges", async () => {
  const rows = (await pg.query("select relname, relrowsecurity from pg_class where relname in ('endless_runs','endless_records','endless_reward_claims')")).rows;
  assert.equal(rows.length, 3); assert.ok(rows.every((r) => r.relrowsecurity));
  for (const role of ["anon", "authenticated"]) {
    for (const table of ["endless_runs", "endless_records", "endless_reward_claims"]) {
      const [r] = (await pg.query("select has_table_privilege($1, $2, 'select') as readable, has_table_privilege($1, $2, 'insert,update,delete') as writable", [role, table])).rows;
      assert.equal(r.readable, false); assert.equal(r.writable, false);
    }
  }
});
test("unauthorized identity, guests, and banned players cannot mutate Endless", async () => {
  await assert.rejects(endlessAction(playerId, randomUUID(), { type: "start", requestId: randomUUID() }, sql), { status: 403 });
  for (const [accountType, moderation] of [["guest", "active"], ["registered", "banned"], ["registered", "suspended"]]) {
    await pg.query("update players set account_type = $1, moderation_status = $2, suspended_until = now() + interval '1 day'", [accountType, moderation]);
    await assert.rejects(start(), { status: 403 });
  }
  assert.equal((await pg.query("select count(*)::int as n from endless_runs")).rows[0].n, 0);
});
test("Start is idempotent; simultaneous devices share one persistent active run", async () => {
  const id = randomUUID();
  const states = await Promise.all(Array.from({ length: 12 }, (_, i) => start(i % 2 ? randomUUID() : id)));
  assert.equal(new Set(states.map((s) => s.run.id)).size, 1);
  assert.equal((await pg.query("select count(*)::int as n from endless_runs")).rows[0].n, 1);
  const resumed = await sync(); assert.deepEqual(resumed.run, states[0].run);
  assert.equal(resumed.protocolVersion, ENDLESS_PROTOCOL_VERSION);
});
test("database deadlines survive reconnect and cannot be reset by another Start", async () => {
  await start(); const r = await storedRun(); r.question.deadline = Date.now() - 10000; await setRun(r);
  const lost = await start(); assert.equal(lost.run.lives, 2); assert.equal(lost.run.phase, "feedback"); assert.equal(lost.run.feedback.timedOut, true);
  assert.equal((await sync()).run.lives, 2); assert.equal((await storedRun()).question.deadline, r.question.deadline);
});

test("expired persisted runs reject late answers and heartbeats, keeping records and Stars", async () => {
  await start(); let r = await storedRun(); r.score = 10; await setRun(r);
  await sync(); r = await storedRun(); r.connectionDeadline = Date.now() - 1; await setRun(r);
  const late = await endlessAction(playerId, userId, { type: "answer", runId: r.id, token: r.question.token, answer: r.question.correctIndex }, sql);
  assert.equal(late.run.phase, "finished"); assert.equal(late.run.endReason, "abandoned"); assert.equal(late.run.score, 10); assert.equal(late.run.lives, 0);
  const again = await endlessAction(playerId, userId, { type: "heartbeat", runId: r.id }, sql);
  assert.deepEqual(again.run, late.run); assert.equal(again.personalBest, 10); assert.equal(again.stars, 110); assert.deepEqual(again.claimed, [10]);
  assert.equal((await pg.query("select finished from endless_runs where id = $1", [r.id])).rows[0].finished, true);
});

test("Start closes an expired run before inserting a fresh one and retries cannot revive it", async () => {
  const id = randomUUID(); await start(id); const r = await storedRun(); r.connectionDeadline = Date.now() - 1; await setRun(r);
  const retry = await start(id); assert.equal(retry.run.id, id); assert.equal(retry.run.endReason, "abandoned");
  const newId = randomUUID(); const fresh = await start(newId);
  assert.equal(fresh.run.id, newId); assert.equal(fresh.run.lives, 3); assert.equal(fresh.run.score, 0);
  assert.equal((await start(id)).run.id, newId);
  const rows = (await pg.query("select id, finished from endless_runs")).rows;
  assert.equal(rows.length, 2); assert.equal(rows.filter((r) => !r.finished).length, 1);
});

test("a new Start atomically expires a lost run without a prior sync", async () => {
  await start(); const lost = await storedRun(); lost.connectionDeadline = Date.now() - 1; await setRun(lost);
  const fresh = await start(); assert.notEqual(fresh.run.id, lost.id); assert.equal(fresh.run.phase, "question");
  assert.equal((await pg.query("select finished from endless_runs where id = $1", [lost.id])).rows[0].finished, true);
});

test("explicit abandonment is idempotent and stale abandon requests cannot end a newer run", async () => {
  await start(); const r = await storedRun(); const command = { type: "abandon", runId: r.id };
  const ended = await endlessAction(playerId, userId, command, sql); assert.equal(ended.run.endReason, "abandoned");
  assert.deepEqual((await endlessAction(playerId, userId, command, sql)).run, ended.run);
  const fresh = await start(); const stale = await endlessAction(playerId, userId, command, sql);
  assert.equal(stale.run.id, fresh.run.id); assert.equal(stale.run.phase, "question"); assert.equal(stale.run.lives, 3);
});

test("reads cannot keep a run alive and only a matching heartbeat renews it", async () => {
  await start(); let r = await storedRun(); r.connectionDeadline = Date.now() + 2000; await setRun(r);
  assert.equal((await sync()).run.connectionDeadline, r.connectionDeadline);
  const renewed = await endlessAction(playerId, userId, { type: "heartbeat", runId: r.id }, sql);
  assert.equal(renewed.run.connectionDeadline, renewed.serverNow + 10000);
  r = await storedRun(); delete r.connectionDeadline; await setRun(r);
  assert.equal((await sync()).run.endReason, "abandoned");
});
test("ordinary answer uses four statements and an idempotent retry performs no writes", async () => {
  await start(); const r = await storedRun();
  const command = { type: "answer", runId: r.id, token: r.question.token, answer: correctInput(r) };
  statementCount = 0;
  const result = await endlessAction(playerId, userId, command, sql);
  assert.equal(result.run.score, 1); assert.equal(statementCount, 4);
  const before = (await pg.query("select updated_at from endless_runs where id = $1", [r.id])).rows[0].updated_at;
  statementCount = 0;
  await endlessAction(playerId, userId, command, sql);
  assert.equal(statementCount, 2);
  assert.deepEqual((await pg.query("select updated_at from endless_runs where id = $1", [r.id])).rows[0].updated_at, before);
});

test("visual word and numeric answers persist safely and grant one point and one milestone", async () => {
  for (const answerType of ["word", "estimate"]) {
    // Reset just this player's prior attempt/claims between answer methods.
    await pg.exec("truncate endless_runs, endless_records, endless_reward_claims, star_transactions cascade");
    await pg.query("update players set stars = 100 where id = $1", [playerId]);
    await start(); const old = await storedRun();
    const content = ENDLESS_QUESTIONS.find((q) => q.presentation && q.answerType === answerType);
    const r = createEndlessRun(old.id, 0, Date.now(), [content]); r.score = 9; await setRun(r);
    const ready = await endlessAction(playerId, userId, { type: "ready", runId: r.id, token: r.question.token }, sql);
    assert.equal(ready.run.phase, "question"); assert.ok(!("correctAnswer" in ready.run.question));
    await assert.rejects(endlessAction(playerId, userId, { type: "answer", runId: r.id, token: r.question.token, answer: answerType === "word" ? 123 : "4" }, sql), { status: 400 });
    const key = r.question.correctAnswer;
    const command = { type: "answer", runId: r.id, token: r.question.token, answer: Array.isArray(key) ? key[0] : key };
    const result = await endlessAction(playerId, userId, command, sql);
    assert.equal(result.run.score, 10); assert.equal(result.run.lives, 3); assert.equal(result.run.feedback.correct, true); assert.equal(result.stars, 110);
    assert.equal((await endlessAction(playerId, userId, command, sql)).stars, 110);
  }
});
test("concurrent answers, retries, records, and reward grants settle exactly once", async () => {
  await start(); const r = await storedRun(); r.score = 9; await setRun(r);
  const command = { type: "answer", runId: r.id, token: r.question.token, answer: correctInput(r) };
  const results = await Promise.all(Array.from({ length: 20 }, () => endlessAction(playerId, userId, command, sql)));
  for (const state of results) { assert.equal(state.run.score, 10); assert.equal(state.personalBest, 10); assert.equal(state.stars, 110); assert.deepEqual(state.claimed, [10]); }
  assert.equal((await pg.query("select count(*)::int as n from star_transactions")).rows[0].n, 1);
  assert.equal((await pg.query("select count(*)::int as n from endless_reward_claims")).rows[0].n, 1);
});
test("failed currency transaction rolls back answer, record, and claim; retry succeeds", async () => {
  await start(); const r = await storedRun(); r.score = 9; await setRun(r);
  await pg.exec("create function fail_reward() returns trigger language plpgsql as $$ begin raise exception 'simulated failure'; end $$; create trigger fail_reward before insert on star_transactions for each row execute function fail_reward();");
  try { await assert.rejects(answerCorrect(), /simulated failure/); } finally { await pg.exec("drop trigger fail_reward on star_transactions; drop function fail_reward();"); }
  assert.equal((await storedRun()).score, 9); assert.equal((await storedRun()).phase, "question");
  assert.equal((await pg.query("select best_score from endless_records")).rows[0].best_score, 0);
  const result = await answerCorrect(); assert.equal(result.run.score, 10); assert.equal(result.stars, 110);
});
test("several milestone rewards commit together and their unique claims prevent duplicates", async () => {
  await start(); const r = await storedRun(); r.score = 75; await setRun(r);
  const state = await sync(); assert.equal(state.personalBest, 75); assert.deepEqual(state.claimed.sort((a,b) => a-b), [10,25,50,75]); assert.equal(state.stars, 170);
  assert.equal((await sync()).stars, 170);
  await assert.rejects(pg.query("insert into endless_reward_claims select * from endless_reward_claims limit 1"), /duplicate key/);
});
test("replay resets the run; finishing below a previous best never reduces permanent progress", async () => {
  const id = randomUUID(); await start(id); let r = await storedRun(); r.score = 50; r.phase = "finished"; r.lives = 0; r.endReason = "lives"; await setRun(r); await sync();
  const replay = await start(); assert.equal(replay.run.score, 0); assert.equal(replay.run.lives, 3); assert.equal(replay.run.previousBest, 50); assert.equal(replay.personalBest, 50); assert.equal(replay.stars, 145);
  // Retrying an old Start cannot replace a newer run.
  assert.equal((await start(id)).run.id, replay.run.id);
  r = await storedRun(); r.score = 35; r.phase = "finished"; r.lives = 0; await setRun(r);
  const below = await sync(); assert.equal(below.personalBest, 50); assert.equal(below.stars, 145); assert.deepEqual(below.run.rewards, []);
});
test("one-active-run database constraint protects against non-cooperating writers", async () => {
  await start(); await assert.rejects(pg.query("insert into endless_runs(id,player_id,state) values ($1,$2,'{}')", [randomUUID(), playerId]), /duplicate key/);
});
test("leaderboard uses verified single-run best, earliest achievement, then player ID", async () => {
  assert.deepEqual(await endlessLeaderboard(playerId, sql), { top: [], currentPlayer: null });
  const earlier = randomUUID();
  await pg.query("insert into players(id, auth_user_id, display_name) values($1,$2,'Earlier')", [earlier, randomUUID()]);
  await pg.query("insert into endless_records(player_id,best_score,achieved_at) values ($1,50,'2026-01-02'),($2,50,'2026-01-01')", [playerId, earlier]);
  await pg.query("insert into player_cosmetics values($1,'clever_fox','avatar',true)", [earlier]);
  const board = await endlessLeaderboard(playerId, sql); assert.equal(board.top[0].playerId, earlier); assert.equal(board.top[0].avatarId, "clever_fox"); assert.equal(board.currentPlayer.position, 2);
  await pg.query("update endless_records set achieved_at = '2026-01-01'");
  const tied = await endlessLeaderboard(playerId, sql); assert.equal(tied.top[0].playerId, [earlier, playerId].sort()[0]);
  await pg.query("update players set moderation_status = 'banned' where id = $1", [earlier]);
  assert.equal((await endlessLeaderboard(playerId, sql)).top.length, 1);
});
test("leaderboard includes the current player outside the top 100", async () => {
  await pg.query("insert into endless_records(player_id,best_score) values ($1,1)", [playerId]);
  for (let i=0; i<101; i++) {
    const id = randomUUID(); await pg.query("insert into players(id,auth_user_id) values($1,$2)", [id,randomUUID()]); await pg.query("insert into endless_records(player_id,best_score) values($1,2)", [id]);
  }
  const board = await endlessLeaderboard(playerId, sql); assert.equal(board.top.length, 100); assert.equal(board.currentPlayer.position, 102);
});
test("account deletion erases private Endless history and removes the leaderboard record", async () => {
  await start(); const r = await storedRun(); r.score = 10; await setRun(r); await sync();
  await pg.query("update players set account_type = 'deleted' where id = $1", [playerId]);
  for (const table of ["endless_runs", "endless_records", "endless_reward_claims"]) assert.equal((await pg.query(`select count(*)::int as n from ${table}`)).rows[0].n, 0);
  assert.equal((await pg.query("select count(*)::int as n from star_transactions")).rows[0].n, 1);
});
