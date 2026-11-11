import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const { reserveBotDamageWager, settleBotDamageWager, saveCompletedMatch }=require('../dist/database.js');
const pg=new PGlite();
function adapter(connection){
 const sql=async(strings,...values)=>{
  const query=strings.reduce((text,part,i)=>text+(i?`$${i}`:'')+part,'');
  return (await connection.query(query,values)).rows;
 };
 sql.begin=callback=>pg.transaction(tx=>callback(adapter(tx)));
 return sql;
}
const sql=adapter(pg),player=randomUUID(),other=randomUUID();
const reserve=(id,stake=40,skill='normal',idPlayer=player)=>reserveBotDamageWager(id,idPlayer,stake,skill,sql);
const settle=(id,outcome)=>settleBotDamageWager(id,outcome,sql);
const balance=async(id=player)=>(await pg.query('select stars from players where id=$1',[id])).rows[0].stars;
const ledger=async()=>(await pg.query('select * from star_transactions order by created_at')).rows;
before(async()=>{
 await pg.exec(`
  create role anon;create role authenticated;
  create table players(id uuid primary key,display_name varchar(20) not null default 'Tester',stars integer not null default 100 check(stars>=0),last_seen_at timestamptz default now(),games_played integer default 0,wins integer default 0);
  create table matches(id uuid primary key,room_code text,game_mode text,locale text,round_count integer,started_at timestamptz);
  create table match_players(match_id uuid references matches(id),player_id uuid references players(id) on delete cascade,display_name text,final_score integer,final_rank integer,primary key(match_id,player_id));
  create table star_transactions(id uuid primary key,player_id uuid references players(id) on delete set null,amount integer not null check(amount<>0),reason text not null,source_match_id uuid references matches(id),created_at timestamptz default now(),unique(player_id,reason,source_match_id));
 `);
 await pg.exec(await readFile(new URL('../../../supabase/migrations/024_create_bot_damage_wagers.sql',import.meta.url),'utf8'));
});
beforeEach(async()=>{
 await pg.exec('truncate players,matches,bot_damage_wagers,star_transactions cascade');
 await pg.query('insert into players(id) values ($1),($2)',[player,other]);
});
after(async()=>{await pg.close()});
test('bot ledger is private and rejects invalid stakes or skills',async()=>{
 const rows=(await pg.query("select relrowsecurity from pg_class where relname='bot_damage_wagers'")).rows;assert.equal(rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated'])assert.equal((await pg.query("select has_table_privilege($1,'bot_damage_wagers','select,insert,update,delete') as allowed",[role])).rows[0].allowed,false);
 assert.equal((await reserve(randomUUID(),999)).ok,false);assert.equal((await reserve(randomUUID(),40,'invented')).ok,false);assert.equal(await balance(),100);assert.equal((await ledger()).length,0);
});
test('stake reserves once, including concurrent retries and insufficient post-debit balance',async()=>{
 const id=randomUUID();const results=await Promise.all(Array.from({length:8},()=>reserve(id,75)));
 assert.ok(results.every(r=>r.ok));assert.equal(await balance(),25);assert.equal((await ledger()).length,1);
});
test('insufficient balance cannot create escrow or debit another active wager',async()=>{
 await reserve(randomUUID(),75);const result=await reserve(randomUUID(),40);assert.equal(result.ok,false);assert.deepEqual(result.insufficientPlayerIds,[player]);assert.equal(await balance(),25);assert.equal((await ledger()).length,1);
});
test('reusing an id with another stake, skill, or player cannot create another debit',async()=>{
 const id=randomUUID();await reserve(id);
 assert.equal((await reserve(id,60)).ok,false);assert.equal((await reserve(id,40,'hard')).ok,false);assert.equal((await reserve(id,40,'normal',other)).ok,false);
 assert.equal(await balance(),60);assert.equal(await balance(other),100);assert.equal((await ledger()).length,1);
});
for(const [outcome,stars,status,count] of [['win',140,'paid',2],['loss',60,'lost',1],['refund',100,'refunded',2]]){
 test(`${outcome} settlement updates balance exactly once and cannot be changed by retries`,async()=>{
  const id=randomUUID();await reserve(id);
  const results=await Promise.all(Array.from({length:8},()=>settle(id,outcome)));
  assert.ok(results.every(r=>r.get(player)===stars));assert.equal(await balance(),stars);assert.equal((await ledger()).length,count);
  await settle(id,outcome==='win'?'refund':'win');assert.equal(await balance(),stars);
  assert.equal((await pg.query('select status from bot_damage_wagers where match_id=$1',[id])).rows[0].status,status);
  assert.equal((await reserve(id)).ok,false);
 });
}
test('failed stake audit rolls the escrow and balance back',async()=>{
 await pg.exec("create function reject_bot_audit() returns trigger language plpgsql as $$ begin raise exception 'test audit failure'; end; $$; create trigger reject_bot_audit before insert on star_transactions for each row execute function reject_bot_audit();");
 try{assert.equal((await reserve(randomUUID())).ok,false);assert.equal(await balance(),100);assert.equal((await pg.query('select * from bot_damage_wagers')).rows.length,0)}
 finally{await pg.exec('drop trigger reject_bot_audit on star_transactions;drop function reject_bot_audit()')}
});
test('failed payout audit rolls back and can be retried without losing the stake',async()=>{
 const id=randomUUID();await reserve(id);
 await pg.exec("create function reject_bot_audit() returns trigger language plpgsql as $$ begin raise exception 'test payout failure'; end; $$; create trigger reject_bot_audit before insert on star_transactions for each row execute function reject_bot_audit();");
 try{assert.equal((await settle(id,'win')).size,0);assert.equal(await balance(),60);assert.equal((await pg.query('select status from bot_damage_wagers')).rows[0].status,'active')}
 finally{await pg.exec('drop trigger reject_bot_audit on star_transactions;drop function reject_bot_audit()')}
 assert.equal((await settle(id,'win')).get(player),140);assert.equal((await ledger()).length,2);
});
test('bot wagers have no special daily winnings cap',async()=>{
 for(let i=0;i<8;i++){const id=randomUUID();await reserve(id,5);await settle(id,'win')}
 assert.equal(await balance(),140);assert.equal((await ledger()).length,16);
});
test('normal completion rewards share the existing five-game daily cap with bot matches',async()=>{
 const complete=async(id)=>saveCompletedMatch({id,roomCode:'123456',gameMode:'friends',locale:'en',roundCount:10,startedAt:new Date(),players:[{deviceId:player,displayName:'Tester',finalScore:30,finalRank:1}]},sql);
 const ids=Array.from({length:7},()=>randomUUID());
 const results=await Promise.all(ids.map(complete));assert.equal(results.reduce((sum,r)=>sum+r.get(player).starsEarned,0),50);assert.equal(await balance(),150);
 await complete(ids[0]);assert.equal(await balance(),150);assert.equal((await pg.query('select games_played from players where id=$1',[player])).rows[0].games_played,7);
});
test('account purge anonymizes bot currency history without blocking deletion',async()=>{
 const id=randomUUID();await reserve(id);await settle(id,'win');await pg.query('delete from players where id=$1',[player]);
 assert.equal((await pg.query('select player_id from bot_damage_wagers')).rows[0].player_id,null);assert.ok((await ledger()).every(row=>row.player_id===null));
});
