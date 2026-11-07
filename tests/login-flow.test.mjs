import sharp from 'sharp';
import {randomBytes} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import vm from 'node:vm';
import {networkContext,sessionTokens,loginLimiter} from '../server-auth.mjs';

const root=new URL('../',import.meta.url);
const sandbox={AbortController,setTimeout,clearTimeout,fetch,console};
vm.runInNewContext(readFileSync(new URL('public/http-client.js',root),'utf8'),sandbox);
const transport=sandbox.AVEDHttp;

test('unreadable HTTP 200 JSON and aborted body never become successful data',async()=>{
 const broken=transport.create({fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('truncated');}})});
 await assert.rejects(broken.request('/api/player/state',{retries:0}),e=>e.code==='INVALID_RESPONSE');
 const delayed=transport.create({timeoutMs:10,fetchImpl:async(_path,{signal})=>({ok:true,status:200,json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))))})});
 await assert.rejects(delayed.request('/api/player/state',{retries:0}),e=>e.code==='TIMEOUT');
});
test('only safe reads retry and missing cookies produce a session error',async()=>{
 let count=0;
 const retry=transport.create({sleep:async()=>{},fetchImpl:async()=>({ok:true,status:200,json:async()=>{if(++count===1)throw new SyntaxError('truncated');return {employees:[]};}})});
 assert.ok((await retry.request('/api/player/state')).employees);assert.equal(count,2);
 count=0;const missing=transport.create({sleep:async()=>{},fetchImpl:async()=>{count++;return {ok:false,status:401,json:async()=>({error:'请先登录。',code:'SESSION_MISSING'})};}});
 await assert.rejects(missing.request('/api/login',{method:'POST',body:'{}'}),e=>e.status===401);assert.equal(count,1);
 count=0;await assert.rejects(missing.confirmSession('admin'),e=>e.code==='SESSION_NOT_SAVED');assert.equal(count,3);
 const mismatch=transport.create({fetchImpl:async()=>({ok:true,status:200,json:async()=>({employee:{username:'other'}})})});
 await assert.rejects(mismatch.confirmSession('admin'),e=>e.code==='SESSION_MISMATCH');
});
test('proxy headers require a trusted peer and login limits are isolated',()=>{
 const req={socket:{remoteAddress:'::ffff:172.18.0.1'},headers:{'x-real-ip':'192.0.2.4','x-forwarded-proto':'https'}};
 assert.deepEqual(networkContext(req,'172.18.0.1'),{address:'192.0.2.4',secure:true});
 assert.deepEqual(networkContext({...req,socket:{remoteAddress:'192.0.2.55'}},'172.18.0.1'),{address:'192.0.2.55',secure:false});
 let now=100;const limiter=loginLimiter({clock:()=>now,windowMs:1000,limit:2});limiter.fail('network-a/employee-a');limiter.fail('network-a/employee-a');assert.ok(limiter.blocked('network-a/employee-a'));assert.equal(limiter.blocked('network-a/employee-b'),0);assert.equal(limiter.blocked('network-b/employee-a'),0);now+=1001;assert.equal(limiter.blocked('network-a/employee-a'),0);
 assert.equal(sessionTokens('wy_session=bad; wy_session='+'a'.repeat(43)).length,1);
});
test('thin login state, duplicate cookies, parallel sessions and HTTPS entry',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-login-'));
 const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>r(n));});});
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',COOKIE_SECURE:'true',SESSION_SECRET:'isolated-auth-flow-secret-for-tests-only',BOOTSTRAP_ADMIN_USERNAME:'auth-admin',BOOTSTRAP_ADMIN_PASSWORD:'auth-password-123'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stdout.resume();child.stderr.on('data',x=>errors+=x);
 t.after(async()=>{if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<70;i++){if(child.exitCode!==null)break;try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,errors);
 async function request(cookie,path,method='GET',body){return fetch(base+path,{method,headers:{cookie,origin:base,'x-forwarded-proto':'https','content-type':'application/json'},body:body?JSON.stringify(body):undefined});}
 async function login(identifier,password='auth-password-123'){const r=await request('','/api/login','POST',{identifier,password});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly.*SameSite=Strict.*Secure/);return r.headers.get('set-cookie').split(';')[0];}
 const first=await login('auth-admin');const added=await request(first,'/api/admin/employees','POST',{username:'auth-player',displayName:'双端员工',password:'auth-password-123'});assert.equal(added.status,201);
 const player=await login('auth-player'),second=await login('auth-player');
 assert.equal((await request(player,'/api/me')).status,200);assert.equal((await request(second,'/api/me')).status,200);
 const bad='wy_session='+'z'.repeat(43);assert.equal((await request(bad+'; '+second,'/api/me')).status,200);
 const newestAdmin=await login('auth-admin');
 assert.equal((await (await request(player+'; '+newestAdmin,'/api/me')).json()).employee.username,'auth-admin');
 assert.equal((await (await request(newestAdmin+'; '+player,'/api/me')).json()).employee.username,'auth-admin');
 const bootResponse=await request(player,'/api/player/state?bootstrap=1'),boot=await bootResponse.json();assert.equal(bootResponse.status,200);assert.equal(boot.employee.username,'auth-player');assert.ok(boot.profile&&boot.gameRecords);
 for(const key of ['employees','departments','announcements','dossiers','stocks','music'])assert.deepEqual(boot[key],[]);assert.deepEqual(boot.forum.items,[]);assert.equal(boot.market,null);
 assert.equal((await request('','/api/player/state?bootstrap=1')).status,401);
 const otherBoot=await (await request(first,'/api/player/state?bootstrap=1&employeeId='+boot.employee.id)).json();assert.equal(otherBoot.employee.username,'auth-admin','URL identity must never override session identity');
 const invalid='data:image/png;base64,'+Buffer.alloc(500000,1).toString('base64');
 assert.equal((await request(player,'/api/profile','PUT',{anonymousName:'网络值班员',bio:'',avatarUrl:invalid})).status,400);
 const source=await sharp(randomBytes(512*512*3),{raw:{width:512,height:512,channels:3}}).png().toBuffer();
 const large='data:image/png;base64,'+source.toString('base64');
 assert.equal((await request(player,'/api/profile','PUT',{anonymousName:'网络值班员',bio:'',avatarUrl:large})).status,200);
 const result=await request(player,'/api/player/state'),raw=await result.text(),state=JSON.parse(raw);assert.ok(raw.length<25000,'login must not download avatar bytes');assert.doesNotMatch(raw,/data:image/);assert.match(state.profile.avatarUrl,/^\/api\/media\/avatar\//);
 assert.equal((await fetch(base+state.profile.avatarUrl,{headers:{'x-forwarded-proto':'https'}})).status,401);
 const img=await request(player,state.profile.avatarUrl);assert.equal(img.status,200);const avatar=Buffer.from(await img.arrayBuffer());assert.ok(avatar.length<source.length);assert.equal((await sharp(avatar).metadata()).width,256);
 assert.equal((await request(player,'/api/profile','PUT',{anonymousName:'新代号',bio:'',avatarUrl:state.profile.avatarUrl})).status,200);
 await request(player,'/api/logout','POST');assert.equal((await request(player,'/api/me')).status,401);assert.equal((await request(second,'/api/me')).status,200);
 const http=await fetch(base+'/admin-terminal.html',{redirect:'manual'});assert.equal(http.status,308);assert.equal(http.headers.get('location'),'https://authority.aved.space/admin-terminal.html');
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,400);
});
