import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installContainmentDossiers} from '../server-containment-dossiers.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';

test('legacy containment archives link once without losing authored text or guessing ambiguous names',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`PRAGMA foreign_keys=ON;
   CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT,identity_kind TEXT,containment_classification TEXT);
   CREATE TABLE profiles(employee_id INTEGER,bio TEXT);
   CREATE TABLE dossiers(id INTEGER PRIMARY KEY,code TEXT UNIQUE,title TEXT,department TEXT,status TEXT,summary TEXT,classification TEXT);
   INSERT INTO employees VALUES(1,'旧档案','player_containment',''),(2,'重名','player_containment','SAFE'),(3,'重名','company_containment','KETER');
   INSERT INTO profiles VALUES(1,'个人简介'),(2,'第二位简介');
   INSERT INTO dossiers VALUES(55,'ORIGINAL','旧档案','科研部','观察中','管理端的完整档案','EUCLID'),(56,'AMBIGUOUS','重名','收容部','观察中','不可随意认领','');`);
  installContainmentDossiers(db);installContainmentDossiers(db);
  const linked=db.prepare('SELECT * FROM dossiers WHERE employee_id=1').get();
  assert.equal(linked.id,55);assert.equal(linked.code,'ORIGINAL');assert.equal(linked.summary,'管理端的完整档案');
  assert.equal(db.prepare('SELECT containment_classification c FROM employees WHERE id=1').get().c,'EUCLID');
  assert.equal(db.prepare('SELECT employee_id FROM dossiers WHERE id=56').get().employee_id,null);
  assert.equal(db.prepare('SELECT count(*) n FROM dossiers').get().n,4);
  db.prepare("UPDATE dossiers SET title='新版档案',classification='KETER',summary='管理员修改正文' WHERE id=55").run();
  assert.equal(db.prepare('SELECT display_name FROM employees WHERE id=1').get().display_name,'新版档案');
  db.prepare("UPDATE employees SET display_name='更名',containment_classification='SAFE' WHERE id=1").run();
  const changed=db.prepare('SELECT * FROM dossiers WHERE id=55').get();
  assert.equal(changed.title,'更名');assert.equal(changed.classification,'SAFE');assert.equal(changed.summary,'管理员修改正文');
  db.prepare("UPDATE profiles SET bio='修改个人简介' WHERE employee_id=1").run();
  assert.equal(db.prepare('SELECT summary FROM dossiers WHERE id=55').get().summary,'管理员修改正文');
  db.prepare('DELETE FROM employees WHERE id=1').run();
  assert.equal(db.prepare('SELECT employee_id FROM dossiers WHERE id=55').get().employee_id,null,'the archive survives account removal');
 }finally{db.close();}
});

test('account creation, admin dossier editing and player archives share the same persistent record',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-linked-dossiers-')),password=randomBytes(20).toString('hex');
 const port=await new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p));});});
 const base='http://127.0.0.1:'+port;let child,errors='',admin,player;
 const env={...process.env,DATA_DIR:folder,HOST:'127.0.0.1',PORT:String(port),COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'linked-admin',BOOTSTRAP_ADMIN_PASSWORD:password};
 async function start(){
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','pipe','pipe']});child.stdout.resume();child.stderr.on('data',d=>errors+=d);
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(errors);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error(errors||'Server not ready');
 }
 async function stop(){if(child?.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}}
 t.after(async()=>{await stop();assert.equal(dirname(resolve(folder)),resolve(tmpdir()));rmSync(folder,{recursive:true,force:true});});
 async function login(identifier){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 async function req(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 const a=(...args)=>req(admin,...args),p=(...args)=>req(player,...args);
 await start();admin=await login('linked-admin');
 const create=await a('/api/admin/employees','POST',{username:'linked-player',password,displayName:'玩家收容样本',identityKind:'player_containment',containmentClassification:'SAFE',archiveBio:'初始简介'});assert.equal(create.status,201);
 const owner=create.data.id;player=await login('linked-player');
 const read=async()=>(await a('/api/admin/dossiers')).data.items.find(d=>d.employeeId===owner);
 let dossier=await read();assert.ok(dossier);const id=dossier.id;
 assert.equal(dossier.identityKind,'player_containment');assert.equal(dossier.summary,'初始简介');assert.equal(dossier.classification,'SAFE');
 const edit={code:dossier.code,title:'新版收容样本',department:'收容部',status:'观察中',summary:'管理端完整正文。'.repeat(100),classification:'KETER',procedures:'新的收容措施',sections:[{type:'note',body:'补充记录'}],employeeId:999};
 assert.equal((await a('/api/admin/dossiers/'+id,'PUT',edit)).status,200);
 let state=(await p('/api/player/state?section=containment')).data;
 const shared=state.dossiers.find(d=>d.employeeId===owner);
 assert.equal((await p('/api/dossiers')).data.items.find(d=>d.employeeId===owner).id,id);
 assert.equal(shared.id,id);assert.equal(shared.title,edit.title);assert.equal(shared.summary,edit.summary);assert.equal(shared.procedures,edit.procedures);assert.equal(shared.sections[0].body,'补充记录');
 assert.equal(state.employee.displayName,edit.title);assert.equal(state.employee.containmentClassification,'KETER');
 assert.equal((await p('/api/admin/dossiers/'+id,'PUT',edit)).status,403);
 assert.equal((await a('/api/admin/dossiers/'+id,'PUT',{...edit,title:'名'.repeat(81)})).status,400);
 assert.equal((await a('/api/admin/dossiers/'+id,'DELETE')).status,409);
 assert.equal((await p('/api/profile','PUT',{bio:'新的个人简介',anonymousName:'样本代号'})).status,200);
 assert.equal((await read()).summary,edit.summary,'profile editing cannot overwrite the full archive');
 assert.equal((await a('/api/admin/employees/'+owner,'PUT',{displayName:'账号处更名',containmentClassification:'EUCLID'})).status,200);
 dossier=await read();assert.equal(dossier.id,id);assert.equal(dossier.title,'账号处更名');assert.equal(dossier.classification,'EUCLID');assert.equal(dossier.summary,edit.summary);
 const system=await a('/api/admin/employees','POST',{identityKind:'company_containment',displayName:'系统收容样本',containmentClassification:'KETER',archiveBio:'系统简介'});assert.equal(system.status,201);
 assert.ok((await a('/api/admin/dossiers')).data.items.some(d=>d.employeeId===system.data.id&&d.identityKind==='company_containment'));
 const ordinary=await a('/api/admin/employees','POST',{username:'converted',password,displayName:'转换样本'});assert.equal(ordinary.status,201);
 assert.equal((await a('/api/admin/employees/'+ordinary.data.id,'PUT',{displayName:'转换样本',identityKind:'player_containment'})).status,200);
 assert.equal((await a('/api/admin/dossiers')).data.items.filter(d=>d.employeeId===ordinary.data.id).length,1);
 await stop();await start();admin=await login('linked-admin');player=await login('linked-player');
 dossier=await read();assert.equal(dossier.id,id);assert.equal(dossier.summary,edit.summary);
 state=(await p('/api/player/state?section=containment')).data;assert.equal(state.dossiers.filter(d=>d.employeeId===owner).length,1);
 assert.equal(state.dossiers.find(d=>d.id===id).title,'账号处更名');
});
