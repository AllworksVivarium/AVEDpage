import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installForumReplies} from '../server-forum-replies.mjs';

test('reply pages and bounded changes preserve edits, moderation and removals without replaying all replies',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT);INSERT INTO employees VALUES(1,'测试员工');
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY,anonymous_name TEXT,avatar_url TEXT DEFAULT '');INSERT INTO profiles(employee_id,anonymous_name) VALUES(1,'代号');
 CREATE TABLE balance_ledger(employee_id INTEGER,delta INTEGER);INSERT INTO balance_ledger VALUES(1,100);
 CREATE TABLE forum_replies(id INTEGER PRIMARY KEY,thread_id INTEGER,employee_id INTEGER,body TEXT,image_data TEXT DEFAULT '',identity_mode TEXT DEFAULT 'anonymous',created_at TEXT DEFAULT CURRENT_TIMESTAMP,edited_at TEXT DEFAULT '',status TEXT DEFAULT 'published',deleted_at TEXT DEFAULT '');`);
 const read=installForumReplies(db),q=s=>new URLSearchParams(s),add=db.prepare('INSERT INTO forum_replies(thread_id,employee_id,body) VALUES(?,1,?)');
 for(let i=0;i<45;i++)add.run(7,'回复 '+i);
 add.run(8,'另一个帖子');
 const first=read(7,1,q(''));assert.equal(first.items.length,20);assert.equal(first.next,20);assert.equal(first.items[0].canEdit,1);
 const next=read(7,2,q('after='+first.next));assert.equal(next.items.length,20);assert.equal(next.items[0].id,21);assert.equal(next.items[0].canEdit,0);
 const last=read(7,1,q('after='+next.next));assert.equal(last.items.length,5);assert.equal(last.next,null);
 assert.deepEqual(read(7,1,q('since='+first.changesCursor)).items,[]);
 db.exec("UPDATE forum_replies SET body='修改',edited_at=CURRENT_TIMESTAMP WHERE id=1; UPDATE forum_replies SET status='hidden' WHERE id=2; DELETE FROM forum_replies WHERE id=3;");
 add.run(7,'新增');const changes=read(7,1,q('since='+first.changesCursor));assert.deepEqual(changes.items.map(x=>x.body),['修改','新增']);assert.deepEqual(changes.removed,[2,3]);assert.equal(changes.moreChanges,false);
 db.exec("UPDATE forum_replies SET status='published' WHERE id=2");assert.equal(read(7,1,q('since='+changes.changesCursor)).items[0].id,2);
 let cursor=read(7,1,q('')).changesCursor;
 db.exec("UPDATE forum_replies SET body=body||' edit' WHERE thread_id=7");
 const seen=[];let page;do{page=read(7,1,q('since='+cursor));assert.ok(page.items.length<=20);seen.push(...page.items.map(x=>x.id));assert.ok(page.changesCursor>cursor);cursor=page.changesCursor;}while(page.moreChanges);
 assert.equal(seen.length,45);assert.equal(new Set(seen).size,45);
 assert.throws(()=>read(7,1,q('after=-1')));assert.throws(()=>read(7,1,q('since=NaN')));
 assert.deepEqual(installForumReplies(db)(7,1,q('since='+cursor)).items,[]);db.close();
});
