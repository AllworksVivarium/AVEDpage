import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:net';import {DatabaseSync} from 'node:sqlite';
import {installBegging} from '../server-begging.mjs';

test('earlier request history migrates without being discarded, while the new pair rule rejects further requests',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY);CREATE TABLE employee_donations(id INTEGER PRIMARY KEY);
   CREATE TABLE employee_begging_requests(id INTEGER PRIMARY KEY,sender_id INTEGER,recipient_id INTEGER,request_key TEXT,status TEXT,amount INTEGER,donation_id INTEGER,created_at INTEGER,resolved_at INTEGER);
   INSERT INTO employee_begging_requests VALUES(1,1,2,'legacy-a','accepted',10,NULL,1,2),(2,1,2,'legacy-b','declined',0,NULL,3,4);`);
  installBegging({db});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_begging_requests').get().n,2);
  assert.equal(db.prepare('SELECT requested_amount,sender_seen_at FROM employee_begging_requests WHERE id=1').get().requested_amount,null,'old requests must not acquire a fabricated requested amount');
  assert.throws(()=>db.exec("INSERT INTO employee_begging_requests(sender_id,recipient_id,request_key,status,amount,created_at) VALUES(1,2,'new','pending',0,5)"),/只能乞讨一次/);
  db.exec("INSERT INTO employee_begging_requests(sender_id,recipient_id,request_key,status,amount,created_at,requested_amount) VALUES(1,3,'other','pending',0,5,1000000)");
  assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_begging_requests').get().n,3);
 }finally{db.close();}
});

test('persistent begging requests are recipient-only, capped, conserved, idempotent and included in account erasure',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-begging-')),password=randomBytes(18).toString('hex'),secret=randomBytes(32).toString('hex');
 const port=await new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
 const base='http://127.0.0.1:'+port;let child,stderr='',db;
 async function start(){
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',COOKIE_SECURE:'false',NODE_ENV:'development',SESSION_SECRET:secret,BOOTSTRAP_ADMIN_USERNAME:'begging-admin',BOOTSTRAP_ADMIN_PASSWORD:password},stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',data=>stderr+=data);
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50));}throw Error(stderr);
 }
 async function stop(){if(child?.exitCode===null){const closed=new Promise(r=>child.once('exit',r));child.kill();await closed;}}
 t.after(async()=>{db?.close();await stop();rmSync(folder,{recursive:true,force:true});});await start();
 async function login(username){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const admin=await login('begging-admin');
 async function user(username,balance){const r=await api(admin,'/api/admin/employees','POST',{username,password,displayName:'保密实名-'+username,initialBalance:balance});assert.equal(r.status,201);return {id:r.data.id,cookie:await login(username)};}
 const sender=await user('begging-sender',10),payer=await user('begging-payer',2000000),stranger=await user('begging-stranger',20),beneficiary=await user('begging-beneficiary',10);
 db=new DatabaseSync(join(folder,'wanyehui.db'));db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000');
 const balance=async person=>(await api(person.cookie,'/api/player/finance')).data.balance;
 let pendingId;
 await t.test('request survives a server restart and cannot be read or handled by another user',async()=>{
  assert.equal((await api(null,'/api/player/begging')).status,401);
  for(const amount of [undefined,null,0,-1,1.5,1000001,'100'])assert.equal((await api(sender.cookie,'/api/player/begging','POST',{recipientId:payer.id,amount,requestId:randomUUID()})).status,400);
  const body={recipientId:payer.id,amount:500,requestId:randomUUID(),senderId:stranger.id};
  const created=await api(sender.cookie,'/api/player/begging','POST',body);assert.equal(created.status,200);pendingId=created.data.id;assert.equal(created.data.senderId,sender.id);
  assert.ok(!JSON.stringify(created.data).includes('保密实名'));
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',body)).data.id,pendingId);
  assert.equal(created.data.requestedAmount,500);
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',{...body,amount:501})).status,409,'a retried request cannot silently change its amount');
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',{...body,requestId:randomUUID()})).status,409);
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',{recipientId:sender.id,requestId:randomUUID()})).status,400);
  assert.equal((await api(stranger.cookie,'/api/player/begging')).data.items.length,0);
  assert.equal((await api(stranger.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'accepted',amount:1})).status,404);
  assert.equal((await api(sender.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'declined'})).status,404);
  await stop();await start();const inbox=await api(payer.cookie,'/api/player/begging');assert.equal(inbox.status,200);assert.equal(inbox.data.items[0].id,pendingId);assert.equal(inbox.data.items[0].requestedAmount,500);
  const robot=await api(admin,'/api/admin/company-robots','POST',{codename:'夜班员工',balance:5000000});assert.equal(robot.status,200);
  const ranking=(await api(sender.cookie,'/api/player/welfare')).data.highest.find(e=>e.id===robot.data.id);assert.equal(ranking.canReceiveBegging,1);assert.equal(ranking.hasBegged,false);
  for(const key of ['isRobot','isNpc','is_npc','is_robot','robot'])assert.equal(Object.hasOwn(ranking,key),false);
  const before={sender:await balance(sender),robot:db.prepare('SELECT balance FROM personal_metrics WHERE employee_id=?').get(robot.data.id).balance,ledger:db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n};
  const robotBody={recipientId:robot.data.id,amount:1000000,requestId:randomUUID()},createdRobot=await api(sender.cookie,'/api/player/begging','POST',robotBody);
  assert.equal(createdRobot.status,200);assert.equal(createdRobot.data.status,'pending');assert.equal(createdRobot.data.recipientName,ranking.name);assert.equal(createdRobot.data.requestedAmount,1000000);
  assert.deepEqual(Object.keys(createdRobot.data).sort(),Object.keys(created.data).sort());
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',robotBody)).data.id,createdRobot.data.id);
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',{...robotBody,requestId:randomUUID()})).status,409);
  assert.equal((await api(stranger.cookie,'/api/player/begging','POST',{...robotBody,requestId:randomUUID()})).status,200,'another employee may independently ask the same recipient');
  const used=(await api(sender.cookie,'/api/player/welfare')).data.highest.find(e=>e.id===robot.data.id);assert.equal(used.hasBegged,true);assert.equal(used.canReceiveBegging,1);
  assert.equal((await api(payer.cookie,'/api/player/begging/'+createdRobot.data.id,'POST',{decision:'accepted',amount:1})).status,404);
  await stop();await start();
  const stored=db.prepare('SELECT status,amount,donation_id,resolved_at FROM employee_begging_requests WHERE id=?').get(createdRobot.data.id);assert.equal(stored.status,'pending');assert.equal(stored.amount,0);assert.equal(stored.donation_id,null);assert.equal(stored.resolved_at,null);
  assert.equal((await api(sender.cookie,'/api/player/begging')).data.rewards.length,0);
  assert.equal(await balance(sender),before.sender);assert.equal(db.prepare('SELECT balance FROM personal_metrics WHERE employee_id=?').get(robot.data.id).balance,before.robot);assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,before.ledger);
 });
 await t.test('invalid amounts never pay; declining does not transfer anything and cannot later be changed',async()=>{
  for(const amount of [0,-1,1.5,1000001,'100',null])assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'accepted',amount})).status,400);
  assert.equal(await balance(payer),2000000);assert.equal(await balance(sender),10);
  assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'declined'})).status,200);
  assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'declined'})).status,200);
  assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'accepted',amount:1})).status,409);
  assert.equal((await api(payer.cookie,'/api/player/begging')).data.items.length,0);assert.equal(await balance(payer),2000000);
  assert.equal((await api(sender.cookie,'/api/player/begging')).data.rewards.length,0,'a rejection must not create a success notification');
 });
 await t.test('a failed credit rolls back both ledgers; a successful maximum payment happens exactly once',async()=>{
  const created=await api(beneficiary.cookie,'/api/player/begging','POST',{recipientId:payer.id,amount:1234,requestId:randomUUID()});pendingId=created.data.id;
  db.exec(`CREATE TRIGGER reject_begging_credit BEFORE INSERT ON balance_ledger WHEN NEW.employee_id=${beneficiary.id} AND NEW.delta>0 BEGIN SELECT RAISE(ABORT,'test credit failure');END`);
  assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'accepted',amount:1000000})).status,400);
  assert.equal(await balance(payer),2000000);assert.equal(await balance(beneficiary),10);assert.equal(db.prepare('SELECT status FROM employee_begging_requests WHERE id=?').get(pendingId).status,'pending');
  db.exec('DROP TRIGGER reject_begging_credit');
  const results=await Promise.all([1,2].map(()=>api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'accepted',amount:1000000})));
  assert.ok(results.every(r=>r.status===200));assert.equal(await balance(payer),1000000);assert.equal(await balance(beneficiary),1000010);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_donations').get().n,1);
  assert.equal((await api(beneficiary.cookie,'/api/player/begging','POST',{recipientId:payer.id,amount:1,requestId:randomUUID()})).status,409,'an acceptance also consumes the allowance permanently');
  const rewards=(await api(beneficiary.cookie,'/api/player/begging')).data.rewards;assert.equal(rewards.length,1);assert.equal(rewards[0].amount,1000000);assert.equal(rewards[0].recipientId,payer.id);assert.equal(typeof rewards[0].recipientName,'string');assert.ok(rewards[0].recipientName);assert.ok(!rewards[0].recipientName.includes('保密实名'));assert.equal(rewards[0].requestedAmount,1234,'the receiver may give a different amount without changing the original request');
  assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId+'/read','POST',{})).status,404);
  assert.equal((await api(stranger.cookie,'/api/player/begging/'+pendingId+'/read','POST',{})).status,404);
  await stop();await start();assert.equal((await api(beneficiary.cookie,'/api/player/begging')).data.rewards[0].id,pendingId,'the offline sender must still receive the success notification after a restart');
  assert.equal((await api(beneficiary.cookie,'/api/player/begging/'+pendingId+'/read','POST',{})).status,200);
  assert.equal((await api(beneficiary.cookie,'/api/player/begging/'+pendingId+'/read','POST',{})).status,200);
  assert.equal((await api(beneficiary.cookie,'/api/player/begging')).data.rewards.length,0,'an acknowledged success should not be repeated');
  assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'accepted',amount:999999})).status,409);
  assert.equal((await api(payer.cookie,'/api/player/begging/'+pendingId,'POST',{decision:'declined'})).status,409);
  const low=await api(beneficiary.cookie,'/api/player/begging','POST',{recipientId:stranger.id,amount:20,requestId:randomUUID()});assert.equal(low.status,200);
  assert.equal((await api(stranger.cookie,'/api/player/begging/'+low.data.id,'POST',{decision:'accepted',amount:21})).status,400);assert.equal(await balance(stranger),20);
  const agreed=await api(stranger.cookie,'/api/player/begging/'+low.data.id,'POST',{decision:'accepted'});assert.equal(agreed.status,200);assert.equal(agreed.data.amount,20,'omitting a custom amount accepts the originally requested amount');
  assert.equal((await api(stranger.cookie,'/api/player/begging/'+low.data.id,'POST',{decision:'accepted'})).status,200);assert.equal(await balance(stranger),0);assert.equal(await balance(beneficiary),1000030);
 });
 await t.test('deleting the requester removes pending and resolved requests, anonymizes the surviving ledger, and keeps the paid amount',async()=>{
  assert.equal((await api(admin,'/api/admin/employees/'+beneficiary.id,'DELETE')).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_begging_requests WHERE sender_id='+beneficiary.id).get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_donations').get().n,0);
  assert.equal((await api(stranger.cookie,'/api/player/begging')).data.items.length,0);
  assert.equal(await balance(payer),1000000);assert.equal(db.prepare("SELECT COUNT(*) n FROM balance_ledger WHERE employee_id=? AND reason='员工捐赠'").get(payer.id).n,1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 });
 await t.test('a receiver can retain many incoming requests and each sender may approach different people only once',async()=>{
  for(let i=0;i<25;i++){const requester=await user('many-begging-'+i,0);const response=await api(requester.cookie,'/api/player/begging','POST',{recipientId:payer.id,amount:1,requestId:randomUUID()});assert.equal(response.status,200);}
  assert.equal((await api(payer.cookie,'/api/player/begging')).data.items.length,25,'there is no receiver inbox cap');
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',{recipientId:stranger.id,amount:1,requestId:randomUUID()})).status,200,'a previous refusal by one person does not block a different recipient');
  assert.equal((await api(sender.cookie,'/api/player/begging','POST',{recipientId:stranger.id,amount:2,requestId:randomUUID()})).status,409);
  const ranking=(await api(sender.cookie,'/api/player/welfare')).data.highest;assert.equal(ranking.find(row=>row.id===payer.id).hasBegged,true);
 });
});
