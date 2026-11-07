import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {animalPlan,animalFrame,animalReturn,animalRules} from '../server-animal-race.mjs';
import {installDerby} from '../server-derby.mjs';

test('five equal lanes, first/last 125% return, reproducible monotonic finishes and pauses',()=>{
 const first=Array(5).fill(0),last=Array(5).fill(0),permutations=new Set(),poses=new Set();
 for(let i=0;i<10000;i++){
  const seed=createHash('sha256').update(String(i)).digest('hex'),plan=animalPlan(seed);
  first[plan.order[0]]++;last[plan.order[4]]++;permutations.add(plan.order.join(''));
  if(i<100){
   assert.deepEqual(animalPlan(seed),plan);let previous=animalFrame(plan,0);
   for(let t=0;t<=25000;t+=100){const frame=animalFrame(plan,t);frame.forEach((r,j)=>{assert.ok(r.progress>=previous[j].progress&&r.progress<=100);assert.ok(r.boxProgress+1e-9>=previous[j].boxProgress,'a pushed box cannot snap back');poses.add(r.pose);});previous=frame;}
   const finishes=plan.actors.toSorted((a,b)=>a.finish-b.finish).map(a=>a.id);assert.deepEqual(finishes,plan.order);
   assert.ok(animalFrame(plan,25000).every(r=>r.progress===100&&r.pose==='finished'));
  }
 }
 assert.equal(permutations.size,120);
 for(const count of [...first,...last])assert.ok(Math.abs(count/10000-.2)<.02);
 for(const pose of ['box','sleep','nudge','push','sniff','carry','run','finished'])assert.ok(poses.has(pose),pose);
 assert.equal(animalRules.bettingMs,15000);assert.equal(animalRules.racingMs,25000);assert.equal(animalRules.resultMs,6000);
 assert.equal(animalReturn(1000,0,'first',[0,1,2,3,4])*.2/1000,1.25);
 assert.equal(animalReturn(1000,0,'first',[0,1,2,3,4],102),5100,'old accepted race tickets retain their return');
 assert.equal(animalReturn(101,4,'last',[0,1,2,3,4]),631);
 assert.equal(animalReturn(1000,0,'last',[0,1,2,3,4]),0);
});

test('two markets settle once across restart; balances, privacy, closed rounds and atomic rollback',async t=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,10000),(2,10000),(3,150);
 CREATE TABLE ledger(employee_id INTEGER,delta INTEGER);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const deps={db,send:(res,status,data)=>{res.status=status;res.data=data;},readBody:async req=>req.body,requireEmployee:req=>({id:req.id}),sessionEmployee:()=>true,balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,
  recordLedger:(id,delta)=>{db.prepare('INSERT INTO ledger VALUES(?,?)').run(id,delta);db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(delta,id);},highlights:{roundEvent:()=>null}};
 let service=installDerby(deps);t.after(()=>{service.close();db.close();});
 const call=async(id,path,body)=>{const res=new EventEmitter();res.writeHead=()=>{};res.frames=[];res.write=x=>res.frames.push(JSON.parse(x.slice(6)));res.end=()=>res.emit('close');await service.handle({id,method:body?'POST':'GET',body},res,new URL('http://test/api/player/games/derby/'+path));return res;};
 const race=(await call(1,'current')).data,plan=animalPlan(db.prepare('SELECT seed FROM derby_races WHERE id=?').get(race.round).seed);
 assert.equal(race.runners.length,5);assert.deepEqual(race.winProbabilities,[.2,.2,.2,.2,.2]);
 assert.ok(race.runners.every(r=>r.place===null),'future finish places stay private');
 for(const field of ['seed','winner','last','order','plan'])assert.ok(!(field in race));
 const a=await call(1,'stream'),b=await call(2,'stream');assert.deepEqual(a.frames[0].runners,b.frames[0].runners);
 const first={round:race.round,market:'first',runner:plan.order[0],bet:1000,balance:999999,prize:999999};
 const end={...first,market:'last',runner:plan.order[4],bet:2000};
 const replies=await Promise.all([call(1,'bet',first),call(1,'bet',first),call(1,'bet',end),call(2,'bet',{...first,runner:plan.order[4]})]);
 assert.ok(replies.every(x=>x.status===200));assert.equal(deps.balanceFor(1),7000);assert.equal(db.prepare('SELECT COUNT(*) n FROM derby_wagers').get().n,3);
 assert.ok(b.frames.at(-1).bets.every(w=>w.runner===plan.order[4]),'other account never sees private tickets');
 assert.equal((await call(1,'bet',{...first,runner:plan.order[1]})).status,400);
 assert.equal((await call(1,'bet',{...first,market:'middle'})).status,400);
 assert.equal((await call(1,'bet',{...first,runner:5})).status,400);
 assert.equal((await call(3,'bet',first)).status,400);
 assert.equal((await call(3,'bet',{...first,bet:100.5})).status,400);
 // Force persistence failure after the debit, proving both ledger and balance roll back.
 db.exec("CREATE TRIGGER reject_test BEFORE INSERT ON derby_wagers WHEN NEW.employee_id=3 BEGIN SELECT RAISE(ABORT,'test write failure'); END;");
 assert.equal((await call(3,'bet',{...first,bet:100})).status,400);assert.equal(deps.balanceFor(3),150);assert.equal(db.prepare('SELECT COUNT(*) n FROM ledger WHERE employee_id=3').get().n,0);db.exec('DROP TRIGGER reject_test');
 db.prepare('UPDATE derby_races SET start_at=?,finish_at=?,next_at=? WHERE id=?').run(Date.now()-5000,Date.now()+20000,Date.now()+26000,race.round);
 const running=(await call(1,'current')).data;assert.equal(running.phase,'RACING');for(const field of ['seed','winner','last','order','plan'])assert.ok(!(field in running));assert.ok(running.frameAt<=running.serverTime+1000);
 assert.ok(running.runners.every(r=>r.place===null),'lookahead cannot publish a place before the actual finish');
 db.prepare('UPDATE derby_races SET start_at=?,finish_at=?,next_at=? WHERE id=?').run(Date.now()-21000,Date.now()+4000,Date.now()+10000,race.round);
 const crossed=(await call(1,'current')).data;assert.equal(crossed.runners.find(r=>r.place===1).id,plan.order[0]);assert.equal(crossed.runners.filter(r=>r.place!==null).length,1);
 assert.equal((await call(3,'bet',{...first,bet:100})).status,400);
 service.close();service=installDerby(deps);
 db.prepare('UPDATE derby_races SET finish_at=?,next_at=? WHERE id=?').run(Date.now()-1,Date.now()+6000,race.round);
 const result=(await call(1,'current')).data;assert.deepEqual(result.order,plan.order);assert.ok(result.bets.every(w=>w.settled));assert.equal(result.bets.reduce((sum,w)=>sum+w.prize,0),18750);assert.equal(result.balance,25750);
 assert.equal((await call(2,'current')).data.bets[0].prize,0);
 await call(1,'current');service.close();service=installDerby(deps);await call(1,'current');assert.equal(db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n,3);assert.equal(deps.balanceFor(1),25750);
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
});
