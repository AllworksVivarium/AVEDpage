import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installWelfare} from '../server-welfare.mjs';

test('all-employee leaderboards and employee donations preserve balances and reject replay changes',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT,enabled INTEGER DEFAULT 1,is_npc INTEGER DEFAULT 0);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER NOT NULL,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE checkins(employee_id INTEGER,reward INTEGER);
 INSERT INTO employees(id,display_name) VALUES(1,'捐赠者'),(2,'负余额员工'),(3,'低余额员工'),(4,'匿名员工');
 INSERT INTO profiles VALUES(1,'代号甲'),(2,'代号乙'),(3,'代号丙'),(4,'代号丁');
 INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(1,10000,'初始'),(2,-5000,'初始'),(3,100,'初始'),(4,-9000,'初始');`);
 const balanceFor=id=>db.prepare('SELECT COALESCE(SUM(delta),0) b FROM balance_ledger WHERE employee_id=?').get(id).b;
 const recordLedger=(id,amount,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,amount,reason);
 const service=installWelfare({db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:(req,res)=>{if(!req.uid){Object.assign(res,{status:401});return null;}return {id:req.uid};},balanceFor,recordLedger});
 const request=async(path,method='GET',body,uid=1)=>{const res={};assert.equal(await service.handle({uid,method,body},res,new URL(path,'http://localhost')),true);return res;};
 assert.deepEqual(service.preferences(1),{rankingIdentity:'anonymous',forumIdentity:'anonymous'});
 await request('/api/player/preferences','PUT',{rankingIdentity:'anonymous'},4);
 const initial=(await request('/api/player/welfare')).data;
 assert.deepEqual(initial.lowest.map(x=>x.id),[4,2,3,1]);assert.equal(initial.highest[0].id,1);assert.equal(initial.lowest[0].identityMode,'anonymous');assert.equal(initial.lowest[0].name,'代号丁');
 for(const key of ['highest','lowest'])assert.ok(initial[key].every(x=>x.identityMode==='anonymous'));
 await request('/api/player/preferences','PUT',{forumIdentity:'real'},1);
 assert.equal(service.preferences(1).rankingIdentity,'anonymous','forum selection does not opt into real-name rankings');
 await request('/api/player/preferences','PUT',{rankingIdentity:'real'},2);
 const opted=(await request('/api/player/welfare')).data;
 for(const key of ['highest','lowest'])assert.ok(opted[key].some(x=>x.id===2&&x.identityMode==='real'&&x.name==='负余额员工'));
 assert.equal(installWelfare({db,balanceFor}).preferences(2).rankingIdentity,'real','explicit choice survives reinstall');
 const body={recipientId:2,amount:2500,requestId:'employee-gift-0001'},total=()=>[1,2,3,4].reduce((sum,id)=>sum+balanceFor(id),0),before=total();
 const first=await request('/api/player/donate/employee','POST',body);assert.equal(first.status,200);assert.equal(balanceFor(1),7500);assert.equal(balanceFor(2),-2500);assert.equal(total(),before);
 const replay=await request('/api/player/donate/employee','POST',body);assert.equal(replay.status,200);assert.equal(balanceFor(1),7500);assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_donations').get().n,1);
 for(const altered of [{...body,amount:1},{...body,recipientId:3},{recipientId:3,amount:9000,requestId:'over-balance-0001'},{recipientId:1,amount:1,requestId:'self-donation-001'},{recipientId:2,amount:1.5,requestId:'fraction-gift-01'}]){assert.equal((await request('/api/player/donate/employee','POST',altered)).status,400);assert.equal(total(),before);}
 assert.equal(balanceFor(1),7500);assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_donations').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM company_fund').get().n,0);
 assert.equal((await request('/api/player/donate/employee','POST',body,null)).status,401);
 const retryAfterHide=await request('/api/player/preferences','PUT',{rankingIdentity:'anonymous'},2);assert.equal(retryAfterHide.status,200);assert.equal((await request('/api/player/donate/employee','POST',body)).status,200,'successful retry remains idempotent after recipient changes identity');
 const ranked=(await request('/api/player/welfare')).data;assert.ok(ranked.lowest.some(x=>x.id===2&&x.identityMode==='anonymous'&&x.name==='代号乙'));
 assert.deepEqual(ranked.lowest.map(x=>x.id),[4,2,3,1]);
 const anonymousGift=await request('/api/player/donate/employee','POST',{recipientId:4,amount:100,requestId:'anonymous-gift-01'});assert.equal(anonymousGift.status,200);assert.equal(balanceFor(4),-8900);assert.equal(total(),before);

});
