import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';

test('the real administrator endpoint erases account content and backups, refunds a live table, expires sessions and removes in-memory seats',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-erasure-http-')),password=randomBytes(16).toString('hex');
 const port=await new Promise(r=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>r(p));});});
 const base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:folder,NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'erase-admin',BOOTSTRAP_ADMIN_PASSWORD:password},stdio:['ignore','ignore','pipe']});
 let stderr='',db;child.stderr.on('data',data=>stderr+=data);
 t.after(async()=>{db?.close();if(child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50));}assert.ok(ready,stderr);
 async function login(username){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 const admin=await login('erase-admin');
 const user=async(username)=>{const r=await api(admin,'/api/admin/employees','POST',{username,displayName:'同名员工',password,initialBalance:100000});assert.equal(r.status,201);return {id:r.data.id,cookie:await login(username)};};
 const victim=await user('erase-victim'),peer=await user('erase-survivor');
 db=new DatabaseSync(join(folder,'wanyehui.db'));db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000');
 const post=await api(victim.cookie,'/api/player/forum','POST',{title:'删除主题',body:'删除正文'});assert.equal(post.status,201);
 assert.equal((await api(peer.cookie,'/api/player/forum/'+post.data.id,'POST',{body:'主题下关联回复'})).status,201);
 const other=await api(peer.cookie,'/api/player/forum','POST',{title:'保留主题',body:'保留正文'});assert.equal(other.status,201);
 const reply=await api(victim.cookie,'/api/player/forum/'+other.data.id,'POST',{body:'删除回复'});assert.equal(reply.status,201);
 const quoted=await api(peer.cookie,'/api/player/forum/'+other.data.id,'POST',{body:'保留回复',replyToId:reply.data.id});assert.equal(quoted.status,201);
 assert.equal((await api(victim.cookie,'/api/player/chat','POST',{room:'sky',body:'删除聊天'})).status,200);
 db.prepare("INSERT INTO life_records(employee_id,title,body,kind) VALUES(?,'删除记录','原始正文','article')").run(victim.id);
 db.prepare("INSERT INTO speech_revisions(source_type,source_id,employee_id,before_json,after_json) VALUES('reply',?,?,?,?)").run(reply.data.id,victim.id,'{"body":"旧正文"}','{"body":"新正文"}');
 db.prepare("INSERT INTO bar_messages(employee_id,alias,body,created_at) VALUES(?,'删除代号','删除酒吧聊天',CURRENT_TIMESTAMP)").run(victim.id);
 db.prepare("INSERT INTO ad_bids(employee_id,day,slot,amount,body,signature,note,image_data,status,request_key,fingerprint,created_at) VALUES(?,'2026-11-20','popup',500000,'删除广告','','','','leading','erase-ad-request','fingerprint',0)").run(victim.id);
 db.prepare("INSERT INTO avatar_thumbnails(employee_id,version,size,image) VALUES(?,'erase-version',64,X'0102')").run(victim.id);
 // Warm the ranking cache before deletion, then verify it is invalidated synchronously.
 db.prepare("INSERT INTO card_rank_wins VALUES('past-round',?,'landlord','删除代号',?)").run(victim.id,Date.now());
 assert.ok((await api(peer.cookie,'/api/player/card-table/rankings')).data.landlord.some(r=>r.employeeId===victim.id));
 async function action(who,body){const room=(await api(who.cookie,'/api/player/card-table')).data.room;return api(who.cookie,'/api/player/card-table','POST',{room:room?.id,revision:room?.revision,requestId:randomUUID(),...body});}
 const room=await action(victim,{action:'create',size:3,base:100});assert.equal(room.status,200,JSON.stringify(room.data));
 assert.equal((await action(peer,{action:'join',roomId:room.data.room.id})).status,200);assert.equal((await action(peer,{action:'ready'})).status,200);
 const started=await action(victim,{action:'start',fillBots:true});assert.equal(started.status,200,JSON.stringify(started.data));
 const balance=()=>db.prepare('SELECT SUM(delta) n FROM balance_ledger WHERE employee_id=?').get(peer.id).n;
 const reserve=started.data.room.money.rules.reserve,before=balance();
 const directory=join(folder,'daily-backups');mkdirSync(directory);
 for(const name of ['daily-2026-11-19.sqlite','five-day-2026-11-18.sqlite'])db.prepare('VACUUM INTO ?').run(join(directory,name));
 assert.equal((await api(peer.cookie,'/api/admin/employees/'+victim.id,'DELETE')).status,403);
 const erased=await api(admin,'/api/admin/employees/'+victim.id,'DELETE');assert.equal(erased.status,200,JSON.stringify(erased.data));
 assert.equal(balance(),before+reserve);assert.equal((await api(victim.cookie,'/api/me')).status,401);
 assert.equal((await api(peer.cookie,'/api/player/card-table')).data.room,null,'the live room cache must not resurrect its erased seat');
 assert.ok(!(await api(peer.cookie,'/api/player/card-table/rankings')).data.landlord.some(r=>r.employeeId===victim.id));
 const remaining=(await api(peer.cookie,'/api/player/forum/'+other.data.id)).data;assert.equal(remaining.thread.body,'保留正文');assert.ok(!remaining.items.some(r=>r.id===reply.data.id));assert.equal(remaining.items.find(r=>r.id===quoted.data.id).replyToId,null);
 for(const table of ['life_records','speech_revisions','chat_messages','bar_messages','ad_bids','avatar_thumbnails','activity_logs','alias_history','card_rank_wins','sessions'])assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE employee_id=?`).get(victim.id).n,0,table);
 assert.ok(db.prepare('SELECT 1 FROM employees WHERE id=?').get(peer.id));assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 for(const name of ['daily-2026-11-19.sqlite','five-day-2026-11-18.sqlite']){const snapshot=new DatabaseSync(join(directory,name));assert.equal(snapshot.prepare('SELECT COUNT(*) n FROM employees WHERE id=?').get(victim.id).n,0);assert.equal(snapshot.prepare('SELECT COUNT(*) n FROM activity_logs WHERE employee_id=?').get(victim.id).n,0);assert.equal(snapshot.prepare('PRAGMA quick_check').get().quick_check,'ok');snapshot.close();}
 assert.equal((await api(admin,'/api/admin/employees/'+victim.id,'DELETE')).status,404);assert.equal(balance(),before+reserve);
 await new Promise(r=>setTimeout(r,450));assert.equal(db.prepare('SELECT COUNT(*) n FROM card_table_rooms').get().n,0,'the game timer cannot recreate the deleted room');
 assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.doesNotMatch(stderr,/FOREIGN KEY|TypeError|Card table:/);
});
