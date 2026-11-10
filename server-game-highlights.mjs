// Settlement-owned records: clients can read highlights, never submit them.
export function installGameHighlights({db,send,requireEmployee}) {
 db.exec(`CREATE TABLE IF NOT EXISTS game_personal_records(
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  game TEXT NOT NULL,ticket_id INTEGER NOT NULL,cost INTEGER NOT NULL,prize INTEGER NOT NULL,created_at TEXT NOT NULL,
  PRIMARY KEY(employee_id,game));
 CREATE TABLE IF NOT EXISTS game_highlights(
  ticket_id INTEGER PRIMARY KEY REFERENCES game_tickets(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  game TEXT NOT NULL,round_id INTEGER,alias TEXT NOT NULL,cost INTEGER NOT NULL,prize INTEGER NOT NULL,
  personal_best INTEGER NOT NULL,broadcast INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS highlights_broadcast ON game_highlights(broadcast,ticket_id DESC);
 CREATE INDEX IF NOT EXISTS highlights_recent ON game_highlights(created_at,ticket_id) WHERE broadcast=1;
 CREATE INDEX IF NOT EXISTS highlights_round_batch ON game_highlights(game,round_id);
 CREATE INDEX IF NOT EXISTS highlights_round ON game_highlights(employee_id,game,round_id);
 CREATE INDEX IF NOT EXISTS tickets_record ON game_tickets(employee_id,game,prize DESC,id);
 `);
 if(!db.prepare('PRAGMA table_info(game_highlights)').all().some(c=>c.name==='penalty'))db.exec('ALTER TABLE game_highlights ADD COLUMN penalty INTEGER NOT NULL DEFAULT 0');
 db.exec('DROP TRIGGER IF EXISTS game_highlights_bomb');
 db.exec(`CREATE TRIGGER IF NOT EXISTS game_highlights_bomb AFTER INSERT ON game_tickets
 WHEN NEW.game='scratch' AND COALESCE(json_extract(NEW.result_json,'$.penalty'),0)>0 AND COALESCE(json_extract(NEW.result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(NEW.result_json,'$.migrated'),0)=0
 BEGIN
  INSERT INTO game_highlights(ticket_id,employee_id,game,alias,cost,prize,personal_best,broadcast,created_at,penalty)
  VALUES(NEW.id,NEW.employee_id,NEW.game,COALESCE((SELECT NULLIF(anonymous_name,'') FROM profiles WHERE employee_id=NEW.employee_id),'未署名员工'),NEW.cost,0,0,1,NEW.created_at,json_extract(NEW.result_json,'$.penalty'));
 END;`);
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='bomb-highlights-v1'").get()){
  db.exec(`BEGIN IMMEDIATE;
   INSERT OR IGNORE INTO game_highlights(ticket_id,employee_id,game,alias,cost,prize,personal_best,broadcast,created_at,penalty)
   SELECT t.id,t.employee_id,t.game,COALESCE(NULLIF(p.anonymous_name,''),'未署名员工'),t.cost,0,0,1,t.created_at,json_extract(t.result_json,'$.penalty') FROM game_tickets t LEFT JOIN profiles p ON p.employee_id=t.employee_id
   WHERE t.game='scratch' AND COALESCE(json_extract(t.result_json,'$.penalty'),0)>0 AND COALESCE(json_extract(t.result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(t.result_json,'$.migrated'),0)=0 AND t.created_at>=datetime('now','-30 minutes');
   INSERT INTO economy_migrations VALUES('bomb-highlights-v1');COMMIT;`);
 }
 const valid="game IN ('scratch','slot','sky','derby','cards') AND prize>0 AND COALESCE(json_extract(result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(result_json,'$.migrated'),0)=0";
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='game-highlights-v1'").get()) {
  db.exec(`BEGIN IMMEDIATE;
   INSERT OR IGNORE INTO game_personal_records(employee_id,game,ticket_id,cost,prize,created_at)
   SELECT employee_id,game,id,cost,prize,created_at FROM (
    SELECT *,ROW_NUMBER() OVER(PARTITION BY employee_id,game ORDER BY prize DESC,id) AS rank FROM game_tickets WHERE ${valid}
   ) WHERE rank=1;
   INSERT INTO economy_migrations VALUES('game-highlights-v1');COMMIT;`);
 }
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='highlights-five-times-v2'").get()){
  db.exec(`BEGIN IMMEDIATE;
   INSERT INTO game_highlights(ticket_id,employee_id,game,round_id,alias,cost,prize,personal_best,broadcast,created_at,penalty)
   SELECT t.id,t.employee_id,t.game,COALESCE(json_extract(t.result_json,'$.round'),json_extract(t.result_json,'$.flight')),COALESCE(NULLIF(p.anonymous_name,''),'未署名员工'),t.cost,t.prize,0,1,t.created_at,COALESCE(json_extract(t.result_json,'$.penalty'),0)
   FROM game_tickets t LEFT JOIN profiles p ON p.employee_id=t.employee_id
   WHERE t.game IN ('scratch','slot','sky','derby','cards') AND t.cost>0 AND t.prize>=t.cost*5 AND t.created_at>=datetime('now','-30 minutes')
    AND COALESCE(json_extract(t.result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(t.result_json,'$.migrated'),0)=0
   ON CONFLICT(ticket_id) DO UPDATE SET broadcast=1;
   INSERT INTO economy_migrations VALUES('highlights-five-times-v2');COMMIT;`);
 }
 const best="NEW.prize>COALESCE((SELECT MAX(prize) FROM game_personal_records WHERE employee_id=NEW.employee_id AND game=NEW.game),0)";
 const rare="NEW.game<>'derby' AND NEW.cost>0 AND NEW.prize>=NEW.cost*5";
 db.exec('DROP TRIGGER IF EXISTS game_highlights_settled');
 db.exec(`CREATE TRIGGER IF NOT EXISTS game_highlights_settled AFTER INSERT ON game_tickets
  WHEN NEW.game IN ('scratch','slot','sky','derby','cards') AND NEW.prize>0
   AND COALESCE(json_extract(NEW.result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(NEW.result_json,'$.migrated'),0)=0
  BEGIN
   INSERT INTO game_highlights(ticket_id,employee_id,game,round_id,alias,cost,prize,personal_best,broadcast,created_at,penalty)
    SELECT NEW.id,NEW.employee_id,NEW.game,COALESCE(json_extract(NEW.result_json,'$.round'),json_extract(NEW.result_json,'$.flight')),
     COALESCE((SELECT NULLIF(anonymous_name,'') FROM profiles WHERE employee_id=NEW.employee_id),'未署名员工'),
     NEW.cost,NEW.prize,(${best}),(${rare}),NEW.created_at,COALESCE(json_extract(NEW.result_json,'$.penalty'),0) WHERE (${best}) OR (${rare});
   INSERT INTO game_personal_records VALUES(NEW.employee_id,NEW.game,NEW.id,NEW.cost,NEW.prize,NEW.created_at)
    ON CONFLICT(employee_id,game) DO UPDATE SET ticket_id=excluded.ticket_id,cost=excluded.cost,prize=excluded.prize,created_at=excluded.created_at
    WHERE excluded.prize>game_personal_records.prize;
  END;`);
 const columns='ticket_id AS ticketId,employee_id AS employeeId,game,alias,cost,prize,personal_best AS personalBest,broadcast,penalty,created_at AS createdAt';
 const records=id=>{const byGame=db.prepare('SELECT game,ticket_id AS ticketId,cost,prize,created_at AS createdAt FROM game_personal_records WHERE employee_id=? ORDER BY prize DESC,ticket_id').all(id);return {highest:byGame[0]||null,byGame};};
 const event=(id,ticket)=>db.prepare(`SELECT ${columns} FROM game_highlights WHERE employee_id=? AND ticket_id=?`).get(id,ticket)||null;
 const roundEvent=(id,game,round)=>db.prepare(`SELECT ${columns} FROM game_highlights WHERE employee_id=? AND game=? AND round_id=? ORDER BY personal_best DESC,prize DESC,ticket_id DESC LIMIT 1`).get(id,game,round)||null;
 const roundEvents=(game,round)=>{const out=new Map();for(const row of db.prepare(`SELECT ${columns} FROM game_highlights WHERE game=? AND round_id=? ORDER BY personal_best DESC,prize DESC,ticket_id DESC`).all(game,round))if(!out.has(row.employeeId))out.set(row.employeeId,row);return out;};
 return {records,event,roundEvent,roundEvents,async handle(req,res,url){
  if(url.pathname!=='/api/player/game-highlights')return false;
  if(!requireEmployee(req,res))return true;
  if(req.method!=='GET'){send(res,405,{error:'只支持调阅已结算的大奖。'});return true;}
  const game=url.searchParams.get('game');
  if(game&&!['scratch','slot','sky','derby','cards'].includes(game)){send(res,400,{error:'无效玩法。'});return true;}
  const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0){send(res,400,{error:'无效记录游标。'});return true;}
  const rows=db.prepare(`SELECT ${columns} FROM game_highlights WHERE broadcast=1 AND game<>'derby' AND ((cost>0 AND prize>=cost*5) OR (game='scratch' AND penalty>0)) AND created_at>=datetime('now','-30 minutes') AND ticket_id>? ${game?'AND game=?':''} ORDER BY ticket_id ASC`).all(...(game?[after,game]:[after]));
  send(res,200,{serverTime:Date.now(),items:rows.map(({employeeId,personalBest,...row})=>row)});return true;
 }};
}
