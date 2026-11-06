import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

test('real server enforces login and Origin, and serves durable edited player sources',async t=>{
  const root=await mkdtemp(join(tmpdir(),'aved-design-http-')),port=18176,base='http://127.0.0.1:'+port,password=randomBytes(20).toString('hex');
  const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:root,SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'design-http-test',BOOTSTRAP_ADMIN_PASSWORD:password};
  let child;
  async function stop(){if(child&&child.exitCode===null){const closed=new Promise(r=>child.once('close',r));child.kill();await closed;}}
  t.after(async()=>{await stop();assert.ok(root.startsWith(join(tmpdir(),'aved-design-http-')));await rm(root,{recursive:true,force:true});});
  async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:resolve(import.meta.dirname,'..'),env,stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}if(child.exitCode!==null)throw Error('测试服务器启动失败');await delay(100);}throw Error('测试服务器未就绪');}
  await start();
  const anonymous=await fetch(base+'/api/admin/player-design/text/resolve',{method:'POST',body:JSON.stringify({text:'员工首页'})});assert.equal(anonymous.status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'design-http-test',password})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  async function post(action,input,origin=base){const response=await fetch(base+'/api/admin/player-design/'+action,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,data:await response.json()};}
  assert.equal((await post('text/resolve',{text:'员工首页'},'https://other.invalid')).status,403);
  const found=await post('text/resolve',{text:'员工首页'});assert.equal(found.status,200);assert.ok(found.data.matches.length);
  const source=found.data.matches.find(c=>c.file==='public/player-terminal.html')||found.data.matches[0];
  const saved=await post('text/save',{...source,text:'员工首页 HTTP验证'});assert.equal(saved.status,200);
  const route='/'+source.file.slice(7);assert.match(await (await fetch(base+route)).text(),/员工首页 HTTP验证/);
  await stop();await start();assert.match(await (await fetch(base+route)).text(),/员工首页 HTTP验证/);
  assert.equal((await post('text/undo',{undoId:saved.data.undoId})).status,200);
  assert.doesNotMatch(await (await fetch(base+route)).text(),/员工首页 HTTP验证/);
});
