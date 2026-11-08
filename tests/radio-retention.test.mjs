import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installRadioRetention,radioVisibleSQL} from '../server-radio-retention.mjs';

test('radio expires after 72 hours, including audit copies, without touching other records',t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE chat_messages(id INTEGER PRIMARY KEY,room TEXT,body TEXT,created_at TEXT);
 CREATE TABLE activity_logs(id INTEGER PRIMARY KEY,target TEXT,details TEXT,created_at TEXT);
 CREATE TABLE speech_revisions(id INTEGER PRIMARY KEY,source_type TEXT,source_id INTEGER);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,delta INTEGER);INSERT INTO balance_ledger VALUES(1,1234);
 INSERT INTO chat_messages VALUES(1,'sky','旧消息',strftime('%Y-%m-%dT%H:%M:%fZ','now','-73 hours')),(2,'derby','新消息',datetime('now','-71 hours'));
 INSERT INTO activity_logs VALUES(1,'chat_messages','{}',datetime('now','-73 hours')),(2,'forum_threads','{}',datetime('now','-90 days')),(3,'chat_messages',json_object('created_at',datetime('now','-73 hours')),CURRENT_TIMESTAMP),(4,'chat_messages','{}',CURRENT_TIMESTAMP);
 INSERT INTO speech_revisions VALUES(1,'chat',1),(2,'thread',1);`);
 const retention=installRadioRetention(db);t.after(()=>retention.close());
 assert.deepEqual(db.prepare('SELECT id FROM chat_messages').all().map(x=>x.id),[2]);
 assert.deepEqual(db.prepare('SELECT id FROM activity_logs ORDER BY id').all().map(x=>x.id),[2,4]);
 assert.equal(db.prepare('SELECT source_type FROM speech_revisions').get().source_type,'thread');
 assert.equal(db.prepare('SELECT delta FROM balance_ledger').get().delta,1234);
 db.exec("INSERT INTO chat_messages VALUES(3,'sky','等待下一次清理',datetime('now','-73 hours'))");
 assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM chat_messages c WHERE ${radioVisibleSQL}`).get().n,1,'reads hide expired messages before the hourly sweep');
 retention.prune();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chat_messages').get().n,1);
});
