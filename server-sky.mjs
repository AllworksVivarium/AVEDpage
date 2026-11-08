import {storedAvatar,robotAvatar,installAvatarPresets} from './server-default-avatar.mjs';
import {skyMultiplier} from './server-sky-rules.mjs';
import {randomInt} from 'node:crypto';
import {proofRandom,weighted} from './server-economy.mjs';

// All clients reconstruct the same landing animation from server timestamps.
export const SKY_LANDING_MS=14000;

export function installSky({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,economy,highlights,companyRobots}){
 installAvatarPresets(db);
 db.exec(`CREATE TABLE IF NOT EXISTS sky_flights(id INTEGER PRIMARY KEY,depart_at INTEGER NOT NULL,ended_at INTEGER NOT NULL DEFAULT 0,safety_line INTEGER NOT NULL,seed TEXT NOT NULL,seed_hash TEXT NOT NULL,rules_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sky_passengers(flight_id INTEGER NOT NULL REFERENCES sky_flights(id),employee_id INTEGER NOT NULL REFERENCES employees(id),cost INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'aboard',depth INTEGER NOT NULL DEFAULT 0,prize INTEGER NOT NULL DEFAULT 0,settled_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(flight_id,employee_id));`);
 db.exec(`CREATE TABLE IF NOT EXISTS sky_robot_plans(flight_id INTEGER NOT NULL,employee_id INTEGER NOT NULL,jump_depth INTEGER NOT NULL,PRIMARY KEY(flight_id,employee_id));
 CREATE TABLE IF NOT EXISTS sky_companion_checks(flight_id INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS sky_companion_arrivals(flight_id INTEGER NOT NULL,employee_id INTEGER NOT NULL,board_at INTEGER NOT NULL,PRIMARY KEY(flight_id,employee_id));`);
 if(!db.prepare("PRAGMA table_info(sky_robot_plans)").all().some(c=>c.name==='jump_at'))db.exec('ALTER TABLE sky_robot_plans ADD COLUMN jump_at INTEGER');
 let pending=!!db.prepare("SELECT 1 FROM sky_passengers WHERE status='aboard' LIMIT 1").get();
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 // Retire outstanding individual flights with a refund when moving to shared flights.
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='shared-sky'").get())tx(()=>{for(const row of db.prepare("SELECT id,employee_id,state_json FROM player_rounds WHERE game='sky'").all()){const s=JSON.parse(row.state_json);if(!s.settled){recordLedger(row.employee_id,s.cost,'旧架次撤回');s.settled=true;s.prize=s.cost;s.migrated=true;db.prepare('UPDATE player_rounds SET state_json=? WHERE id=?').run(JSON.stringify(s),row.id);}}db.prepare("INSERT INTO economy_migrations VALUES('shared-sky')").run();});
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='sky-settlement-v2'").get())tx(()=>{for(const p of db.prepare("SELECT s.*,f.seed,f.seed_hash FROM sky_passengers s JOIN sky_flights f ON f.id=s.flight_id WHERE s.status='aboard'").all()){recordLedger(p.employee_id,p.cost,'架次维护退回');db.prepare("UPDATE sky_passengers SET status='cancelled',prize=cost,settled_at=? WHERE flight_id=? AND employee_id=?").run(Date.now(),p.flight_id,p.employee_id);db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(p.employee_id,'sky',p.cost,p.cost,p.seed,p.seed_hash,JSON.stringify({flight:p.flight_id,cancelled:true}));}db.prepare("INSERT INTO economy_migrations VALUES('sky-settlement-v2')").run();});
 const streams=new Set();let eventTimer=null,eventDeadline=0;
 let rulesJson,cachedRules;
 const rules=f=>{if(rulesJson!==f.rules_json){rulesJson=f.rules_json;cachedRules={breakEvenDepth:200,...JSON.parse(f.rules_json),lossFraction:1};}return cachedRules;};
 const depth=(f,now=Date.now())=>Math.min(2000,Math.max(100,Math.floor(100+Math.max(0,now-f.depart_at)*rules(f).speed/1000)));
 const revealTime=f=>f.depart_at+(f.safety_line-100)/rules(f).speed*1000;
 function finish(f,p,atDepth,now,expired=false){
  if(p.status!=='aboard')return;
  const safe=!expired&&atDepth<=f.safety_line,prize=safe?Math.floor(p.cost*skyMultiplier(atDepth,rules(f))):0;
  const changed=db.prepare("UPDATE sky_passengers SET status=?,depth=?,prize=?,settled_at=? WHERE flight_id=? AND employee_id=? AND status='aboard'").run(safe?'landed':'crashed',atDepth,prize,now,f.id,p.employee_id).changes;
  if(!changed)return;if(prize)recordLedger(p.employee_id,prize,safe?'空投开伞返还':'空投损失结余');
  db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(p.employee_id,'sky',p.cost,prize,f.seed,f.seed_hash,JSON.stringify({flight:f.id,depth:atDepth,safetyLine:f.safety_line,safe,expired}));
 }
 function current(now=Date.now()){
  let f=db.prepare('SELECT * FROM sky_flights ORDER BY id DESC LIMIT 1').get();
  if(f&&!f.ended_at&&now>=f.depart_at-4000)tx(()=>{
   // Choose companions once, four seconds before departure. Persist staggered arrivals,
   // so reconnects/restarts cannot choose extra employees or charge anyone twice.
   if(now<f.depart_at&&!db.prepare('SELECT 1 FROM sky_companion_checks WHERE flight_id=?').get(f.id)){
    db.prepare('INSERT INTO sky_companion_checks VALUES(?)').run(f.id);
    const humans=db.prepare('SELECT COUNT(*) n FROM sky_passengers s WHERE flight_id=? AND NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=s.employee_id)').get(f.id).n;
    if(humans===1){
     const eligible=companyRobots.list().filter(r=>r.balance>=100);
     const count=Math.min(randomInt(1,4),eligible.length),window=Math.max(1,Math.floor(f.depart_at-now-150)),lead=Math.min(150,Math.floor(window/2));
     for(let i=0;i<count;i++){
      const robot=eligible.splice(randomInt(eligible.length),1)[0];
      const slot=(window-lead)/count,delay=lead+Math.floor(slot*i+randomInt(Math.max(1,Math.floor(slot))));
      db.prepare('INSERT INTO sky_companion_arrivals VALUES(?,?,?)').run(f.id,robot.id,now+delay);
     }
    }
   }
   for(const arrival of db.prepare(`SELECT a.employee_id FROM sky_companion_arrivals a
    WHERE a.flight_id=? AND a.board_at<=? AND NOT EXISTS(SELECT 1 FROM sky_passengers s WHERE s.flight_id=a.flight_id AND s.employee_id=a.employee_id)
    ORDER BY a.board_at`).all(f.id,now)){
     const robot=companyRobots.list().find(r=>r.id===arrival.employee_id);
     if(robot&&robot.balance>=100){const cost=Math.min(1000,Math.floor(robot.balance));
      recordLedger(robot.id,-cost,'共享空投登机 #'+f.id);
      db.prepare('INSERT INTO sky_passengers(flight_id,employee_id,cost) VALUES(?,?,?)').run(f.id,robot.id,cost);
      // Independent of the sealed safety line; never sent to clients.
      const jumpDepth=randomInt(180,601),jumpAt=Math.round(f.depart_at+(jumpDepth-100)/rules(f).speed*1000);
      db.prepare('INSERT INTO sky_robot_plans(flight_id,employee_id,jump_depth,jump_at) VALUES(?,?,?,?)').run(f.id,robot.id,jumpDepth,jumpAt);pending=true;
     }else db.prepare('DELETE FROM sky_companion_arrivals WHERE flight_id=? AND employee_id=?').run(f.id,arrival.employee_id);
   }
   if(now>=f.depart_at)for(const p of db.prepare("SELECT s.*,r.jump_depth,r.jump_at FROM sky_passengers s JOIN sky_robot_plans r USING(flight_id,employee_id) WHERE s.flight_id=? AND s.status='aboard'").all(f.id)){
    const jumpAt=p.jump_at??f.depart_at+(p.jump_depth-100)/rules(f).speed*1000;
    if(jumpAt<revealTime(f)&&now>=jumpAt)finish(f,p,p.jump_depth,jumpAt);
   }
  });
  if(f&&!f.ended_at&&now>=revealTime(f))tx(()=>{
   const revealedAt=revealTime(f);
   const passengers=db.prepare('SELECT * FROM sky_passengers WHERE flight_id=?').all(f.id);
   for(const p of passengers)finish(f,p,f.safety_line,revealedAt,true);
   const endedAt=Math.ceil(revealedAt+SKY_LANDING_MS);
   db.prepare('UPDATE sky_flights SET ended_at=? WHERE id=? AND ended_at=0').run(endedAt,f.id);
   f={...f,ended_at:endedAt};pending=false;
  });
  if(!f||f.ended_at&&now>=f.ended_at){const p=proofRandom(),s=economy.get().sky,range=weighted(s.ranges,p.random),line=range.min+Math.floor(p.random()*(range.max-range.min+1));const row=db.prepare('INSERT INTO sky_flights(depart_at,safety_line,seed,seed_hash,rules_json) VALUES(?,?,?,?,?)').run(now+s.boardingSeconds*1000,line,p.seed,p.seedHash,JSON.stringify(s));f=db.prepare('SELECT * FROM sky_flights WHERE id=?').get(row.lastInsertRowid);}
  return f;
 }
 function snapshot(id,f=current(),sharedPassengers=null){
  const now=Date.now(),phase=f.ended_at?'LANDING':now<f.depart_at?'BOARDING':'DROPPING';
  const passengers=sharedPassengers||passengersFor(f);
  const prior=db.prepare('SELECT * FROM sky_flights WHERE id<? AND ended_at>0 AND ended_at<=? ORDER BY id DESC LIMIT 1').get(f.id,now);
  let previous=null;if(prior){const mine=db.prepare('SELECT status,cost,depth,prize FROM sky_passengers WHERE flight_id=? AND employee_id=?').get(prior.id,id);previous={round:prior.id,safetyLine:prior.safety_line,seed:prior.seed,seedHash:prior.seed_hash,self:mine||null};}
  // Never disclose the safety line OR its timestamp while decisions remain open.
  const reveal=f.ended_at?{safetyLine:f.safety_line,revealedAt:revealTime(f),seed:f.seed}:{};
  return {round:f.id,gameHighlight:highlights.roundEvent(id,'sky',f.id),phase,departAt:f.depart_at,endedAt:f.ended_at,serverTime:now,depth:f.ended_at?f.safety_line:depth(f,now),speed:rules(f).speed,payoutRules:{curve:rules(f).curve,ranges:rules(f).ranges,breakEvenDepth:rules(f).breakEvenDepth},breakEvenDepth:rules(f).breakEvenDepth,boardingSeconds:rules(f).boardingSeconds,landingMs:SKY_LANDING_MS,...reveal,expectedSafety:rules(f).ranges.reduce((sum,x)=>sum+(x.min+x.max)/2*x.weight,0)/rules(f).ranges.reduce((sum,x)=>sum+x.weight,0),lossFraction:rules(f).lossFraction,remaining:Math.max(0,Math.ceil((f.depart_at-now)/1000)),seedHash:f.seed_hash,passengers,self:passengers.find(p=>p.id===id)||null,balance:balanceFor(id),previous};
 }
 function passengersFor(f){return db.prepare(`SELECT s.employee_id AS id,COALESCE(r.codename,p.anonymous_name,'员工') AS alias,p.avatar_url AS avatar,p.avatar_preset AS avatarPreset,r.employee_id IS NOT NULL AS isRobot,s.cost,s.status,s.depth,s.prize,s.settled_at AS settledAt FROM sky_passengers s LEFT JOIN profiles p ON p.employee_id=s.employee_id LEFT JOIN company_robots r ON r.employee_id=s.employee_id WHERE s.flight_id=? ORDER BY s.rowid`).all(f.id).map(p=>({...p,avatar:p.isRobot?robotAvatar(p.id):storedAvatar(p.id,p.avatar,p.avatarPreset,64)}));}
 function write(stream,f,passengers){if(stream.res.destroyed||stream.res.writableLength>262144){stream.res.destroy();streams.delete(stream);return;}stream.res.write('data: '+JSON.stringify(snapshot(stream.id,f,passengers))+'\n\n');}
 function broadcast(){const f=current();
  // One shared wake-up for the next arrival/departure/reveal, never a timer per client.
  const now=Date.now(),deadlines=[];
  if(!f.ended_at){
   if(now<f.depart_at-4000)deadlines.push(f.depart_at-4000);
   const arrival=db.prepare(`SELECT MIN(a.board_at) at FROM sky_companion_arrivals a WHERE a.flight_id=? AND a.board_at>? AND NOT EXISTS(SELECT 1 FROM sky_passengers s WHERE s.flight_id=a.flight_id AND s.employee_id=a.employee_id)`).get(f.id,now);
   if(arrival.at!=null)deadlines.push(arrival.at);
   if(now<f.depart_at)deadlines.push(f.depart_at);
   deadlines.push(revealTime(f));
  }
  const next=deadlines.length?Math.ceil(Math.min(...deadlines)):0;
  if(next!==eventDeadline){clearTimeout(eventTimer);eventDeadline=next;if(next){eventTimer=setTimeout(()=>{eventDeadline=0;try{if(streams.size||pending)broadcast();}catch(e){console.error('Shared flight:',e.message);}},Math.max(1,next-now));eventTimer.unref();}}
  const passengers=streams.size?passengersFor(f):null;for(const s of streams)write(s,f,passengers);}
 const timer=setInterval(()=>{try{if(streams.size||pending)broadcast();}catch(e){console.error('Shared flight:',e.message);}},1000);timer.unref();
 return {close(){clearInterval(timer);clearTimeout(eventTimer);for(const s of streams)s.res.end();streams.clear();},async handle(req,res,url){if(!url.pathname.startsWith('/api/player/games/sky/'))return false;const actor=requireEmployee(req,res);if(!actor)return true;try{
  const path=url.pathname;
  if(path.endsWith('/stream')&&req.method==='GET'){
   for(const old of [...streams].filter(x=>x.id===actor.id).slice(0,-1)){old.res.end();streams.delete(old);}
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});const stream={id:actor.id,res};streams.add(stream);write(stream,current());
   const authTimer=setInterval(()=>{if(!sessionEmployee(req)){res.end();streams.delete(stream);}},15000);authTimer.unref();res.on('close',()=>{clearInterval(authTimer);streams.delete(stream);});return true;
  }
  if(path.endsWith('/current')&&req.method==='GET'){send(res,200,snapshot(actor.id));return true;}
  if(req.method!=='POST'||!['/api/player/games/sky/start','/api/player/games/sky/jump'].includes(path)){send(res,405,{error:'架次指令无效。'});return true;}
  const data=await readBody(req);let f=current();
  tx(()=>{const now=Date.now();f=db.prepare('SELECT * FROM sky_flights WHERE id=?').get(f.id);const p=db.prepare('SELECT * FROM sky_passengers WHERE flight_id=? AND employee_id=?').get(f.id,actor.id);
   if(path.endsWith('/start')){if(f.ended_at||now>=f.depart_at)throw Error('舱门已关闭，请等待下一架次。');if(data.round!=null&&Number(data.round)!==f.id)throw Error('架次已变更，请重新登机。');if(p)return;const cost=data.bet;if(!Number.isSafeInteger(cost)||cost<100||cost>1000000)throw Error('登机投入应为 100 至 1,000,000。');if(balanceFor(actor.id)<cost)throw Error('余额不足。');recordLedger(actor.id,-cost,'共享空投登机 #'+f.id);db.prepare('INSERT INTO sky_passengers(flight_id,employee_id,cost) VALUES(?,?,?)').run(f.id,actor.id,cost);pending=true;
   }else{if(Number(data.round)!==f.id)throw Error('该架次已结束，请调阅结算记录。');if(!p)throw Error('您未登上本架次。');if(p.status!=='aboard')return;if(now<f.depart_at)throw Error('舱门尚未开启。');finish(f,p,depth(f,now),now,!!f.ended_at||now>=revealTime(f));}
  });broadcast();send(res,200,snapshot(actor.id));return true;
 }catch(e){send(res,400,{error:e.message});return true;}}};
}
