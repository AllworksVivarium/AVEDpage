import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
test('four real sessions, SSE privacy, duplicate/stale actions, reconnect and cached avatar derivatives',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-card-')),password=randomBytes(16).toString('hex');
 const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});const base='http://127.0.0.1:'+port;
 const env={...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'card-admin',BOOTSTRAP_ADMIN_PASSWORD:password};
 let child,errors='',db;const controllers=[];function start(){child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','ignore','pipe']});child.stderr.on('data',x=>errors+=x);}async function stop(){controllers.forEach(c=>c.abort());if(child?.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}}
 t.after(async()=>{await stop();db?.close();assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
 async function ready(){for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}assert.fail(errors);}
 const req=async(cookie,path,body)=>{const res=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 async function login(name){const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:name,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 const view=async c=>(await req(c,'/api/player/card-table')).data.room;
 async function action(c,body,override={}){const room=await view(c);return req(c,'/api/player/card-table',{room:room?.id,revision:room?.revision,requestId:randomUUID(),...body,...override});}
 start();await ready();const admin=await login('card-admin'),cookies=[];
 for(let i=0;i<4;i++){assert.equal((await req(admin,'/api/admin/employees',{username:'card-'+i,displayName:'牌桌测试'+i,password,initialBalance:25000})).status,201);cookies.push(await login('card-'+i));}
 assert.equal((await req('','/api/player/card-table')).status,401);
 assert.equal((await req('','/api/player/card-table/rooms')).status,401);
 let created=await action(cookies[0],{action:'create',size:4});assert.equal(created.status,200);const roomId=created.data.room.id;
 let directory=(await req(cookies[1],'/api/player/card-table/rooms')).data;
 assert.equal(directory.currentRoom,null);assert.equal(directory.items.length,1);
 assert.deepEqual(directory.items[0],{id:roomId,size:4,players:1,hostName:'匿名员工-2',phase:'waiting',base:1000,spectators:0,canWatch:true,canJoin:true,updatedAt:directory.items[0].updatedAt});
 assert.equal((await action(cookies[1],{action:'join',code:roomId})).status,400,'manual room-code matching is retired');
 assert.equal((await action(cookies[1],{action:'join',roomId:'not-a-listed-table'})).status,400);
 db=new DatabaseSync(join(folder,'wanyehui.db'));db.prepare("INSERT INTO balance_ledger(employee_id,delta,reason) SELECT id,20000,'test card funds' FROM employees WHERE username='card-admin'").run();
 const solo=await action(admin,{action:'solo',size:3});assert.equal(solo.status,200);
 assert.ok(!(await req(cookies[1],'/api/player/card-table/rooms')).data.items.some(x=>x.id===solo.data.room.id),'solo tables stay out of the public directory');
 await action(admin,{action:'leave'});
 for(let i=1;i<4;i++){assert.equal((await action(cookies[i],{action:'join',roomId})).status,200);await action(cookies[i],{action:'ready'});}
 assert.equal((await action(admin,{action:'join',roomId})).status,400);
 directory=(await req(cookies[1],'/api/player/card-table/rooms')).data;
 assert.equal(directory.items[0].players,4);assert.equal(directory.items[0].canJoin,false);assert.equal(directory.currentRoom.id,roomId);
 const ctl=new AbortController();controllers.push(ctl);const response=await fetch(base+'/api/player/card-table/stream',{headers:{cookie:cookies[1]},signal:ctl.signal});assert.equal(response.status,200);const reader=response.body.getReader();const initial=new TextDecoder().decode((await reader.read()).value);assert.ok(initial.includes(roomId));
 assert.equal((await action(cookies[1],{action:'start'})).status,400);assert.equal((await action(cookies[0],{action:'start'})).status,200);
 let v=await view(cookies[0]);assert.equal(v.hand.length,25);assert.equal(v.bottom.filter(Boolean).length,0);assert.ok(v.seats.every(s=>!('hand'in s)));
 const publicRoom=(await req(admin,'/api/player/card-table/rooms')).data.items[0];
 assert.equal(publicRoom.phase,'bidding');assert.equal(publicRoom.canJoin,false);
 for(const key of ['hand','hands','bottom','seats','receipts','host','game'])assert.ok(!(key in publicRoom),key+' must not leak through the directory');
 const bid={action:'bid',bid:3,room:v.id,revision:v.revision,requestId:randomUUID()};const first=await req(cookies[0],'/api/player/card-table',bid);assert.equal(first.status,200);const twice=await req(cookies[0],'/api/player/card-table',bid);assert.equal(twice.data.room.revision,first.data.room.revision);
 assert.equal(first.data.room.event.text,'太姥先出');assert.equal(first.data.room.hostName,'匿名员工-2');
 v=await view(cookies[0]);assert.equal(v.hand.length,33);assert.equal((await action(cookies[1],{action:'play',cards:[v.hand[0].id]})).status,400);
 const stale=await action(cookies[0],{action:'play',cards:[v.hand[0].id]},{revision:0});assert.equal(stale.status,409);
 assert.equal((await action(cookies[0],{action:'play',cards:[v.hand[0].id]})).status,200);
 await action(cookies[2],{action:'leave'});v=await view(cookies[0]);assert.equal(v.seats[2].auto,true);
 const balances=await Promise.all(cookies.map(c=>req(c,'/api/me')));assert.ok(balances.every(v=>v.data.balance===15000));
 const id=(await req(cookies[0],'/api/me')).data.employee.id;
 const png=await sharp({create:{width:800,height:800,channels:3,background:'#738b63'}}).png().toBuffer();
 const upload=await fetch(base+'/api/profile',{method:'PUT',headers:{cookie:cookies[0],origin:base,'content-type':'application/json'},body:JSON.stringify({anonymousName:'测试头像',bio:'',avatarUrl:'data:image/png;base64,'+png.toString('base64')})});assert.equal(upload.status,200);
 const original=db.prepare('SELECT avatar_url FROM profiles WHERE employee_id=?').get(id).avatar_url;assert.equal((await sharp(Buffer.from(original.split(',')[1],'base64')).metadata()).width,256);
 // Existing avatars are resized on first use, then served from the persisted cache.
 db.prepare('UPDATE profiles SET avatar_url=? WHERE employee_id=?').run('data:image/png;base64,'+png.toString('base64'),id);
 const url=base+'/api/media/avatar/'+id+'?size=64';const images=await Promise.all([fetch(url,{headers:{cookie:cookies[0]}}),fetch(url,{headers:{cookie:cookies[0]}})]);assert.ok(images.every(x=>x.status===200));const image=Buffer.from(await images[0].arrayBuffer());assert.equal((await sharp(image).metadata()).width,64);assert.ok(image.length<10000);assert.equal(db.prepare('SELECT count(*) AS n FROM avatar_thumbnails WHERE employee_id=?').get(id).n,1);
 assert.equal((await fetch(url,{headers:{cookie:cookies[0],'if-none-match':images[0].headers.get('etag')}})).status,304);assert.equal((await fetch(url)).status,401);
 const revision=(await view(cookies[0])).revision;await stop();start();await ready();const restored=await view(cookies[0]);assert.equal(restored.id,roomId);assert.equal(restored.revision,revision);assert.equal(restored.hand.length,32);
});
