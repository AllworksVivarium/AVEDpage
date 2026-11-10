import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {EventEmitter} from 'node:events';
import {installDerby} from '../server-derby.mjs';
test('races wake exactly at their phase boundaries, use the history index and never accept a post-start bet',async t=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,10000);CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 let now=100000,wake,delay,step=0;const service=installDerby({db,clock:()=>{const value=now;now+=step;return value;},setTimer(fn,ms){wake=fn;delay=ms;return {unref(){}};},clearTimer(){},readBody:async req=>req.body,requireEmployee:()=>({id:1}),sessionEmployee:()=>true,send:(res,status,data)=>Object.assign(res,{status,data}),balanceFor:()=>10000,recordLedger(){assert.fail('late wager must not debit');},highlights:{roundEvent:()=>null}});
 t.after(()=>{service.close();db.close();});
 const stream=new EventEmitter();Object.assign(stream,{frames:[],writableLength:0,writeHead(){},write(chunk){this.frames.push(JSON.parse(chunk.split('data: ')[1]));},end(){this.emit('close');},destroy(){this.destroyed=true;}});
 await service.handle({method:'GET'},stream,new URL('http://test/api/player/games/derby/stream'));
 const first=stream.frames[0];assert.equal(first.phase,'BETTING');assert.equal(delay,first.startAt-now);
 now=first.startAt;wake();assert.equal(stream.frames.at(-1).phase,'RACING');assert.equal(delay,first.finishAt-now);
 const res={};await service.handle({method:'POST',body:{round:first.round,runner:0,bet:100,clickedAt:first.startAt-1}},res,new URL('http://test/api/player/games/derby/bet'));assert.equal(res.status,400);
 now=first.finishAt-1;step=1;const crossing={};await service.handle({method:'GET'},crossing,new URL('http://test/api/player/games/derby/current'));assert.equal(crossing.data.phase,'RACING','a snapshot crossing the finish millisecond never advertises an unsettled result');step=0;
 now=first.finishAt;wake();assert.equal(stream.frames.at(-1).phase,'RESULT');assert.equal(delay,first.nextAt-now);
 const plan=db.prepare("EXPLAIN QUERY PLAN SELECT * FROM derby_races WHERE CASE WHEN json_valid(rules_json) THEN json_extract(rules_json,'$.version') END=2 ORDER BY id DESC LIMIT 1").all();assert.ok(plan.some(row=>row.detail.includes('derby_races_version')));
});
