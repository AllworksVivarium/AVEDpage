import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {skyMultiplier,skySurvival} from '../server-sky-rules.mjs';
import {defaultEconomy} from '../server-economy.mjs';

test('broad bell-shaped safety distribution and accelerating payouts with 125% adventure return',()=>{
 const r=defaultEconomy().sky,total=r.ranges.reduce((n,x)=>n+x.weight,0);
 assert.equal(total,1000000);assert.equal(r.ranges[0].weight/total,.005);assert.equal(r.boardingSeconds,12);
 assert.ok(skyMultiplier(100,r)<1);assert.ok(skyMultiplier(200,r)<1);
 assert.ok(skySurvival(215,r.ranges)<1&&skySurvival(215,r.ranges)>.97);
 assert.equal(r.curve,'bell-v2');
 for(let d=280;d<1119;d++){
  const value=skyMultiplier(d,r)*skySurvival(d,r.ranges);assert.ok(Math.abs(value-1.25)<1e-10);
  const prize=Math.floor(1000000*skyMultiplier(d,r));assert.ok(Number.isSafeInteger(prize));
 }
 let previous=0;for(let d=100;d<1119;d++){const m=skyMultiplier(d,r);assert.ok(m>=previous);previous=m;}
 assert.ok(Math.abs(skyMultiplier(875,r)-30)<.01);
 assert.ok(skyMultiplier(950,r)>50&&skyMultiplier(1000,r)>skyMultiplier(950,r));
 assert.equal(skyMultiplier(1119,r),0,'zero-survival depths are not payable');
 assert.equal(skyMultiplier(950,{...r,curve:'bell-v1'}),50,'saved old flights keep their original ceiling');
 assert.ok(skyMultiplier(850,r)-skyMultiplier(700,r)>skyMultiplier(550,r)-skyMultiplier(400,r));
 assert.equal(skyMultiplier(300,{breakEvenDepth:207}),300/207,'old flights retain linear payouts');
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
 assert.equal(flight.breakEvenDepth,216);assert.equal(flight.landingMs,14000);
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
 assert.equal(prize,Math.floor(10000*skyMultiplier(opens[0].data.self.depth,opens[0].data.payoutRules)));
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
 await call(a,'start','POST',{round:next.round,bet:100});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM sky_companion_arrivals WHERE flight_id=?').get(next.round).n,0,'no companions before the final four seconds');
 db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()+3900,next.round);
 const waiting=(await call(a,'current')).data;
 assert.equal(waiting.phase,'BOARDING');assert.equal(waiting.passengers.length,1);
 const arrivals=db.prepare('SELECT * FROM sky_companion_arrivals WHERE flight_id=?').all(next.round);
 assert.equal(arrivals.length,1,'an eligible pool of one yields one companion');
 assert.ok(arrivals[0].board_at>=waiting.departAt-4000&&arrivals[0].board_at<waiting.departAt);
 assert.equal((await req(admin,'/api/admin/company-robots')).data.items[0].balance,10000,'planning does not spend funds');
 await call(a,'current');assert.deepEqual(db.prepare('SELECT * FROM sky_companion_arrivals WHERE flight_id=?').all(next.round),arrivals);
 db.prepare('UPDATE sky_companion_arrivals SET board_at=? WHERE flight_id=?').run(Date.now()-1,next.round);
 const boarding=(await call(a,'current')).data;
 assert.equal(boarding.phase,'BOARDING');assert.ok(boarding.passengers.some(p=>p.id===robot.id),'companion is visible in the helicopter before takeoff');
 const originalPlan=db.prepare('SELECT * FROM sky_robot_plans WHERE flight_id=?').get(next.round);
 assert.equal(originalPlan.jump_at,Math.round(boarding.departAt+(originalPlan.jump_depth-100)/boarding.speed*1000));
 const takeoff=Date.now()-1000;db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(takeoff,next.round);
 db.prepare('UPDATE sky_robot_plans SET jump_at=? WHERE flight_id=?').run(Math.round(takeoff+(originalPlan.jump_depth-100)/boarding.speed*1000),next.round);
 const allOpened=(await call(a,'jump','POST',{round:next.round})).data;assert.equal(allOpened.self.status,'landed');assert.equal(allOpened.phase,'DROPPING');assert.ok(!('safetyLine' in allOpened),'all cashouts must not reveal line early');
 const bot=allOpened.passengers.find(p=>p.isRobot);assert.equal(bot.id,robot.id);assert.equal(bot.alias,'陪玩测试员');assert.equal(bot.cost,1000);assert.ok(!('jump_depth' in bot));assert.ok(!('jump_at' in bot));assert.match(bot.avatar,/^\/assets\/avatar-pixel-/);assert.equal((await fetch(base+bot.avatar)).status,200);
 const planned=db.prepare('SELECT * FROM sky_robot_plans WHERE flight_id=?').get(next.round);assert.ok(Number.isSafeInteger(planned.jump_at));assert.equal(planned.jump_at,Math.round(allOpened.departAt+(planned.jump_depth-100)/allOpened.speed*1000));
 assert.equal((await req(admin,'/api/admin/company-robots')).data.items[0].balance,9000);
 await call(a,'current');assert.deepEqual(db.prepare('SELECT * FROM sky_robot_plans WHERE flight_id=?').get(next.round),planned);assert.equal(db.prepare('SELECT COUNT(*) n FROM sky_robot_plans WHERE flight_id=?').get(next.round).n,1);
 // Restart keeps the same persisted choice, including catch-up when nobody watches.
 await stop();db.prepare('UPDATE sky_robot_plans SET jump_depth=180,jump_at=? WHERE flight_id=?').run(Date.now()-500,next.round);db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()-4000,next.round);start();await ready();
 const resumed=(await call(a,'current')).data.passengers.find(p=>p.isRobot);assert.equal(resumed.status,'landed');assert.equal(resumed.prize,Math.floor(1000*skyMultiplier(180,defaultEconomy().sky)));
 await call(a,'current');assert.equal((await req(admin,'/api/admin/company-robots')).data.items[0].balance,9000+Math.floor(1000*skyMultiplier(180,defaultEconomy().sky)));
 assert.equal(db.prepare("SELECT COUNT(*) n FROM game_tickets WHERE employee_id=? AND game='sky'").get(robot.id).n,1);
 // A watched but empty flight does not create robot spending.
 db.prepare('UPDATE sky_flights SET ended_at=? WHERE id=?').run(Date.now()-1,next.round);const empty=(await call(a,'current')).data;
 db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(Date.now()-1,empty.round);assert.equal((await call(a,'current')).data.passengers.length,0);

 // A larger pool chooses one to three distinct companions in separate arrival slots.
 for(const codename of ['晚风','远山'])assert.equal((await req(admin,'/api/admin/company-robots','POST',{codename,balance:10000})).status,200);
 db.prepare('UPDATE sky_flights SET ended_at=? WHERE id=?').run(Date.now()-1,empty.round);
 const solo=(await call(a,'current')).data;
 await call(a,'start','POST',{round:solo.round,bet:100});
 const depart=Date.now()+3900;db.prepare('UPDATE sky_flights SET depart_at=? WHERE id=?').run(depart,solo.round);
 await call(a,'current');
 const chosen=db.prepare('SELECT * FROM sky_companion_arrivals WHERE flight_id=? ORDER BY board_at').all(solo.round);
 assert.ok(chosen.length>=1&&chosen.length<=3);assert.equal(new Set(chosen.map(x=>x.employee_id)).size,chosen.length);
 for(let i=0;i<chosen.length;i++){assert.ok(chosen[i].board_at>=depart-4000&&chosen[i].board_at<depart);if(i)assert.ok(chosen[i].board_at>chosen[i-1].board_at);}
 // Restart inside the boarding window retains precisely the scheduled employees.
 await stop();start();await ready();await call(a,'current');
 assert.deepEqual(db.prepare('SELECT * FROM sky_companion_arrivals WHERE flight_id=? ORDER BY board_at').all(solo.round),chosen);
 db.prepare('UPDATE sky_companion_arrivals SET board_at=? WHERE flight_id=?').run(Date.now()-1,solo.round);
 const withCompany=(await call(a,'current')).data;
 assert.equal(withCompany.phase,'BOARDING');assert.equal(withCompany.passengers.length,chosen.length+1);
 const spent=db.prepare("SELECT COUNT(*) n FROM balance_ledger WHERE reason=?").get('共享空投登机 #'+solo.round).n;
 await call(a,'current');assert.equal(db.prepare("SELECT COUNT(*) n FROM balance_ledger WHERE reason=?").get('共享空投登机 #'+solo.round).n,spent,'arrivals charge once');

});
