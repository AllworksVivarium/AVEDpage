import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {installCardTables} from '../server-card-table.mjs';
import {installDerby} from '../server-derby.mjs';
import {animalPlan,animalMotion} from '../server-animal-race.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);
 INSERT INTO employees VALUES(1,100000),(2,100000),(3,100000),(4,100000);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 INSERT INTO profiles VALUES(1,'甲',''),(2,'乙',''),(3,'丙',''),(4,'丁','');
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const deps={db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:req=>({id:req.id}),sessionEmployee:()=>true,
 balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,
 recordLedger:(id,delta)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(delta,id),highlights:{roundEvent:()=>null}};
 return {db,deps};
}

test('spectators see public plays and each other, never private cards or money, and cannot act',async()=>{
 const {db,deps}=fixture(),service=installCardTables(deps);
 const call=async(id,body)=>{const res={};await service.handle({id,method:body?'POST':'GET',body},res,new URL('http://test/api/player/card-table'));return res;};
 try{
  assert.equal((await call(1,{action:'create',size:3,base:101.5})).status,400);
  let room=(await call(1,{action:'create',size:3,base:500})).data.room;
  assert.equal(room.base,500);
  assert.match(room.seats[0].avatar,/avatar-pixel-slate\./);
  db.prepare("UPDATE profiles SET avatar_preset='wine' WHERE employee_id=1").run();
  assert.match((await call(1)).data.room.seats[0].avatar,/avatar-pixel-wine\./,'existing seats refresh profile presets');
  assert.equal((await call(1,{action:'botLevel',level:'cheat'})).status,400);
  assert.equal((await call(1,{action:'botLevel',level:'easy'})).data.room.botLevel,'easy');
  room=(await call(1)).data.room;assert.equal(room.botLevel,'easy');
  const watched=await call(4,{action:'watch',roomId:room.id});
  assert.equal(watched.status,200);assert.equal(watched.data.room.spectating,true);
  assert.equal(watched.data.room.money,null);assert.deepEqual(watched.data.room.hand,[]);
  assert.equal(watched.data.room.spectators[0].name,'丁');assert.equal(deps.balanceFor(4),100000);
  assert.match(watched.data.room.spectators[0].avatar,/avatar-pixel-slate\./);
  db.prepare("UPDATE profiles SET avatar_preset='sand' WHERE employee_id=4").run();
  assert.match((await call(1)).data.room.spectators[0].avatar,/avatar-pixel-sand\./);
  db.prepare("UPDATE profiles SET avatar_url='data:image/png;base64,iVBORw0KGgo=' WHERE employee_id=4").run();
  assert.match((await call(1)).data.room.spectators[0].avatar,/^\/api\/media\/avatar\/4\?.*&size=64$/,'custom spectator avatars take priority');
  assert.equal((await call(4,{action:'start',room:room.id,revision:room.revision,requestId:randomUUID()})).status,400);
  room=(await call(1,{action:'start',fillBots:true,room:room.id,revision:room.revision,requestId:randomUUID()})).data.room;
  assert.equal(room.money.rules.base,500);
  assert.ok(room.seats.filter(p=>p?.bot).every(p=>/^\/assets\/avatar-pixel-/.test(p.avatar)));
  room=(await call(1,{action:'bid',bid:3,room:room.id,revision:room.revision,requestId:randomUUID()})).data.room;
  const played=room.hand[0];
  room=(await call(1,{action:'play',cards:[played.id],room:room.id,revision:room.revision,requestId:randomUUID()})).data.room;
  const view=(await call(4)).data.room;
  assert.deepEqual(view.hand,[]);assert.equal(view.last.cards[0].id,played.id);
  assert.ok(view.seats.every(p=>!p||!('hand' in p)));assert.equal(view.money,null);
  assert.equal((await call(4,{action:'unwatch'})).data.room,null);
  assert.equal((await call(1)).data.room.spectators.length,0);
 }finally{service.close();db.close();}
});

test('sleep interpolation is exactly stationary until wake, including transition snapshots',()=>{
 const window={},context={window};vm.runInNewContext(readFileSync(new URL('../public/derby-scene.js',import.meta.url),'utf8'),context);
 for(let i=0;i<50;i++){
  const plan=animalPlan(createHash('sha256').update('sleep-'+i).digest('hex'));
  for(const actor of plan.actors)for(const event of actor.events.filter(e=>e.pose==='sleep')){
   const from=event.at+event.duration-500,to=from+1000;
   const motion=animalMotion(plan,from,to)[actor.id],r={motion};
   const a=window.AVEDDerbyPosition(r,from+10,from,to),b=window.AVEDDerbyPosition(r,from+400,from,to),c=window.AVEDDerbyPosition(r,from+700,from,to);
   assert.equal(a.pose,'sleep');assert.equal(b.pose,'sleep');assert.equal(a.progress,b.progress);
   assert.equal(c.pose,'run');assert.ok(c.progress>b.progress);
   assert.ok(motion.every(p=>p.at>=from&&p.at<=to),'future trajectory is bounded to the public frame window');
  }
 }
});

test('race support is public without amounts; robot wagers debit once and settle through normal records',async()=>{
 const {db,deps}=fixture();deps.companyRobots={list:()=>[2,3].map(id=>({id,balance:deps.balanceFor(id)}))};
 const service=installDerby(deps);
 const call=async(body)=>{const res={};await service.handle({id:1,method:body?'POST':'GET',body},res,new URL('http://test/api/player/games/derby/'+(body?'bet':'current')));return res;};
 try{
  const race=(await call()).data;assert.equal(race.supporters.length,2);
  assert.equal(deps.balanceFor(2),99900);assert.equal(deps.balanceFor(3),99900);
  await call();assert.equal(deps.balanceFor(2),99900);
  assert.ok(race.supporters.every(p=>!('cost' in p)&&!('balance' in p)&&!('prize' in p)));
  const response=await call({round:race.round,runner:1,market:'last',bet:1000});assert.equal(response.status,200);
  assert.ok(response.data.supporters.some(p=>p.id===1&&p.runner===1&&p.market==='last'));
  db.prepare('UPDATE derby_races SET finish_at=?,next_at=? WHERE id=?').run(Date.now()-1,Date.now()+60000,race.round);
  await call();assert.equal(db.prepare('SELECT COUNT(*) n FROM derby_wagers WHERE settled=1').get().n,3);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n,3);
 }finally{service.close();db.close();}
});

test('solo autopilot matches easy opponents, and difficulty cannot change mid-round',async()=>{
 const {db,deps}=fixture();let now=1000000,tick;
 Object.assign(deps,{clock:()=>now,schedule:(fn,ms)=>{if(ms===350)tick=fn;return {unref(){}};},cancel:()=>{}});
 let service=installCardTables(deps);
 const call=async body=>{const res={};await service.handle({id:1,method:body?'POST':'GET',body},res,new URL('http://test/api/player/card-table'));return res;};
 try{
  const created=await call({action:'solo',size:3,botLevel:'easy'});assert.equal(created.data.room.botLevel,'easy');
  assert.equal((await call({action:'botLevel',level:'smart'})).status,400);
  service.close();
  function setTurn(seat){
   const r=JSON.parse(db.prepare('SELECT state_json FROM card_table_rooms').get().state_json);
   Object.assign(r.game,{phase:'playing',turn:seat,landlord:seat,bid:1,last:null,passes:0});
   r.game.hands[seat]=[3,3,3,3,4,5,6,7,8,9,14].map((val,id)=>({val,id:900+id,label:String(val),suit:'♠'}));
   r.seats[0].auto=true;r.deadline=now;
   db.prepare('UPDATE card_table_rooms SET state_json=?').run(JSON.stringify(r));
  }
  setTurn(0);service=installCardTables(deps);tick();
  let room=(await call()).data.room;assert.equal(room.seats[0].last.text.startsWith('四带二'),true,'human autopilot matches the easy opponent setting');
  service.close();setTurn(1);service=installCardTables(deps);tick();
  room=(await call()).data.room;assert.equal(room.seats[1].last.text.startsWith('四带二'),true,'computer opponent follows easy setting');
 }finally{service.close();db.close();}
});
