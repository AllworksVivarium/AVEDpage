import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {defaultEconomy} from '../server-economy.mjs';

test('sky pacing and risk curve: mean 400m, rare 150m, approximately 130% reference return',()=>{
 const r=defaultEconomy().sky,total=r.ranges.reduce((n,x)=>n+x.weight,0);
 const mean=r.ranges.reduce((n,x)=>n+(x.min+x.max)/2*x.weight,0)/total;
 assert.ok(Math.abs(mean-400)<1);assert.ok(r.ranges.every(x=>x.min>=150));
 assert.equal(r.ranges.filter(x=>x.min<180).reduce((n,x)=>n+x.weight,0)/total,.005);
 assert.equal(r.breakEvenDepth,207);assert.equal(r.boardingSeconds,12);
 // Count all crashes as zero. A line exactly at the planned depth reveals before a jump.
 const survival=d=>r.ranges.reduce((sum,x)=>sum+x.weight*Math.max(0,Math.min(1,(x.max-Math.max(d+1,x.min)+1)/(x.max-x.min+1))),0)/total;
 const returns=Array.from({length:1901},(_,i)=>(i+100)*survival(i+100)/r.breakEvenDepth);
 assert.ok(Math.abs(300*survival(300)/r.breakEvenDepth-1.3)<.005);
 assert.ok(Math.abs(Math.max(...returns)-1.3)<.001);

});

test('shared sky: sealed limit, independent cashouts, automatic crash, SSE chat and restart',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-sky-')),password=randomBytes(24).toString('hex');
 const port=await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const base='http://127.0.0.1:'+port,env={...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:randomBytes(32).toString('hex'),BOOTSTRAP_ADMIN_USERNAME:'sky-admin',BOOTSTRAP_ADMIN_PASSWORD:password};
 let child,db,errors='',streams=[];
 const start=()=>{child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','ignore','pipe']});child.stderr.on('data',x=>errors+=x);};
 const stop=async()=>{for(const s of streams)s.abort();streams=[];if(child?.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill();await end;}};
 t.after(async()=>{await stop();db?.close();assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
 const until=async(fn,ms=5000)=>{const deadline=Date.now()+ms;do{const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,40));}while(Date.now()<deadline);assert.fail('Timed out: '+errors);};
 const ready=()=>until(async()=>{try{return (await fetch(base+'/api/health')).ok;}catch{return false;}});
 const req=async(cookie,path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{cookie,origin:base,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const login=async name=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:name,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const stream=async(cookie,path)=>{const ctl=new AbortController();streams.push(ctl);const response=await fetch(base+path,{headers:{cookie},signal:ctl.signal});assert.equal(response.status,200);const items=[];(async()=>{let buffer='';try{for await(const chunk of response.body){buffer+=new TextDecoder().decode(chunk);let end;while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);if(event.startsWith('data: '))items.push(JSON.parse(event.slice(6)));}}}catch(e){if(e.name!=='AbortError')throw e;}})();return items;};
 start();await ready();const admin=await login('sky-admin');
 for(const name of ['pilot-a','pilot-b'])assert.equal((await req(admin,'/api/admin/employees','POST',{username:name,displayName:name,password,initialBalance:100000})).status,201);
 const robot=(await req(admin,'/api/admin/company-robots','POST',{codename:'陪玩测试员',balance:10000})).data;
 const a=await login('pilot-a'),b=await login('pilot-b'),call=(cookie,path,method,body)=>req(cookie,'/api/player/games/sky/'+path,method,body);
 db=new DatabaseSync(join(folder,'wanyehui.db'));
 const flight=(await call(a,'current')).data;
 assert.equal(flight.breakEvenDepth,207);assert.equal(flight.landingMs,14000);
 db.prepare('UPDATE sky_flights SET depart_at=?,safety_line=600 WHERE id=?').run(Date.now()+12000,flight.round);
 const flightA=await stream(a,'/api/player/games/sky/stream'),flightB=await stream(b,'/api/player/games/sky/stream');
 await until(()=>flightA.length&&flightB.length);
 for(const snapshot of [flightA[0],flightB[0]]){assert.equal(snapshot.round,flight.round);for(const key of ['safetyLine','revealedAt','seed'])assert.ok(!(key in snapshot),key+' leaked');}
 const board={round:flight.round,bet:10000};
 const joined=await Promise.all([call(a,'start','POST',board),call(b,'start','POST',board),call(a,'start','POST',board)]);assert.ok(joined.every(x=>x.status===200));
 await until(()=>flightB.some(x=>x.passengers.length===2));assert.equal((await call(a,'current')).data.balance,90000);assert.equal(db.prepare('SELECT COUNT(*) n FROM sky_passengers WHERE flight_id=?').get(flight.round).n,2);
 assert.equal((await call(a,'jump','POST',{round:flight.round})).status,400,'no cashout before takeoff');
 const chatA=await stream(a,'/api/player/chat/stream?room=sky'),chatB=await stream(b,'/api/player/chat/stream?room=sky');
 assert.equal((await req(a,'/api/player/chat','POST',{room:'sky',body:'全机舱都能看见这条弹幕'})).status,200);
 await until(()=>[chatA,chatB].every(events=>events.some(x=>x.items.some(m=>m.body==='全机舱都能看见这条弹幕'))));
 db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()-6000,flight.round);
 const opens=await Promise.all([call(a,'jump','POST',{round:flight.round}),call(a,'jump','POST',{round:flight.round})]);assert.ok(opens.every(x=>x.status===200));assert.equal(opens[0].data.self.status,'landed');
 const prize=opens[0].data.self.prize;assert.equal(opens[1].data.self.prize,prize);assert.equal(opens[1].data.balance,90000+prize);assert.ok(!('safetyLine' in opens[0].data));
 assert.equal(prize,Math.floor(10000*opens[0].data.self.depth/207));
 const earlyHistory=(await req(a,'/api/games/history')).data.items.find(x=>x.game==='sky');assert.ok(!('safetyLine' in JSON.parse(earlyHistory.result)),'cashout history must not leak the shared limit');
 await until(()=>flightB.some(x=>x.passengers.some(p=>p.status==='landed')));
 assert.equal((await call(b,'current')).data.self.status,'aboard');assert.equal((await call(a,'current')).data.passengers.filter(p=>p.isRobot).length,0,'two humans need no companion');
 assert.equal((await call(b,'jump','POST',{round:flight.round-1})).status,400);
 db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()-20500,flight.round);
 const revealed=(await call(b,'current')).data;assert.equal(revealed.phase,'LANDING');assert.equal(revealed.safetyLine,600);assert.equal(revealed.self.status,'crashed');assert.equal(revealed.self.prize,0);assert.ok(revealed.seed&&revealed.revealedAt);
 assert.equal(JSON.parse((await req(a,'/api/games/history')).data.items.find(x=>x.game==='sky').result).safetyLine,600);
 await until(()=>flightA.some(x=>x.phase==='LANDING'&&x.safetyLine===600&&x.passengers.some(p=>p.status==='crashed')));
 const repeated=(await call(b,'jump','POST',{round:flight.round})).data;assert.equal(repeated.balance,90000);assert.equal(repeated.self.status,'crashed');
 const count=()=>db.prepare("SELECT COUNT(*) n FROM game_tickets WHERE game='sky'").get().n;assert.equal(count(),2);
 await stop();start();await ready();const restored=(await call(a,'current')).data;assert.equal(restored.round,flight.round);assert.equal(restored.phase,'LANDING');assert.equal(restored.self.prize,prize);assert.equal(restored.balance,90000+prize);assert.equal(count(),2);
 db.prepare('UPDATE sky_flights SET ended_at=? WHERE id=?').run(Date.now()-1,flight.round);
 const next=(await call(a,'current')).data;assert.notEqual(next.round,flight.round);assert.equal(next.previous.safetyLine,600);assert.ok(!('safetyLine' in next));
 db.prepare('UPDATE sky_flights SET depart_at=?,safety_line=600 WHERE id=?').run(Date.now()+12000,next.round);
 await call(a,'start','POST',{round:next.round,bet:100});db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()-1000,next.round);
 const allOpened=(await call(a,'jump','POST',{round:next.round})).data;assert.equal(allOpened.self.status,'landed');assert.equal(allOpened.phase,'DROPPING');assert.ok(!('safetyLine' in allOpened),'all cashouts must not reveal line early');
 const bot=allOpened.passengers.find(p=>p.isRobot);assert.equal(bot.id,robot.id);assert.equal(bot.alias,'陪玩测试员');assert.equal(bot.cost,1000);assert.ok(!('jump_depth' in bot));assert.ok(!('jump_at' in bot));
 const planned=db.prepare('SELECT * FROM sky_robot_plans WHERE flight_id=?').get(next.round);assert.ok(Number.isSafeInteger(planned.jump_at));assert.equal(planned.jump_at,Math.round(allOpened.departAt+(planned.jump_depth-100)/allOpened.speed*1000));
 assert.equal((await req(admin,'/api/admin/company-robots')).data.items[0].balance,9000);
 await call(a,'current');assert.deepEqual(db.prepare('SELECT * FROM sky_robot_plans WHERE flight_id=?').get(next.round),planned);assert.equal(db.prepare('SELECT COUNT(*) n FROM sky_robot_plans WHERE flight_id=?').get(next.round).n,1);
 // Restart keeps the same persisted choice, including catch-up when nobody watches.
 await stop();db.prepare('UPDATE sky_robot_plans SET jump_depth=180,jump_at=? WHERE flight_id=?').run(Date.now()-500,next.round);db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()-4000,next.round);start();await ready();
 const resumed=(await call(a,'current')).data.passengers.find(p=>p.isRobot);assert.equal(resumed.status,'landed');assert.equal(resumed.prize,Math.floor(1000*180/207));
 await call(a,'current');assert.equal((await req(admin,'/api/admin/company-robots')).data.items[0].balance,9000+Math.floor(1000*180/207));
 assert.equal(db.prepare("SELECT COUNT(*) n FROM game_tickets WHERE employee_id=? AND game='sky'").get(robot.id).n,1);
 // A watched but empty flight does not create robot spending.
 db.prepare('UPDATE sky_flights SET ended_at=? WHERE id=?').run(Date.now()-1,next.round);const empty=(await call(a,'current')).data;
 db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()-1,empty.round);assert.equal((await call(a,'current')).data.passengers.length,0);

});
