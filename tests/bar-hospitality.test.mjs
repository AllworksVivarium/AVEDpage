import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installBarHospitality} from '../server-bar-hospitality.mjs';
import {installDebtRelief} from '../server-debt-relief.mjs';
import {barDrinks} from '../server-bar-catalog.mjs';
function setup(t){
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT);INSERT INTO employees VALUES(1,'甲实名'),(2,'乙实名'),(3,'丙实名');CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,reason TEXT);CREATE TABLE bar_orders(id INTEGER PRIMARY KEY,employee_id INTEGER,day TEXT,drink_id TEXT,price INTEGER,request_key TEXT,created_at TEXT,UNIQUE(employee_id,request_key));INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(1,10000,'初始'),(2,10000,'初始'),(3,10000,'初始');`);
 let now=Date.parse('2026-11-12T10:00:00Z');const cups=new Map(),online=new Set([1,2,3]),balanceFor=id=>db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM balance_ledger WHERE employee_id=?').get(id).n;
 const options={db,clock:()=>now,dayFor:()=> '2026-11-12',name:id=>'匿名'+id,isOnline:id=>online.has(id),balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason),drinking:{invalidate(){},currentOrder:id=>cups.get(id)}};
 let service=installBarHospitality(options);t.after(()=>db.close());return {db,balanceFor,cups,online,get service(){return service;},restart(){service=installBarHospitality(options);},advance(ms){now+=ms;},setBalance(id,amount){options.recordLedger(id,amount-balanceFor(id),'调整');}};
}
const drink=barDrinks.find(x=>x.price>0&&x.orderable!==false),actor=id=>({id}),requestId='hospitality-request-0001';
test('gift requires recipient consent, debits sender exactly once and never bills recipient',t=>{
 const f=setup(t),gift=f.service.invite(actor(1),{recipientId:2,drinkId:drink.id,requestId,identityMode:'anonymous'});
 assert.equal(f.balanceFor(1),10000);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_orders').get().n,0);assert.equal(gift.senderName,'匿名1');
 assert.equal(f.service.invite(actor(1),{recipientId:2,drinkId:drink.id,requestId}).id,gift.id);
 assert.throws(()=>f.service.respond(actor(1),gift.id,{decision:'accepted'}));assert.throws(()=>f.service.respond(actor(3),gift.id,{decision:'declined'}));
 f.service.respond(actor(2),gift.id,{decision:'accepted'});f.restart();f.service.respond(actor(2),gift.id,{decision:'accepted'});
 assert.equal(f.balanceFor(1),10000-drink.price);assert.equal(f.balanceFor(2),10000);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_orders').get().n,1);
 assert.equal(f.db.prepare('SELECT payer_id FROM bar_orders').get().payer_id,1);assert.equal(f.service.personal(2).gifts.length,0);
});
test('decline, expiry, offline recipients and insufficient sender funds do not replace drinks or charge',t=>{
 const f=setup(t),make=id=>f.service.invite(actor(1),{recipientId:2,drinkId:drink.id,requestId:id});
 const first=make(requestId);f.service.respond(actor(2),first.id,{decision:'declined'});assert.equal(f.balanceFor(1),10000);
 const second=make(requestId+'2');f.setBalance(1,0);assert.throws(()=>f.service.respond(actor(2),second.id,{decision:'accepted'}),/余额/);assert.equal(f.service.personal(2).gifts.length,1);
 f.advance(300000);assert.throws(()=>f.service.respond(actor(2),second.id,{decision:'accepted'}),/结束/);assert.equal(f.service.personal(2).gifts.length,0);
 f.online.delete(2);assert.throws(()=>make(requestId+'3'),/离开/);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_orders').get().n,0);
});
test('round persists offline/restart, debits exact orders and has an enforceable budget and idempotency',t=>{
 const f=setup(t),round=f.service.startRound(actor(1),{budget:drink.price*2,requestId});assert.equal(f.balanceFor(1),10000);
 assert.equal(f.service.startRound(actor(1),{budget:drink.price*2,requestId}).id,round.id);assert.throws(()=>f.service.startRound(actor(2),{budget:1000,requestId}),/已经/);
 f.online.delete(1);f.restart();assert.equal(f.service.activeRound().id,round.id);
 const body={drinkId:drink.id,roundId:round.id,requestId};const receipt=f.service.order(actor(2),body);assert.equal(f.balanceFor(1),10000-drink.price);assert.equal(f.balanceFor(2),10000);
 assert.equal(f.service.order(actor(2),body).id,receipt.id);assert.equal(f.service.activeRound().spent,drink.price);
 assert.throws(()=>f.service.order(actor(2),{...body,requestId:requestId+'2'}),/每分钟/);
 f.service.order(actor(3),body);assert.equal(f.service.activeRound(),null);assert.equal(f.balanceFor(1),10000-2*drink.price);
 assert.equal(f.service.order(actor(2),body).id,receipt.id);assert.throws(()=>f.service.order(actor(2),{...body,requestId:requestId+'3'}),/结束/);assert.equal(f.balanceFor(2),10000);
});
test('expired or unaffordable sponsorship never silently charges the guest',t=>{
 const f=setup(t),r=f.service.startRound(actor(1),{budget:1000,requestId});f.advance(3600000);
 assert.throws(()=>f.service.order(actor(2),{drinkId:drink.id,roundId:r.id,requestId}),/结束/);assert.equal(f.balanceFor(2),10000);
 const next=f.service.startRound(actor(1),{budget:1000,requestId:requestId+'2'});f.setBalance(1,drink.price-1);
 assert.throws(()=>f.service.order(actor(2),{drinkId:drink.id,roundId:next.id,requestId}),/结束/);assert.equal(f.service.activeRound(),null);assert.equal(f.service.personal(1).lastRound.status,'balance');assert.equal(f.balanceFor(2),10000);
});
test('round respects unfinished cups, explicit self payment, owner-only cancellation and atomic rollback',t=>{
 const f=setup(t),r=f.service.startRound(actor(1),{budget:1000,requestId}),body={drinkId:drink.id,roundId:r.id,requestId};f.cups.set(2,{remainingMl:20});
 assert.throws(()=>f.service.order(actor(2),body),/喝完/);f.service.order(actor(2),{...body,roundId:null});assert.equal(f.balanceFor(2),10000-drink.price);assert.equal(f.service.activeRound().spent,0);
 assert.throws(()=>f.service.endRound(actor(2),r.id));f.cups.delete(2);
 f.db.exec("CREATE TRIGGER fail_order BEFORE INSERT ON bar_orders BEGIN SELECT RAISE(ABORT,'fixture'); END");
 assert.throws(()=>f.service.order(actor(2),{...body,requestId:requestId+'2'}),/fixture/);assert.equal(f.balanceFor(1),10000);assert.equal(f.service.activeRound().spent,0);
 f.service.endRound(actor(1),r.id);f.service.endRound(actor(1),r.id);assert.equal(f.service.activeRound(),null);
});
test('negative reset is an atomic, auditable company-fund expense; positive reset is not',t=>{
 const f=setup(t);f.db.exec('CREATE TABLE company_fund(id INTEGER PRIMARY KEY,employee_id INTEGER,amount INTEGER,kind TEXT,source_ledger_id INTEGER UNIQUE REFERENCES balance_ledger(id));');
 installDebtRelief(f.db);installDebtRelief(f.db);f.setBalance(1,-20000);
 const reset=id=>{f.db.exec('BEGIN IMMEDIATE');try{const b=f.balanceFor(id);if(b)f.db.prepare("INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,'主动归零')").run(id,-b);f.db.exec('COMMIT');}catch(e){f.db.exec('ROLLBACK');throw e;}};
 reset(1);reset(1);reset(2);assert.equal(f.balanceFor(1),0);assert.equal(f.balanceFor(2),0);
 const rows=f.db.prepare('SELECT * FROM company_fund').all();assert.equal(rows.length,1);assert.equal(rows[0].amount,-20000);assert.equal(rows[0].kind,'debt_relief');
 f.setBalance(3,-50);f.db.exec("CREATE TRIGGER fail_fund BEFORE INSERT ON company_fund BEGIN SELECT RAISE(ABORT,'fund fixture'); END");assert.throws(()=>reset(3),/fund fixture/);assert.equal(f.balanceFor(3),-50);
 assert.equal(f.db.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length,0);
});
