import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installGameHighlights} from '../server-game-highlights.mjs';

test('records and announcements follow committed settlements, exclude refunds, and survive reinstall',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY);
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT);
 CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,result_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO employees VALUES(1),(2);INSERT INTO profiles VALUES(1,'员工甲'),(2,'<script>员工乙</script>');`);
 const insert=(id,game,cost,prize,result={})=>Number(db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,result_json) VALUES(?,?,?,?,?)').run(id,game,cost,prize,JSON.stringify(result)).lastInsertRowid);
 const old=insert(1,'scratch',1000,3000);insert(1,'sky',100000,100000,{cancelled:true});
 let reply;const dependencies={db,requireEmployee:req=>req.user,send:(_res,status,data)=>reply={status,data}};
 let service=installGameHighlights(dependencies);
 assert.equal(service.records(1).highest.ticketId,old);assert.equal(db.prepare('SELECT COUNT(*) n FROM game_highlights').get().n,0,'historical backfill must not rebroadcast or celebrate');
 const win=insert(1,'scratch',1000,30000,{rarePrize:true});assert.equal(service.event(1,win).personalBest,1);assert.equal(service.event(2,win),null);
 const tied=insert(1,'scratch',1000,30000,{rarePrize:true});assert.equal(service.event(1,tied).personalBest,0,'equal awards do not set new records');
 const small=insert(1,'slot',100,2000);assert.equal(service.event(1,small).broadcast,1);assert.equal(service.event(1,small).personalBest,1);
 const sky=insert(1,'sky',10000,60000,{flight:7});assert.equal(service.roundEvent(1,'sky',7).ticketId,sky);assert.equal(service.roundEvent(2,'sky',7),null);
 const firstRace=insert(1,'derby',1000,8500,{round:8});insert(1,'derby',1000,6250,{round:8});assert.equal(service.roundEvent(1,'derby',8).ticketId,firstRace,'a smaller second bet must not hide the record');insert(1,'cards',0,20000,{round:9});
 const overload=insert(2,'slot',1000,2000,{penalty:2000});assert.equal(service.event(2,overload).penalty,2000);
 insert(1,'sky',999999,999999,{cancelled:true});insert(1,'unknown',0,999999);
 assert.equal(service.records(1).highest.prize,60000);assert.equal(service.records(1).byGame.length,5);
 db.exec('BEGIN');insert(1,'slot',1000,900000);db.exec('ROLLBACK');assert.equal(service.records(1).highest.prize,60000);
 const partial=insert(2,'scratch',1000,500);assert.equal(service.event(2,partial).personalBest,1);assert.equal(service.event(2,partial).broadcast,0,'partial returns never become public jackpots');
 await service.handle({method:'GET',user:{id:2}},null,new URL('http://local/api/player/game-highlights'));
 assert.ok(reply.data.items.every(x=>x.cost>0&&x.prize>=x.cost*5));
 assert.equal(reply.status,200);assert.ok(reply.data.items.some(x=>x.ticketId===win));assert.ok(reply.data.items.every(x=>!('employeeId' in x)&&!('personalBest' in x)&&x.prize>x.cost));
 db.prepare("UPDATE game_highlights SET created_at=datetime('now','-31 minutes') WHERE ticket_id=?").run(win);
 await service.handle({method:'GET',user:{id:2}},null,new URL('http://local/api/player/game-highlights'));
 assert.ok(!reply.data.items.some(x=>x.ticketId===win));
 const recent=insert(2,'scratch',1000,5000);db.prepare("UPDATE game_highlights SET created_at=datetime('now','-20 minutes') WHERE ticket_id=?").run(recent);
 for(let i=0;i<15;i++)insert(2,'scratch',1000,5000);
 await service.handle({method:'GET',user:{id:1}},null,new URL('http://local/api/player/game-highlights?after='+recent));
 assert.equal(reply.data.items.length,15);assert.ok(reply.data.items.every(x=>x.ticketId>recent));
 await service.handle({method:'GET',user:{id:1}},null,new URL('http://local/api/player/game-highlights'));
 assert.ok(reply.data.items.some(x=>x.ticketId===recent));
 await service.handle({method:'POST',user:{id:2}},null,new URL('http://local/api/player/game-highlights'));assert.equal(reply.status,405);
 service=installGameHighlights(dependencies);assert.equal(service.records(1).highest.prize,60000);
 db.prepare('DELETE FROM employees WHERE id=1').run();assert.equal(service.records(1).highest,null);assert.equal(service.event(1,win),null);
});

test('committed bomb tickets broadcast their actual medical charge without becoming prize records',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE employees(id INTEGER PRIMARY KEY);CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT);CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,result_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);INSERT INTO employees VALUES(1);INSERT INTO profiles VALUES(1,'公司代号');");
  let data;const service=installGameHighlights({db,requireEmployee:()=>({id:1}),send:(r,s,d)=>data=d});
  for(const penalty of [1000,2000,4000])db.prepare("INSERT INTO game_tickets(employee_id,game,cost,prize,result_json) VALUES(1,'scratch',1000,0,?)").run(JSON.stringify({penalty}));
  assert.equal(service.records(1).highest,null);
  await service.handle({method:'GET'},null,new URL('http://test/api/player/game-highlights'));
  assert.deepEqual(data.items.map(x=>x.penalty),[1000,2000,4000]);assert.ok(data.items.every(x=>x.alias==='公司代号'&&x.prize===0&&!('employeeId' in x)));
  db.exec('BEGIN');db.prepare("INSERT INTO game_tickets(employee_id,game,cost,prize,result_json) VALUES(1,'scratch',1000,0,?)").run(JSON.stringify({penalty:4000}));db.exec('ROLLBACK');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_highlights').get().n,3);
  installGameHighlights({db});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_highlights').get().n,3);
 }finally{db.close();}
});
