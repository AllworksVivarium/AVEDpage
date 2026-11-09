import {installSocialAchievements,socialMetrics} from './server-social-achievements.mjs';
import {achievementCatalog} from './achievement-catalog.mjs';
import {installGameplayAchievements,gameplayRules,gameplayAwardsSQL} from './server-game-achievements.mjs';

export function installPersonal({db,send,readBody,requireEmployee,requireAdmin,balanceFor,recordLedger,publicProfile,today,highlights}) {
 const personalMetrics=['zero_count','relief_count','peak','debt','donated','checkin_count','hourly_count','prize_max','loss_max'];
 const metrics=[...personalMetrics,...gameplayRules.map(r=>r.metric),...socialMetrics.map(r=>r.metric)];
 db.exec(`CREATE TABLE IF NOT EXISTS achievement_definitions(code TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,metric TEXT NOT NULL,threshold INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS personal_metrics(employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,balance INTEGER NOT NULL DEFAULT 0,peak INTEGER NOT NULL DEFAULT 0,debt INTEGER NOT NULL DEFAULT 0,zero_count INTEGER NOT NULL DEFAULT 0,relief_count INTEGER NOT NULL DEFAULT 0,donated INTEGER NOT NULL DEFAULT 0,checkin_count INTEGER NOT NULL DEFAULT 0,hourly_count INTEGER NOT NULL DEFAULT 0,prize_max INTEGER NOT NULL DEFAULT 0,loss_max INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS hourly_claims(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,hour INTEGER NOT NULL,reward INTEGER NOT NULL,PRIMARY KEY(employee_id,hour));
 CREATE INDEX IF NOT EXISTS ledger_employee_id ON balance_ledger(employee_id,id);
 CREATE INDEX IF NOT EXISTS tickets_employee_id ON game_tickets(employee_id,id);
 DROP TRIGGER IF EXISTS award_balance;
 DROP TRIGGER IF EXISTS personal_metrics_game;`);
 for(const d of achievementCatalog)db.prepare('INSERT OR IGNORE INTO achievement_definitions(code,title,description,metric,threshold) VALUES(?,?,?,?,?)').run(d.code,d.title,d.description,d.metric,d.threshold);
 // One-time historical backfill; subsequent awards use incremental counters.
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='personal-metrics-v1'").get()) {
  db.exec(`BEGIN IMMEDIATE;
   INSERT OR REPLACE INTO personal_metrics(employee_id,balance,peak,debt,zero_count,relief_count,donated,checkin_count,hourly_count,prize_max,loss_max)
   WITH running AS (SELECT *,SUM(delta) OVER(PARTITION BY employee_id ORDER BY id) AS running_balance FROM balance_ledger)
   SELECT e.id,COALESCE(SUM(r.delta),0),MAX(0,COALESCE(MAX(r.running_balance),0)),MAX(0,-COALESCE(MIN(r.running_balance),0)),
    COALESCE(SUM(r.running_balance=0 AND r.delta<>0),0),COALESCE(SUM(r.reason='应急低保' AND r.delta>0),0),
    COALESCE(SUM(CASE WHEN r.reason='爱心账户捐款' THEN -r.delta ELSE 0 END),0),COALESCE(SUM(r.reason='每日签到'),0),0,
    COALESCE((SELECT MAX(prize) FROM game_tickets WHERE employee_id=e.id),0),MAX(0,COALESCE((SELECT MAX(cost+COALESCE(json_extract(result_json,'$.penalty'),0)-prize) FROM game_tickets WHERE employee_id=e.id),0))
   FROM employees e LEFT JOIN running r ON r.employee_id=e.id GROUP BY e.id;
   INSERT INTO economy_migrations VALUES('personal-metrics-v1');COMMIT;`);
 }
 const metricCase='CASE d.metric '+personalMetrics.map(m=>`WHEN '${m}' THEN m.${m}`).join(' ')+' ELSE 0 END';
 const awardSQL=(where='')=>`INSERT OR IGNORE INTO earned_achievements(employee_id,code) SELECT m.employee_id,d.code FROM personal_metrics m CROSS JOIN achievement_definitions d WHERE d.enabled=1 AND ${metricCase}>=d.threshold ${where};`;
 db.exec(`CREATE TRIGGER IF NOT EXISTS personal_metrics_ledger AFTER INSERT ON balance_ledger BEGIN
  INSERT INTO personal_metrics(employee_id,balance,peak,debt,zero_count,relief_count,donated,checkin_count,hourly_count)
   VALUES(NEW.employee_id,NEW.delta,MAX(0,NEW.delta),MAX(0,-NEW.delta),0,NEW.reason='应急低保' AND NEW.delta>0,CASE WHEN NEW.reason='爱心账户捐款' THEN -NEW.delta ELSE 0 END,NEW.reason='每日签到',NEW.reason='整点补给')
   ON CONFLICT(employee_id) DO UPDATE SET balance=balance+NEW.delta,peak=MAX(peak,balance+NEW.delta),debt=MAX(debt,-balance-NEW.delta),zero_count=zero_count+(balance<>0 AND balance+NEW.delta=0),relief_count=relief_count+(NEW.reason='应急低保' AND NEW.delta>0),donated=donated+CASE WHEN NEW.reason='爱心账户捐款' THEN -NEW.delta ELSE 0 END,checkin_count=checkin_count+(NEW.reason='每日签到'),hourly_count=hourly_count+(NEW.reason='整点补给');
  ${awardSQL('AND m.employee_id=NEW.employee_id')}
 END;
 CREATE TRIGGER IF NOT EXISTS personal_metrics_game AFTER INSERT ON game_tickets BEGIN
  INSERT INTO personal_metrics(employee_id,prize_max,loss_max) VALUES(NEW.employee_id,NEW.prize,MAX(0,NEW.cost+COALESCE(json_extract(NEW.result_json,'$.penalty'),0)-NEW.prize))
   ON CONFLICT(employee_id) DO UPDATE SET prize_max=MAX(prize_max,NEW.prize),loss_max=MAX(loss_max,NEW.cost+COALESCE(json_extract(NEW.result_json,'$.penalty'),0)-NEW.prize);
  ${awardSQL('AND m.employee_id=NEW.employee_id')}
 END;${awardSQL()}`);
 installGameplayAchievements(db);
 installSocialAchievements(db);
 const earned=id=>db.prepare(`SELECT d.code,d.title,d.description,a.created_at AS createdAt FROM earned_achievements a JOIN achievement_definitions d ON d.code=a.code WHERE a.employee_id=? AND d.enabled=1 ORDER BY a.created_at DESC,d.rowid`).all(id);
 function rewards(id) {const now=Date.now(),hour=Math.floor(now/3600000),daily=!!db.prepare('SELECT 1 FROM checkins WHERE employee_id=? AND checkin_date=?').get(id,today());return {serverTime:now,balance:balanceFor(id),dailyClaimed:daily,dailyReward:10000,dailyResetAt:(Math.floor((now+28800000)/86400000)+1)*86400000-28800000,hourlyClaimed:!!db.prepare('SELECT 1 FROM hourly_claims WHERE employee_id=? AND hour=?').get(id,hour),hourlyResetAt:(hour+1)*3600000,hourlyReward:5000};}
 db.exec(`INSERT INTO personal_metrics(employee_id,balance) SELECT e.id,COALESCE(SUM(l.delta),0) FROM employees e LEFT JOIN balance_ledger l ON l.employee_id=e.id GROUP BY e.id ON CONFLICT(employee_id) DO UPDATE SET balance=excluded.balance;`);
 const balanceQuery=db.prepare('SELECT balance FROM personal_metrics WHERE employee_id=?');
 return {balance:id=>balanceQuery.get(id)?.balance||0,earned,async handle(req,res,url) {
  const path=url.pathname;if(!['/api/profile','/api/player/history','/api/player/rewards','/api/player/rewards/hourly','/api/admin/achievements'].includes(path)||path==='/api/profile'&&req.method!=='GET')return false;
  const employee=path.startsWith('/api/admin/')?requireAdmin(req,res):requireEmployee(req,res);if(!employee)return true;
  try {
   if(path==='/api/profile'&&req.method==='GET'){send(res,200,{profile:publicProfile(employee.id),achievements:earned(employee.id),gameRecords:highlights.records(employee.id),balance:balanceFor(employee.id)});return true;}
   if(path==='/api/player/history'&&req.method==='GET'){const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;const rows=db.prepare("SELECT id,game,cost,prize,COALESCE(json_extract(result_json,'$.penalty'),0) AS penalty,created_at AS createdAt FROM game_tickets WHERE employee_id=? AND id<? ORDER BY id DESC LIMIT 21").all(employee.id,before);send(res,200,{items:rows.slice(0,20),next:rows.length>20?rows[19].id:null});return true;}
   if(path==='/api/player/rewards'&&req.method==='GET'){send(res,200,rewards(employee.id));return true;}
   if(path==='/api/player/rewards/hourly'&&req.method==='POST') {
    db.exec('BEGIN IMMEDIATE');try{const hour=Math.floor(Date.now()/3600000),claimed=db.prepare('INSERT OR IGNORE INTO hourly_claims VALUES(?,?,5000)').run(employee.id,hour).changes;if(claimed)recordLedger(employee.id,5000,'整点补给');db.exec('COMMIT');send(res,200,{...rewards(employee.id),reward:claimed?5000:0});}catch(e){db.exec('ROLLBACK');throw e;}return true;
   }
   if(path==='/api/admin/achievements') {
    if(req.method==='PUT'){const d=await readBody(req);if(!/^[-a-z0-9]{1,40}$/.test(d.code)||typeof d.title!=='string'||!d.title.trim()||d.title.length>60||typeof d.description!=='string'||d.description.length>200||!metrics.includes(d.metric)||!Number.isSafeInteger(d.threshold)||d.threshold<1||typeof d.enabled!=='boolean')throw Error('请填写有效的成就编号、名称、条件及正整数门槛。');db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO achievement_definitions VALUES(?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET title=excluded.title,description=excluded.description,metric=excluded.metric,threshold=excluded.threshold,enabled=excluded.enabled').run(d.code,d.title.trim(),d.description,d.metric,d.threshold,d.enabled?1:0);db.exec(awardSQL()+gameplayAwardsSQL());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
    else if(req.method!=='GET'){send(res,405,{error:'指令无效。'});return true;}
    send(res,200,{items:db.prepare('SELECT * FROM achievement_definitions ORDER BY rowid').all(),metrics,metricLabels:Object.fromEntries([...gameplayRules,...socialMetrics].map(r=>[r.metric,r.label]))});return true;
   }
   send(res,405,{error:'指令无效。'});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
