export function installRecreationRecords(db){
 db.exec(`CREATE TABLE IF NOT EXISTS economy_migrations(code TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS slot_protocol_unlocks(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,protocol INTEGER NOT NULL CHECK(protocol BETWEEN 0 AND 2),PRIMARY KEY(employee_id,protocol));
 CREATE INDEX IF NOT EXISTS tickets_game_time ON game_tickets(game,created_at,employee_id);
 CREATE TRIGGER IF NOT EXISTS slot_protocol_unlock AFTER INSERT ON game_tickets WHEN NEW.game='slot' BEGIN
 INSERT OR IGNORE INTO slot_protocol_unlocks SELECT NEW.employee_id,CAST(value AS INTEGER) FROM json_each(NEW.result_json,'$.mechanisms') WHERE type='integer' AND value BETWEEN 0 AND 2; END;`);
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='slot-protocol-unlocks-v1'").get())db.exec(`INSERT OR IGNORE INTO slot_protocol_unlocks SELECT t.employee_id,CAST(j.value AS INTEGER) FROM game_tickets t,json_each(t.result_json,'$.mechanisms') j WHERE t.game='slot' AND j.type='integer' AND j.value BETWEEN 0 AND 2;INSERT INTO economy_migrations VALUES('slot-protocol-unlocks-v1');`);
 let cache=null,until=0;
 return {unlocks:id=>db.prepare('SELECT protocol FROM slot_protocol_unlocks WHERE employee_id=? ORDER BY protocol').all(id).map(r=>r.protocol),
 rankings(){const now=Date.now();if(cache&&now<until)return cache;const since=new Date(now-3*86400000).toISOString().slice(0,19).replace('T',' ');
 const query=(game,condition,value,limit)=>db.prepare(`SELECT t.employee_id AS employeeId,COALESCE(NULLIF(p.anonymous_name,''),'员工') AS name,${value} AS value FROM game_tickets t JOIN employees e ON e.id=t.employee_id LEFT JOIN profiles p ON p.employee_id=t.employee_id WHERE t.game=? AND t.created_at>? AND e.is_npc=0 AND NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=t.employee_id) AND COALESCE(json_extract(t.result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(t.result_json,'$.migrated'),0)=0 AND ${condition} GROUP BY t.employee_id ORDER BY value DESC,t.employee_id LIMIT ?`).all(game,since,limit).map((r,i,a)=>({...r,rank:a.findIndex(x=>x.value===r.value)+1}));
 cache={skySafe:query('sky',"json_extract(t.result_json,'$.safe')=1",'COUNT(*)',3),skyDepth:query('sky',"json_extract(t.result_json,'$.safe')=1","MAX(json_extract(t.result_json,'$.depth'))",3),derby:query('derby','t.prize>0','COUNT(*)',5)};until=now+30000;return cache;
 }};
}
