import {proofRandom,weighted} from './server-economy.mjs';
import {mediaReference} from './server-media.mjs';

export function installSky({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,economy}){
 db.exec(`CREATE TABLE IF NOT EXISTS sky_flights(id INTEGER PRIMARY KEY,depart_at INTEGER NOT NULL,ended_at INTEGER NOT NULL DEFAULT 0,safety_line INTEGER NOT NULL,seed TEXT NOT NULL,seed_hash TEXT NOT NULL,rules_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sky_passengers(flight_id INTEGER NOT NULL REFERENCES sky_flights(id),employee_id INTEGER NOT NULL REFERENCES employees(id),cost INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'aboard',depth INTEGER NOT NULL DEFAULT 0,prize INTEGER NOT NULL DEFAULT 0,settled_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(flight_id,employee_id));`);
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 // Retire outstanding individual flights with a refund when moving to shared flights.
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='shared-sky'").get())tx(()=>{for(const row of db.prepare("SELECT id,employee_id,state_json FROM player_rounds WHERE game='sky'").all()){const s=JSON.parse(row.state_json);if(!s.settled){recordLedger(row.employee_id,s.cost,'旧架次撤回');s.settled=true;s.prize=s.cost;s.migrated=true;db.prepare('UPDATE player_rounds SET state_json=? WHERE id=?').run(JSON.stringify(s),row.id);}}db.prepare("INSERT INTO economy_migrations VALUES('shared-sky')").run();});
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='sky-settlement-v2'").get())tx(()=>{for(const p of db.prepare("SELECT s.*,f.seed,f.seed_hash FROM sky_passengers s JOIN sky_flights f ON f.id=s.flight_id WHERE s.status='aboard'").all()){recordLedger(p.employee_id,p.cost,'架次维护退回');db.prepare("UPDATE sky_passengers SET status='cancelled',prize=cost,settled_at=? WHERE flight_id=? AND employee_id=?").run(Date.now(),p.flight_id,p.employee_id);db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(p.employee_id,'sky',p.cost,p.cost,p.seed,p.seed_hash,JSON.stringify({flight:p.flight_id,cancelled:true}));}db.prepare("INSERT INTO economy_migrations VALUES('sky-settlement-v2')").run();});
 const streams=new Set();
 const rules=f=>JSON.parse(f.rules_json);
 const depth=(f,now=Date.now())=>Math.min(2000,Math.max(100,Math.floor(100+Math.max(0,now-f.depart_at)*rules(f).speed/1000)));
 function finish(f,p,atDepth,now,expired=false){
  if(p.status!=='aboard')return;
  const safe=!expired&&atDepth<=f.safety_line,prize=safe?Math.floor(p.cost*atDepth/200):Math.floor(p.cost*(1-rules(f).lossFraction));
  const changed=db.prepare("UPDATE sky_passengers SET status=?,depth=?,prize=?,settled_at=? WHERE flight_id=? AND employee_id=? AND status='aboard'").run(safe?'landed':'crashed',atDepth,prize,now,f.id,p.employee_id).changes;
  if(!changed)return;if(prize)recordLedger(p.employee_id,prize,safe?'空投开伞返还':'空投损失结余');
  db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(p.employee_id,'sky',p.cost,prize,f.seed,f.seed_hash,JSON.stringify({flight:f.id,depth:atDepth,safetyLine:f.safety_line,safe,expired}));
 }
 function current(now=Date.now()){
  let f=db.prepare('SELECT * FROM sky_flights ORDER BY id DESC LIMIT 1').get();
  if(f&&!f.ended_at&&now>=f.depart_at){const passengers=db.prepare('SELECT * FROM sky_passengers WHERE flight_id=?').all(f.id),d=depth(f,now);if(now>=f.depart_at+1901/rules(f).speed*1000||passengers.every(p=>p.status!=='aboard'))tx(()=>{for(const p of passengers)finish(f,p,d,now,true);const landedAt=now+(passengers.length?3200:0);db.prepare('UPDATE sky_flights SET ended_at=? WHERE id=? AND ended_at=0').run(landedAt,f.id);f={...f,ended_at:landedAt};});}
  if(!f||f.ended_at&&now>=f.ended_at){const p=proofRandom(),s=economy.get().sky,range=weighted(s.ranges,p.random),line=range.min+Math.floor(p.random()*(range.max-range.min+1));const row=db.prepare('INSERT INTO sky_flights(depart_at,safety_line,seed,seed_hash,rules_json) VALUES(?,?,?,?,?)').run(now+s.boardingSeconds*1000,line,p.seed,p.seedHash,JSON.stringify(s));f=db.prepare('SELECT * FROM sky_flights WHERE id=?').get(row.lastInsertRowid);}
  return f;
 }
 function snapshot(id,f=current()){
  const now=Date.now(),phase=f.ended_at?'LANDING':now<f.depart_at?'BOARDING':'DROPPING';
  const passengers=db.prepare(`SELECT s.employee_id AS id,p.anonymous_name AS alias,p.avatar_url AS avatar,s.cost,s.status,s.depth,s.prize,s.settled_at AS settledAt FROM sky_passengers s JOIN profiles p ON p.employee_id=s.employee_id WHERE s.flight_id=? ORDER BY s.rowid`).all(f.id).map(p=>({...p,avatar:mediaReference('avatar',p.id,p.avatar)}));
  const prior=db.prepare('SELECT * FROM sky_flights WHERE id<? AND ended_at>0 AND ended_at<=? ORDER BY id DESC LIMIT 1').get(f.id,now);
  let previous=null;if(prior){const mine=db.prepare('SELECT status,cost,depth,prize FROM sky_passengers WHERE flight_id=? AND employee_id=?').get(prior.id,id);previous={round:prior.id,safetyLine:prior.safety_line,seed:prior.seed,seedHash:prior.seed_hash,self:mine||null};}
  return {round:f.id,phase,departAt:f.depart_at,endedAt:f.ended_at,serverTime:now,depth:depth(f,f.ended_at?f.ended_at-3200:now),speed:rules(f).speed,boardingSeconds:rules(f).boardingSeconds,expectedSafety:rules(f).ranges.reduce((sum,x)=>sum+(x.min+x.max)/2*x.weight,0)/rules(f).ranges.reduce((sum,x)=>sum+x.weight,0),lossFraction:rules(f).lossFraction,remaining:Math.max(0,Math.ceil((f.depart_at-now)/1000)),seedHash:f.seed_hash,passengers,self:passengers.find(p=>p.id===id)||null,balance:balanceFor(id),previous};
 }
 function write(stream,f){if(stream.res.destroyed||stream.res.writableLength>262144){stream.res.destroy();streams.delete(stream);return;}stream.res.write('data: '+JSON.stringify(snapshot(stream.id,f))+'\n\n');}
 function broadcast(){const f=current();for(const s of streams)write(s,f);}
 const timer=setInterval(()=>{try{broadcast();}catch(e){console.error('Shared flight:',e.message);}},500);timer.unref();
 return {close(){clearInterval(timer);for(const s of streams)s.res.end();streams.clear();},async handle(req,res,url){if(!url.pathname.startsWith('/api/player/games/sky/'))return false;const actor=requireEmployee(req,res);if(!actor)return true;try{
  const path=url.pathname;
  if(path.endsWith('/stream')&&req.method==='GET'){
   for(const old of [...streams].filter(x=>x.id===actor.id).slice(0,-2)){old.res.end();streams.delete(old);}
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});const stream={id:actor.id,res};streams.add(stream);write(stream,current());
   const authTimer=setInterval(()=>{if(!sessionEmployee(req)){res.end();streams.delete(stream);}},15000);authTimer.unref();res.on('close',()=>{clearInterval(authTimer);streams.delete(stream);});return true;
  }
  if(path.endsWith('/current')&&req.method==='GET'){send(res,200,snapshot(actor.id));return true;}
  if(req.method!=='POST'||!['/api/player/games/sky/start','/api/player/games/sky/jump'].includes(path)){send(res,405,{error:'架次指令无效。'});return true;}
  const data=await readBody(req);let f=current();
  tx(()=>{const now=Date.now();f=db.prepare('SELECT * FROM sky_flights WHERE id=?').get(f.id);const p=db.prepare('SELECT * FROM sky_passengers WHERE flight_id=? AND employee_id=?').get(f.id,actor.id);
   if(path.endsWith('/start')){if(f.ended_at||now>=f.depart_at)throw Error('舱门已关闭，请等待下一架次。');if(data.round!=null&&Number(data.round)!==f.id)throw Error('架次已变更，请重新登机。');if(p)return;const cost=data.bet;if(!Number.isSafeInteger(cost)||cost<100||cost>1000000)throw Error('登机投入应为 100 至 1,000,000。');if(balanceFor(actor.id)<cost)throw Error('余额不足。');recordLedger(actor.id,-cost,'共享空投登机 #'+f.id);db.prepare('INSERT INTO sky_passengers(flight_id,employee_id,cost) VALUES(?,?,?)').run(f.id,actor.id,cost);
   }else{if(Number(data.round)!==f.id)throw Error('该架次已结束，请调阅结算记录。');if(!p)throw Error('您未登上本架次。');if(p.status!=='aboard')return;if(now<f.depart_at)throw Error('舱门尚未开启。');finish(f,p,depth(f,now),now,!!f.ended_at);}
  });broadcast();send(res,200,snapshot(actor.id));return true;
 }catch(e){send(res,400,{error:e.message});return true;}}};
}
