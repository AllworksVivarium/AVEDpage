import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installWelfare} from '../server-welfare.mjs';

function setup(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT,enabled INTEGER DEFAULT 1,is_npc INTEGER DEFAULT 0);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER NOT NULL,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE checkins(employee_id INTEGER,reward INTEGER);
 INSERT INTO employees(id,display_name) VALUES(1,'负债测试'),(2,'捐款测试');
 INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(1,-6217,'fixture'),(2,8783,'fixture');`);
 const balanceFor=id=>db.prepare('SELECT COALESCE(SUM(delta),0) n FROM balance_ledger WHERE employee_id=?').get(id).n;
 const recordLedger=(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason);
 const service=installWelfare({db,balanceFor,recordLedger,readBody:async r=>r.body,send:(res,status,data)=>Object.assign(res,{status,data}),requireEmployee:(req,res)=>req.uid?{id:req.uid}:(Object.assign(res,{status:401}),null)});
 const call=async(path,body,uid=1)=>{const res={};assert.equal(await service.handle({uid,body,method:body?'POST':'GET'},res,new URL(path,'http://fixture')),true);return res;};
 return {db,balanceFor,recordLedger,call};
}

test('negative accounts cannot donate positive amounts or negative remainders; positive remainders debit only',async t=>{
 const f=setup(t);
 for(const amount of [-6217,-217,-17,0,1,83,6217,1.5,'83']){
  const r=await f.call('/api/player/donate',{amount,requestId:'remainder-case-001'});
  assert.equal(r.status,400);assert.equal(f.balanceFor(1),-6217);
 }
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM company_fund').get().n,0);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,2);
 const body={amount:83,requestId:'positive-remainder-001'};
 const r=await f.call('/api/player/donate',body,2);assert.equal(r.status,200);assert.equal(r.data.personal.balance,8700);assert.equal(r.data.fund.donated,83);
 assert.equal((await f.call('/api/player/donate',body,2)).data.personal.balance,8700);
});

test('transferring debt stops at zero, may overdraw the fund, and never counts as a donation',async t=>{
 const f=setup(t),body={expectedDebt:6217,requestId:'debt-fixture-001'};
 const r=await f.call('/api/player/debt/transfer',body);assert.equal(r.status,200);
 assert.equal(r.data.personal.balance,0);assert.equal(r.data.personal.donated,0);assert.equal(r.data.fund.balance,-6217);
 assert.equal(r.data.fund.debtReliefAmount,6217);assert.equal(r.data.fund.debtReliefCount,1);assert.equal(r.data.fund.donated,0);
 assert.ok(r.data.donors.every(x=>x.donated===0));
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM employee_donations').get().n,0);
 // A replay cannot cover a later, unrelated debt or add a second fund expense.
 f.recordLedger(1,-1000,'new fixture debt');
 const replay=await f.call('/api/player/debt/transfer',body);assert.equal(replay.data.personal.balance,-1000);assert.equal(replay.data.debtTransfer.repeated,true);
 assert.equal(replay.data.fund.debtReliefAmount,6217);
 assert.equal((await f.call('/api/player/debt/transfer',{...body,expectedDebt:1000})).status,400);
 const next=await f.call('/api/player/debt/transfer',{expectedDebt:1000,requestId:'debt-fixture-002'});
 assert.equal(next.data.personal.balance,0);assert.equal(next.data.fund.debtReliefAmount,7217);
 assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length,0);
});

test('stale debt confirmations and positive balances never apply a reset',async t=>{
 const f=setup(t),body={expectedDebt:6217,requestId:'debt-fixture-001'};
 f.recordLedger(1,1000,'fixture income');
 const stale=await f.call('/api/player/debt/transfer',body);assert.equal(stale.status,409);assert.equal(stale.data.code,'BALANCE_CHANGED');assert.equal(f.balanceFor(1),-5217);
 assert.equal((await f.call('/api/player/debt/transfer',body,2)).status,400);assert.equal(f.balanceFor(2),8783);
 assert.equal((await f.call('/api/player/debt/transfer',body,null)).status,401);
 for(const expectedDebt of [-1,0,1.5,'5217',Number.MAX_SAFE_INTEGER+1])assert.equal((await f.call('/api/player/debt/transfer',{...body,expectedDebt})).status,400);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM company_fund').get().n,0);
});

test('a failed fund entry rolls back the personal credit and remains retryable',async t=>{
 const f=setup(t),body={expectedDebt:6217,requestId:'debt-fixture-001'};
 f.db.exec("CREATE TRIGGER fail_fund BEFORE INSERT ON company_fund BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
 assert.equal((await f.call('/api/player/debt/transfer',body)).status,400);assert.equal(f.balanceFor(1),-6217);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,2);
 f.db.exec('DROP TRIGGER fail_fund');assert.equal((await f.call('/api/player/debt/transfer',body)).status,200);
 assert.equal(f.balanceFor(1),0);assert.equal(f.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
});
