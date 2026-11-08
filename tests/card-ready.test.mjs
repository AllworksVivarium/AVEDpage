import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {installCardTables} from '../server-card-table.mjs';

test('two humans can fill a four-seat table with two bots before the guest is ready, without charging or starting',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,100000),(2,100000);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const deps={db,readBody:async r=>r.body,requireEmployee:r=>({id:r.id}),sessionEmployee:()=>true,send:(r,status,data)=>Object.assign(r,{status,data}),balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,recordLedger:(id,n)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(n,id)};
 let service=installCardTables(deps);
 const call=async(id,body)=>{const res={};await service.handle({id,body,method:body?'POST':'GET'},res,new URL('http://test/api/player/card-table'));return res;};
 const act=async(id,action)=>{const r=(await call(id)).data.room;return call(id,{action,room:r.id,revision:r.revision,requestId:randomUUID()});};
 try{
  const room=(await call(1,{action:'create',size:4,base:1000})).data.room;assert.equal((await call(2,{action:'join',roomId:room.id})).status,200);
  assert.equal((await act(2,'fillBots')).status,400,'guest cannot insert computers');
  const filled=await act(1,'fillBots');assert.equal(filled.status,200);assert.equal(filled.data.room.phase,'waiting');
  assert.equal(filled.data.room.seats.filter(p=>p.bot).length,2);assert.deepEqual(filled.data.room.seats.slice(0,2).map(p=>p.id),[1,2]);
  assert.equal(filled.data.room.seats[1].ready,false,'fill does not consent on behalf of the guest');
  assert.equal(deps.balanceFor(1),100000);assert.equal(deps.balanceFor(2),100000);assert.equal(db.prepare('SELECT count(*) n FROM card_money_rounds').get().n,0);
  service.close();service=installCardTables(deps);assert.equal((await call(2)).data.room.seats.filter(p=>p.bot).length,2,'bot seats survive reconnect/restart');
  assert.equal((await act(1,'fillBots')).status,400,'full table is not filled twice');
  assert.equal((await act(1,'start')).status,400,'host still waits for human readiness');
  assert.equal((await act(2,'ready')).status,200);assert.equal((await call(1)).data.room.phase,'waiting');
  const started=await act(1,'start');assert.equal(started.status,200);assert.equal(started.data.room.phase,'bidding');
  assert.equal(started.data.room.seats.filter(p=>p.bot).length,2);assert.equal(deps.balanceFor(1),90000);assert.equal(deps.balanceFor(2),90000);
  assert.equal((await act(1,'fillBots')).status,400,'seats cannot change during a live round');
 }finally{service.close();db.close();}
});

test('online players confirm readiness again after settlement; only the host starts the next round',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,100000),(2,100000),(3,100000);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const deps={db,readBody:async r=>r.body,requireEmployee:r=>({id:r.id}),sessionEmployee:()=>true,send:(r,status,data)=>Object.assign(r,{status,data}),balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,recordLedger:(id,n)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(n,id)};
 let service=installCardTables(deps);
 const call=async(id,body)=>{const res={};await service.handle({id,body,method:body?'POST':'GET'},res,new URL('http://test/api/player/card-table'));return res;};
 const act=async(id,action,extra={})=>{const r=(await call(id)).data.room;return call(id,{action,room:r.id,revision:r.revision,requestId:randomUUID(),...extra});};
 try{
  let r=(await call(1,{action:'create',size:3,base:1000})).data.room;
  for(const id of [2,3]){assert.equal((await call(id,{action:'join',roomId:r.id})).status,200);assert.equal((await act(id,'ready')).status,200);}
  assert.equal((await act(1,'start')).status,200);service.close();
  const saved=JSON.parse(db.prepare('SELECT state_json FROM card_table_rooms').get().state_json);
  Object.assign(saved.game,{phase:'playing',turn:0,landlord:0,bid:1,multiplier:1,last:null});saved.game.hands[0]=[{id:999,val:3,label:'3',suit:'♠'}];saved.game.plays[1]=1;
  db.prepare('UPDATE card_table_rooms SET state_json=?').run(JSON.stringify(saved));service=installCardTables(deps);
  const ended=await act(1,'play',{cards:[999]});assert.equal(ended.status,200);r=ended.data.room;
  assert.equal(r.phase,'ended');assert.deepEqual(r.seats.map(p=>p.ready),[true,false,false]);
  assert.equal((await act(1,'start')).status,400);assert.equal((await act(2,'ready')).status,200);assert.equal((await act(1,'start')).status,400);
  assert.equal((await act(3,'ready')).status,200);assert.equal((await act(2,'start')).status,400);
  assert.equal((await call(1)).data.room.phase,'ended','readiness never auto-starts');
  assert.equal((await act(1,'start')).status,200);assert.equal(db.prepare('SELECT count(*) n FROM card_money_rounds').get().n,2);
 }finally{service.close();db.close();}
});
