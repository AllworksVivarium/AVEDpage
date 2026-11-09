import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {cardSettlement,installCardWallet} from '../server-card-wallet.mjs';
import {installCardTables,botTurn} from '../server-card-table.mjs';

test('card stakes are affordable; payouts conserve the pot plus a 25% system bonus',()=>{
 for(const size of [3,4])for(let landlord=0;landlord<size;landlord++)for(const winner of ['landlord','farmers'])for(const bid of [1,2,3])for(const multiplier of [1,2,4,8,16,32,64]){
  const r=cardSettlement(size,landlord,winner,bid,multiplier);
  assert.equal(r.players.reduce((s,p)=>s+p.stake,0),r.pot);
  assert.equal(r.players.reduce((s,p)=>s+p.reward,0),r.pot+r.bonus);
  assert.equal(r.players.reduce((s,p)=>s+p.net,0),r.bonus);
  for(const p of r.players){assert.ok(p.stake<=10000);assert.ok(p.release>=0);assert.ok(Number.isSafeInteger(p.release));}
 }
});

test('card money survives restart, settles once, rolls back errors and follows departing humans',async t=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,30000),(2,9999);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 CREATE TABLE ledger(employee_id INTEGER,delta INTEGER,reason TEXT);CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 const deps={db,readBody:async r=>r.body,requireEmployee:r=>({id:r.id,username:'test'}),sessionEmployee:()=>true,send:(r,status,data)=>Object.assign(r,{status,data}),balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,
 recordLedger:(id,delta,reason)=>{db.prepare('INSERT INTO ledger VALUES(?,?,?)').run(id,delta,reason);db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(delta,id);}};
 let service=installCardTables(deps);t.after(()=>{service.close();db.close();});
 const call=async(id,body)=>{const res={};await service.handle({id,method:body?'POST':'GET',body},res,new URL('http://test/api/player/card-table'));return res;};
 assert.equal((await call(2,{action:'solo',size:3})).status,400);
 db.exec("CREATE TRIGGER reject_money BEFORE INSERT ON ledger BEGIN SELECT RAISE(ABORT,'test failure'); END");
 assert.equal((await call(1,{action:'solo',size:3})).status,400);assert.equal(deps.balanceFor(1),30000);assert.equal(db.prepare('SELECT count(*) n FROM card_money_rounds').get().n,0);
 db.exec('DROP TRIGGER reject_money');
 const started=await call(1,{action:'solo',size:3,base:100});assert.equal(started.status,200);assert.equal(deps.balanceFor(1),20000);
 const id=started.data.room.id;service.close();
 const r=JSON.parse(db.prepare('SELECT state_json FROM card_table_rooms WHERE id=?').get(id).state_json);
 Object.assign(r.game,{phase:'playing',turn:0,landlord:0,bid:1,multiplier:1,last:null});r.game.hands[0]=[{id:999,val:3,label:'3',suit:'♠'}];r.game.plays[1]=1;
 db.prepare('UPDATE card_table_rooms SET state_json=? WHERE id=?').run(JSON.stringify(r),id);
 service=installCardTables(deps);let v=(await call(1)).data.room;assert.equal(v.money.round,started.data.room.money.round);
 const play={action:'play',cards:[999],room:id,revision:v.revision,requestId:randomUUID(),balance:999999,prize:999999};
 db.exec("CREATE TRIGGER reject_settle BEFORE INSERT ON ledger WHEN NEW.delta>0 BEGIN SELECT RAISE(ABORT,'settlement write failure'); END");
 assert.equal((await call(1,play)).status,400);assert.equal(deps.balanceFor(1),20000);assert.equal((await call(1)).data.room.phase,'playing');assert.equal(db.prepare('SELECT settlement_json FROM card_money_rounds').get().settlement_json,null);
 db.exec('DROP TRIGGER reject_settle');
 const finish=await call(1,play);assert.equal(finish.status,200);assert.equal(finish.data.room.money.settlement.stake,200);assert.equal(finish.data.room.money.settlement.reward,380);assert.equal(deps.balanceFor(1),30180);assert.equal(db.prepare('SELECT cost FROM game_tickets').get().cost,200);
 const rows=db.prepare('SELECT count(*) n FROM ledger').get().n;await call(1,play);assert.equal(db.prepare('SELECT count(*) n FROM ledger').get().n,rows);
 assert.equal(db.prepare('SELECT system_delta FROM card_money_rounds').get().system_delta,-180);
 await new Promise(resolve=>setTimeout(resolve,1200));
 assert.equal((await call(1)).data.room.phase,'ended','the timer never starts the next round');
 assert.equal(db.prepare('SELECT count(*) n FROM card_money_rounds').get().n,1);
 service.close();service=installCardTables(deps);v=(await call(1)).data.room;assert.equal(v.money.settlement.reward,380);assert.equal(deps.balanceFor(1),30180);
 let next=await call(1,{action:'start',room:id,revision:v.revision,requestId:randomUUID()});assert.equal(next.status,200);assert.equal(deps.balanceFor(1),20180);
 const round=next.data.room.money.round;
 await call(1,{action:'leave',room:id,revision:next.data.room.revision,requestId:randomUUID()});assert.equal((await call(1)).data.room,null);assert.equal(deps.balanceFor(1),20180);
 const kept=JSON.parse(db.prepare('SELECT state_json FROM card_table_rooms WHERE id=?').get(id).state_json);assert.equal(kept.seats[0].id,1);assert.equal(kept.seats[0].auto,true);assert.equal(kept.seats[0].detached,true);
 assert.equal(db.prepare('SELECT employee_id FROM card_money_seats WHERE round_id=? AND seat=0').get(round).employee_id,1);
 assert.equal((await call(1,{action:'solo',size:3})).status,400,'leaving cannot open parallel automated tables');
});

test('a computer never bids below the current bid',()=>{
 const g={phase:'bidding',turn:0,bid:2,hands:[[{val:15}]]};assert.equal(botTurn(g).bid,0);
});

test('solo humans have no deadline; explicitly enabled autoplay advances promptly across restart',async()=>{
 for(const size of [3,4])for(const phase of ['bidding','playing']){
  const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,100000);
   CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
   CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
  let now=1000000,advance;
  const deps={db,clock:()=>now,schedule:(fn,ms)=>{if(ms===350)advance=fn;return {unref(){}};},cancel:()=>{},readBody:async r=>r.body,requireEmployee:()=>({id:1}),sessionEmployee:()=>true,send:(r,status,data)=>Object.assign(r,{status,data}),balanceFor:()=>db.prepare('SELECT balance FROM employees WHERE id=1').get().balance,recordLedger:(_,delta)=>db.prepare('UPDATE employees SET balance=balance+? WHERE id=1').run(delta)};
  let service=installCardTables(deps);
  const call=async body=>{const res={};await service.handle({method:body?'POST':'GET',body},res,new URL('http://test/api/player/card-table'));assert.equal(res.status,200,JSON.stringify(res.data));return res.data.room;};
  try{
   let room=await call({action:'solo',size});
   if(phase==='playing')room=await call({action:'bid',bid:3,room:room.id,revision:room.revision,requestId:randomUUID()});
   assert.equal(room.deadline,0);const revision=room.revision;now+=90000;advance();
   assert.equal((await call()).revision,revision);assert.equal((await call()).seats[0].auto,false);
   service.close();service=installCardTables(deps);assert.equal((await call()).deadline,0);
   room=await call({action:'auto',room:room.id,revision:room.revision,requestId:randomUUID()});
   assert.equal(room.deadline-now,400);now=room.deadline;advance();assert.equal((await call()).revision,room.revision+1);
  }finally{service.close();db.close();}
 }
});

test('computer autoplay follows reduced winnings and half-loss rules without duplicate credits',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT); CREATE TABLE card_auto_limits(employee_id INTEGER PRIMARY KEY,streak INTEGER,cooldown_until INTEGER); INSERT INTO card_auto_limits VALUES(1,99,9999999999999);');
  let credits=0;const deps={db,balanceFor:()=>100000,recordLedger:(_,delta)=>credits+=delta};let wallet=installCardWallet(deps);
  function finish(manualPlay,winner='landlord',manualPass=false){
   const r={id:randomUUID(),size:3,seats:[{id:1},{id:-2,bot:true},{id:-3,bot:true}]};wallet.start(r);
   for(let i=0;i<10;i++)wallet.recordTurn(r,0,'play',true);
   if(manualPlay)wallet.recordTurn(r,0,'play',false);
   if(manualPass)wallet.recordTurn(r,0,'pass',false);
   r.game={phase:'ended',landlord:0,winner,bid:1,multiplier:1};wallet.settle(r);
   const before=credits;wallet.settle(r);assert.equal(credits,before,'settlement is idempotent');
   assert.doesNotThrow(()=>wallet.checkEntry(1));return r.money.settlement.players[0];
  }
  for(let i=0;i<4;i++){const p=finish(false);assert.equal(p.net,180);assert.equal(p.reward,380);assert.equal(p.bonus,0);assert.equal(p.autoOnly,true);}
  const manual=finish(true);assert.equal(manual.reward,380);assert.equal(manual.bonus,0);assert.equal(manual.net,180);assert.equal(manual.autoOnly,false);
  assert.equal(finish(false,'landlord',true).net,180,'manual participation is not required for normal winnings');
  const loss=finish(false,'farmers');assert.equal(loss.reward,100);assert.equal(loss.net,-100);
  wallet=installCardWallet(deps);assert.doesNotThrow(()=>wallet.checkEntry(1));assert.equal(finish(false).net,180);
  assert.equal(db.prepare('SELECT count(*) n FROM game_tickets').get().n,8);
 }finally{db.close();}
});

test('an old in-flight round retains its saved autoplay policy rather than rewriting historical payouts',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);');
  const wallet=installCardWallet({db,balanceFor:()=>100000,recordLedger(){}}),room={id:randomUUID(),size:3,base:100,seats:[{id:1},{id:-2,bot:true},{id:-3,bot:true}]};
  wallet.start(room);const saved={...room.money.rules,autoProfitPolicy:'manual-play-v1'};
  delete saved.computerReturns;delete saved.computerOnly;saved.bonusPercent=25;
  db.prepare('UPDATE card_money_rounds SET rules_json=? WHERE id=?').run(JSON.stringify(saved),room.money.round);
  room.game={phase:'ended',landlord:0,winner:'landlord',bid:1,multiplier:1};wallet.settle(room);
  assert.equal(room.money.settlement.players[0].net,0,'saved legacy policy is authoritative');
  assert.equal(room.money.settlement.players[0].bonus,0);
 }finally{db.close();}
});

test('computer settlements bound gains and losses for both roles and use the saved round rules',()=>{
 for(const size of [3,4])for(const humanSeat of [0,1])for(const won of [true,false]){
  const db=new DatabaseSync(':memory:');let balance=2000000;
  try{
   db.exec('CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);');
   const deps={db,balanceFor:()=>balance,recordLedger:(_,delta)=>{balance+=delta;}};
   let wallet=installCardWallet(deps);
   const room={id:randomUUID(),mode:'online',size,base:10000,seats:Array.from({length:size},(_,seat)=>({id:seat===humanSeat?1:-seat-1,bot:seat!==humanSeat}))};
   wallet.start(room);assert.equal(balance,1900000);
   assert.equal(room.money.rules.computerOnly,true);assert.equal(room.money.rules.bonusPercent,0);
   const winner=(humanSeat===0)===won?'landlord':'farmers';
   room.game={phase:'ended',landlord:0,winner,bid:3,multiplier:64};
   room.base=1000000;room.money.rules.computerReturns={winPercent:999999,lossPercent:100};
   wallet=installCardWallet(deps);wallet.settle(room);
   const p=room.money.settlement.players[humanSeat];
   assert.equal(p.reward,Math.floor(p.stake*(won?190:50)/100));
   assert.ok(p.net<=90000&&p.net>=-50000);assert.equal(p.bonus,0);
   assert.equal(balance,2000000+p.net);
   wallet.settle(room);assert.equal(balance,2000000+p.net);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n,1);
  }finally{db.close();}
 }
});

test('an existing round keeps its previous full reward after the computer rule update',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);');
  const wallet=installCardWallet({db,balanceFor:()=>100000,recordLedger(){}});
  const room={id:randomUUID(),size:3,base:100,seats:[{id:1},{id:-2,bot:true},{id:-3,bot:true}]};
  wallet.start(room);
  db.prepare('UPDATE card_money_rounds SET rules_json=? WHERE id=?').run(JSON.stringify({base:100,reserve:10000,bonusPercent:25,autoProfitPolicy:'normal-v2'}),room.money.round);
  room.game={phase:'ended',landlord:0,winner:'landlord',bid:1,multiplier:1};wallet.settle(room);
  assert.equal(room.money.settlement.players[0].reward,500);assert.equal(room.money.settlement.players[0].net,300);
 }finally{db.close();}
});
