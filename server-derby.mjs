import {proofRandom} from './server-economy.mjs';
import {createHmac} from 'node:crypto';

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
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};
 function current(now=Date.now()) {
  let race=db.prepare('SELECT * FROM derby_races ORDER BY id DESC LIMIT 1').get();
  if(race&&!race.settled&&now>=race.finish_at)tx(()=>{
   for(const b of db.prepare('SELECT * FROM derby_bets WHERE race_id=? AND settled=0').all(race.id)) {
    // The race snapshot keeps already accepted bets on their original terms.
    const draw=()=>createHmac('sha256',Buffer.from(race.seed,'hex')).update('partial-return:'+b.employee_id).digest().readUInt32BE(0)/4294967296;
    const prize=derbyReturn(b.cost,b.runner,race.winner,draw,raceRules(race));
    if(!db.prepare('UPDATE derby_bets SET settled=1,prize=? WHERE race_id=? AND employee_id=? AND settled=0').run(prize,race.id,b.employee_id).changes)continue;
    if(prize)recordLedger(b.employee_id,prize,'联机赛马返还 #'+race.id);
    db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(b.employee_id,'derby',b.cost,prize,race.seed,race.seed_hash,JSON.stringify({round:race.id,winner:race.winner,runner:b.runner}));
   }
   db.prepare('UPDATE derby_races SET settled=1 WHERE id=?').run(race.id);race.settled=1;
  });
  if(!race||now>=race.next_at) {
   const proof=proofRandom(),r=proof.random();let total=0,winner=3;for(const x of runners){total+=x.weight;if(r<total){winner=x.id;break;}}
   const row=db.prepare('INSERT INTO derby_races(start_at,finish_at,next_at,winner,seed,seed_hash,rules_json) VALUES(?,?,?,?,?,?,?)').run(now+15000,now+33000,now+53000,winner,proof.seed,proof.seedHash,JSON.stringify({runners,partialReturns:true}));
   race=db.prepare('SELECT * FROM derby_races WHERE id=?').get(row.lastInsertRowid);
  }
  return race;
 }
 const streams=new Set();
 function snapshot(id,race=current()) {
  const now=Date.now(),phase=now<race.start_at?'BETTING':now<race.finish_at?'RACING':'RESULT',t=Math.max(0,Math.min(1,(now-race.start_at)/(race.finish_at-race.start_at))),config=raceRules(race);
  // Deterministic, shared trajectories. Never disclose the seed or future winner while betting/racing.
  const progress=config.runners.map(x=>{const noise=createHmac('sha256',race.seed).update('pace:'+x.id).digest().readUInt32BE(0)/4294967296;return Math.max(0,Math.min(100,t*100+(Math.sin(t*Math.PI*3+noise*6)-Math.sin(noise*6))*Math.sin(t*Math.PI)*8-(x.id===race.winner?0:3+noise*8)*t*t));});
  const self=db.prepare('SELECT runner,cost,prize,settled FROM derby_bets WHERE race_id=? AND employee_id=?').get(race.id,id)||null;
  const history=db.prepare('SELECT id,winner,seed,seed_hash AS seedHash FROM derby_races WHERE settled=1 ORDER BY id DESC LIMIT 6').all();
  return {round:race.id,gameHighlight:highlights.roundEvent(id,'derby',race.id),phase,serverTime:now,startAt:race.start_at,finishAt:race.finish_at,nextAt:race.next_at,seedHash:race.seed_hash,...(race.settled?{seed:race.seed,winner:race.winner}:{}),partialReturns:config.partialReturns,winProbabilities:config.runners.map(x=>x.weight),runners:config.runners.map(({weight,...x})=>({...x,progress:progress[x.id]})),self,balance:balanceFor(id),entrants:db.prepare('SELECT COUNT(*) AS n FROM derby_bets WHERE race_id=?').get(race.id).n,history};
 }
 function write(s,race){if(s.res.destroyed||s.res.writableLength>262144){s.res.destroy();streams.delete(s);return;}s.res.write('data: '+JSON.stringify(snapshot(s.id,race))+'\n\n');}
 const timer=setInterval(()=>{try{if(!streams.size&&!db.prepare('SELECT 1 FROM derby_bets WHERE settled=0 LIMIT 1').get())return;const race=current();for(const s of streams)write(s,race);}catch(e){console.error('Shared derby:',e.message);}},750);timer.unref();
 return {close(){clearInterval(timer);for(const s of streams)s.res.end();},async handle(req,res,url){
  if(!url.pathname.startsWith('/api/player/games/derby'))return false;const employee=requireEmployee(req,res);if(!employee)return true;
  try {
   const path=url.pathname;if(path==='/api/player/games/derby/current'&&req.method==='GET'){send(res,200,snapshot(employee.id));return true;}
   if(path==='/api/player/games/derby/stream'&&req.method==='GET') {
    for(const old of [...streams].filter(s=>s.id===employee.id).slice(0,-2)){old.res.end();streams.delete(old);}
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});const s={id:employee.id,res};streams.add(s);write(s,current());const auth=setInterval(()=>{if(!sessionEmployee(req))res.end();},15000);auth.unref();res.on('close',()=>{clearInterval(auth);streams.delete(s);});return true;
   }
   if(path==='/api/player/games/derby/bet'&&req.method==='POST') {
    const d=await readBody(req),race=current();tx(()=>{
     if(Number(d.round)!==race.id||Date.now()>=race.start_at)throw Error('本场已封盘，请等待下一场。');
     if(!Number.isInteger(d.runner)||!runners[d.runner]||!Number.isSafeInteger(d.bet)||d.bet<100||d.bet>1000000)throw Error('请选择跑道，投入为 100 至 1,000,000 的整数。');
     const existing=db.prepare('SELECT runner,cost FROM derby_bets WHERE race_id=? AND employee_id=?').get(race.id,employee.id);if(existing){if(existing.runner!==d.runner||existing.cost!==d.bet)throw Error('本场委托已封存，不可更改。');return;}
     if(balanceFor(employee.id)<d.bet)throw Error('余额不足。');recordLedger(employee.id,-d.bet,'联机赛马投入 #'+race.id);db.prepare('INSERT INTO derby_bets(race_id,employee_id,runner,cost) VALUES(?,?,?,?)').run(race.id,employee.id,d.runner,d.bet);
    });send(res,200,snapshot(employee.id,race));for(const s of streams)write(s,race);return true;
   }
   send(res,409,{error:'赛场已改为共享场次，请刷新终端。'});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
