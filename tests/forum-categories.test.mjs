import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {installForumCategories} from '../server-forum-categories.mjs';

test('forum categories: admin catalog, single-category publishing, filtering and reassignment',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-community-'));
 const port=await new Promise(resolvePort=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolvePort(p));});});
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:'isolated-community-review-secret-123456',BOOTSTRAP_ADMIN_USERNAME:'community-admin',BOOTSTRAP_ADMIN_NAME:'监察员',BOOTSTRAP_ADMIN_PASSWORD:'community-review-123'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stdout.resume();child.stderr.on('data',x=>errors+=x);
 t.after(async()=>{if(child.exitCode===null){const closed=new Promise(r=>child.once('exit',r));child.kill();await closed;}assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;let ready=false;
 for(let i=0;i<70;i++){if(child.exitCode!==null)break;try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,errors);
 async function login(identifier,password,remember=false){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password,remember})});assert.equal(r.status,200);if(remember)assert.match(r.headers.get('set-cookie'),/Max-Age=604800/);return r.headers.get('set-cookie').split(';')[0];}
 const admin=await login('community-admin','community-review-123');
 const request=async(cookie,path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const a=(p,m,b)=>request(admin,p,m,b);


 const made=await a('/api/admin/employees','POST',{username:'category-reader',displayName:'分类测试员',password:'employee123',initialBalance:0});assert.equal(made.status,201);
 const reader=await login('category-reader','employee123'),p=(path,method,body)=>request(reader,path,method,body);
 const catalog=(await p('/api/player/forum/categories')).data.items;
 assert.deepEqual(catalog.map(c=>c.name),['员工日常','组队招募','出谋划策']);
 const [daily,recruit,ideas]=catalog;
 assert.equal((await p('/api/admin/forum/categories')).status,403);
 assert.equal((await p('/api/admin/forum/categories','POST',{name:'伪造分类'})).status,403);
 const post=async(title,categoryId)=>(await p('/api/player/forum','POST',{title,body:'可检索正文',categoryId}));
 const first=await post('标题保持原样',recruit.id);assert.equal(first.status,201);assert.equal(first.data.categoryId,recruit.id);
 await post('日常主题',daily.id);await post('建议主题',ideas.id);
 const before=(await p('/api/player/forum')).data.total;
 for(const invalid of [0,-1,99999,[daily.id,recruit.id],'bad',null])assert.equal((await post('错误分类',invalid)).status,400);
 assert.equal((await p('/api/player/forum')).data.total,before,'invalid categories never create orphan topics');
 const filtered=(await p('/api/player/forum?category='+recruit.id+'&q='+encodeURIComponent('可检索'))).data;
 assert.equal(filtered.sort,'activity');assert.equal(filtered.categoryId,recruit.id);assert.equal(filtered.total,1);assert.equal(filtered.items[0].title,'标题保持原样');assert.equal(filtered.items[0].categoryName,'组队招募');
 assert.equal((await p('/api/player/forum?category=bad')).status,400);
 assert.equal((await p('/api/player/forum?category=99999')).status,400);
 let topic=(await p('/api/player/forum/'+first.data.id)).data.thread;
 assert.equal(topic.categoryId,recruit.id);assert.equal(topic.categoryName,'组队招募');
 await p('/api/player/forum/'+first.data.id,'POST',{body:'回复不会改分类',categoryId:daily.id});
 assert.equal((await p('/api/player/forum/'+first.data.id)).data.thread.categoryId,recruit.id);
 assert.equal((await p('/api/player/forum/thread/'+first.data.id,'PUT',{title:topic.title,body:topic.body,categoryId:ideas.id})).status,200);
 assert.equal((await p('/api/player/forum?category='+recruit.id)).data.total,0);
 assert.equal((await p('/api/player/forum/thread/'+first.data.id,'PUT',{title:topic.title,body:topic.body,categoryId:99999})).status,400);
 assert.equal((await a('/api/admin/forum/threads/'+first.data.id+'/category','PUT',{categoryId:daily.id})).status,200);
 assert.equal((await p('/api/admin/forum/threads/'+first.data.id+'/category','PUT',{categoryId:recruit.id})).status,403);
 const rename=await a('/api/admin/forum/categories/'+daily.id,'PUT',{name:'员工生活',sortOrder:20});assert.equal(rename.status,200);
 topic=(await p('/api/player/forum/'+first.data.id)).data.thread;assert.equal(topic.categoryId,daily.id);assert.equal(topic.categoryName,'员工生活');assert.equal(topic.title,'标题保持原样');
 assert.equal((await a('/api/admin/forum/categories','POST',{name:'员工生活'})).status,400);
 assert.equal((await a('/api/admin/forum/categories/'+daily.id,'PUT',{name:'错误顺序',sortOrder:-1})).status,400);
 const extra=await a('/api/admin/forum/categories','POST',{name:'临时活动'});assert.equal(extra.status,201);
 assert.equal((await a('/api/admin/forum/categories/'+extra.data.id,'PUT',{name:'联动活动',sortOrder:0})).status,200);
 assert.equal((await p('/api/player/forum/categories')).data.items.length,4);
 assert.equal((await p('/api/player/state?section=forum')).data.forum.categories.length,4);
 assert.equal((await a('/api/admin/forum')).data.items.find(t=>t.id===first.data.id).categoryId,daily.id);
 const aved=await a('/api/admin/employees','POST',{username:'AVED',displayName:'管理员',password:'employee123',identityKind:'planning_member',positionTitle:'叙事编辑',initialBalance:0});assert.equal(aved.status,201);
 const avedCookie=await login('AVED','employee123');
 const robot=await a('/api/admin/company-robots','POST',{codename:'分类机器人',balance:0,purpose:'story'});assert.equal(robot.status,200);
 const persona=(await request(avedCookie,'/api/player/forum/personas')).data.items[0];
 const workshop=await request(avedCookie,'/api/player/forum/workshop','POST',{requestId:'category-workshop-001',title:'线索标题',categoryId:extra.data.id,lines:[{personaId:persona.id,body:'线索正文'}]});assert.equal(workshop.status,201);
 assert.equal((await p('/api/player/forum/'+workshop.data.threadId)).data.thread.categoryId,extra.data.id);
 const legacy=await p('/api/forum','POST',{title:'兼容发帖',body:'兼容正文',categoryId:recruit.id});assert.equal(legacy.status,201);
 assert.equal((await p('/api/player/forum/'+legacy.data.id)).data.thread.categoryId,recruit.id);
});


test('category migration keeps old titles and stable membership after catalog edits and restart',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE forum_threads(id INTEGER PRIMARY KEY,title TEXT);INSERT INTO forum_threads VALUES(1,'旧标题');");
  let categories=installForumCategories(db);const original=categories.list(),daily=original[0].id;
  assert.equal(db.prepare('SELECT category_id FROM forum_threads WHERE id=1').get().category_id,daily);
  categories.save(daily,{name:'生活日常',sortOrder:50});
  const extra=categories.save(null,{name:'自定义分类',sortOrder:0});
  db.prepare('INSERT INTO forum_threads(title,category_id) VALUES(?,?)').run('新标题',extra.id);
  categories=installForumCategories(db);
  assert.equal(categories.list().length,4);assert.equal(categories.list().find(c=>c.id===daily).name,'生活日常');
  const rows=db.prepare('SELECT title,category_id FROM forum_threads ORDER BY id').all();
  assert.deepEqual(rows.map(r=>r.title),['旧标题','新标题']);assert.deepEqual(rows.map(r=>r.category_id),[daily,extra.id]);
  db.prepare('INSERT INTO forum_threads(title) VALUES(?)').run('兼容脚本标题');
  assert.ok(categories.list().some(c=>c.id===db.prepare('SELECT category_id FROM forum_threads WHERE id=3').get().category_id));
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});
