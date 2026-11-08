import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';

test('avatar choices, real notice identities and paged forum moderation',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-community-'));
 const port=await new Promise(resolvePort=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolvePort(p));});});
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:'isolated-community-review-secret-123456',BOOTSTRAP_ADMIN_USERNAME:'community-admin',BOOTSTRAP_ADMIN_NAME:'监察员',BOOTSTRAP_ADMIN_PASSWORD:'community-review-123'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stdout.resume();child.stderr.on('data',x=>errors+=x);
 t.after(async()=>{if(child.exitCode===null){const closed=new Promise(r=>child.once('exit',r));child.kill();await closed;}assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;let ready=false;
 for(let i=0;i<70;i++){if(child.exitCode!==null)break;try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,errors);
 async function login(identifier,password,remember=false){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password,remember})});assert.equal(r.status,200);if(remember)assert.match(r.headers.get('set-cookie'),/Max-Age=2592000/);return r.headers.get('set-cookie').split(';')[0];}
 const admin=await login('community-admin','community-review-123');
 const request=async(cookie,path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const a=(p,m,b)=>request(admin,p,m,b);


 const created=await a('/api/admin/employees','POST',{username:'preview-player',displayName:'实名测试员',password:'employee123',initialBalance:10000});assert.equal(created.status,201);
 const cookie=await login('preview-player','employee123'),p=(path,method,body)=>request(cookie,path,method,body);
 const save=body=>p('/api/profile','PUT',{anonymousName:'测试代号',bio:'',...body});
 let chosen=await save({avatarUrl:'',avatarPreset:'moss'});assert.equal(chosen.status,200);assert.match(chosen.data.profile.avatarUrl,/avatar-pixel-moss\.[a-f0-9]{12}\.svg$/);assert.equal(chosen.data.profile.avatarPreset,'moss');
 assert.equal((await fetch(base+chosen.data.profile.avatarUrl)).status,200);
 const imageUrl=chosen.data.profile.avatarUrl;
 chosen=await save({avatarUrl:imageUrl});assert.equal(chosen.status,200);assert.equal(chosen.data.profile.avatarUrl,imageUrl);
 assert.equal((await save({avatarPreset:'not-a-palette'})).status,400);assert.equal((await save({avatarUrl:123})).status,400);
 const thread=(await p('/api/player/forum','POST',{title:'管理列表测试',body:'主题正文',identityMode:'real'})).data.id;
 let topic=(await p('/api/player/forum/'+thread)).data.thread;assert.equal(topic.avatarUrl,imageUrl);
 await p('/api/player/forum/thread/'+thread,'PUT',{title:'管理列表测试',body:'主题正文',identityMode:'anonymous'});assert.equal((await p('/api/player/forum/'+thread)).data.thread.avatarUrl,'');
 const replies=[];for(let i=0;i<23;i++)replies.push((await p('/api/player/forum/'+thread,'POST',{body:'回复 '+i})).data.id);
 assert.equal((await p('/api/admin/forum')).status,403);
 let page=(await a('/api/admin/forum')).data;assert.equal(page.items.find(t=>t.id===thread).replyCount,23);
 page=(await a('/api/admin/forum/'+thread)).data;assert.equal(page.items.length,20);assert.ok(page.next);
 assert.equal((await a('/api/admin/forum/'+thread+'?after='+page.next)).data.items.length,3);
 assert.equal((await a('/api/admin/forum/replies/'+replies[0],'DELETE')).status,200);
 assert.equal((await p('/api/player/forum/'+thread)).data.items.some(r=>r.id===replies[0]),false);
 const state=(await p('/api/player/state?section=news')).data,notice=state.announcements[0];
 assert.equal((await p('/api/posts','POST',{announcementId:notice.id,anonymousName:'伪造身份',body:'实名留言'})).status,201);
 const comment=(await p('/api/posts?announcementId='+notice.id)).data.items[0];assert.equal(comment.displayName,'实名测试员');assert.equal('anonymousName' in comment,false);assert.equal(comment.avatarUrl,imageUrl);
 await save({avatarUrl:'',avatarPreset:''});assert.equal((await p('/api/profile')).data.profile.avatarUrl,'');
 const robot=(await a('/api/admin/company-robots','POST',{codename:'头像机器人',balance:0,avatarPreset:'sand'})).data;
 const list=(await a('/api/admin/company-robots')).data.items;assert.match(list.find(r=>r.id===robot.id).avatarUrl,/avatar-pixel-sand\./);
 assert.equal((await a('/api/admin/forum/threads/'+thread,'DELETE')).status,200);assert.equal((await p('/api/player/forum/'+thread)).status,400);assert.equal((await a('/api/admin/forum')).data.items.some(t=>t.id===thread),false);
 assert.ok((await a('/api/admin/speech-records?keyword='+encodeURIComponent('主题正文'))).data.items.some(t=>t.deletedAt));
});
