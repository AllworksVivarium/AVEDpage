import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {installCardTables,cardReadyTimeoutMs} from '../server-card-table.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,100000),(2,100000),(3,100000),(4,100000);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 let now=100000,tick,service;const streams=[];
 const deps={db,clock:()=>now,schedule:(fn,ms)=>{if(ms===350)tick=fn;return {unref(){}};},cancel(){},readBody:async r=>r.body,requireEmployee:r=>({id:r.id}),sessionEmployee:()=>true,send:(r,status,data)=>Object.assign(r,{status,data}),balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,recordLedger:(id,n)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(n,id)};
 const restart=()=>{service?.close();service=installCardTables(deps);};restart();
 const call=async(id,body)=>{const res={};await service.handle({id,body,method:body?'POST':'GET'},res,new URL('http://test/api/player/card-table'));return res;};
 const room=async id=>(await call(id)).data.room;
 const act=async(id,action,extra={})=>{const r=await room(id);return call(id,{action,room:r.id,revision:r.revision,requestId:randomUUID(),...extra});};
 async function ended(){
  const r=(await call(1,{action:'create',size:3,base:100})).data.room;
  for(const id of [2,3]){await call(id,{action:'join',roomId:r.id});await act(id,'ready');}
  await act(1,'start');service.close();
  const saved=JSON.parse(db.prepare('SELECT state_json FROM card_table_rooms').get().state_json);
  Object.assign(saved.game,{phase:'playing',turn:0,landlord:0,bid:1,multiplier:1,last:null});saved.game.hands[0]=[{id:999,val:3,label:'3',suit:'♠'}];saved.game.plays[1]=1;
  db.prepare('UPDATE card_table_rooms SET state_json=?').run(JSON.stringify(saved));restart();
  const result=await act(1,'play',{cards:[999]});assert.equal(result.status,200);return result.data.room;
 }
 async function stream(id){const res=new EventEmitter();Object.assign(res,{chunks:[],writableLength:0,writeHead(){},write(s){this.chunks.push(s);},end(){this.destroyed=true;},destroy(){this.destroyed=true;}});streams.push(res);await service.handle({id,method:'GET'},res,new URL('http://test/api/player/card-table/stream'));return res;}
 return {db,call,room,act,ended,restart,stream,balance:()=>db.prepare('SELECT id,balance FROM employees ORDER BY id').all(),advance:n=>{now+=n;tick();},close(){streams.forEach(s=>s.emit('close'));service.close();db.close();}};
}

test('creating a computer room fills bots without dealing or debiting until an explicit start',async()=>{
 const f=fixture();try{
  let r=(await f.call(1,{action:'soloRoom',size:4,base:1000,botLevel:'smart'})).data.room;
  assert.equal(r.phase,'waiting');assert.equal(r.mode,'solo');assert.equal(r.seats.filter(p=>p.bot).length,3);assert.equal(r.money,null);
  assert.equal(f.db.prepare('SELECT count(*) n FROM card_money_rounds').get().n,0);assert.equal(f.balance()[0].balance,100000);
  f.advance(120000);r=await f.room(1);assert.equal(r.phase,'waiting');
  r=(await f.act(1,'start')).data.room;assert.equal(r.phase,'bidding');assert.equal(f.balance()[0].balance,90000);
 }finally{f.close();}
});
test('unoccupied online room expires after thirty minutes without touching balances',async()=>{
 const f=fixture();try{
  await f.call(1,{action:'create',size:3,base:100});const before=f.balance();
  f.advance(30*60*1000-1);assert.ok(await f.room(1));
  f.advance(1);assert.equal(await f.room(1),null);
  assert.deepEqual(f.balance(),before);assert.equal(f.db.prepare('SELECT count(*) n FROM card_table_rooms').get().n,0);
 }finally{f.close();}
});

test('pre-game host disconnect or delegated play closes an online room for all seats',async()=>{
 const f=fixture();try{
  await f.call(1,{action:'create',size:3,base:100});await f.call(2,{action:'join',roomId:(await f.room(1)).id});
  const host=await f.stream(1);host.emit('close');f.advance(1);assert.ok(await f.room(2));f.advance(30000);
  assert.equal(await f.room(1),null);assert.equal(await f.room(2),null);
  const created=(await f.call(1,{action:'create',size:3,base:100})).data.room;
  await f.act(1,'auto');f.advance(1);assert.equal(await f.room(1),null);
  assert.ok(created.id);
 }finally{f.close();}
});
test('an ended online table closes when its host goes offline',async()=>{
 const f=fixture();try{
  await f.ended();const stream=await f.stream(1);stream.emit('close');
  f.advance(1);f.advance(30000);
  assert.equal(await f.room(1),null);assert.equal(await f.room(2),null);
  assert.equal(f.db.prepare('SELECT count(*) n FROM card_money_rounds').get().n,1);
 }finally{f.close();}
});

test('unready players including the host expire at a persisted deadline; ready humans inherit host and SSE clears departed seats',async()=>{
 const f=fixture();try{
  const r=await f.ended(),expires=r.seats[0].readyDeadline;assert.equal(expires,r.serverTime+cardReadyTimeoutMs);assert.ok(r.seats.every(p=>!p.ready));
  const host=await f.stream(1),guest=await f.stream(3);await f.act(2,'ready');const balance=f.balance(),tickets=f.db.prepare('SELECT count(*) n FROM game_tickets').get().n;
  f.advance(cardReadyTimeoutMs-1);assert.ok(await f.room(1));f.restart();assert.equal((await f.room(1)).seats[0].readyDeadline,expires);
  // Restart preserves deadlines; new SSE subscriptions receive the departure.
  const hostAfter=await f.stream(1),guestAfter=await f.stream(3);f.advance(1);
  assert.equal(await f.room(1),null);assert.equal(await f.room(3),null);const kept=await f.room(2);
  assert.equal(kept.host,2);assert.equal(kept.seats.filter(Boolean).length,1);assert.equal(kept.seats[1].ready,true);assert.equal(kept.phase,'ended');
  assert.equal(JSON.parse(hostAfter.chunks.at(-1).split('data: ')[1]).room,null);assert.equal(JSON.parse(guestAfter.chunks.at(-1).split('data: ')[1]).room,null);
  assert.deepEqual(f.balance(),balance);assert.equal(f.db.prepare('SELECT count(*) n FROM game_tickets').get().n,tickets,'expiry never re-settles or starts a round');
  assert.equal((await f.act(2,'fillBots')).status,200);assert.equal((await f.act(2,'start')).status,200);
 }finally{f.close();}
});

test('a ready host who never confirms a fully prepared next round expires, without automatically starting',async()=>{
 const f=fixture();try{
  await f.ended();for(const id of [1,2,3])await f.act(id,'ready');
  const r=await f.room(1);assert.ok(r.hostStartDeadline>r.serverTime);assert.ok(r.seats.every(p=>p.ready));
  f.advance(cardReadyTimeoutMs);assert.equal(await f.room(1),null);const kept=await f.room(2);assert.equal(kept.host,2);assert.equal(kept.phase,'ended');
  assert.equal(f.db.prepare('SELECT count(*) n FROM card_money_rounds').get().n,1);
 }finally{f.close();}
});

test('joining a completed table and cancelling preparation cannot bypass idle expiry; an empty table is removed',async()=>{
 const f=fixture();try{
  const r=await f.ended();await f.act(3,'leave');await f.call(4,{action:'join',roomId:r.id});
  const joined=await f.room(4);assert.equal(joined.phase,'waiting');assert.equal(joined.readyCycle,true);assert.ok(joined.seats[2].readyDeadline>joined.serverTime);
  await f.act(2,'ready');f.advance(10000);await f.act(2,'ready');
  f.advance(50000);assert.equal(await f.room(1),null);assert.equal(await f.room(4),null);assert.ok(await f.room(2));
  f.advance(10000);assert.equal(await f.room(2),null);assert.equal(f.db.prepare('SELECT count(*) n FROM card_table_rooms').get().n,0);
 }finally{f.close();}
});
