import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installForumSocial,forumAuthorSQL} from '../server-forum-social.mjs';
import {ensureCompanyRobots} from '../server-company-robots.mjs';

test('old NOT NULL persona owners migrate without losing posts, references, views or triggers',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(`PRAGMA foreign_keys=ON;
   CREATE TABLE employees(id INTEGER PRIMARY KEY,enabled INTEGER,role TEXT,identity_kind TEXT,display_name TEXT DEFAULT '',username TEXT UNIQUE,password_hash TEXT,department TEXT DEFAULT '',is_npc INTEGER DEFAULT 0);
   INSERT INTO employees(id,enabled,role,identity_kind) VALUES(1,1,'admin','planning_member'),(2,0,'employee','player_employee'),(3,1,'employee','planning_member'),(4,0,'employee','player_employee');
   CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT,avatar_url TEXT);INSERT INTO profiles VALUES(1,'管理员','');
   CREATE TABLE balance_ledger(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,delta INTEGER);INSERT INTO balance_ledger VALUES(1,999999),(2,4242),(4,777);
   CREATE TABLE forum_personas(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,created_by INTEGER NOT NULL REFERENCES employees(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
   INSERT INTO forum_personas(id,name,created_by) VALUES(7,'旧角色',3),(8,'历史路人',3),(9,'未使用角色',3),(10,'仅回复角色',3);
   CREATE TABLE forum_threads(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),anonymous_name TEXT,title TEXT,body TEXT,persona_id INTEGER REFERENCES forum_personas(id),identity_mode TEXT DEFAULT 'anonymous',status TEXT DEFAULT 'published',moderation TEXT DEFAULT 'approved',deleted_at TEXT DEFAULT '');
   INSERT INTO forum_threads(id,employee_id,title,body,persona_id) VALUES(11,1,'旧主题','旧正文',7),(12,1,'历史主题','历史正文',8);
   CREATE TABLE forum_replies(id INTEGER PRIMARY KEY,thread_id INTEGER REFERENCES forum_threads(id),employee_id INTEGER REFERENCES employees(id),body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,status TEXT DEFAULT 'published',moderation TEXT DEFAULT 'approved',deleted_at TEXT DEFAULT '');
   ALTER TABLE forum_replies ADD COLUMN persona_id INTEGER REFERENCES forum_personas(id);INSERT INTO forum_replies(id,thread_id,employee_id,body,persona_id) VALUES(21,11,1,'仅回复角色正文',10);
   CREATE TABLE migration_audit(value INTEGER);
   CREATE VIEW legacy_persona_names AS SELECT id,name FROM forum_personas;
   CREATE TRIGGER legacy_persona_log AFTER UPDATE OF name ON forum_personas BEGIN INSERT INTO migration_audit VALUES(NEW.id);END;`);
  ensureCompanyRobots(db);db.exec("INSERT INTO company_robots(employee_id,codename) VALUES(2,'旧角色'),(4,'新机器人');CREATE TRIGGER legacy_robot_echo AFTER UPDATE OF codename ON company_robots BEGIN INSERT INTO migration_audit SELECT COUNT(*) FROM forum_personas;END;");
  const oldLedger=db.prepare('SELECT * FROM balance_ledger').all();
  const social=installForumSocial(db),read=id=>db.prepare(`SELECT ${forumAuthorSQL('t')} FROM forum_threads t WHERE id=?`).get(id);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
  assert.equal(db.prepare('PRAGMA table_info(forum_personas)').all().find(c=>c.name==='created_by').notnull,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM forum_threads').get().n,2);
  assert.equal(db.prepare('SELECT name FROM legacy_persona_names WHERE id=8').get().name,'历史路人');
  const items=social.list(1).items;assert.equal(items.length,4);assert.equal(items.find(p=>p.robotId===2).id,7);assert.equal(items.find(p=>p.robotId===4).balance,777);
  assert.equal(read(11).balance,4242);assert.equal(read(12).anonymousName,'历史路人');assert.equal(read(12).balance,0);assert.equal(social.persona(1,8),8);
  assert.equal(db.prepare('SELECT robot_employee_id FROM forum_personas WHERE id=9').get().robot_employee_id,null,'unused roles do not create accounts');
  assert.ok(db.prepare('SELECT robot_employee_id FROM forum_personas WHERE id=10').get().robot_employee_id,'reply-only identities migrate too');
  assert.deepEqual(db.prepare('SELECT * FROM balance_ledger').all(),oldLedger,'migration does not mint or transfer money');
  const created=db.prepare('SELECT e.enabled,e.is_npc,e.password_hash,p.avatar_preset FROM company_robots r JOIN employees e ON e.id=r.employee_id JOIN profiles p ON p.employee_id=e.id WHERE r.codename=?').get('历史路人');assert.equal(created.enabled,0);assert.equal(created.is_npc,1);assert.equal(created.password_hash.length,128);assert.ok(created.avatar_preset);
  assert.deepEqual(db.prepare('SELECT id,employee_id,persona_id FROM forum_threads ORDER BY id').all().map(r=>({...r})),[{id:11,employee_id:1,persona_id:7},{id:12,employee_id:1,persona_id:8}]);
  assert.deepEqual({...db.prepare('SELECT id,employee_id,persona_id FROM forum_replies WHERE id=21').get()},{id:21,employee_id:1,persona_id:10});
  const beforeRestart=db.prepare('SELECT COUNT(*) n FROM employees').get().n;installForumSocial(db);assert.equal(db.prepare('SELECT COUNT(*) n FROM employees').get().n,beforeRestart,'restarting does not create duplicate robots');
  db.exec("UPDATE company_robots SET codename='新名称' WHERE employee_id=2");assert.equal(read(11).anonymousName,'新名称');
  assert.ok(db.prepare('SELECT COUNT(*) n FROM migration_audit').get().n>0,'external trigger was recreated');
  db.exec('DELETE FROM employees WHERE id=3');assert.equal(db.prepare('SELECT created_by FROM forum_personas WHERE id=7').get().created_by,null);
  db.exec('DELETE FROM employees WHERE id=2');assert.equal(read(11).anonymousName,'新名称');assert.equal(read(11).balance,null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM forum_threads').get().n,2);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  installForumSocial(db);assert.equal(db.prepare('SELECT COUNT(*) n FROM company_robots').get().n,3,'deleted robots are not resurrected');assert.equal(db.prepare('SELECT COUNT(*) n FROM forum_threads').get().n,2,'restart migration is idempotent');
 }finally{db.close();}
});
