import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:net';import {spawn} from 'node:child_process';import {randomBytes} from 'node:crypto';

test('two authenticated bar clients receive real presence, purchases and chat over SSE',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-bar-')),password=randomBytes(16).toString('hex'),controllers=[];
 const port=await new Promise(resolve=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});});
 const base='http://127.0.0.1:'+port,child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'bar-test-admin',BOOTSTRAP_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
 let errors='';child.stdout.resume();child.stderr.on('data',data=>errors+=data);
 t.after(async()=>{for(const controller of controllers)controller.abort();if(child.exitCode===null){const closed=new Promise(resolve=>child.once('exit',resolve));child.kill();await closed;}rmSync(folder,{recursive:true,force:true});});
 let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,errors);
 async function login(identifier){const response=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password})});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
 async function request(cookie,path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
 const admin=await login('bar-test-admin');for(const username of ['bar-one','bar-two'])assert.equal((await request(admin,'/api/admin/employees',{username,password,displayName:username,initialBalance:10000})).status,201);
 const first=await login('bar-one'),second=await login('bar-two');
 assert.equal((await fetch(base+'/api/player/bar')).status,401);
 const menu=(await request(first,'/api/player/bar')).data.menu;assert.equal(menu.length,18);assert.ok(menu.every(x=>x.price>=300&&x.price<=3000));
 async function stream(cookie){const controller=new AbortController();controllers.push(controller);const response=await fetch(base+'/api/player/bar/events',{headers:{cookie},signal:controller.signal});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  return {controller,async next(predicate){const timeout=setTimeout(()=>controller.abort(),4000);try{for(;;){let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const line=block.split('\n').find(x=>x.startsWith('data: '));if(line){const data=JSON.parse(line.slice(6));if(predicate(data))return data;}}const chunk=await reader.read();if(chunk.done)throw Error('SSE ended');buffer+=decoder.decode(chunk.value,{stream:true});}}finally{clearTimeout(timeout);}}};
 }
 const one=await stream(first);assert.equal((await one.next(x=>x.onlineCount===1)).onlineCount,1);
 const two=await stream(second);assert.equal((await one.next(x=>x.onlineCount===2)).onlineCount,2);
 const duplicate=await stream(first);assert.equal((await duplicate.next(x=>x.onlineCount===2)).onlineCount,2);
 const order=await request(second,'/api/player/bar/orders',{drinkId:menu[0].id,requestId:'http-bar-order-0001',price:0});assert.equal(order.status,200);assert.equal(order.data.balance,10000-menu[0].price);
 assert.ok((await one.next(x=>x.guests.some(y=>y.drink))).guests.some(x=>x.drink?.drinkId===menu[0].id));
 assert.equal((await request(second,'/api/player/bar/messages',{body:'另一位客人的真实消息'})).status,201);
 assert.ok((await one.next(x=>x.items.some(y=>y.body==='另一位客人的真实消息'))).items.some(x=>x.body==='另一位客人的真实消息'));
 assert.equal((await request(first,'/api/player/bar/messages',{body:'用实名发言',identityMode:'real',alias:'伪造名字'})).status,201);
 const realMessage=(await two.next(x=>x.items.some(y=>y.body==='用实名发言'))).items.find(x=>x.body==='用实名发言');assert.equal(realMessage.alias,'bar-one');assert.equal(realMessage.identityMode,'real');
 two.controller.abort();assert.equal((await one.next(x=>x.onlineCount===1)).onlineCount,1);
 assert.equal((await request(second,'/api/player/bar/orders',{drinkId:menu[0].id,requestId:'http-bar-order-0001'})).data.balance,order.data.balance);
});
