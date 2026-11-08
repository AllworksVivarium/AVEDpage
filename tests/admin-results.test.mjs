import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('activity trigger migration keeps only publication and ledger results',()=>{
 const db=new DatabaseSync(':memory:');
 const tables=['employees','profiles','balance_ledger','checkins','game_tickets','forum_threads','forum_replies','posts','dossiers','announcements','dossier_comments','chat_messages','stock_holdings'];
 for(const name of tables)db.exec(`CREATE TABLE ${name}(id INTEGER PRIMARY KEY,employee_id INTEGER,username TEXT,body TEXT)`);
 db.exec("CREATE TABLE activity_logs(id INTEGER PRIMARY KEY,employee_id INTEGER,username TEXT,action TEXT,target TEXT,details TEXT)");
 db.exec("CREATE TRIGGER audit_profiles_UPDATE AFTER UPDATE ON profiles BEGIN INSERT INTO activity_logs(action,target) VALUES('update','profiles'); END");
 const source=readFileSync(new URL('../player-service.mjs',import.meta.url),'utf8');
 const start=source.indexOf("  for(const table of ['employees'");const end=source.indexOf('  const award=',start);
 new Function('db',source.slice(start,end))(db);
 for(const name of tables)db.prepare(`INSERT INTO ${name}(employee_id,username,body) VALUES(1,'tester','message')`).run();
 for(const action of ['view','GET','login','logout','cards.pass','stock.buy'])db.prepare('INSERT INTO activity_logs(action,target) VALUES(?,?)').run(action,'terminal');
 db.exec("UPDATE profiles SET body='changed'");
 const rows=db.prepare('SELECT action,target FROM activity_logs').all();assert.equal(rows.length,6);assert.ok(rows.every(r=>r.action==='insert'));
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name='audit_profiles_UPDATE'").get().n,0);db.close();
});
