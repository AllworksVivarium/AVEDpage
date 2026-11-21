import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {installAvedRecovery} from '../server-aved-recovery.mjs';

test('recovery defaults closed and is bound to the exact enabled AVED administrator and configured employee ID',async()=>{
 let calls=0;const account={id:1,username:'AVED',role:'admin',enabled:1},passwordHash='a'.repeat(32)+':'+ 'b'.repeat(64);
 const options={employeeId:1,passwordHash,verifyPassword:async()=>{calls++;return true;}};
 for(const overrides of [{employeeId:''},{employeeId:'x'},{employeeId:0},{passwordHash:''},{passwordHash:'malformed'}])assert.equal(await installAvedRecovery({...options,...overrides}).verify('AVED',account,'test-secret'),false);
 const app=installAvedRecovery(options);
 for(const [name,employee] of [['aved',account],['AVED',{...account,id:2}],['AVED',{...account,username:'other'}],['AVED',{...account,role:'employee'}],['AVED',{...account,enabled:0}],['AVED',null]])assert.equal(await app.verify(name,employee,'test-secret'),false);
 assert.equal(calls,0);assert.equal(await app.verify('AVED',account,'test-secret'),true);assert.equal(calls,1);
});

test('AVED primary password remains valid and can change independently of its server-side recovery password',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-dual-password-')),primary=randomBytes(16).toString('hex'),fallback=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
 const recoveryHash=salt+':'+pbkdf2Sync(fallback,salt,310000,32,'sha256').toString('hex');
 const port=await new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:folder,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'development',COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'AVED',BOOTSTRAP_ADMIN_PASSWORD:primary,AVED_RECOVERY_EMPLOYEE_ID:'1',AVED_RECOVERY_PASSWORD_HASH:recoveryHash},stdio:['ignore','ignore','pipe']});
 let errors='';child.stderr.on('data',bytes=>errors+=bytes);
 t.after(async()=>{if(child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;}rmSync(folder,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;let ready=false;
 for(let i=0;i<150;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready,errors);
 const request=async(path,body,cookie='')=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0],data:await response.json()};};
 const login=(password,identifier='AVED')=>request('/api/login',{identifier,password});
 const first=await login(primary);assert.equal(first.status,200);assert.equal((await login(fallback)).status,200);assert.equal((await login('wrong')).status,401);
 const created=await request('/api/admin/employees',{username:'other',displayName:'其他员工',password:primary},first.cookie);assert.equal(created.status,201);
 assert.equal((await login(fallback,'other')).status,401);
 const changed=randomBytes(16).toString('hex');
 const edit=await fetch(base+'/api/admin/employees/1',{method:'PUT',headers:{'Content-Type':'application/json',Origin:base,Cookie:first.cookie},body:JSON.stringify({displayName:'管理员',department:'公司直属',password:changed,avedRecoveryPassword:'attempted-change',AVED_RECOVERY_PASSWORD_HASH:'attempted-change'})});assert.equal(edit.status,200);
 assert.equal((await login(primary)).status,401);assert.equal((await login(changed)).status,200);assert.equal((await login(fallback)).status,200);assert.equal((await login('attempted-change')).status,401);
 const session=await fetch(base+'/api/me',{headers:{Cookie:first.cookie}});const body=JSON.stringify(await session.json());assert.equal(body.includes(recoveryHash),false);assert.equal(body.includes(fallback),false);
});
