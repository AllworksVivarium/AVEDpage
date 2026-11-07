import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHmac,randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';

const repo=resolve(process.argv[2]),label=process.argv[3]||'optimized',duration=Number(process.argv[4]||32)*1000;
const dir=await mkdtemp(join(tmpdir(),'aved-load-')),secret=randomBytes(32).toString('hex');
const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>r(n));});});
const base='http://127.0.0.1:'+port,child=spawn(process.execPath,['--import',new URL('./bench-probe.mjs',import.meta.url).href,'server.mjs'],{cwd:repo,env:{...process.env,DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:secret,BOOTSTRAP_ADMIN_USERNAME:'bench',BOOTSTRAP_ADMIN_PASSWORD:randomBytes(16).toString('hex')},stdio:['ignore','ignore','pipe','ipc']});
let errors='',db;child.stderr.on('data',x=>errors+=x);const stop=new AbortController();let streamBytes=0,streamFrames=0,httpBytes=0,failures=0;const latency=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stats=()=>new Promise(r=>{child.once('message',r);child.send('stats');});
try{
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await sleep(50);}assert.ok(ready,errors);
 db=new DatabaseSync(join(dir,'wanyehui.db'));db.exec('PRAGMA busy_timeout=5000;BEGIN IMMEDIATE');
 const hash=db.prepare('SELECT password_hash FROM employees LIMIT 1').get().password_hash;
 const cookies=[],ids=[];
 for(let i=0;i<120;i++){
  const id=Number(db.prepare('INSERT INTO employees(username,password_hash,display_name) VALUES(?,?,?)').run('load-'+i,hash,'合成员工 '+i).lastInsertRowid);ids.push(id);
  db.prepare('INSERT INTO profiles(employee_id,anonymous_name) VALUES(?,?)').run(id,'合成代号 '+i);
  const token=randomBytes(32).toString('base64url');cookies.push('wy_session='+token);db.prepare('INSERT INTO sessions(token_hash,employee_id,expires_at,issued_at) VALUES(?,?,?,?)').run(createHmac('sha256',secret).update(token).digest('hex'),id,Date.now()+3600000,Date.now());
  const insert=db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)');for(let j=0;j<250;j++)insert.run(id,1000,'合成压力测试流水');
 }
 for(const room of ['sky','derby'])for(let i=0;i<30;i++)db.prepare('INSERT INTO chat_messages(employee_id,room,alias,body) VALUES(?,?,?,?)').run(ids[i],room,'合成代号 '+i,'用于独立测试的聊天消息 '+i);
 db.exec('COMMIT');db.close();db=null;
 const request=async(i,path,body)=>{const before=performance.now();const response=await fetch(base+path,{headers:{cookie:cookies[i],'content-type':'application/json'},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});const data=await response.text();return {status:response.status,data:JSON.parse(data),ms:performance.now()-before,bytes:Buffer.byteLength(data)};};
 // Register real participants so snapshots exercise per-player balances/settlement.
 const sky=(await request(0,'/api/player/games/sky/current')).data,derby=(await request(20,'/api/player/games/derby/current')).data;
 for(let i=0;i<40;i++)await request(i,i<20?'/api/player/games/sky/start':'/api/player/games/derby/bet',i<20?{round:sky.round,bet:100}:{round:derby.round,bet:100,runner:i%4});
 const streams=[];for(let i=0;i<40;i++)for(const path of ['/api/player/games/'+(i<20?'sky':'derby')+'/stream','/api/player/chat/stream?room='+(i<20?'sky':'derby')]){
  const response=await fetch(base+path,{headers:{cookie:cookies[i]},signal:stop.signal});assert.equal(response.status,200);
  streams.push((async()=>{try{for await(const chunk of response.body){streamBytes+=chunk.length;streamFrames+=Buffer.from(chunk).toString().split('data: ').length-1;}}catch(e){if(!stop.signal.aborted)failures++;}})());
 }
 const before=await stats(),started=performance.now(),until=started+duration;streamBytes=0;streamFrames=0;
 const samples=[];let probing=false;const sampler=setInterval(async()=>{if(probing)return;probing=true;try{samples.push(await stats());}finally{probing=false;}},2000);
 await Promise.all(Array.from({length:40},async(_,i)=>{await sleep(i*15);let n=0;while(performance.now()<until){try{const paths=['/api/me',i%4===0?'/api/player/stocks':'/api/player/finance','/api/player/state?bootstrap=1'];const r=await request(i,paths[n++%paths.length]);latency.push(r.ms);httpBytes+=r.bytes;if(r.status!==200)failures++;}catch{failures++;}await sleep(2000);}}));
 clearInterval(sampler);while(probing)await sleep(5);const after=await stats(),elapsed=performance.now()-started;stop.abort();await Promise.all(streams);latency.sort((a,b)=>a-b);
 const report={label,registeredUsers:120,onlineUsers:40,sseConnections:80,ledgerRows:30000,durationSeconds:+(elapsed/1000).toFixed(2),requests:latency.length,errors:failures,p50Ms:+latency[Math.floor(latency.length*.5)].toFixed(2),p95Ms:+latency[Math.floor(latency.length*.95)].toFixed(2),maxMs:+latency.at(-1).toFixed(2),cpuOneCorePercent:+((after.cpu.user+after.cpu.system-before.cpu.user-before.cpu.system)/(elapsed*10)).toFixed(2),peakRssMiB:+(Math.max(before.rss,after.rss,...samples.map(x=>x.rss))/1048576).toFixed(2),eventLoopP99Ms:+Math.max(after.loopP99,...samples.map(x=>x.loopP99)).toFixed(2),streamMiB:+(streamBytes/1048576).toFixed(3),streamFrames,httpMiB:+(httpBytes/1048576).toFixed(3),runtime:process.version,platform:process.platform};
 console.log(JSON.stringify(report,null,2));
}finally{stop.abort();db?.close();if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});}
