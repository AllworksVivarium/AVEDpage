import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installSocialAchievements,socialAchievementCatalog} from '../server-social-achievements.mjs';

function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY,is_npc INTEGER DEFAULT 0);
 INSERT INTO employees VALUES(1,0),(2,0),(3,1);
 CREATE TABLE gameplay_achievement_metrics(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,metric TEXT,value INTEGER,PRIMARY KEY(employee_id,metric));
 CREATE TABLE achievement_definitions(code TEXT PRIMARY KEY,title TEXT,description TEXT,metric TEXT,threshold INTEGER,enabled INTEGER DEFAULT 1);
 CREATE TABLE earned_achievements(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,code TEXT,PRIMARY KEY(employee_id,code));
 CREATE TABLE stock_trades(id INTEGER PRIMARY KEY,employee_id INTEGER,holding_before INTEGER,action TEXT,realized_pnl_change INTEGER);`);
 for(const table of ['forum_threads','forum_replies'])db.exec(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY,employee_id INTEGER,thread_id INTEGER,reply_to_id INTEGER,body TEXT DEFAULT '测试',status TEXT DEFAULT 'published',moderation TEXT DEFAULT 'approved',deleted_at TEXT DEFAULT '',persona_id INTEGER,identity_mode TEXT DEFAULT 'anonymous',image_data TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
 for(const d of socialAchievementCatalog)db.prepare('INSERT INTO achievement_definitions(code,title,description,metric,threshold) VALUES(?,?,?,?,?)').run(d.code,d.title,d.description,d.metric,d.threshold);
 installSocialAchievements(db);
 const metric=(id,name)=>db.prepare('SELECT value FROM gameplay_achievement_metrics WHERE employee_id=? AND metric=?').get(id,name)?.value||0;
 const earned=(id,code)=>!!db.prepare('SELECT 1 FROM earned_achievements WHERE employee_id=? AND code=?').get(id,code);
 const reply=(id,author,replyTo=null)=>db.prepare('INSERT INTO forum_replies(id,employee_id,thread_id,reply_to_id) VALUES(?,?,1,?)').run(id,author,replyTo);
 db.exec('INSERT INTO forum_threads(id,employee_id) VALUES(1,1)');
 return {db,metric,earned,reply};
}
test('forum events credit the real sender and both distinct recipients without self notifications',t=>{
 const {db,metric,earned,reply}=fixture(t);
 reply(1,1);reply(2,1,1);reply(3,2,2);
 assert.equal(metric(1,'forum_self_thread'),2);assert.equal(metric(1,'forum_self_reply'),1);
 assert.equal(metric(1,'forum_received'),1);assert.equal(metric(1,'forum_direct_received'),1);
 assert.ok(earned(2,'forum-talk'));assert.equal(metric(2,'forum_received'),0);
 db.exec("INSERT INTO forum_replies(id,employee_id,thread_id,persona_id) VALUES(4,2,1,9);INSERT INTO forum_replies(id,employee_id,thread_id) VALUES(5,3,1)");
 assert.equal(metric(2,'forum_replies'),1);assert.equal(metric(3,'forum_replies'),0);assert.equal(metric(1,'forum_received'),1);
});
test('rapid reply is a bounded event window, persists through restart, and rolls back with the post',t=>{
 const {db,metric,earned,reply}=fixture(t);
 reply(1,2);reply(2,2);assert.equal(earned(2,'forum-water'),false);
 db.exec("UPDATE social_achievement_events SET happened_at=unixepoch()-61 WHERE source='reply' AND source_id=1");
 reply(3,2);assert.equal(earned(2,'forum-water'),false);
 installSocialAchievements(db);assert.equal(metric(2,'forum_replies'),3);
 db.exec('BEGIN');reply(4,2);assert.ok(earned(2,'forum-water'));db.exec('ROLLBACK');assert.equal(earned(2,'forum-water'),false);
 reply(4,2);assert.ok(earned(2,'forum-water'));
});
test('pending, hidden, deleted and role-play posts do not count; publication counts once and edits cannot farm it',t=>{
 const {db,metric,earned}=fixture(t);
 db.exec("INSERT INTO forum_replies(id,employee_id,thread_id,moderation,image_data,identity_mode,body) VALUES(1,2,1,'pending','image','real',printf('%0300d',0))");
 assert.equal(metric(2,'forum_replies'),0);
 db.exec("UPDATE forum_replies SET moderation='approved' WHERE id=1");
 assert.equal(metric(2,'forum_replies'),1);assert.ok(earned(2,'forum-image'));assert.ok(earned(2,'forum-long'));assert.ok(earned(2,'forum-real'));
 db.exec("UPDATE forum_replies SET status='hidden' WHERE id=1;UPDATE forum_replies SET status='published' WHERE id=1;UPDATE forum_replies SET body='edit' WHERE id=1");
 assert.equal(metric(2,'forum_replies'),1);
 db.exec("INSERT INTO forum_replies(id,employee_id,thread_id,deleted_at) VALUES(2,2,1,'deleted');INSERT INTO forum_replies(id,employee_id,thread_id,status) VALUES(3,2,1,'hidden')");
 assert.equal(metric(2,'forum_replies'),1);
 db.exec('DELETE FROM forum_replies WHERE id=1');
 db.exec('INSERT INTO forum_replies(id,employee_id,thread_id) VALUES(1,2,1)');
 assert.equal(metric(2,'forum_replies'),2,'a new row can reuse a physically deleted id');
});
test('stock awards distinguish opening, long/short closing, losses and zero PnL; no money is written',t=>{
 const {db,metric,earned}=fixture(t);
 db.exec("INSERT INTO stock_trades VALUES(1,1,0,'buy',0),(2,1,10,'sell',50),(3,1,-10,'buy',-20),(4,1,5,'sell',0)");
 assert.equal(metric(1,'stock_trades'),4);assert.equal(metric(1,'stock_closes'),3);
 for(const code of ['stock-first','stock-close','stock-profit','stock-flat','stock-loss'])assert.ok(earned(1,code));
 db.exec('BEGIN');db.exec("INSERT INTO stock_trades VALUES(5,1,10,'sell',5)");db.exec('ROLLBACK');
 assert.equal(metric(1,'stock_wins'),1);installSocialAchievements(db);assert.equal(metric(1,'stock_wins'),1);
 db.exec("UPDATE achievement_definitions SET enabled=0 WHERE code='stock-first';INSERT INTO stock_trades VALUES(5,2,0,'buy',0)");
 assert.equal(earned(2,'stock-first'),false);
});
