import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {cardStakes,cardMoneyRules,cardSettlement} from '../server-card-wallet.mjs';
import {installCardTables} from '../server-card-table.mjs';

test('preset and custom stakes scale reserves and retain a meaningful high-stake payout',()=>{
 assert.deepEqual(cardStakes.presets,[1000,5000,10000]);
 for(const base of [100,101,1000,5000,10000]){
  assert.equal(cardStakes.read('custom',String(base)),base);
  const reserve=cardStakes.reserve(base);
  for(const size of [3,4]){
   const r=cardSettlement(size,0,'landlord',1,1,{...cardMoneyRules,base,reserve});
   assert.equal(r.unit,base);assert.ok(r.players.every(p=>p.stake<=reserve));
   assert.equal(r.players.reduce((s,p)=>s+p.reward,0),r.pot+r.bonus);
  }
 }
 for(const base of [0,99,100.5,10001,1000001,Infinity,NaN,'1000'])assert.throws(()=>cardStakes.validate(base));
 assert.equal(cardStakes.reserve(10000),100000);
 assert.equal(cardStakes.validate(10000,true),10000);
 assert.throws(()=>cardStakes.validate(10001,true),/全人机/);
 assert.throws(()=>cardStakes.validate(10001,false));
});

test('all card modes reject excess stakes before debit and preserve multiplayer rewards',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,20000000),(2,20000000);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const deps={db,requireEmployee:r=>({id:r.id}),sessionEmployee:()=>true,readBody:async r=>r.body,send:(r,status,data)=>Object.assign(r,{status,data}),
  balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,
  recordLedger:(id,delta)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(delta,id)};
 const service=installCardTables(deps);let serial=0;
 const call=async(id,body)=>{const res={};await service.handle({id,method:body?'POST':'GET',body},res,new URL('http://test/api/player/card-table'));return res;};
 const action=(id,room,act,extra={})=>call(id,{action:act,room:room.id,revision:room.revision,requestId:'cap-test-'+(++serial),...extra});
 try{
  for(const mode of ['solo','soloRoom','create']){
   const rejected=await call(1,{action:mode,size:3,base:10001,computerOnly:false,bonusPercent:25});
   assert.equal(rejected.status,400);assert.match(rejected.data.error,/10,000/);
   assert.equal(deps.balanceFor(1),20000000);
  }
  let created=await call(1,{action:'create',size:3,base:10000});assert.equal(created.status,200);
  let room=created.data.room;
  assert.equal(deps.balanceFor(1),20000000);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM card_money_rounds').get().n,0);
  room=(await call(1)).data.room;assert.equal(room.seats.filter(Boolean).length,1);
  let joined=await call(2,{action:'join',roomId:room.id});assert.equal(joined.status,200);
  assert.equal((await action(2,joined.data.room,'ready')).status,200);
  room=(await call(1)).data.room;
  const started=await action(1,room,'start',{fillBots:true});assert.equal(started.status,200);
  assert.equal(started.data.room.money.rules.computerOnly,false);
  assert.equal(started.data.room.money.rules.bonusPercent,25);
  assert.equal(started.data.room.money.rules.reserve,100000);
  assert.equal(deps.balanceFor(1),19900000);assert.equal(deps.balanceFor(2),19900000);
 }finally{service.close();db.close();}
});

test('online and solo stake choices enforce required funds and debit the server reserve once',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,1000000),(2,10000),(3,1000000);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const deps={db,requireEmployee:r=>({id:r.id}),sessionEmployee:()=>true,readBody:async r=>r.body,send:(r,status,data)=>Object.assign(r,{status,data}),
  balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,
  recordLedger:(id,delta)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(delta,id)};
 const service=installCardTables(deps);
 const call=async(id,body)=>{const res={};await service.handle({id,method:'POST',body},res,new URL('http://test/api/player/card-table'));return res;};
 try{
  for(const base of [99,100.5,10001,'50000'])assert.equal((await call(1,{action:'create',size:3,base})).status,400);
  const created=await call(1,{action:'create',size:3,base:10000});assert.equal(created.status,200);
  assert.equal(created.data.room.reserve,100000);assert.equal(deps.balanceFor(1),1000000);
  assert.equal((await call(2,{action:'join',roomId:created.data.room.id})).status,400);
  assert.equal(deps.balanceFor(2),10000);
  const solo=await call(3,{action:'solo',size:4,base:10000,balance:999999999,reserve:1});
  assert.equal(solo.status,200);assert.equal(solo.data.room.base,10000);assert.equal(solo.data.room.money.rules.reserve,100000);
  assert.equal(deps.balanceFor(3),900000);
  const saved=db.prepare('SELECT rules_json FROM card_money_rounds WHERE id=?').get(solo.data.room.money.round);
  assert.equal(JSON.parse(saved.rules_json).reserve,100000);
  assert.equal((await call(3,{action:'solo',size:4,base:10000})).status,400);assert.equal(deps.balanceFor(3),900000);
 }finally{service.close();db.close();}
});
