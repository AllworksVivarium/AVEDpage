import {proofRandom} from './server-economy.mjs';
import {MAX_SHARED_GAME_STAKE,validateGameStake} from './game-stake-limits.mjs';
import {randomInt} from 'node:crypto';
import {mediaReference} from './server-media.mjs';
import {robotAvatar} from './server-default-avatar.mjs';
import {animalRules,animalPlan,animalFrame,animalMotion,animalReturn} from './server-animal-race.mjs';

export function installDerby({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,highlights,companyRobots,gameTax,clock=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}) {
 db.exec(`CREATE TABLE IF NOT EXISTS derby_races(id INTEGER PRIMARY KEY,start_at INTEGER NOT NULL,finish_at INTEGER NOT NULL,next_at INTEGER NOT NULL,winner INTEGER NOT NULL,seed TEXT NOT NULL,seed_hash TEXT NOT NULL,settled INTEGER NOT NULL DEFAULT 0);`);
 if(!db.prepare('PRAGMA table_info(derby_races)').all().some(c=>c.name==='rules_json'))db.exec("ALTER TABLE derby_races ADD COLUMN rules_json TEXT NOT NULL DEFAULT ''");
 db.exec(`CREATE TABLE IF NOT EXISTS derby_wagers(race_id INTEGER NOT NULL REFERENCES derby_races(id),employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,market TEXT NOT NULL CHECK(market IN ('first','last')),runner INTEGER NOT NULL CHECK(runner BETWEEN 0 AND 4),cost INTEGER NOT NULL,prize INTEGER NOT NULL DEFAULT 0,settled INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(race_id,employee_id,market));
 CREATE INDEX IF NOT EXISTS derby_wagers_pending ON derby_wagers(race_id) WHERE settled=0;`);
 db.exec("CREATE INDEX IF NOT EXISTS derby_races_version ON derby_races((CASE WHEN json_valid(rules_json) THEN json_extract(rules_json,'$.version') END),id DESC)");
 let rulesJson,cachedRules;
 const raceRules=race=>{if(rulesJson!==race.rules_json){rulesJson=race.rules_json;cachedRules=JSON.parse(rulesJson);}return cachedRules;};
 const hasProfiles=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='profiles'").get();
 db.exec('CREATE TABLE IF NOT EXISTS derby_robot_checks(race_id INTEGER PRIMARY KEY)');
 function robotBets(race){
  if(!companyRobots||clock()>=race.start_at||db.prepare('SELECT 1 FROM derby_robot_checks WHERE race_id=?').get(race.id))return;
  tx(()=>{
   if(db.prepare('SELECT 1 FROM derby_robot_checks WHERE race_id=?').get(race.id))return;
   db.prepare('INSERT INTO derby_robot_checks VALUES(?)').run(race.id);
   const candidates=companyRobots.list().filter(p=>p.balance>=100),count=Math.min(candidates.length,randomInt(2,5));
   for(let i=0;i<count;i++){
    const [robot]=candidates.splice(randomInt(candidates.length),1),market=randomInt(2)?'first':'last',runner=randomInt(5),cost=100;
    if(balanceFor(robot.id)<cost)continue;
    recordLedger(robot.id,-cost,'下班竞速投入 #'+race.id+' 机器人陪玩');
    db.prepare('INSERT INTO derby_wagers(race_id,employee_id,market,runner,cost) VALUES(?,?,?,?,?)').run(race.id,robot.id,market,runner,cost);
   }
  });
 }
 function supporters(race){
  if(!hasProfiles)return [];
  return db.prepare("SELECT w.employee_id AS id,w.market,w.runner,p.anonymous_name AS name,p.avatar_url AS avatar FROM derby_wagers w LEFT JOIN profiles p ON p.employee_id=w.employee_id WHERE w.race_id=? ORDER BY w.employee_id,w.market").all(race.id).map(p=>({...p,name:p.name||'员工 '+p.id,avatar:p.avatar?mediaReference('avatar',p.id,p.avatar,64):robotAvatar(p.id)}));
 }
 let cachedSeed,cachedPlan;
 const planFor=race=>{if(cachedSeed!==race.seed){cachedSeed=race.seed;cachedPlan=animalPlan(race.seed);}return cachedPlan;};
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};
 function current(now=clock()) {
  let race=db.prepare("SELECT * FROM derby_races WHERE CASE WHEN json_valid(rules_json) THEN json_extract(rules_json,'$.version') END=2 ORDER BY id DESC LIMIT 1").get();
  if(race&&!race.settled&&now>=race.finish_at)tx(()=>{
   const config=raceRules(race),order=planFor(race).order;
   for(const b of db.prepare('SELECT * FROM derby_wagers WHERE race_id=? AND settled=0').all(race.id)) {
    const prize=animalReturn(b.cost,b.runner,b.market,order,config.returnPercent);
    const params=[prize,race.id,b.employee_id,b.market];
    if(!db.prepare('UPDATE derby_wagers SET settled=1,prize=? WHERE race_id=? AND employee_id=? AND settled=0 AND market=?').run(...params).changes)continue;
    if(prize)recordLedger(b.employee_id,prize,'下班竞速返还 #'+race.id+(b.market==='first'?' 第一名':' 最后一名'));
    db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(b.employee_id,'derby',b.cost,prize,race.seed,race.seed_hash,JSON.stringify({round:race.id,winner:race.winner,runner:b.runner,market:b.market,order}));
   }
   if(gameTax)for(const total of db.prepare('SELECT employee_id,SUM(cost) cost,SUM(prize) prize FROM derby_wagers WHERE race_id=? GROUP BY employee_id').all(race.id)){const tax=gameTax.charge({employeeId:total.employee_id,game:'derby',key:race.id+':'+race.seed_hash,cost:total.cost,prize:total.prize});if(tax){const ticket=db.prepare("SELECT id,result_json FROM game_tickets WHERE employee_id=? AND game='derby' AND json_extract(result_json,'$.round')=? ORDER BY prize DESC,id LIMIT 1").get(total.employee_id,race.id);const result=JSON.parse(ticket.result_json);result.tax=tax;db.prepare('UPDATE game_tickets SET result_json=? WHERE id=?').run(JSON.stringify(result),ticket.id);db.prepare('UPDATE derby_wagers SET prize=prize-? WHERE race_id=? AND employee_id=? AND market=?').run(tax,race.id,total.employee_id,result.market);}}
   db.prepare('UPDATE derby_races SET settled=1 WHERE id=?').run(race.id);race.settled=1;
  });
  if(!race||now>=race.next_at) {
   const proof=proofRandom(),winner=animalPlan(proof.seed).order[0];
   const row=db.prepare('INSERT INTO derby_races(start_at,finish_at,next_at,winner,seed,seed_hash,rules_json) VALUES(?,?,?,?,?,?,?)').run(now+animalRules.bettingMs,now+animalRules.bettingMs+animalRules.racingMs,now+animalRules.bettingMs+animalRules.racingMs+animalRules.resultMs,winner,proof.seed,proof.seedHash,JSON.stringify(animalRules));
   race=db.prepare('SELECT * FROM derby_races WHERE id=?').get(row.lastInsertRowid);
  }
  return race;
 }
 const streams=new Set();
 function sharedSnapshot(race) {
  robotBets(race);
  const now=clock(),phase=race.settled?'RESULT':now<race.start_at?'BETTING':'RACING',config=raceRules(race);
  {
   const plan=planFor(race),elapsed=(now-race.start_at)*25000/(race.finish_at-race.start_at),lookahead=phase==='RACING'?Math.min(now+1000,race.finish_at):now;
   const motion=animalMotion(plan,elapsed,(lookahead-race.start_at)*25000/(race.finish_at-race.start_at));
   const frame=animalFrame(plan,elapsed),next=animalFrame(plan,(lookahead-race.start_at)*25000/(race.finish_at-race.start_at));
   return {supporters:supporters(race),round:race.id,version:2,phase,serverTime:now,startAt:race.start_at,finishAt:race.finish_at,nextAt:race.next_at,frameAt:lookahead,seedHash:race.seed_hash,
    ...(race.settled?{seed:race.seed,winner:plan.order[0],last:plan.order.at(-1),order:plan.order}:{}),partialReturns:false,returnPercent:config.returnPercent,winProbabilities:[.2,.2,.2,.2,.2],
    runners:config.runners.map(({weight,...r})=>({...r,odds:config.returnPercent/20,...frame[r.id],motion:motion[r.id].map(p=>({...p,at:race.start_at+p.at*(race.finish_at-race.start_at)/25000})),place:frame[r.id].progress>=100?plan.order.indexOf(r.id)+1:null,nextProgress:next[r.id].progress,nextPose:next[r.id].pose,nextBoxProgress:next[r.id].boxProgress})),
    entrants:db.prepare('SELECT COUNT(DISTINCT employee_id) AS n FROM derby_wagers WHERE race_id=?').get(race.id).n};
  }
 }
 function snapshot(id,race=current(),shared=null,context=null){
  if(!shared)shared=sharedSnapshot(race);
  const bets=context?(context.bets.get(id)||[]):db.prepare('SELECT market,runner,cost,prize,settled FROM derby_wagers WHERE race_id=? AND employee_id=? ORDER BY market').all(race.id,id);
  const self=bets.find(b=>b.market==='first')||bets[0]||null;
  return {...shared,self,bets,balance:balanceFor(id),gameHighlight:context?.events?context.events.get(id)||null:highlights.roundEvent(id,'derby',race.id)};
 }
 function write(s,race,shared,context){if(s.res.destroyed||s.res.writableLength>262144){s.res.destroy();streams.delete(s);return;}s.res.write('data: '+JSON.stringify(snapshot(s.id,race,shared,context))+'\n\n');}
 let wakeTask=null,wakeAt=0,broadcastTask=null;
 function arm(race){const now=clock(),active=streams.size||db.prepare('SELECT 1 FROM derby_wagers WHERE settled=0 LIMIT 1').get(),next=!active?0:now<race.start_at?race.start_at:now<race.finish_at?race.finish_at:race.next_at;if(next===wakeAt)return;clearTimer(wakeTask);wakeAt=next;if(next){wakeTask=setTimer(()=>{wakeAt=0;try{broadcast();}catch(e){console.error('Race phase:',e.message);}},Math.max(1,next-now));wakeTask?.unref();}}
 function broadcast(){const race=current(),shared=sharedSnapshot(race),bets=new Map();if(streams.size)for(const row of db.prepare('SELECT employee_id,market,runner,cost,prize,settled FROM derby_wagers WHERE race_id=? ORDER BY market').all(race.id)){const {employee_id,...bet}=row;if(!bets.has(employee_id))bets.set(employee_id,[]);bets.get(employee_id).push(bet);}const context={bets,events:streams.size?highlights.roundEvents?.('derby',race.id):null};for(const s of streams)write(s,race,shared,context);arm(race);}
 function queueBroadcast(){if(broadcastTask)return;broadcastTask=setImmediate(()=>{broadcastTask=null;try{broadcast();}catch(e){console.error('Race update:',e.message);}});broadcastTask.unref();}
 const timer=setInterval(()=>{try{if(!streams.size&&!db.prepare('SELECT 1 FROM derby_wagers WHERE settled=0 LIMIT 1').get())return;broadcast();}catch(e){console.error('Shared derby:',e.message);}},1000);timer.unref();
 return {close(){clearInterval(timer);clearImmediate(broadcastTask);clearTimer(wakeTask);for(const s of streams)s.res.end();},async handle(req,res,url){
  if(!url.pathname.startsWith('/api/player/games/derby'))return false;const employee=requireEmployee(req,res);if(!employee)return true;
  try {
   const path=url.pathname;if(path==='/api/player/games/derby/current'&&req.method==='GET'){send(res,200,snapshot(employee.id));return true;}
   if(path==='/api/player/games/derby/stream'&&req.method==='GET') {
    for(const old of [...streams].filter(s=>s.id===employee.id).slice(0,-1)){old.res.end();streams.delete(old);}
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});const s={id:employee.id,res};streams.add(s);const race=current();write(s,race);arm(race);const auth=setInterval(()=>{if(!sessionEmployee(req))res.end();},15000);auth.unref();res.on('close',()=>{clearInterval(auth);streams.delete(s);});return true;
   }
   if(path==='/api/player/games/derby/bet'&&req.method==='POST') {
    const d=await readBody(req),receivedAt=clock(),race=current(receivedAt),config=raceRules(race),market=d.market??'first';tx(()=>{
     if(Number(d.round)!==race.id||receivedAt>=race.start_at)throw Error('本场已封盘，请等待下一场。');
     if(!['first','last'].includes(market))throw Error('本场不支持该竞猜位次。');
     if(!Number.isInteger(d.runner)||!config.runners[d.runner])throw Error('请选择有效选手。');
     validateGameStake(d.bet,MAX_SHARED_GAME_STAKE);
     const key=[race.id,employee.id,market];
     const existing=db.prepare('SELECT runner,cost FROM derby_wagers WHERE race_id=? AND employee_id=? AND market=?').get(...key);if(existing){if(existing.runner!==d.runner||existing.cost!==d.bet)throw Error('这个位次的委托已封存，不可更改。');return;}
     const committed=db.prepare('SELECT COALESCE(SUM(cost),0) AS total FROM derby_wagers WHERE race_id=? AND employee_id=?').get(race.id,employee.id).total;
     if(committed+d.bet>MAX_SHARED_GAME_STAKE)throw Error('本场第一名与最后一名合计最多投入 500,000。');
     if(balanceFor(employee.id)<d.bet)throw Error('余额不足。');recordLedger(employee.id,-d.bet,'下班竞速投入 #'+race.id+' '+(market==='first'?'第一名':'最后一名'));
     db.prepare('INSERT INTO derby_wagers(race_id,employee_id,market,runner,cost) VALUES(?,?,?,?,?)').run(race.id,employee.id,market,d.runner,d.bet);
    });send(res,200,snapshot(employee.id,race));queueBroadcast();return true;
   }
   send(res,409,{error:'赛场已改为共享场次，请刷新终端。'});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
