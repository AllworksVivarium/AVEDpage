import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {installStatic} from '../server-static.mjs';
import {workGate,burstLimiter} from '../server-load-control.mjs';

test('static compression, conditional caching, HEAD, large streams and text-edit invalidation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'aved-static-'));let revision='one';
 await writeFile(join(dir,'index.html'),'<main>preview</main>');await writeFile(join(dir,'image.123456789abc.webp'),'image');await writeFile(join(dir,'app.js'),'// hello\n'.repeat(1000));await writeFile(join(dir,'big.woff2'),Buffer.alloc(2*1024*1024,7));
 const serve=installStatic({publicDir:dir,maxBytes:20000,design:{revision:()=>revision,render:async(_file,data)=>Buffer.concat([data,Buffer.from(revision)])}});
 const server=createServer((req,res)=>serve(req,res,req.url.slice(1)));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});});
 const first=await fetch(base+'/app.js',{headers:{'accept-encoding':'gzip'}});assert.equal(first.status,200);assert.equal(first.headers.get('content-encoding'),'gzip');assert.ok((await first.text()).endsWith('one'));
 const html=await fetch(base+'/index.html');assert.equal(html.headers.get('cache-control'),'no-cache');assert.equal((await fetch(base+'/index.html',{headers:{'if-none-match':html.headers.get('etag')}})).status,304);
 assert.match((await fetch(base+'/big.woff2')).headers.get('cache-control'),/max-age=3600/);
 assert.match((await fetch(base+'/image.123456789abc.webp')).headers.get('cache-control'),/immutable/);
 const etag=first.headers.get('etag');assert.equal((await fetch(base+'/app.js',{headers:{'if-none-match':etag}})).status,304);
 const head=await fetch(base+'/app.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const plain=await fetch(base+'/app.js',{headers:{'accept-encoding':'gzip;q=0'}});assert.equal(plain.headers.get('content-encoding'),null);
 revision='two';const edited=await fetch(base+'/app.js',{headers:{'if-none-match':etag}});assert.equal(edited.status,200);assert.notEqual(edited.headers.get('etag'),etag);assert.ok((await edited.text()).endsWith('two'));
 assert.equal((await (await fetch(base+'/big.woff2')).arrayBuffer()).byteLength,2*1024*1024);
 assert.equal((await fetch(base+'/app.js',{method:'POST'})).status,405);
});

test('bounded password queue releases slots on errors; action limits are per employee',async()=>{
 const gate=workGate({concurrency:1,maxWaiting:1});let release;
 const a=gate(()=>new Promise(r=>release=r));let called=false;const b=gate(()=>{called=true;throw Error('failed');});
 await assert.rejects(gate(()=>assert.fail('queue overflow')),e=>e.status===503);assert.equal(called,false);
 release();await a;await assert.rejects(b,/failed/);assert.equal(await gate(()=>42),42);
 let now=0;const limit=burstLimiter({limit:2,windowMs:1000,clock:()=>now});assert.equal(limit(1),0);assert.equal(limit(1),0);assert.equal(limit(1),1);assert.equal(limit(2),0);now=1001;assert.equal(limit(1),0);
});

test('concurrent GETs share one request; mutations are never coalesced or retried',async()=>{
 const ctx={setTimeout,clearTimeout,AbortController};vm.runInNewContext(await readFile(new URL('../public/http-client.js',import.meta.url),'utf8'),ctx);
 let requests=0,release;const http=ctx.AVEDHttp.create({fetchImpl:async()=>{requests++;await new Promise(r=>release=r);return {ok:true,status:200,json:async()=>({ok:true})};}});
 const a=http.request('/api/me'),b=http.request('/api/me');assert.equal(requests,1);release();await Promise.all([a,b]);
 let writes=0;const post=ctx.AVEDHttp.create({fetchImpl:async()=>{writes++;return {ok:true,status:200,json:async()=>({ok:true})};}});
 await Promise.all([post.request('/api/game',{method:'POST'}),post.request('/api/game',{method:'POST'})]);assert.equal(writes,2);
});

test('forged rewards, duplicate tickets, unfunded stock exposure and retired cards cannot mint balances',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'aved-safety-')),password=randomBytes(12).toString('hex');
 const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>r(n));});});
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',COOKIE_SECURE:'false',NODE_ENV:'production',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'safety',BOOTSTRAP_ADMIN_PASSWORD:password},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',x=>errors+=x);let db;
 t.after(async()=>{if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}db?.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,errors);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'safety',password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const req=async(path,body,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 db=new DatabaseSync(join(dir,'wanyehui.db'));const id=(await req('/api/me')).data.employee.id;
 await req('/api/checkin',{balance:999999999,reward:999999999});assert.equal((await req('/api/me')).data.balance,10000);
 const state=(await req('/api/player/state')).data,code=state.stocks[0].code;
 const news=(await req('/api/player/state?section=news')).data;assert.ok(news.announcements.length);assert.deepEqual(news.employees,[]);assert.deepEqual(news.dossiers,[]);assert.deepEqual(news.stocks,[]);assert.equal(news.market,null);
 const directory=(await req('/api/player/state?section=departments')).data;assert.ok(directory.employees.length);assert.ok(directory.departments.length);assert.deepEqual(directory.announcements,[]);
 assert.equal((await req('/api/player/state?section=unknown')).status,400);
 assert.equal((await req('/api/player/stocks',{code,action:'buy',quantity:10000,leverage:3,price:1,balance:999999999})).status,400);
 assert.equal((await req('/api/me')).data.balance,10000);assert.equal(db.prepare('SELECT count(*) n FROM stock_trades').get().n,0);
 for(const bet of [-100,1.5,Number.MAX_SAFE_INTEGER])assert.equal((await req('/api/player/games/slot',{bet,prize:999999999})).status,400);
 assert.equal((await req('/api/player/games/cards',{action:'start',winner:0,prize:20000})).status,410);
 const tier=state.economy.tiers[0],requestKey=randomUUID(),body={tier:tier.id,type:'three_match',cost:tier.cost,revision:state.economy.revision,requestKey,prize:999999999,totalPayout:999999999};
 const tickets=await Promise.all(Array.from({length:5},()=>req('/api/player/games/scratch',body)));assert.ok(tickets.every(x=>x.status===200),JSON.stringify(tickets));assert.equal(new Set(tickets.map(x=>x.data.ticketId)).size,1);
 const ticket=db.prepare('SELECT * FROM game_tickets WHERE employee_id=?').get(id);assert.equal(ticket.prize,tickets[0].data.prize);assert.notEqual(ticket.prize,body.prize);
 const actual=db.prepare('SELECT SUM(delta) balance FROM balance_ledger WHERE employee_id=?').get(id).balance;
 assert.equal((await req('/api/me')).data.balance,actual);assert.equal(db.prepare('SELECT balance FROM personal_metrics WHERE employee_id=?').get(id).balance,actual);
 assert.equal(db.prepare('SELECT count(*) n FROM game_tickets WHERE employee_id=?').get(id).n,1);
});

test('reference cache expires, isolates callers, clears on mutations, and never caches financial state',async()=>{
 let now=0,calls=0;class Clock extends Date{static now(){return now;}}
 const ctx={setTimeout,clearTimeout,AbortController,Date:Clock};vm.runInNewContext(await readFile(new URL('../public/http-client.js',import.meta.url),'utf8'),ctx);
 const http=ctx.AVEDHttp.create({fetchImpl:async()=>({ok:true,status:200,json:async()=>({n:++calls,nested:{value:1}})})});
 const a=await http.request('/api/player/directory');a.nested.value=99;
 assert.equal((await http.request('/api/player/directory')).nested.value,1);assert.equal(calls,1);
 now=30001;await http.request('/api/player/directory');assert.equal(calls,2);
 await http.request('/api/player/stocks');await http.request('/api/player/stocks');assert.equal(calls,4);
 await http.request('/api/me',{cacheTtlMs:99999});await http.request('/api/me',{cacheTtlMs:99999});assert.equal(calls,6);
 await http.request('/api/profile',{method:'PUT'});await http.request('/api/player/directory');assert.equal(calls,8);
 let release,referenceReads=0;const concurrent=ctx.AVEDHttp.create({fetchImpl:async(path)=>{if(path==='/api/player/directory'){referenceReads++;await new Promise(r=>release=r);}return {ok:true,status:200,json:async()=>({ok:true})};}});
 const read=concurrent.request('/api/player/directory');await concurrent.request('/api/logout',{method:'POST'});release();await read;
 const fresh=concurrent.request('/api/player/directory');release();await fresh;assert.equal(referenceReads,2,'a pre-logout read cannot populate the new session cache');
});

test('latency probes preserve reference caches while financial writes still invalidate them',async()=>{
 const ctx={setTimeout,clearTimeout,AbortController};vm.runInNewContext(await readFile(new URL('../public/http-client.js',import.meta.url),'utf8'),ctx);
 let reads=0;const http=ctx.AVEDHttp.create({fetchImpl:async path=>{if(path==='/api/player/directory')reads++;return {ok:true,status:200,json:async()=>({ok:true})};}});
 await http.request('/api/player/directory');for(const path of ['/api/player/games/sky/input-sync','/api/player/card-table/input-sync']){await http.request(path,{method:'POST'});await http.request('/api/player/directory');}assert.equal(reads,1);
 await http.request('/api/checkin',{method:'POST'});await http.request('/api/player/directory');assert.equal(reads,2);
});
