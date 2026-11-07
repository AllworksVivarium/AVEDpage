import {proofRandom} from './server-economy.mjs';
import {createHmac} from 'node:crypto';
import {animalRules,animalPlan,animalFrame,animalReturn} from './server-animal-race.mjs';

const legacyRunners=[{id:0,name:'铁蹄',odds:2.2,weight:.44},{id:1,name:'夜行',odds:3.5,weight:.28},{id:2,name:'白噪',odds:5,weight:.17},{id:3,name:'红移',odds:8.5,weight:.11}];
export const runners=legacyRunners.map((r,i)=>({...r,odds:[2.2,3.4,5.54,8.5][i]}));
export function derbyReturn(cost,runner,winner,random,config={runners,partialReturns:true}){
 if(runner===winner)return Math.floor(cost*config.runners[runner].odds);
 if(!config.partialReturns)return 0;
 const roll=random();if(roll<.05)return 0;
 return Math.floor(cost*[5,10,15][Math.min(2,Math.floor((roll-.05)/.95*3))]/100);
}
const raceRules=race=>race.rules_json?JSON.parse(race.rules_json):{runners:legacyRunners,partialReturns:false};
export function installDerby({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,highlights}) {
 db.exec(`CREATE TABLE IF NOT EXISTS derby_races(id INTEGER PRIMARY KEY,start_at INTEGER NOT NULL,finish_at INTEGER NOT NULL,next_at INTEGER NOT NULL,winner INTEGER NOT NULL,seed TEXT NOT NULL,seed_hash TEXT NOT NULL,settled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS derby_bets(race_id INTEGER REFERENCES derby_races(id),employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,runner INTEGER NOT NULL,cost INTEGER NOT NULL,prize INTEGER NOT NULL DEFAULT 0,settled INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(race_id,employee_id));`);
 if(!db.prepare('PRAGMA table_info(derby_races)').all().some(c=>c.name==='rules_json'))db.exec("ALTER TABLE derby_races ADD COLUMN rules_json TEXT NOT NULL DEFAULT ''");
 db.exec(`CREATE TABLE IF NOT EXISTS derby_wagers(race_id INTEGER NOT NULL REFERENCES derby_races(id),employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,market TEXT NOT NULL CHECK(market IN ('first','last')),runner INTEGER NOT NULL CHECK(runner BETWEEN 0 AND 4),cost INTEGER NOT NULL,prize INTEGER NOT NULL DEFAULT 0,settled INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(race_id,employee_id,market));
 CREATE INDEX IF NOT EXISTS derby_wagers_pending ON derby_wagers(race_id) WHERE settled=0;`);
 let cachedSeed,cachedPlan;
 const planFor=race=>{if(cachedSeed!==race.seed){cachedSeed=race.seed;cachedPlan=animalPlan(race.seed);}return cachedPlan;};
 const wagersTable=race=>raceRules(race).version===2?'derby_wagers':'derby_bets';
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};
 function current(now=Date.now()) {
  let race=db.prepare('SELECT * FROM derby_races ORDER BY id DESC LIMIT 1').get();
  if(race&&!race.settled&&now>=race.finish_at)tx(()=>{
   const config=raceRules(race),modern=config.version===2,table=wagersTable(race),order=modern?planFor(race).order:null;
   for(const b of db.prepare(`SELECT * FROM ${table} WHERE race_id=? AND settled=0`).all(race.id)) {
    // Old accepted tickets retain their original rules; new markets settle independently.
    const draw=()=>createHmac('sha256',Buffer.from(race.seed,'hex')).update('partial-return:'+b.employee_id).digest().readUInt32BE(0)/4294967296;
    const prize=modern?animalReturn(b.cost,b.runner,b.market,order,config.returnPercent||102):derbyReturn(b.cost,b.runner,race.winner,draw,config);
    const params=[prize,race.id,b.employee_id];if(modern)params.push(b.market);
    if(!db.prepare(`UPDATE ${table} SET settled=1,prize=? WHERE race_id=? AND employee_id=? AND settled=0${modern?' AND market=?':''}`).run(...params).changes)continue;
    if(prize)recordLedger(b.employee_id,prize,'下班竞速返还 #'+race.id+(modern?(b.market==='first'?' 第一名':' 最后一名'):''));
    db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(b.employee_id,'derby',b.cost,prize,race.seed,race.seed_hash,JSON.stringify({round:race.id,winner:race.winner,runner:b.runner,...(modern?{market:b.market,order}:{})}));
   }
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
  const now=Date.now(),phase=now<race.start_at?'BETTING':now<race.finish_at?'RACING':'RESULT',t=Math.max(0,Math.min(1,(now-race.start_at)/(race.finish_at-race.start_at))),config=raceRules(race);
  if(config.version===2){
   const plan=planFor(race),elapsed=(now-race.start_at)*25000/(race.finish_at-race.start_at),lookahead=phase==='RACING'?Math.min(now+1000,race.finish_at):now;
   const frame=animalFrame(plan,elapsed),next=animalFrame(plan,(lookahead-race.start_at)*25000/(race.finish_at-race.start_at));
   return {round:race.id,version:2,phase,serverTime:now,startAt:race.start_at,finishAt:race.finish_at,nextAt:race.next_at,frameAt:lookahead,seedHash:race.seed_hash,
    ...(race.settled?{seed:race.seed,winner:plan.order[0],last:plan.order.at(-1),order:plan.order}:{}),partialReturns:false,returnPercent:config.returnPercent||102,winProbabilities:[.2,.2,.2,.2,.2],
    runners:config.runners.map(({weight,...r})=>({...r,odds:(config.returnPercent||102)/20,...frame[r.id],place:frame[r.id].progress>=100?plan.order.indexOf(r.id)+1:null,nextProgress:next[r.id].progress,nextPose:next[r.id].pose,nextBoxProgress:next[r.id].boxProgress})),
    entrants:db.prepare('SELECT COUNT(DISTINCT employee_id) AS n FROM derby_wagers WHERE race_id=?').get(race.id).n};
  }
  // Deterministic, shared trajectories. Never disclose the seed or future winner while betting/racing.
  const progress=config.runners.map(x=>{const noise=createHmac('sha256',race.seed).update('pace:'+x.id).digest().readUInt32BE(0)/4294967296;return Math.max(0,Math.min(100,t*100+(Math.sin(t*Math.PI*3+noise*6)-Math.sin(noise*6))*Math.sin(t*Math.PI)*8-(x.id===race.winner?0:3+noise*8)*t*t));});
  const history=db.prepare('SELECT id,winner,seed,seed_hash AS seedHash FROM derby_races WHERE settled=1 ORDER BY id DESC LIMIT 6').all();
  return {round:race.id,phase,serverTime:now,startAt:race.start_at,finishAt:race.finish_at,nextAt:race.next_at,seedHash:race.seed_hash,...(race.settled?{seed:race.seed,winner:race.winner}:{}),partialReturns:config.partialReturns,winProbabilities:config.runners.map(x=>x.weight),runners:config.runners.map(({weight,...x})=>({...x,progress:progress[x.id]})),entrants:db.prepare('SELECT COUNT(*) AS n FROM derby_bets WHERE race_id=?').get(race.id).n,history};
 }
 function snapshot(id,race=current(),shared=sharedSnapshot(race)){
  const modern=shared.version===2,bets=modern?db.prepare('SELECT market,runner,cost,prize,settled FROM derby_wagers WHERE race_id=? AND employee_id=? ORDER BY market').all(race.id,id):[];
  const self=modern?(bets.find(b=>b.market==='first')||bets[0]||null):db.prepare('SELECT runner,cost,prize,settled FROM derby_bets WHERE race_id=? AND employee_id=?').get(race.id,id)||null;
  return {...shared,self,bets:modern?bets:self?[{...self,market:'first'}]:[],balance:balanceFor(id),gameHighlight:highlights.roundEvent(id,'derby',race.id)};
 }
 function write(s,race,shared){if(s.res.destroyed||s.res.writableLength>262144){s.res.destroy();streams.delete(s);return;}s.res.write('data: '+JSON.stringify(snapshot(s.id,race,shared))+'\n\n');}
 const timer=setInterval(()=>{try{if(!streams.size&&!db.prepare('SELECT 1 FROM derby_bets WHERE settled=0 UNION ALL SELECT 1 FROM derby_wagers WHERE settled=0 LIMIT 1').get())return;const race=current(),shared=sharedSnapshot(race);for(const s of streams)write(s,race,shared);}catch(e){console.error('Shared derby:',e.message);}},1000);timer.unref();
 return {close(){clearInterval(timer);for(const s of streams)s.res.end();},async handle(req,res,url){
  if(!url.pathname.startsWith('/api/player/games/derby'))return false;const employee=requireEmployee(req,res);if(!employee)return true;
  try {
   const path=url.pathname;if(path==='/api/player/games/derby/current'&&req.method==='GET'){send(res,200,snapshot(employee.id));return true;}
   if(path==='/api/player/games/derby/stream'&&req.method==='GET') {
    for(const old of [...streams].filter(s=>s.id===employee.id).slice(0,-1)){old.res.end();streams.delete(old);}
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});const s={id:employee.id,res};streams.add(s);write(s,current());const auth=setInterval(()=>{if(!sessionEmployee(req))res.end();},15000);auth.unref();res.on('close',()=>{clearInterval(auth);streams.delete(s);});return true;
   }
   if(path==='/api/player/games/derby/bet'&&req.method==='POST') {
    const d=await readBody(req),race=current(),config=raceRules(race),modern=config.version===2,market=d.market??'first',table=wagersTable(race);tx(()=>{
     if(Number(d.round)!==race.id||Date.now()>=race.start_at)throw Error('本场已封盘，请等待下一场。');
     if(!['first','last'].includes(market)||!modern&&market!=='first')throw Error('本场不支持该竞猜位次。');
     if(!Number.isInteger(d.runner)||!config.runners[d.runner]||!Number.isSafeInteger(d.bet)||d.bet<100||d.bet>1000000)throw Error('请选择选手，投入为 100 至 1,000,000 的整数。');
     const key=[race.id,employee.id];if(modern)key.push(market);
     const existing=db.prepare(`SELECT runner,cost FROM ${table} WHERE race_id=? AND employee_id=?${modern?' AND market=?':''}`).get(...key);if(existing){if(existing.runner!==d.runner||existing.cost!==d.bet)throw Error('这个位次的委托已封存，不可更改。');return;}
     if(balanceFor(employee.id)<d.bet)throw Error('余额不足。');recordLedger(employee.id,-d.bet,'下班竞速投入 #'+race.id+' '+(market==='first'?'第一名':'最后一名'));
     if(modern)db.prepare('INSERT INTO derby_wagers(race_id,employee_id,market,runner,cost) VALUES(?,?,?,?,?)').run(race.id,employee.id,market,d.runner,d.bet);
     else db.prepare('INSERT INTO derby_bets(race_id,employee_id,runner,cost) VALUES(?,?,?,?)').run(race.id,employee.id,d.runner,d.bet);
    });send(res,200,snapshot(employee.id,race));const shared=sharedSnapshot(race);for(const s of streams)write(s,race,shared);return true;
   }
   send(res,409,{error:'赛场已改为共享场次，请刷新终端。'});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
