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
 CREATE INDEX IF NOT EXISTS highlights_round ON game_highlights(employee_id,game,round_id);
 CREATE INDEX IF NOT EXISTS tickets_record ON game_tickets(employee_id,game,prize DESC,id);
 `);
 const valid="game IN ('scratch','slot','sky','derby','cards') AND prize>0 AND COALESCE(json_extract(result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(result_json,'$.migrated'),0)=0";
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='game-highlights-v1'").get()) {
  db.exec(`BEGIN IMMEDIATE;
   INSERT OR IGNORE INTO game_personal_records(employee_id,game,ticket_id,cost,prize,created_at)
   SELECT employee_id,game,id,cost,prize,created_at FROM (
    SELECT *,ROW_NUMBER() OVER(PARTITION BY employee_id,game ORDER BY prize DESC,id) AS rank FROM game_tickets WHERE ${valid}
   ) WHERE rank=1;
   INSERT INTO economy_migrations VALUES('game-highlights-v1');COMMIT;`);
 }
 const best="NEW.prize>COALESCE((SELECT MAX(prize) FROM game_personal_records WHERE employee_id=NEW.employee_id),0)";
 const rare=`NEW.prize>NEW.cost AND CASE NEW.game
  WHEN 'scratch' THEN COALESCE(json_extract(NEW.result_json,'$.rarePrize'),0)=1
  WHEN 'slot' THEN NEW.cost>0 AND NEW.prize>=NEW.cost*10
  WHEN 'sky' THEN NEW.cost>0 AND NEW.prize>=NEW.cost*5
  WHEN 'derby' THEN NEW.cost>0 AND NEW.prize>=NEW.cost*8
  ELSE 0 END`;
 db.exec(`CREATE TRIGGER IF NOT EXISTS game_highlights_settled AFTER INSERT ON game_tickets
  WHEN NEW.game IN ('scratch','slot','sky','derby','cards') AND NEW.prize>0
   AND COALESCE(json_extract(NEW.result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(NEW.result_json,'$.migrated'),0)=0
  BEGIN
   INSERT INTO game_highlights(ticket_id,employee_id,game,round_id,alias,cost,prize,personal_best,broadcast,created_at)
    SELECT NEW.id,NEW.employee_id,NEW.game,COALESCE(json_extract(NEW.result_json,'$.round'),json_extract(NEW.result_json,'$.flight')),
     COALESCE((SELECT NULLIF(anonymous_name,'') FROM profiles WHERE employee_id=NEW.employee_id),'未署名员工'),
     NEW.cost,NEW.prize,(${best}),(${rare}),NEW.created_at WHERE (${best}) OR (${rare});
   INSERT INTO game_personal_records VALUES(NEW.employee_id,NEW.game,NEW.id,NEW.cost,NEW.prize,NEW.created_at)
    ON CONFLICT(employee_id,game) DO UPDATE SET ticket_id=excluded.ticket_id,cost=excluded.cost,prize=excluded.prize,created_at=excluded.created_at
    WHERE excluded.prize>game_personal_records.prize;
  END;`);
 const columns='ticket_id AS ticketId,employee_id AS employeeId,game,alias,cost,prize,personal_best AS personalBest,broadcast,created_at AS createdAt';
 const records=id=>{const byGame=db.prepare('SELECT game,ticket_id AS ticketId,cost,prize,created_at AS createdAt FROM game_personal_records WHERE employee_id=? ORDER BY prize DESC,ticket_id').all(id);return {highest:byGame[0]||null,byGame};};
 const event=(id,ticket)=>db.prepare(`SELECT ${columns} FROM game_highlights WHERE employee_id=? AND ticket_id=?`).get(id,ticket)||null;
 const roundEvent=(id,game,round)=>db.prepare(`SELECT ${columns} FROM game_highlights WHERE employee_id=? AND game=? AND round_id=? ORDER BY ticket_id DESC LIMIT 1`).get(id,game,round)||null;
 return {records,event,roundEvent,async handle(req,res,url){
  if(url.pathname!=='/api/player/game-highlights')return false;
  if(!requireEmployee(req,res))return true;
  if(req.method!=='GET'){send(res,405,{error:'只支持调阅已结算的大奖。'});return true;}
  const game=url.searchParams.get('game');
  if(game&&!['scratch','slot','sky','derby','cards'].includes(game)){send(res,400,{error:'无效玩法。'});return true;}
  const rows=game?db.prepare(`SELECT ${columns} FROM game_highlights WHERE broadcast=1 AND game=? ORDER BY ticket_id DESC LIMIT 12`).all(game):db.prepare(`SELECT ${columns} FROM game_highlights WHERE broadcast=1 ORDER BY ticket_id DESC LIMIT 12`).all();
  send(res,200,{items:rows.map(({employeeId,personalBest,...row})=>row)});return true;
 }};
}
