import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:net';import {spawn} from 'node:child_process';import {randomBytes} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {adDay} from '../server-ads.mjs';
test('advertising HTTP routes authenticate, protect private creatives and enforce admin refunds',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'aved-ads-http-')),password=randomBytes(16).toString('hex');
 const port=await new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});}),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'test',DATA_DIR:directory,HOST:'127.0.0.1',PORT:String(port),COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'ads-admin',BOOTSTRAP_ADMIN_PASSWORD:password},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);
 t.after(async()=>{if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}rmSync(directory,{recursive:true,force:true});});
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready,errors);
 const request=async(cookie,path,body,method=body?'POST':'GET')=>{const res=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 const login=async identifier=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const admin=await login('ads-admin');for(const username of ['ads-one','ads-two'])assert.equal((await request(admin,'/api/admin/employees',{username,password,displayName:username,initialBalance:2000000})).status,201);
 const one=await login('ads-one'),two=await login('ads-two');assert.equal((await request('','/api/player/ads/market')).status,401);assert.equal((await request(one,'/api/admin/ads')).status,403);
 const body={day:adDay(Date.now()+86400000),slot:'popup',amount:500000,title:'临时测试标题',body:'临时测试广告',signature:'独立署名',note:'测试',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',confirmed:true,requestId:'ads-http-request-0001'};
 // Use a genuine image produced by the existing decoder.
 const {default:sharp}=await import('sharp');body.image='data:image/png;base64,'+(await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer()).toString('base64');
 const placed=await request(one,'/api/player/ads/bids',body);assert.equal(placed.status,200);assert.equal(placed.data.balance,1500000);assert.equal(placed.data.bid.title,body.title);const id=placed.data.bid.id;
 assert.equal((await request(one,'/api/player/ads/bids',body)).data.balance,1500000);
 const future=await request(two,'/api/player/ads/market');assert.equal(future.data.slots[0].mine,false);assert.equal(future.data.mine.length,0);assert.doesNotMatch(JSON.stringify(future.data),/独立署名|临时测试广告|data:image/);
 assert.equal((await fetch(base+'/api/player/ads/images/'+id,{headers:{cookie:one}})).status,200);assert.equal((await fetch(base+'/api/player/ads/images/'+id,{headers:{cookie:two}})).status,404);
 assert.equal((await request(two,'/api/player/ads/bids/'+id,{body:'越权'},'PUT')).status,400);
 // Only the isolated test DB is advanced to the current delivery date.
 const db=new DatabaseSync(join(directory,'wanyehui.db'));db.prepare("UPDATE ad_bids SET day=?,status='won' WHERE id=?").run(adDay(Date.now()),id);db.close();
 const delivered=await request(two,'/api/player/ads/visit',{popup:true});assert.equal(delivered.data.popup.signature,'独立署名');assert.equal((await request(two,'/api/player/ads/visit',{popup:true})).data.popup,null);
 const paid=await request(two,'/api/player/ads/protection',{days:3,confirmed:true,requestId:'protection-http-0001'});assert.equal(paid.data.balance,1950000);assert.equal((await request(two,'/api/player/ads/visit',{popup:true})).data.popup,null);
 assert.equal((await request('','/api/player/ads/current')).status,401);
 assert.equal((await request('','/api/player/ads/protection/display',{showAds:true},'PUT')).status,401);
 const current=await request(two,'/api/player/ads/current');assert.equal(current.data.items[0].id,id);assert.equal('note' in current.data.items[0],false);
 const display=await request(two,'/api/player/ads/protection/display',{showAds:true},'PUT');assert.equal(display.data.showAds,true);assert.equal(display.data.balance,1950000);assert.equal(display.data.protectionUntil,paid.data.protectionUntil);
 assert.equal((await request(two,'/api/player/ads/protection/display',{showAds:1},'PUT')).status,400);
 await request(two,'/api/player/ads/protection/display',{showAds:false},'PUT');assert.equal((await request(two,'/api/player/ads/visit',{popup:true})).data.popup,null);
 const purchaseId='protection-http-queued-001',renewed=await request(two,'/api/player/ads/protection',{days:1,confirmed:true,requestId:purchaseId});
 assert.equal(renewed.data.protectionOrders.find(x=>x.id===purchaseId).canRefund,true);
 assert.equal((await request(one,'/api/player/ads/protection/refund',{purchaseId,confirmed:true})).status,400);
 const refunded=await Promise.all([request(two,'/api/player/ads/protection/refund',{purchaseId,confirmed:true}),request(two,'/api/player/ads/protection/refund',{purchaseId,confirmed:true})]);
 for(const r of refunded){assert.equal(r.status,200);assert.equal(r.data.balance,1940000);assert.equal(r.data.protectionUntil,paid.data.protectionUntil);assert.equal(r.data.refundAmount,10000);}
 assert.equal(refunded.filter(r=>r.data.replayed).length,1);
 const manage=await request(admin,'/api/admin/ads');assert.ok(manage.data.items.some(x=>x.id===id));assert.equal((await request(admin,'/api/admin/ads/'+id+'/remove',{reason:'测试撤下'})).status,200);assert.equal((await request(one,'/api/player/ads/market')).data.balance,2000000);assert.equal((await request(admin,'/api/admin/ads/'+id+'/remove',{reason:'重试'})).status,200);assert.equal((await request(one,'/api/player/ads/market')).data.balance,2000000);
});
