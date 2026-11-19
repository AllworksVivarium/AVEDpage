import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installWelfare,createWelfareRosterReader} from '../server-welfare.mjs';

test('batch roster preserves all ranking responses and reads fresh financial and identity state',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT,enabled INTEGER DEFAULT 1,is_npc INTEGER DEFAULT 0,identity_kind TEXT);
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT);
 CREATE TABLE personal_metrics(employee_id INTEGER PRIMARY KEY,balance INTEGER);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,reason TEXT);
 CREATE TABLE checkins(employee_id INTEGER,reward INTEGER);
 WITH RECURSIVE ids(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM ids WHERE i<1000)
 INSERT INTO employees SELECT i,'实名-'||i,1,0,CASE WHEN i%2=0 THEN 'player_containment' ELSE 'player_employee' END FROM ids;
 INSERT INTO profiles SELECT id,'代号-'||id FROM employees;
 INSERT INTO personal_metrics SELECT id,id*100-50000 FROM employees;`);
 let balanceReads=0,identityReads=0,batchReads=0,now=Date.parse('2026-11-18T23:59:59.999+08:00');
 const balanceFor=id=>{balanceReads++;return db.prepare('SELECT balance FROM personal_metrics WHERE employee_id=?').get(id)?.balance||0;};
 const isContainment=id=>{identityReads++;return db.prepare('SELECT identity_kind FROM employees WHERE id=?').get(id)?.identity_kind==='player_containment';};
 const options={db,clock:()=>now,balanceFor,isContainment,requireEmployee:()=>({id:1}),send:(res,status,data)=>Object.assign(res,{status,data})};
 const original=installWelfare(options),read=createWelfareRosterReader(db);
 const batched=installWelfare({...options,rosterState:()=>{batchReads++;return read();}});
 db.exec("INSERT INTO employee_preferences SELECT id,'real','anonymous' FROM employees");
 const request=async service=>{const res={};await service.handle({method:'GET'},res,new URL('http://localhost/api/player/welfare'));assert.equal(res.status,200);return res.data;};
 const before=await request(original);assert.equal(balanceReads,1001);assert.equal(identityReads,1001);
 balanceReads=identityReads=0;
 assert.deepEqual(await request(batched),before);
 assert.equal(batchReads,1);assert.equal(balanceReads,1);assert.equal(identityReads,1);
 db.exec("UPDATE personal_metrics SET balance=999999 WHERE employee_id=2;UPDATE profiles SET anonymous_name='新代号' WHERE employee_id=2");
 const changed=await request(batched);assert.equal(changed.highest[0].name,'新代号');assert.equal(changed.highest[0].balance,999999);assert.equal(changed.highest[0].isContainment,true);
 db.exec("BEGIN;UPDATE personal_metrics SET balance=-999999 WHERE employee_id=2;UPDATE employees SET identity_kind='player_employee' WHERE id=2");
 const pending=await request(batched);assert.equal(pending.lowest[0].name,'实名-2');assert.equal(pending.lowest[0].balance,-999999);
 db.exec('ROLLBACK');assert.deepEqual(await request(batched),changed,'rolled-back values are never cached');
 db.prepare('INSERT INTO employee_begging_requests(sender_id,recipient_id,request_key,created_at,requested_amount) VALUES(1,2,?,?,100)').run('roster-day-quota',now);
 const used=async()=> (await request(batched)).highest.find(row=>row.id===2).hasBegged;
 assert.equal(await used(),true);now=Date.parse('2026-11-19T00:00:00+08:00');assert.equal(await used(),true);now=Date.parse('2026-11-19T03:59:59.999+08:00');assert.equal(await used(),true);now++;assert.equal(await used(),false,'ranking button is available again at Beijing 04:00');

});
