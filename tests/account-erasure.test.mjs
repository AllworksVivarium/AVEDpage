import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {eraseEmployeeAccount} from '../server-account-erasure.mjs';

function fixture(t){
 const directory=mkdtempSync(join(tmpdir(),'aved-erasure-')),db=new DatabaseSync(join(directory,'wanyehui.db'));
 t.after(()=>{db.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});});
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,created_at TEXT);
 INSERT INTO employees VALUES(1,'erase-me','同名员工','2026-01-01'),(2,'keep-me','同名员工','2026-01-02');
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,anonymous_name TEXT);INSERT INTO profiles VALUES(1,'曾用代号'),(2,'保留代号');
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,delta INTEGER,reason TEXT,created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL);
 INSERT INTO balance_ledger VALUES(1,1,10000,'初始余额',NULL),(2,2,10000,'初始余额',1),(3,1,-300,'向同名员工捐赠',NULL),(4,2,300,'收到同名员工的捐赠',NULL);
 CREATE TABLE employee_donations(id INTEGER PRIMARY KEY,sender_id INTEGER REFERENCES employees(id),recipient_id INTEGER REFERENCES employees(id),sender_ledger_id INTEGER REFERENCES balance_ledger(id),recipient_ledger_id INTEGER REFERENCES balance_ledger(id));INSERT INTO employee_donations VALUES(1,1,2,3,4);
 CREATE TABLE company_fund(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,amount INTEGER,source_ledger_id INTEGER REFERENCES balance_ledger(id) ON DELETE SET NULL,request_key TEXT);INSERT INTO company_fund VALUES(1,1,500,1,'account-1-fund');
 CREATE TABLE announcements(id INTEGER PRIMARY KEY,created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,title TEXT);INSERT INTO announcements VALUES(1,1,'被删公告'),(2,2,'保留公告');
 CREATE TABLE posts(id INTEGER PRIMARY KEY,announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,body TEXT,deleted_by INTEGER);INSERT INTO posts VALUES(1,2,1,'被删评论',NULL),(2,2,2,'保留评论',1),(3,1,2,'被删公告下的评论',NULL);
 CREATE TABLE forum_threads(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE);INSERT INTO forum_threads VALUES(1,1),(2,2);
 CREATE TABLE forum_replies(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,thread_id INTEGER REFERENCES forum_threads(id) ON DELETE CASCADE,reply_to_id INTEGER REFERENCES forum_replies(id) ON DELETE SET NULL);INSERT INTO forum_replies VALUES(1,1,2,NULL),(2,2,2,1),(3,2,1,NULL);
 CREATE TABLE forum_reactions(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,target_kind TEXT,target_id INTEGER);INSERT INTO forum_reactions VALUES(1,2,'reply',1);
 CREATE TABLE forum_reaction_notifications(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,reaction_id INTEGER REFERENCES forum_reactions(id) ON DELETE CASCADE);INSERT INTO forum_reaction_notifications VALUES(1,2,1);
 CREATE TABLE life_records(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),body TEXT);INSERT INTO life_records VALUES(1,1,'生活图文'),(2,2,'保留图文');
 CREATE TABLE chat_messages(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,body TEXT);INSERT INTO chat_messages VALUES(1,1,'游戏聊天'),(2,2,'保留聊天');
 CREATE TABLE bar_messages(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,body TEXT);INSERT INTO bar_messages VALUES(1,1,'酒吧聊天'),(2,2,'保留酒吧聊天');
 CREATE TABLE speech_revisions(id INTEGER PRIMARY KEY,employee_id INTEGER,source_type TEXT,source_id INTEGER,before_json TEXT);INSERT INTO speech_revisions VALUES(1,1,'comment',1,'历史正文'),(2,2,'reply',3,'被删主题下的历史'),(3,2,'comment',2,'保留修订');
 CREATE TABLE image_upload_archive(id INTEGER PRIMARY KEY,employee_id INTEGER,username TEXT,source_type TEXT,source_id INTEGER,image_data TEXT,reviewed_by INTEGER,reviewer_name TEXT);INSERT INTO image_upload_archive VALUES(1,1,'erase-me','life',1,'image1',NULL,''),(2,2,'keep-me','reply',3,'image2',NULL,''),(3,2,'keep-me','life',2,'image3',1,'同名员工');
 CREATE TABLE activity_logs(id INTEGER PRIMARY KEY,employee_id INTEGER,username TEXT,target TEXT,details TEXT);INSERT INTO activity_logs VALUES(1,1,'erase-me','posts','{}'),(2,2,'keep-me','employees','{"id":1}'),(3,2,'keep-me','forum_replies','{"id":3}'),(4,2,'keep-me','balance_ledger','{"id":4,"reason":"收到同名员工的捐赠"}'),(5,2,'keep-me','posts','{"id":2}');
 CREATE TABLE event_account_history(id INTEGER PRIMARY KEY,employee_id INTEGER,username TEXT);CREATE TRIGGER event_account_deleted BEFORE DELETE ON employees BEGIN INSERT INTO event_account_history(employee_id,username) VALUES(OLD.id,OLD.username);END;
 CREATE TABLE alias_history(id INTEGER PRIMARY KEY,employee_id INTEGER,alias TEXT);INSERT INTO alias_history VALUES(1,1,'曾用代号');
 CREATE TABLE avatar_thumbnails(employee_id INTEGER,image BLOB);INSERT INTO avatar_thumbnails VALUES(1,X'1234'),(2,X'5678');
 CREATE TABLE future_owned(id INTEGER PRIMARY KEY,account INTEGER REFERENCES employees(id));INSERT INTO future_owned VALUES(1,1),(2,2);
 CREATE TABLE future_child(id INTEGER PRIMARY KEY,parent INTEGER REFERENCES future_owned(id));INSERT INTO future_child VALUES(1,1),(2,2);
 CREATE TABLE bar_stored_drinks(id INTEGER PRIMARY KEY,sender_id INTEGER REFERENCES employees(id),recipient_id INTEGER REFERENCES employees(id),price INTEGER,status TEXT);INSERT INTO bar_stored_drinks VALUES(1,2,1,200,'pending');
 CREATE TABLE card_money_rounds(id TEXT PRIMARY KEY,room_id TEXT,rules_json TEXT,settlement_json TEXT,system_delta INTEGER);INSERT INTO card_money_rounds VALUES('round','room','{}',NULL,NULL);
 CREATE TABLE card_money_seats(round_id TEXT REFERENCES card_money_rounds(id),seat INTEGER,employee_id INTEGER,reserve INTEGER);INSERT INTO card_money_seats VALUES('round',0,1,1000),('round',1,2,1000);
 CREATE TABLE card_table_rooms(id TEXT PRIMARY KEY,state_json TEXT);INSERT INTO card_table_rooms VALUES('room','{"host":1,"seats":[{"id":1},{"id":2}]}');
 CREATE TABLE sessions(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,token_hash TEXT);INSERT INTO sessions VALUES(1,'victim-session'),(2,'peer-session');`);
 const balance=id=>db.prepare('SELECT COALESCE(SUM(delta),0) n FROM balance_ledger WHERE employee_id=?').get(id).n;
 return {db,directory,balance};
}

test('hard deletion clears owned speech, archives, foreign and soft references without changing unrelated content or money',t=>{
 const f=fixture(t),before=f.balance(2);
 const result=eraseEmployeeAccount({db:f.db,dataDir:f.directory,employeeId:1});
 assert.deepEqual(result.rooms,['room']);assert.equal(f.balance(2),before+1200,'only escrow and pending gifts are refunded');
 for(const table of ['employees','profiles','chat_messages','bar_messages','life_records','future_owned','future_child','avatar_thumbnails','sessions'])assert.equal(f.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,1,table);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM posts').get().n,1);assert.equal(f.db.prepare('SELECT deleted_by FROM posts WHERE id=2').get().deleted_by,null);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM forum_replies').get().n,1);assert.equal(f.db.prepare('SELECT reply_to_id FROM forum_replies WHERE id=2').get().reply_to_id,null);
 for(const table of ['forum_reactions','forum_reaction_notifications','event_account_history','alias_history','employee_donations','bar_stored_drinks','card_table_rooms'])assert.equal(f.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0,table);
 assert.deepEqual(f.db.prepare('SELECT id FROM speech_revisions').all().map(r=>r.id),[3]);assert.deepEqual(f.db.prepare('SELECT id FROM image_upload_archive').all().map(r=>r.id),[3]);
 assert.equal(f.db.prepare('SELECT reviewer_name FROM image_upload_archive').get().reviewer_name,'');
 assert.deepEqual(f.db.prepare('SELECT id FROM activity_logs').all().map(r=>r.id),[5]);
 assert.equal(f.db.prepare('SELECT reason FROM balance_ledger WHERE id=4').get().reason,'员工捐赠');
 const fund=f.db.prepare('SELECT * FROM company_fund').get();assert.equal(fund.amount,500);assert.equal(fund.employee_id,null);assert.equal(fund.source_ledger_id,null);assert.equal(fund.request_key,null);
 assert.equal(f.db.prepare('SELECT display_name FROM employees').get().display_name,'同名员工','a matching real name is not a deletion key');
 assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(f.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 assert.equal(eraseEmployeeAccount({db:f.db,dataDir:f.directory,employeeId:1}),null,'retries cannot duplicate refunds');
});

test('a failed delete rolls back all content and refunds, including snapshot work',t=>{
 const f=fixture(t),before=f.balance(2);mkdirSync(join(f.directory,'daily-backups'));const snapshot=join(f.directory,'daily-backups','daily-2026-11-19.sqlite');f.db.prepare('VACUUM INTO ?').run(snapshot);
 f.db.exec("CREATE TRIGGER reject_delete BEFORE DELETE ON employees WHEN OLD.id=1 BEGIN SELECT RAISE(ABORT,'test failure');END;");
 assert.throws(()=>eraseEmployeeAccount({db:f.db,dataDir:f.directory,employeeId:1}),/test failure/);
 assert.equal(f.balance(2),before);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM posts').get().n,3);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM employees').get().n,2);assert.equal(f.db.isTransaction,false);
 const saved=new DatabaseSync(snapshot);assert.equal(saved.prepare('SELECT COUNT(*) n FROM employees').get().n,2);assert.equal(saved.prepare('SELECT COUNT(*) n FROM posts').get().n,3);saved.close();
});

test('the shared maintenance lock prevents a simultaneous backup from restoring erased data',t=>{
 const f=fixture(t),lock=new DatabaseSync(join(f.directory,'maintenance-lock.sqlite'));
 lock.exec('BEGIN IMMEDIATE');
 try{assert.throws(()=>eraseEmployeeAccount({db:f.db,dataDir:f.directory,employeeId:1,lockTimeoutMs:1}),error=>error.status===503);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM employees').get().n,2);}
 finally{lock.exec('ROLLBACK');lock.close();}
 assert.ok(eraseEmployeeAccount({db:f.db,dataDir:f.directory,employeeId:1}));
});

test('both existing recovery snapshots are purged and a reused ID belonging to another account is protected',t=>{
 const f=fixture(t),directory=join(f.directory,'daily-backups');mkdirSync(directory);
 for(const name of ['daily-2026-11-19.sqlite','five-day-2026-11-18.sqlite'])f.db.prepare('VACUUM INTO ?').run(join(directory,name));
 const changed=new DatabaseSync(join(directory,'five-day-2026-11-18.sqlite'));changed.exec("UPDATE employees SET created_at='2025-01-01' WHERE id=1");changed.close();
 const result=eraseEmployeeAccount({db:f.db,dataDir:f.directory,employeeId:1});assert.equal(result.snapshotsSanitized,1);
 for(const [name,count] of [['daily-2026-11-19.sqlite',0],['five-day-2026-11-18.sqlite',1]]){const backup=new DatabaseSync(join(directory,name));assert.equal(backup.prepare('SELECT COUNT(*) n FROM employees WHERE id=1').get().n,count);if(!count)assert.equal(backup.prepare('SELECT COUNT(*) n FROM event_account_history').get().n,0);assert.equal(backup.prepare('PRAGMA quick_check').get().quick_check,'ok');backup.close();}
});
