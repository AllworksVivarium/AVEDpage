import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installBarExtras,JUKEBOX_PRICE} from '../server-bar-extras.mjs';
import {barDrinks} from '../server-bar-catalog.mjs';
function fixture(t){
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT,enabled INTEGER DEFAULT 1,is_npc INTEGER DEFAULT 0,identity_kind TEXT DEFAULT 'player_employee');INSERT INTO employees(id,display_name) VALUES(1,'甲真名'),(2,'乙真名'),(3,'丙真名');CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT);INSERT INTO profiles VALUES(1,'甲代号'),(2,'乙代号'),(3,'丙代号');CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,reason TEXT);INSERT INTO balance_ledger(employee_id,delta) VALUES(1,100000),(2,100000),(3,100000);CREATE TABLE bar_orders(id INTEGER PRIMARY KEY,employee_id INTEGER,day TEXT,drink_id TEXT,price INTEGER,request_key TEXT,created_at TEXT,payer_id INTEGER,gift_id INTEGER,round_id INTEGER,UNIQUE(employee_id,request_key));`);
 let now=Date.parse('2026-11-18T04:00:00Z');const cups=new Map(),music={enabled:true,tracks:[]},balanceFor=id=>db.prepare('SELECT COALESCE(SUM(delta),0) n FROM balance_ledger WHERE employee_id=?').get(id).n,options={db,clock:()=>now,dayFor:n=>new Date(n).toISOString().slice(0,10),balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason),name:id=>db.prepare('SELECT anonymous_name n FROM profiles WHERE employee_id=?').get(id).n,isContainment:id=>id===3,getMusic:()=>music,drinking:{currentOrder:id=>cups.get(id),invalidate(){}}};
 let service=installBarExtras(options);t.after(()=>db.close());return {db,cups,music,balanceFor,get service(){return service;},advance:ms=>now+=ms,restart:()=>service=installBarExtras(options),get now(){return now;}};
}
const actor=id=>({id}),drink=barDrinks.find(d=>d.id==='lemon-cocktail'),key='bar-extra-request-0001';
const token=(f,mode='anonymous',id=2)=>f.service.contacts(actor(1),mode,id===2?'乙':'丙')[0].token;
const gift=(f,extra={})=>({recipientMode:'anonymous',recipientToken:token(f),drinkId:drink.id,identityMode:'anonymous',note:'给你留着。',requestId:key,...extra});
test('contact handles and returned names are isolated by identity, persistent and never expose account IDs',t=>{
 const f=fixture(t),anon=f.service.contacts(actor(1),'anonymous','乙')[0],real=f.service.contacts(actor(1),'real','乙')[0];assert.equal(anon.name,'乙代号');assert.equal(real.name,'乙真名');assert.notEqual(anon.token,real.token);assert.deepEqual(Object.keys(anon).sort(),['isContainment','name','token']);
 assert.doesNotMatch(JSON.stringify(anon),/真名|employee|username|recipientId/);f.restart();assert.equal(token(f),anon.token);
 assert.throws(()=>f.service.leave(actor(1),gift(f,{recipientMode:'real',recipientToken:anon.token})),/请选择/);assert.equal(f.balanceFor(1),100000);
 const saved=gift(f,{recipientToken:anon.token});f.db.prepare('UPDATE employees SET enabled=0 WHERE id=2').run();assert.equal(f.service.contacts(actor(1),'real','乙').length,0);assert.throws(()=>f.service.leave(actor(1),saved),/请选择/);
});
test('offline leave is prepaid once, accepted privately in the addressed mode, and cannot replace an unfinished cup',t=>{
 const f=fixture(t),body=gift(f);f.service.leave(actor(1),body);f.service.leave(actor(1),body);assert.equal(f.balanceFor(1),100000-drink.price);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_orders').get().n,0);
 const sent=f.service.personal(1).items[0],incoming=f.service.personal(2).items[0];assert.equal(sent.status,'stored');assert.equal(incoming.senderName,'甲代号');assert.doesNotMatch(JSON.stringify(incoming),/甲真名|乙真名|senderId|recipientId|employeeId/);
 assert.throws(()=>f.service.leave(actor(1),{...body,note:'换了留言'}),/凭据/);assert.throws(()=>f.service.receive(actor(3),sent.id,{decision:'accepted',identityMode:'anonymous'}));assert.throws(()=>f.service.receive(actor(2),sent.id,{decision:'accepted',identityMode:'real'}),/收件身份/);
 f.cups.set(2,{remainingMl:10});assert.throws(()=>f.service.receive(actor(2),sent.id,{decision:'accepted',identityMode:'anonymous'}),/喝完/);f.cups.clear();
 f.service.receive(actor(2),sent.id,{decision:'accepted',identityMode:'anonymous'});f.restart();f.service.receive(actor(2),sent.id,{decision:'accepted',identityMode:'anonymous'});
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_orders').get().n,1);assert.equal(f.balanceFor(2),100000);assert.equal(f.balanceFor(1),100000-drink.price);assert.equal(f.service.personal(1).items[0].status,'stored');assert.equal(f.service.personal(2).items.length,0);
});
test('real and anonymous deliveries remain independent and public drinks have exactly one recipient',t=>{
 const f=fixture(t);f.service.leave(actor(1),gift(f,{recipientMode:'real',recipientToken:token(f,'real'),identityMode:'real'}));const row=f.service.personal(2).items[0];assert.equal(row.senderName,'甲真名');assert.equal(row.recipientName,'乙真名');assert.doesNotMatch(JSON.stringify(row),/甲代号|乙代号/);
 f.service.leave(actor(1),gift(f,{recipientMode:'public',recipientToken:undefined,requestId:key+'2'}));const pub=f.service.personal(3).items.find(i=>i.recipientMode==='public');f.service.receive(actor(3),pub.id,{decision:'accepted'});assert.throws(()=>f.service.receive(actor(2),pub.id,{decision:'accepted'}),/领用|到期/);assert.equal(f.service.personal(1).items.find(i=>i.id===pub.id).recipientName,'下一位客人');
});
test('decline and expiry refund exactly once; a failed insert rolls the debit back',t=>{
 const f=fixture(t);f.service.leave(actor(1),gift(f));const id=f.service.personal(2).items[0].id;f.service.receive(actor(2),id,{decision:'declined',identityMode:'anonymous'});f.service.receive(actor(2),id,{decision:'declined',identityMode:'anonymous'});assert.equal(f.balanceFor(1),100000);
 f.service.leave(actor(1),gift(f,{requestId:key+'2'}));f.advance(7*86400000);f.service.personal(1);f.restart();f.service.personal(1);assert.equal(f.balanceFor(1),100000);
 f.db.exec("CREATE TRIGGER fail_kept BEFORE INSERT ON bar_stored_drinks BEGIN SELECT RAISE(ABORT,'fixture'); END");assert.throws(()=>f.service.leave(actor(1),gift(f,{requestId:key+'3'})),/fixture/);assert.equal(f.balanceFor(1),100000);assert.equal(f.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
});
test('jukebox rejects empty catalog, charges the server price once and persists ordered playback without identity IDs',t=>{
 const f=fixture(t),body={trackId:7,requestId:key,message:'今晚慢慢坐。',identityMode:'anonymous',price:1};assert.throws(()=>f.service.requestSong(actor(1),body),/上架/);assert.equal(f.balanceFor(1),100000);
 f.music.tracks=[{id:7,title:'测试唱片',durationSeconds:90}];f.service.requestSong(actor(1),body);f.service.requestSong(actor(1),body);assert.equal(f.balanceFor(1),100000-JUKEBOX_PRICE);
 f.service.requestSong(actor(2),{...body,identityMode:'real'});f.restart();const q=f.service.queue().queue;assert.equal(q.length,2);assert.equal(q[0].endsAt-q[0].startsAt,90000);assert.equal(q[1].startsAt,q[0].endsAt);assert.equal(q[0].alias,'甲代号');assert.equal(q[1].alias,'乙真名');assert.doesNotMatch(JSON.stringify(q),/employeeId|senderId|甲真名|乙代号/);
 assert.throws(()=>f.service.requestSong(actor(1),{...body,message:'不同留言'}),/凭据/);f.music.tracks=[];assert.equal(f.service.queue().queue.length,0);assert.equal(f.balanceFor(1),100000);f.service.queue();assert.equal(f.balanceFor(1),100000);
});
test('jukebox queue cap, insufficient funds and transaction failures cannot create unpaid requests',t=>{
 const f=fixture(t);f.music.tracks=[{id:7,title:'测试',durationSeconds:60}];const body={trackId:7,requestId:key};f.service.requestSong(actor(1),body);f.service.requestSong(actor(1),{...body,requestId:key+'2'});assert.throws(()=>f.service.requestSong(actor(1),{...body,requestId:key+'3'}),/两首/);assert.equal(f.balanceFor(1),40000);
 f.db.exec("CREATE TRIGGER fail_juke BEFORE INSERT ON bar_jukebox_requests BEGIN SELECT RAISE(ABORT,'fixture'); END");assert.throws(()=>f.service.requestSong(actor(2),body),/fixture/);assert.equal(f.balanceFor(2),100000);f.advance(120000);assert.equal(f.service.queue().queue.length,0);
});
test('regular drink is inferred from three paid personal orders on two days, excluding gifts, rounds and water',t=>{
 const f=fixture(t),insert=f.db.prepare('INSERT INTO bar_orders(employee_id,day,drink_id,price,request_key,payer_id,gift_id,round_id) VALUES(?,?,?,?,?,?,?,?)');
 for(let i=0;i<3;i++)insert.run(1,'2026-11-17',drink.id,drink.price,'regular-'+i,1,null,null);assert.equal(f.service.usual(1),null);
 insert.run(1,'2026-11-18',drink.id,drink.price,'regular-4',1,null,null);f.service.invalidate(1);assert.equal(f.service.usual(1).drinkId,drink.id);
 for(let i=0;i<8;i++)insert.run(2,i%2?'2026-11-18':'2026-11-17',drink.id,drink.price,'gift-'+i,1,i+1,null);assert.equal(f.service.usual(2),null);assert.equal(f.service.usual(3),null);
});
