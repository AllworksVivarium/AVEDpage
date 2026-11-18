import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {installForumReactions,forumReactionCatalog} from '../server-forum-reactions.mjs';
function fixture(t){const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY);INSERT INTO employees VALUES(1),(2),(3);CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER,reason TEXT);INSERT INTO balance_ledger(employee_id,delta) VALUES(1,1000000),(2,1000000),(3,1);CREATE TABLE forum_threads(id INTEGER PRIMARY KEY,status TEXT,moderation TEXT,deleted_at TEXT);INSERT INTO forum_threads VALUES(10,'published','approved',''),(20,'hidden','pending','');CREATE TABLE forum_replies(id INTEGER PRIMARY KEY,thread_id INTEGER REFERENCES forum_threads(id),status TEXT,moderation TEXT,deleted_at TEXT);INSERT INTO forum_replies VALUES(11,10,'published','approved',''),(12,10,'hidden','pending',''),(21,20,'published','approved','');CREATE TABLE forum_reply_clock(id INTEGER PRIMARY KEY,revision INTEGER);INSERT INTO forum_reply_clock VALUES(1,1);ALTER TABLE forum_threads ADD COLUMN employee_id INTEGER DEFAULT 2;ALTER TABLE forum_threads ADD COLUMN title TEXT DEFAULT '测试主题';ALTER TABLE forum_replies ADD COLUMN employee_id INTEGER DEFAULT 2;`);const balanceFor=id=>db.prepare('SELECT COALESCE(SUM(delta),0) n FROM balance_ledger WHERE employee_id=?').get(id).n;const service=installForumReactions({db,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason)});return {db,service,balanceFor};}
const data={kind:'reply',targetId:11,reaction:'question',confirmed:true};
test('paid reactions debit once per account, aggregate people, and never reveal identities',t=>{const f=fixture(t),cost=forumReactionCatalog.find(x=>x.id==='question').price;assert.equal(f.service.add(1,{...data,price:1}).charged,cost);assert.equal(f.service.add(1,data).charged,0);assert.equal(f.balanceFor(1),1000000-cost);const result=f.service.add(2,data);assert.deepEqual(result.reactions,[{id:'question',count:2,mine:1}]);assert.deepEqual(f.service.summary('reply',11,3),[{id:'question',count:2,mine:0}]);assert.equal(f.db.prepare('SELECT revision FROM forum_reaction_versions WHERE thread_id=10').get().revision,3);});
test('invalid, hidden, deleted and unaffordable reactions never charge',t=>{const f=fixture(t);for(const change of [{confirmed:false},{reaction:'unknown'},{targetId:12},{targetId:21},{targetId:999},{targetId:1.1},{kind:'employees'}])assert.throws(()=>f.service.add(1,{...data,...change}));assert.throws(()=>f.service.add(3,data),/余额不足/);assert.equal(f.balanceFor(1),1000000);assert.equal(f.balanceFor(3),1);f.db.exec("UPDATE forum_threads SET deleted_at='deleted' WHERE id=10");assert.throws(()=>f.service.add(1,data));assert.equal(f.db.prepare('SELECT COUNT(*) n FROM forum_reactions').get().n,0);});
test('reaction insert failure rolls back the ledger and revision',t=>{const f=fixture(t);f.db.exec("CREATE TRIGGER reject_reaction BEFORE INSERT ON forum_reactions BEGIN SELECT RAISE(ABORT,'rollback fixture');END;");assert.throws(()=>f.service.add(1,data),/rollback fixture/);assert.equal(f.balanceFor(1),1000000);assert.equal(f.db.prepare('SELECT revision FROM forum_reply_clock').get().revision,1);});
test('one batch decorates only visible replies, preserves unchanged paging, and separates thread reactions',t=>{const f=fixture(t);f.service.add(1,data);f.service.add(1,{...data,kind:'thread',targetId:10,reaction:'flower'});const result=f.service.decoratePage(10,{items:[{id:11},{id:13}],page:1},2);assert.deepEqual(result.threadReactions,[{id:'flower',count:1,mine:0}]);assert.deepEqual(result.items[0].reactions,[{id:'question',count:1,mine:0}]);assert.deepEqual(result.items[1].reactions,[]);assert.equal(f.service.decoratePage(10,{notModified:true},1).notModified,true);assert.ok(forumReactionCatalog.some(x=>x.name==='问号'));assert.ok(forumReactionCatalog.every(x=>x.animated));});

test('new reactions use the lower server prices; retired reactions cannot be purchased',t=>{
 const f=fixture(t);for(const id of ['thumb','hundred','pig','plus','bulb','medal','fan','thinking','mahjong','check','grin','ambulance','pray','brokenHeart','good','cross']){
  const item=forumReactionCatalog.find(x=>x.id===id);assert.ok(item);assert.ok(item.price>=200&&item.price<=3000);
  assert.equal(f.service.add(1,{...data,reaction:id,price:1}).charged,item.price);
 }
 assert.equal(forumReactionCatalog.some(x=>x.id==='signal'),false);assert.throws(()=>f.service.add(1,{...data,reaction:'signal'}));
 assert.ok(forumReactionCatalog.filter(x=>x.animated).every(x=>x.price<=6000));
});

test('reactions share four uniform price rows with praise first and question last',()=>{
 const cost=id=>forumReactionCatalog.find(x=>x.id===id).price;
 assert.deepEqual([...new Set(forumReactionCatalog.map(x=>x.price))].sort((a,b)=>a-b),[300,800,1500,3000]);
 assert.equal(cost('fan'),1500);assert.equal(cost('heart'),cost('brokenHeart'));assert.equal(cost('check'),cost('cross'));assert.equal(forumReactionCatalog.findIndex(x=>x.id==='cross'),forumReactionCatalog.findIndex(x=>x.id==='check')+1);assert.equal(cost('question'),3000);
 assert.deepEqual(forumReactionCatalog.slice(0,4).map(x=>[x.id,x.price]),[['plus',300],['heart',300],['brokenHeart',300],['thumb',300]]);assert.equal(forumReactionCatalog.at(-1).id,'question');
 for(let row=0;row<4;row++)assert.deepEqual(forumReactionCatalog.slice(row*6,row*6+6).map(x=>x.price),Array(6).fill([300,800,1500,3000][row]));
 assert.deepEqual(forumReactionCatalog.slice(18,21).map(x=>x.id),['grin','applause','thinking']);
 assert.deepEqual(forumReactionCatalog.map(x=>x.price),forumReactionCatalog.map(x=>x.price).sort((a,b)=>a-b));
});

test('reaction notices are private, independent, deduplicated and scoped to visible content',t=>{
 const f=fixture(t);f.service.add(1,data);f.service.add(1,data);f.service.add(2,{...data,reaction:'heart'});
 let inbox=f.service.inbox(2);assert.equal(inbox.unread,1);assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].reaction,'question');
 assert.equal(inbox.items[0].replyId,11);assert.equal(inbox.items[0].threadId,10);
 assert.deepEqual(Object.keys(inbox.items[0]).sort(),['createdAt','notificationId','reaction','replyId','threadId','title','unread'].sort());
 assert.equal(f.service.inbox(1).unread,0);assert.equal(f.service.inbox(3).items.length,0);
 const notice=inbox.items[0].notificationId;f.service.read(1,[notice]);assert.equal(f.service.inbox(2).unread,1);
 f.service.add(1,{...data,kind:'thread',targetId:10,reaction:'fan'});
 f.service.read(2,[notice]);inbox=f.service.inbox(2);assert.equal(inbox.unread,1);assert.equal(inbox.items.find(x=>x.notificationId===notice).unread,0);
 assert.equal(inbox.items.find(x=>x.unread).replyId,0);
 f.db.exec("UPDATE forum_threads SET moderation='pending' WHERE id=10");assert.deepEqual(f.service.inbox(2),{unread:0,items:[]});
 for(const bad of [null,'1',[0],[1.2],Array(21).fill(1)])assert.throws(()=>f.service.read(2,bad));
});
test('a failed notice write rolls back payment, reaction and revision together',t=>{
 const f=fixture(t);f.db.exec("CREATE TRIGGER reject_notice BEFORE INSERT ON forum_reaction_notifications BEGIN SELECT RAISE(ABORT,'notice fixture');END;");
 assert.throws(()=>f.service.add(1,data),/notice fixture/);assert.equal(f.balanceFor(1),1000000);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM forum_reactions').get().n,0);assert.equal(f.db.prepare('SELECT revision FROM forum_reply_clock').get().revision,1);
});
