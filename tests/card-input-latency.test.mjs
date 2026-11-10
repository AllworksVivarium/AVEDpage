import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {installCardTables} from '../server-card-table.mjs';
function fixture(t){
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,100000),(2,100000),(3,100000);CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 let now=100000,tick;const service=installCardTables({db,clock:()=>now,schedule(fn,ms){if(ms===350)tick=fn;return {unref(){}};},cancel(){},readBody:async req=>await req.body,requireEmployee:req=>({id:req.id}),sessionEmployee:()=>true,send:(res,status,data)=>Object.assign(res,{status,data}),balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,recordLedger:(id,n)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(n,id)});
 t.after(()=>{service.close();db.close();});
 const call=async(id,body,path='')=>{const res={};await service.handle({id,body,method:body===undefined?'GET':'POST'},res,new URL('http://test/api/player/card-table'+path));return res;};
 const room=async id=>(await call(id)).data.room;
 const command=(r,action,extra={})=>({action,room:r.id,revision:r.revision,turnId:r.turnId,requestId:randomUUID(),...extra});
 const act=async(id,action,extra={})=>call(id,command(await room(id),action,extra));
 const setup=async()=>{const r=(await call(1,{action:'create',size:3,base:1000})).data.room;for(const id of [2,3]){await call(id,{action:'join',roomId:r.id});await act(id,'ready');}return r;};
 async function stream(id){const res=new EventEmitter();Object.assign(res,{frames:[],writableLength:0,writeHead(){},write(chunk){this.frames.push(JSON.parse(chunk.split('data: ')[1]));},end(){},destroy(){this.destroyed=true;}});await service.handle({id,method:'GET'},res,new URL('http://test/api/player/card-table/stream'));return res;}
 return {db,call,room,act,command,setup,stream,at(value){now=value;},tick:()=>tick(),now:()=>now};
}
test('unrelated seat changes and repeated trustee toggles never extend the current manual turn',async t=>{
 const f=fixture(t);await f.setup();const start=(await f.act(1,'start')).data.room,deadline=start.deadline;
 f.at(f.now()+1000);await f.act(2,'auto');assert.equal((await f.room(1)).deadline,deadline);
 await f.act(1,'auto');f.at(f.now()+100);await f.act(1,'auto');assert.equal((await f.room(1)).deadline,deadline);
 const response=await f.call(1,f.command(start,'bid',{bid:1}));assert.equal(response.status,200,'unchanged turn identity accepts a delayed revision after another seat changed settings');assert.equal(response.data.room.turn,1);
 assert.equal((await f.call(1,f.command(start,'bid',{bid:2}))).status,409,'old turn tokens cannot act on a different turn');
 const current=await f.room(2);assert.equal((await f.call(2,f.command(current,'bid',{bid:3,turnId:start.turnId}))).status,409,'even a current revision cannot reuse an obsolete turn identity');
});
test('measured input has at most 250 ms grace; timers wait for it, retries stay idempotent',async t=>{
 const f=fixture(t),r=await f.setup();f.at(f.now()+400);
 assert.equal((await f.call(1,{room:r.id,scope:r.inputProbe.scope,token:r.inputProbe.token},'/input-sync')).data.compensationMs,200);
 const start=(await f.act(1,'start')).data.room;f.at(start.deadline+100);f.tick();assert.equal((await f.room(1)).seats[0].auto,false);
 const body=f.command(start,'bid',{bid:1,clickedAt:0,compensationMs:999999});const first=await f.call(1,body);assert.equal(first.status,200);const revision=first.data.room.revision;assert.equal((await f.call(1,body)).data.room.revision,revision);
});
test('a slow request body cannot backdate a late move or change the balance',async t=>{
 const f=fixture(t);await f.setup();const start=(await f.act(1,'start')).data.room;let finish;
 const waiting=f.call(1,new Promise(resolve=>finish=resolve));f.at(start.deadline+251);finish(f.command(start,'bid',{bid:3,clickedAt:start.deadline-1000}));const late=await waiting;assert.equal(late.status,400);assert.equal((await f.room(1)).revision,start.revision);assert.equal(f.db.prepare('SELECT balance FROM employees WHERE id=1').get().balance,90000);
 f.tick();assert.equal((await f.room(1)).seats[0].auto,true);
});

test('commands acknowledge before room fanout; same-tick changes share one authoritative frame',async t=>{
 const f=fixture(t);await f.setup();await f.act(1,'start');await new Promise(resolve=>setImmediate(resolve));
 const s=await f.stream(1);s.frames.length=0;
 assert.equal((await f.act(2,'auto')).status,200);assert.equal((await f.act(3,'auto')).status,200);assert.equal(s.frames.length,0,'sender acknowledgements do not wait for spectator serialization');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(s.frames.length,1);assert.equal(s.frames[0].room.seats[1].auto,true);assert.equal(s.frames[0].room.seats[2].auto,true);
});
