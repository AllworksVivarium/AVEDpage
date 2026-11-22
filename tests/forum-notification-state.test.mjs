import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installForumSocial} from '../server-forum-social.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY,enabled INTEGER,role TEXT,display_name TEXT DEFAULT '',username TEXT,password_hash TEXT,department TEXT DEFAULT '',is_npc INTEGER DEFAULT 0);
 INSERT INTO employees(id,enabled,role,username) VALUES(1,1,'employee','owner'),(2,1,'employee','reader');
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT,avatar_url TEXT);INSERT INTO profiles VALUES(1,'作者',''),(2,'读者','');
 CREATE TABLE balance_ledger(employee_id INTEGER,delta INTEGER);
 CREATE TABLE forum_threads(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),title TEXT,body TEXT DEFAULT '',identity_mode TEXT DEFAULT 'anonymous',status TEXT DEFAULT 'published',moderation TEXT DEFAULT 'approved',deleted_at TEXT DEFAULT '');
 INSERT INTO forum_threads(id,employee_id,title) VALUES(1,1,'通知测试');
 CREATE TABLE forum_replies(id INTEGER PRIMARY KEY,thread_id INTEGER REFERENCES forum_threads(id),employee_id INTEGER REFERENCES employees(id),body TEXT,identity_mode TEXT DEFAULT 'anonymous',created_at TEXT DEFAULT CURRENT_TIMESTAMP,status TEXT DEFAULT 'published',moderation TEXT DEFAULT 'approved',deleted_at TEXT DEFAULT '',reply_to_id INTEGER REFERENCES forum_replies(id) ON DELETE SET NULL);
 INSERT INTO forum_replies(id,thread_id,employee_id,body) VALUES(1,1,1,'作者的评论');
 CREATE TABLE forum_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,reply_id INTEGER REFERENCES forum_replies(id) ON DELETE CASCADE,thread_id INTEGER,read_at TEXT NOT NULL DEFAULT '',UNIQUE(employee_id,reply_id));
 CREATE TABLE forum_notification_reads(employee_id INTEGER,thread_id INTEGER,last_notification_id INTEGER,PRIMARY KEY(employee_id,thread_id));`);
 return db;
}

test('binary-state migration preserves legacy reads and original reply kind across restart and parent deletion',()=>{
 const db=fixture();try{
  for(let i=10;i<=14;i++)db.prepare('INSERT INTO forum_replies(id,thread_id,employee_id,body,reply_to_id) VALUES(?,1,2,?,?)').run(i,'旧回复 '+i,i===13?1:null);
  for(let i=1;i<=5;i++)db.prepare('INSERT INTO forum_notifications(id,employee_id,reply_id,thread_id,read_at) VALUES(?,1,?,1,?)').run(i,i+9,i===3?'2026-11-18 00:00:00':'');
  db.exec('INSERT INTO forum_notification_reads VALUES(1,1,2)');
  let social=installForumSocial(db),rows=db.prepare('SELECT is_read,kind FROM forum_notifications ORDER BY id').all();
  assert.deepEqual(rows.map(r=>r.is_read),[1,1,1,0,0]);assert.equal(rows[3].kind,'reply');
  assert.equal(social.inbox(1).unread,2);
  social.readReplies(1,1,[13]);
  db.exec('UPDATE forum_notification_reads SET last_notification_id=999;DELETE FROM forum_replies WHERE id=1');
  social=installForumSocial(db);
  assert.equal(social.inbox(1).unread,1,'legacy cursors are not reapplied after migration');
  assert.equal(db.prepare('SELECT is_read,kind FROM forum_notifications WHERE reply_id=13').get().kind,'reply','a deleted parent never turns a direct notice into a thread summary');
  assert.throws(()=>db.exec('UPDATE forum_notifications SET is_read=2'),/CHECK/);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});

test('inbox limits never change total unread groups, and thread snapshots do not clear direct or unapproved notices',()=>{
 const db=fixture();try{
  const social=installForumSocial(db),insert=db.prepare('INSERT INTO forum_replies(thread_id,employee_id,body,reply_to_id,moderation) VALUES(1,2,?,?,?)');
  for(let i=0;i<25;i++)insert.run('单独回复 '+i,1,'approved');
  for(let i=0;i<10;i++)insert.run('普通回复 '+i,null,'approved');
  let inbox=social.inbox(1);assert.equal(inbox.unread,26);assert.equal(inbox.items.length,20);
  const summary=inbox.items.find(n=>n.kind==='thread');assert.equal(summary.count,10);
  const hidden=Number(insert.run('待审核',null,'pending').lastInsertRowid);
  // Even a broad legacy cursor cannot read a reply which was not public yet.
  social.read(1,1,Number.MAX_SAFE_INTEGER);
  assert.equal(social.inbox(1).unread,25);
  db.prepare("UPDATE forum_replies SET moderation='approved' WHERE id=?").run(hidden);
  assert.equal(social.inbox(1).unread,26);
  inbox=social.inbox(1);
  const directIds=inbox.items.filter(n=>n.kind==='reply').map(n=>n.replyId);social.readReplies(1,1,directIds);
  assert.equal(social.inbox(1).unread,26-directIds.length);assert.ok(social.inbox(1).items.some(n=>n.unread&&n.kind==='reply'));
  assert.throws(()=>social.readReplies(1,1,Array(21).fill(1)),/无效/);
  assert.throws(()=>social.read(1,1,-1),/无效/);
  assert.equal(social.inbox(2).unread,0);
 }finally{db.close();}
});
