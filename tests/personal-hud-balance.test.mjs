import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';

test('personal reset accepts signed balances, preserves ledger and is idempotent',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-hud-'));
 const password=randomBytes(24).toString('hex');
 const port=await new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p));});});
 const base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:folder,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'hud-test',BOOTSTRAP_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
 child.stdout.resume();let errors='';child.stderr.on('data',x=>errors+=x);let db;
 t.after(async()=>{db?.close();if(child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill();await end;}assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,errors);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'hud-test',password})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const request=async(path,method='GET')=>{const r=await fetch(base+path,{method,headers:{cookie,origin:base}});return {status:r.status,data:await r.json()};};
 db=new DatabaseSync(join(folder,'wanyehui.db'));const id=db.prepare('SELECT id FROM employees WHERE username=?').get('hud-test').id;
 for(const amount of [12500,-8700]){
  db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,amount,'HUD isolated fixture');
  assert.equal((await request('/api/me')).data.balance,amount);
  const before=db.prepare('SELECT COUNT(*) n FROM balance_ledger WHERE employee_id=?').get(id).n;
  const reset=await request('/api/player/balance/zero','POST');assert.equal(reset.status,200);assert.equal(reset.data.balance,0);
  const entry=db.prepare('SELECT delta,reason FROM balance_ledger WHERE employee_id=? ORDER BY id DESC').get(id);assert.equal(entry.delta,-amount);assert.equal(entry.reason,'主动归零');
  assert.equal((await request('/api/player/balance/zero','POST')).data.balance,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger WHERE employee_id=?').get(id).n,before+1);
 }
 const state=(await request('/api/player/state')).data;assert.deepEqual(state.history,[]);assert.ok(Array.isArray(state.achievements));assert.ok('gameRecords' in state);
});
