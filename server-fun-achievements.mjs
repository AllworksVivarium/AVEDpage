import {gameplayAwardsSQL} from './server-game-achievements.mjs';

// Private definitions: the profile endpoint only returns earned achievements.
export const funAchievementCatalog=[
 ['fun-startup','工资只是启动资金','首次完成一局有投入的小游戏。财务已了解你的职业规划。'],
 ['fun-smiling','谢谢，已经在笑了','连续三张刮刮乐没有盈利。刮开的是涂层，也是嘴角。'],
 ['fun-money-visited','钱来过','北京时间同一天，单局返还至少五十万，之后出现负债。有流水为证。'],
 ['fun-company-backup','公司是我坚强的后盾','首次将负债转交公司基金。这句话终于有了具体金额。'],
 ['fun-relief','从哪里跌倒，就在哪里领低保','小游戏亏损后，当天领取低保。已完成业务闭环。'],
 ['fun-charity','慈善事业的双向奔赴','北京时间同一天既向爱心账户捐款，又领取低保。公司和你都尽力了。'],
 ['fun-arrived','来都来了','速降在 100 至 120 米处安全开伞。来过高空，也算出差。'],
 ['fun-alive','活着就是盈利','连续三次安全开伞，但这三次合计仍亏损。至少统计口径很乐观。'],
 ['fun-participation','我买的是参与感','连续五场下班竞速，支持的选手均未押中。陪伴也是一种成绩。'],
 ['fun-last-round','《最后一把》','十五分钟内完成十局有投入的小游戏。最后一把的解释权归本人所有。']
].map(([code,title,description])=>({code,title,description,metric:code.replaceAll('-','_'),threshold:1}));

const day="date('now','+8 hours')";
const award=(code,condition)=>`INSERT INTO gameplay_achievement_metrics(employee_id,metric,value)
 SELECT employee_id,'${code.replaceAll('-','_')}',1 FROM fun_achievement_state WHERE employee_id=NEW.employee_id AND (${condition})
 ON CONFLICT(employee_id,metric) DO UPDATE SET value=1;`;
const resetDay=`UPDATE fun_achievement_state SET donated=0,relief=0,lost=0,large_prize=0,day=${day} WHERE employee_id=NEW.employee_id AND day<>${day};`;

export function installFunAchievements(db){
 db.exec(`CREATE TABLE IF NOT EXISTS fun_achievement_state(
 employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
 balance INTEGER NOT NULL DEFAULT 0,day TEXT NOT NULL DEFAULT '',
 donated INTEGER NOT NULL DEFAULT 0,relief INTEGER NOT NULL DEFAULT 0,lost INTEGER NOT NULL DEFAULT 0,large_prize INTEGER NOT NULL DEFAULT 0,
 scratch_streak INTEGER NOT NULL DEFAULT 0,derby_streak INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS fun_achievement_events(
 id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 game TEXT NOT NULL,cost INTEGER NOT NULL,prize INTEGER NOT NULL,penalty INTEGER NOT NULL DEFAULT 0,
 safe INTEGER NOT NULL DEFAULT 0,depth INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS fun_events_employee ON fun_achievement_events(employee_id,id);
 CREATE INDEX IF NOT EXISTS fun_events_game ON fun_achievement_events(employee_id,game,id);
 INSERT INTO fun_achievement_state(employee_id,balance,day)
 SELECT e.id,COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=e.id),0),${day}
 FROM employees e WHERE NOT EXISTS(SELECT 1 FROM fun_achievement_state s WHERE s.employee_id=e.id);
 DROP TRIGGER IF EXISTS fun_achievement_ledger;
 CREATE TRIGGER fun_achievement_ledger AFTER INSERT ON balance_ledger BEGIN
 INSERT OR IGNORE INTO fun_achievement_state(employee_id) VALUES(NEW.employee_id);
 ${resetDay}
 UPDATE fun_achievement_state SET balance=balance+NEW.delta,
 donated=MAX(donated,NEW.reason='爱心账户捐款' AND NEW.delta<0),
 relief=MAX(relief,NEW.reason='应急低保' AND NEW.delta>0) WHERE employee_id=NEW.employee_id;
 ${award('fun-company-backup',"NEW.reason='主动归零' AND NEW.delta>0")}
 ${award('fun-relief',"lost=1 AND NEW.reason='应急低保' AND NEW.delta>0")}
 ${award('fun-charity','donated=1 AND relief=1')}
 ${gameplayAwardsSQL('AND g.employee_id=NEW.employee_id')}
 END;
 DROP TRIGGER IF EXISTS fun_achievement_event;
 CREATE TRIGGER fun_achievement_event AFTER INSERT ON fun_achievement_events BEGIN
 INSERT OR IGNORE INTO fun_achievement_state(employee_id) VALUES(NEW.employee_id);
 ${resetDay}
 ${award('fun-money-visited','large_prize=1 AND balance<0')}
 UPDATE fun_achievement_state SET
 lost=MAX(lost,NEW.prize<NEW.cost+NEW.penalty),large_prize=MAX(large_prize,NEW.prize>=500000),
 scratch_streak=CASE WHEN NEW.game<>'scratch' THEN scratch_streak WHEN NEW.prize<=NEW.cost+NEW.penalty THEN scratch_streak+1 ELSE 0 END,
 derby_streak=CASE WHEN NEW.game<>'derby' THEN derby_streak WHEN NEW.prize=0 THEN derby_streak+1 ELSE 0 END
 WHERE employee_id=NEW.employee_id;
 ${award('fun-startup','1')}
 ${award('fun-smiling','scratch_streak>=3')}
 ${award('fun-arrived',"NEW.game='sky' AND NEW.safe=1 AND NEW.depth BETWEEN 100 AND 120")}
 ${award('fun-participation','derby_streak>=5')}
 ${award('fun-alive',`NEW.game='sky' AND (SELECT COUNT(*)=3 AND MIN(safe)=1 AND SUM(prize-cost-penalty)<0 FROM (SELECT safe,prize,cost,penalty FROM fun_achievement_events WHERE employee_id=NEW.employee_id AND game='sky' ORDER BY id DESC LIMIT 3))`)}
 ${award('fun-last-round',`(SELECT COUNT(*)=10 AND MIN(created_at)>=datetime('now','-15 minutes') FROM (SELECT created_at FROM fun_achievement_events WHERE employee_id=NEW.employee_id ORDER BY id DESC LIMIT 10))`)}
 ${gameplayAwardsSQL('AND g.employee_id=NEW.employee_id')}
 -- Keep only ten events per game, enough for the rolling conditions above.
 DELETE FROM fun_achievement_events WHERE employee_id=NEW.employee_id AND game=NEW.game
 AND id NOT IN(SELECT id FROM fun_achievement_events WHERE employee_id=NEW.employee_id AND game=NEW.game ORDER BY id DESC LIMIT 10);
 END;
 DROP TRIGGER IF EXISTS fun_achievement_ticket;
 CREATE TRIGGER fun_achievement_ticket AFTER INSERT ON game_tickets
 WHEN NEW.cost>0 AND NEW.game IN ('scratch','slot','sky','cards')
 AND COALESCE(json_extract(NEW.result_json,'$.cancelled'),0)=0
 AND COALESCE(json_extract(NEW.result_json,'$.migrated'),0)=0
 AND COALESCE(json_extract(NEW.result_json,'$.demo'),0)=0
 BEGIN INSERT INTO fun_achievement_events(employee_id,game,cost,prize,penalty,safe,depth)
 VALUES(NEW.employee_id,NEW.game,NEW.cost,NEW.prize,COALESCE(json_extract(NEW.result_json,'$.penalty'),0)+COALESCE(json_extract(NEW.result_json,'$.tax'),0),
 COALESCE(json_extract(NEW.result_json,'$.safe'),0) AND COALESCE(json_extract(NEW.result_json,'$.expired'),0)=0,
 COALESCE(json_extract(NEW.result_json,'$.depth'),0)); END;`);
 installFunDerbyAchievements(db);
}

export function installFunDerbyAchievements(db){
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='fun_achievement_events'").get())return;
 if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='derby_races'").get())db.exec(`
 DROP TRIGGER IF EXISTS fun_achievement_race;
 CREATE TRIGGER fun_achievement_race AFTER UPDATE OF settled ON derby_races WHEN OLD.settled=0 AND NEW.settled=1 BEGIN
 INSERT INTO fun_achievement_events(employee_id,game,cost,prize)
 SELECT employee_id,'derby',SUM(cost),SUM(prize) FROM derby_wagers WHERE race_id=NEW.id AND settled=1 GROUP BY employee_id HAVING SUM(cost)>0;
 END;`);
}
