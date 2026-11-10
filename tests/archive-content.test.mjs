import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {installDossierContent,normalizeDossierContent} from '../server-dossier-content.mjs';

test('classification migrates once; optional blocks retain order, whitespace and plain-text escaping',()=>{
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE dossiers(id INTEGER PRIMARY KEY,status TEXT);INSERT INTO dossiers VALUES(1,'SAFE')");installDossierContent(db);assert.equal(db.prepare('SELECT classification FROM dossiers').get().classification,'SAFE');db.exec("UPDATE dossiers SET classification=''");installDossierContent(db);assert.equal(db.prepare('SELECT classification FROM dossiers').get().classification,'');db.close();
 assert.throws(()=>normalizeDossierContent({classification:'<script>'}));assert.throws(()=>normalizeDossierContent({sections:Array(25).fill({})}));
 const c={window:{}};vm.runInNewContext(readFileSync(new URL('../public/dossier-content.js',import.meta.url),'utf8'),c);
 const item=c.window.AVEDDossierContent.map({code:'TEST',title:'示例',summary:'第一段\n\n第二段',status:'观察中',sections:[{type:'note',author:'古登野',date:'20xx 更新',body:'<script>unsafe</script>'},{type:'story',body:'小故事'}]});
 const html=c.window.AVEDDossierContent.render(item);assert.ok(!html.includes('SPECIAL CONTAINMENT PROCEDURES'));assert.ok(html.includes('第一段\n\n第二段'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('20xx 更新'));assert.ok(html.indexOf('古登野')<html.indexOf('小故事'));
});

test('admin edits structured dossiers and six dimensions; players only read them; restart preserves data',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-archive-')),password=randomBytes(16).toString('hex');
 const port=await new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p));});});const base='http://127.0.0.1:'+port;let child,errors='';
 const env={...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'archive-admin',BOOTSTRAP_ADMIN_PASSWORD:password};
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','pipe','pipe']});child.stdout.resume();child.stderr.on('data',d=>errors+=d);for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error(errors);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error(errors||'Server not ready');}
 async function stop(){if(child?.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}}
 t.after(async()=>{await stop();assert.equal(dirname(resolve(folder)),resolve(tmpdir()));assert.ok(basename(folder).startsWith('aved-archive-'));rmSync(folder,{recursive:true,force:true});});await start();
 async function login(name){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:name,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 let admin=await login('archive-admin'),player;
 async function req(cookie,path,method='GET',data){const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
 const a=(...args)=>req(admin,...args),p=(...args)=>req(player,...args);
 const person=await a('/api/admin/employees','POST',{username:'archive-player',password,displayName:'录入测试员',attributes:[0,20,40,60,80,100]});assert.equal(person.status,201);player=await login('archive-player');const attrPath='/api/admin/employees/'+person.data.id+'/attributes';
 assert.deepEqual((await p('/api/profile')).data.profile.attributes,[0,20,40,60,80,100]);assert.equal((await p(attrPath,'PUT',{values:[1,2,3,4,5,6]})).status,403);
 assert.equal((await a(attrPath,'PUT',{values:[0,20,40,60,80,101]})).status,400);assert.deepEqual((await a(attrPath)).data.values,[0,20,40,60,80,100]);
 assert.equal((await a('/api/admin/employees/'+person.data.id,'PUT',{displayName:'录入测试员',attributes:[100,80,60,40,20,0]})).status,200);
 assert.deepEqual((await p('/api/player/directory')).data.items.find(x=>x.id===person.data.id).attributes,[100,80,60,40,20,0]);
 const document={code:'TEST-MODULES',title:'模块档案',department:'收容部',status:'观察中',summary:'原始正文\n\n第二段',classification:'SAFE',procedures:'措施正文',sections:[{type:'note',title:'更新',author:'古登野',date:'20xx',body:'补充正文\n第二行'},{type:'story',body:'无署名故事'},{type:'note',body:''}]};
 const created=await a('/api/admin/dossiers','POST',document);assert.equal(created.status,201);const id=created.data.id,path='/api/admin/dossiers/'+id;
 let row=(await p('/api/dossiers')).data.items.find(x=>x.id===id);assert.equal(row.classification,'SAFE');assert.equal(row.sections.length,2);assert.equal(row.sections[0].date,'20xx');assert.ok(!('image_data' in row));
 assert.equal((await a(path,'PUT',{code:document.code,title:document.title,department:document.department,status:document.status,summary:'修改正文'})).status,200);
 row=(await a('/api/admin/dossiers')).data.items.find(x=>x.id===id);assert.equal(row.procedures,'措施正文');assert.equal(row.sections.length,2,'unrelated edits preserve optional modules');
 assert.equal((await p(path,'PUT',document)).status,403);assert.equal((await a(path,'PUT',{...document,classification:'INVALID'})).status,400);
 assert.equal((await a(path,'PUT',{...document,classification:'',procedures:'',sections:[]})).status,200);
 await stop();await start();admin=await login('archive-admin');player=await login('archive-player');row=(await p('/api/dossiers')).data.items.find(x=>x.id===id);assert.equal(row.classification,'');assert.equal(row.procedures,'');assert.deepEqual(row.sections,[]);assert.deepEqual((await p('/api/profile')).data.profile.attributes,[100,80,60,40,20,0]);
 assert.equal((await a(attrPath,'PUT',{values:null})).status,200);assert.equal((await p('/api/profile')).data.profile.attributes,null);
});


test('archive effects escape HTML, switch twice and always restore within 100ms',()=>{
 const timers=[],context={window:{},setTimeout:(fn,ms)=>timers.push({fn,ms})};vm.runInNewContext(readFileSync(new URL('../public/dossier-content.js',import.meta.url),'utf8'),context);const api=context.window.AVEDDossierContent;
 const html=api.render(api.map({summary:'[遮盖]<img src=x>[/遮盖] [乱码]原文[/乱码]',sections:[]}));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('dossier-redaction'));assert.ok(html.includes('data-dossier-glitch'));assert.ok(!html.includes('<img'));
 const node={textContent:'需要恢复的原文',isConnected:true},root={querySelectorAll:()=>[node]};api.play(root,'visit-1');assert.notEqual(node.textContent,'需要恢复的原文');assert.deepEqual(timers.map(t=>t.ms),[45,95]);timers[0].fn();timers[1].fn();assert.equal(node.textContent,'需要恢复的原文');api.play(root,'visit-1');assert.equal(timers.length,2);api.play(root,'visit-2',false);assert.equal(node.textContent,'需要恢复的原文');assert.equal(timers.length,2);
});
