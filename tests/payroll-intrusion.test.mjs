import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installPayrollIntrusion} from '../server-payroll-intrusion.mjs';

function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,identity_kind TEXT,enabled INTEGER DEFAULT 1,is_npc INTEGER DEFAULT 0);
 CREATE TABLE company_robots(employee_id INTEGER PRIMARY KEY);CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,delta INTEGER,reason TEXT);
 CREATE TABLE company_fund(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,amount INTEGER,kind TEXT,source_ledger_id INTEGER REFERENCES balance_ledger(id) ON DELETE SET NULL,request_key TEXT UNIQUE);
 INSERT INTO employees(id,identity_kind) VALUES(1,'player_employee'),(2,'planning_member'),(3,'player_containment'),(4,'company_containment'),(5,'player_employee'),(6,'planning_member'),(7,'player_employee');UPDATE employees SET enabled=0 WHERE id=5;UPDATE employees SET is_npc=1 WHERE id IN (4,6);INSERT INTO company_robots VALUES(7);`);
 const balanceFor=id=>db.prepare('SELECT COALESCE(SUM(delta),0) n FROM balance_ledger WHERE employee_id=?').get(id).n;
 let now=Date.parse('2026-11-17T19:59:00Z'),index=0;
 const deps={db,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason),clock:()=>now,roll:()=>index++%3,readBody:async req=>req.body,send:(res,status,data)=>Object.assign(res,{status,data}),requireAdmin:(req,res)=>{if(req.id!==1){res.status=403;return null;}return {id:1};},requireEmployee:(req,res)=>{if(!req.id){res.status=401;return null;}return {id:req.id};}};
 const service=installPayrollIntrusion(deps);
 const request=async(path,method='GET',body,id=3)=>{const res={};assert.equal(await service.handle({id,method,body},res,new URL(path,'http://localhost')),true);return res;};
 return {db,service,deps,request,balanceFor,advance:ms=>now+=ms};
}
test('payroll excludes containment, NPC, disabled and robots; batches are atomic and idempotent',async t=>{
 const f=fixture(t),{request,balanceFor,db}=f;
 assert.equal((await request('/api/admin/payroll')).status,403);
 assert.equal((await request('/api/player/intrusion','POST',{},1)).status,403);
 assert.equal((await request('/api/player/intrusion','GET',undefined,null)).status,401);
 assert.deepEqual((await request('/api/admin/payroll','GET',undefined,1)).data,{count:2,amount:200000,total:400000});
 const body={requestId:'salary-test-0001',expectedCount:2};
 assert.equal((await request('/api/admin/payroll','POST',{...body,expectedCount:3},1)).status,400);assert.equal(balanceFor(1),0);
 assert.equal((await request('/api/admin/payroll','POST',body,1)).data.count,2);
 assert.equal((await request('/api/admin/payroll','POST',body,1)).data.replayed,true);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM payroll_notices').get().n,2);
 assert.equal(balanceFor(1),200000);assert.equal(balanceFor(2),200000);
 for(const id of [3,4,5,6,7])assert.equal(balanceFor(id),0);
 assert.equal((await request('/api/admin/payroll','POST',{...body,requestId:'salary-test-0002'},1)).status,200);assert.equal(balanceFor(2),400000);
 db.exec("CREATE TRIGGER fail_salary BEFORE INSERT ON balance_ledger WHEN NEW.employee_id=2 BEGIN SELECT RAISE(ABORT,'injected failure');END;");
 assert.equal((await request('/api/admin/payroll','POST',{...body,requestId:'salary-test-0003'},1)).status,400);assert.equal(balanceFor(1),400000);assert.equal(db.prepare('SELECT COUNT(*) n FROM payroll_batches').get().n,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM payroll_notices').get().n,4);
});

test('salary receipts are account-scoped, claimed once across devices and expire at the business-day boundary',async t=>{
 const {request,advance,deps}=fixture(t);
 assert.equal((await request('/api/player/payroll-notices','GET',undefined,null)).status,401);
 assert.deepEqual((await request('/api/player/payroll-notices','GET',undefined,1)).data.items,[]);
 await request('/api/admin/payroll','POST',{requestId:'salary-notice-001',expectedCount:2},1);
 const [first]=(await request('/api/player/payroll-notices','GET',undefined,1)).data.items;
 assert.equal(first.amount,200000);
 assert.equal((await request('/api/player/payroll-notices/read','POST',{id:first.id},2)).data.claimed,false);
 assert.equal((await request('/api/player/payroll-notices/read','POST',{id:first.id},1)).data.claimed,true);
 assert.equal((await request('/api/player/payroll-notices/read','POST',{id:first.id},1)).data.claimed,false);
 assert.equal((await request('/api/player/payroll-notices','GET',undefined,1)).data.items.length,0);
 assert.equal((await request('/api/player/payroll-notices','GET',undefined,2)).data.items.length,1);
 assert.equal((await request('/api/player/payroll-notices','GET',undefined,3)).data.items.length,0);
 installPayrollIntrusion(deps);
 assert.equal((await request('/api/player/payroll-notices','GET',undefined,1)).data.items.length,0);
 const [other]=(await request('/api/player/payroll-notices','GET',undefined,2)).data.items;
 advance(60000);
 assert.equal((await request('/api/player/payroll-notices','GET',undefined,2)).data.items.length,0);
 assert.equal((await request('/api/player/payroll-notices/read','POST',{id:other.id},2)).data.claimed,false);
 await request('/api/admin/payroll','POST',{requestId:'salary-notice-002',expectedCount:2},1);
 assert.equal((await request('/api/player/payroll-notices','GET',undefined,1)).data.items.length,1);
 assert.equal((await request('/api/player/payroll-notices/read','POST',{id:'invalid'},1)).status,400);
 assert.equal((await request('/api/player/payroll-notices','POST',{},1)).status,405);
 assert.equal((await request('/api/player/payroll-notices/read','GET',undefined,1)).status,405);
});
test('intrusion shares manual and automatic daily quota, conserves funds and resets at Beijing 04:00',async t=>{
 const {request,balanceFor,service,advance,db,deps}=fixture(t);
 assert.equal((await request('/api/player/intrusion')).data.claimed,false);
 const first=await request('/api/player/intrusion','POST');assert.equal(first.data.reward,60000);
 assert.equal((await request('/api/player/intrusion','POST')).data.reward,0);
 assert.equal((await request('/api/player/intrusion','PUT',{automatic:true})).data.reward,0);
 advance(60000);service.runAutomatic();assert.equal(balanceFor(3),125000);service.runAutomatic();assert.equal(balanceFor(3),125000);
 assert.equal((await request('/api/player/intrusion','POST')).data.reward,0);
 advance(86400000);installPayrollIntrusion(deps).runAutomatic();assert.equal(balanceFor(3),200000);
 assert.equal(db.prepare('SELECT SUM(amount) n FROM company_fund').get().n,-200000);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM containment_intrusions').get().n,3);
 await request('/api/player/intrusion','PUT',{automatic:false});advance(86400000);service.runAutomatic();assert.equal(balanceFor(3),200000);
 assert.equal((await request('/api/player/intrusion','PUT',{automatic:'true'})).status,400);
});
test('failed intrusion rolls back quota, fund debit and income together',async t=>{
 const {db,request,balanceFor}=fixture(t);db.exec("CREATE TRIGGER reject_fund BEFORE INSERT ON company_fund BEGIN SELECT RAISE(ABORT,'fund failed');END;");
 assert.equal((await request('/api/player/intrusion','POST')).status,400);assert.equal(balanceFor(3),0);assert.equal(db.prepare('SELECT COUNT(*) n FROM containment_intrusions').get().n,0);
});
