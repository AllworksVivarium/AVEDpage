import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installSky} from '../server-sky.mjs';
import {defaultEconomy} from '../server-economy.mjs';

test('opening acknowledgements precede coalesced broadcasts; a late body cannot backdate its settlement',async t=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY);INSERT INTO employees VALUES(1);
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT,avatar_url TEXT,avatar_preset TEXT);INSERT INTO profiles VALUES(1,'测试乘员','','');
 CREATE TABLE company_robots(employee_id INTEGER PRIMARY KEY,codename TEXT);
 CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);INSERT INTO economy_migrations VALUES('shared-sky'),('sky-settlement-v2');
 CREATE TABLE player_rounds(id TEXT,employee_id INTEGER,game TEXT,state_json TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const order=[],ledger=[];let response,closeStream;
 const service=installSky({db,send(_res,status,data){assert.equal(status,200);response=data;order.push('ack');},readBody:req=>req.body,requireEmployee:()=>({id:1}),sessionEmployee:()=>({id:1}),balanceFor:()=>10000,recordLedger:(...args)=>ledger.push(args),economy:{get:defaultEconomy},highlights:{roundEvent:()=>null},companyRobots:{list:()=>[]}});
 t.after(()=>{service.close();db.close();});
 const call=(action,body)=>service.handle({method:body===undefined?'GET':'POST',body},null,new URL('http://test/api/player/games/sky/'+action));
 await call('current');const round=response.round;
 const stream={destroyed:false,writableLength:0,writeHead(){},write(){order.push('sse');},on(event,fn){if(event==='close')closeStream=fn;},end(){closeStream?.();}};
 await service.handle({method:'GET'},stream,new URL('http://test/api/player/games/sky/stream'));order.length=0;
 await Promise.all([call('start',{round,bet:100}),call('start',{round,bet:100})]);
 assert.deepEqual(order,['ack','ack'],'the sender does not wait for full-cabin SSE serialization');
 assert.equal(ledger.length,1,'a repeated boarding command is still idempotent');
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(order,['ack','ack','sse'],'same-tick changes share one cabin broadcast');
 let finishBody;const delayedBody=new Promise(resolve=>finishBody=resolve);
 const request=call('jump',delayedBody);
 // The request started while boarding. Its complete body arrives only after the deadline.
 db.prepare('UPDATE sky_flights SET depart_at=?,safety_line=200 WHERE id=?').run(Date.now()-6000,round);
 finishBody({round,clickedAt:1,depth:100,prize:999999999,balance:999999999});await request;
 assert.equal(response.self.status,'crashed');assert.equal(response.self.prize,0);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n,1);
 assert.equal(ledger.length,1,'client money fields cannot credit the wallet');
});

test('bounded server calibration rescues in-flight input before reveal, without publishing the line or reopening settled flights',async t=>{
 const db=new DatabaseSync(':memory:');db.exec(`
 CREATE TABLE employees(id INTEGER PRIMARY KEY);INSERT INTO employees VALUES(1),(2),(3);
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT,avatar_url TEXT,avatar_preset TEXT);INSERT INTO profiles VALUES(1,'甲','',''),(2,'乙','',''),(3,'丙','','');
 CREATE TABLE company_robots(employee_id INTEGER PRIMARY KEY,codename TEXT);
 CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);INSERT INTO economy_migrations VALUES('shared-sky'),('sky-settlement-v2');
 CREATE TABLE player_rounds(id TEXT,employee_id INTEGER,game TEXT,state_json TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 let now=1000000,response;const ledger=[];
 const service=installSky({db,clock:()=>now,send(_res,status,data){assert.equal(status,200,data.error);response=data;},readBody:req=>req.body,requireEmployee:req=>({id:req.user}),sessionEmployee:req=>({id:req.user}),balanceFor:()=>10000,recordLedger:(...args)=>ledger.push(args),economy:{get:defaultEconomy},highlights:{roundEvent:()=>null},companyRobots:{list:()=>[]}});
 t.after(()=>{service.close();db.close();});
 const call=async(user,action,body)=>{await service.handle({user,method:body===undefined?'GET':'POST',body},null,new URL('http://test/api/player/games/sky/'+action));return response;};
 const {round}=await call(1,'current');const first=await call(1,'start',{round,bet:100});await call(2,'start',{round,bet:100});await call(3,'start',{round,bet:100});
 now+=400;assert.equal((await call(1,'input-sync',{round,token:first.inputProbe.token,compensationMs:999999})).compensationMs,200);
 const depart=now+1000;db.prepare('UPDATE sky_flights SET depart_at=?,safety_line=200 WHERE id=?').run(depart,round);
 const lineAt=depart+100/first.speed*1000;
 now=Math.ceil(lineAt+100);const before=await call(1,'current');assert.equal(before.phase,'DROPPING');assert.ok(!('safetyLine' in before));assert.ok(!('revealedAt' in before));
 const safe=await call(1,'jump',{round,depth:1,clickedAt:1,prize:999999});assert.equal(safe.self.status,'landed');assert.equal(safe.self.settledAt,now-200);assert.ok(safe.self.depth<200);assert.ok(safe.self.prize>0);assert.ok(!('safetyLine' in safe));
 const uncalibrated=await call(2,'jump',{round,clickedAt:1});assert.equal(uncalibrated.self.status,'crashed');assert.equal(uncalibrated.self.prize,0);
 now=Math.ceil(lineAt+301);const late=await call(3,'jump',{round});assert.equal(late.phase,'LANDING');assert.equal(late.safetyLine,200);assert.equal(late.self.status,'crashed');
 const credits=ledger.length;await call(1,'jump',{round});await call(3,'jump',{round});assert.equal(ledger.length,credits);assert.equal(db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n,3);
});
