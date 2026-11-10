// Durable unseen awards, pushed only to their owner. No backfill of old awards.
export function installAchievementAlerts({db,send,readBody,requireEmployee,sessionEmployee}){
 db.exec(`CREATE TABLE IF NOT EXISTS achievement_alerts(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,code TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,seen_at TEXT,PRIMARY KEY(employee_id,code));
 CREATE INDEX IF NOT EXISTS achievement_alerts_unseen ON achievement_alerts(employee_id,created_at) WHERE seen_at IS NULL;
 CREATE TRIGGER IF NOT EXISTS achievement_alert_new AFTER INSERT ON earned_achievements BEGIN INSERT OR IGNORE INTO achievement_alerts(employee_id,code,created_at) VALUES(NEW.employee_id,NEW.code,NEW.created_at);END;`);
 const streams=new Set();let turn=0;
 function pending(ids){if(!ids.length)return [];return db.prepare(`SELECT a.employee_id AS employeeId,a.code,d.title,d.description,a.created_at AS createdAt FROM achievement_alerts a JOIN achievement_definitions d ON d.code=a.code WHERE a.seen_at IS NULL AND d.enabled=1 AND a.employee_id IN (${ids.map(()=>'?').join(',')}) ORDER BY a.created_at,a.rowid LIMIT 400`).all(...ids);}
 function write(stream,items){if(stream.res.destroyed||stream.res.writableLength>262144){stream.res.destroy();streams.delete(stream);return;}stream.res.write('data: '+JSON.stringify({items:items.filter(a=>a.employeeId===stream.id).slice(0,20)})+'\n\n');}
 const timer=setInterval(()=>{if(!streams.size)return;try{turn++;if(turn%3===0)for(const s of streams)if(!sessionEmployee(s.req)){s.res.end();streams.delete(s);}const items=pending([...new Set([...streams].map(s=>s.id))]);for(const s of streams)write(s,items);}catch(error){console.error('Achievement alerts:',error.message);}},5000);timer.unref();
 return {close(){clearInterval(timer);for(const s of streams)s.res.end();streams.clear();},async handle(req,res,url){
  if(!url.pathname.startsWith('/api/player/achievement-alerts'))return false;const employee=requireEmployee(req,res);if(!employee)return true;
  if(url.pathname==='/api/player/achievement-alerts/stream'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});const s={req,res,id:employee.id};streams.add(s);res.on('close',()=>streams.delete(s));write(s,pending([employee.id]));return true;}
  if(url.pathname==='/api/player/achievement-alerts'&&req.method==='GET'){send(res,200,{items:pending([employee.id]).slice(0,20)});return true;}
  if(url.pathname==='/api/player/achievement-alerts/read'&&req.method==='POST'){const data=await readBody(req);if(!Array.isArray(data.codes)||data.codes.length>20||data.codes.some(c=>typeof c!=='string'||c.length>80)){send(res,400,{error:'成就回执无效。'});return true;}db.exec('BEGIN IMMEDIATE');try{const mark=db.prepare('UPDATE achievement_alerts SET seen_at=CURRENT_TIMESTAMP WHERE employee_id=? AND code=? AND seen_at IS NULL');for(const code of data.codes)mark.run(employee.id,code);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}send(res,200,{ok:true});return true;}
  send(res,404,{error:'成就提醒指令不存在。'});return true;
 }};
}
