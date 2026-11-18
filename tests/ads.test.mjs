import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {installAds,adDay} from '../server-ads.mjs';

function fixture(t){const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY);INSERT INTO employees VALUES(1),(2),(3);CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,reason TEXT);INSERT INTO balance_ledger(employee_id,delta) VALUES(1,5000000),(2,5000000),(3,100);');let now=Date.parse('2026-11-19T03:58:00+08:00');const balanceFor=id=>db.prepare('SELECT SUM(delta) n FROM balance_ledger WHERE employee_id=?').get(id).n,options={db,balanceFor,clock:()=>now,recordLedger:(id,n,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,n,reason)};return {db,balanceFor,service:installAds(options),restart:()=>installAds(options),advance:n=>now+=n,now:()=>now};}
const offer=(f,changes={})=>({day:adDay(f.now()+86400000),slot:'popup',amount:500000,body:'夜班见。',signature:'匿名行人',note:'今晚营业',confirmed:true,requestId:'advertising-request-0001',...changes});

test('tomorrow only, authoritative base/increment, idempotent bids and full outbid refunds',async t=>{
 const f=fixture(t),s=f.service;const first=await s.bid(1,offer(f));assert.equal(first.bid.status,'leading');assert.equal(f.balanceFor(1),4500000);
 await s.bid(1,offer(f));assert.equal(f.balanceFor(1),4500000);
 for(const c of [{day:'2026-11-18'},{day:'2026-11-20'},{amount:509999},{amount:NaN},{amount:1000000001},{slot:'unknown'},{confirmed:false},{body:''}])await assert.rejects(()=>s.bid(2,offer(f,{...c,requestId:'invalid-request-0001'})));
 await assert.rejects(()=>s.bid(1,offer(f,{body:'different'})),/凭据/);
 await s.bid(2,offer(f,{amount:510000}));assert.equal(f.balanceFor(1),5000000);assert.equal(f.balanceFor(2),4490000);assert.equal(s.market(1).mine[0].status,'outbid');
 await s.bid(2,offer(f,{amount:520000,requestId:'advertising-request-0002'}));assert.equal(f.balanceFor(2),4480000);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM ad_bids WHERE status='leading'").get().n,1);
 await assert.rejects(()=>s.bid(3,offer(f,{amount:530000})),/余额/);assert.equal(f.balanceFor(2),4480000);
});

test('all slots cap each raise at 10000 and reject off-step, low, high and stale bids without changing holds',async t=>{
 for(const slot of ['popup','forum','casino']){
  const f=fixture(t),s=f.service,initial=s.market(1).slots.find(x=>x.id===slot),base=initial.base;
  assert.equal(initial.step,10000);assert.equal(initial.minimum,base);assert.equal(initial.maximum,base+10000);
  const unchanged=()=>({ledger:f.db.prepare('SELECT * FROM balance_ledger ORDER BY id').all(),bids:f.db.prepare('SELECT * FROM ad_bids ORDER BY id').all()});
  for(const amount of [base-1,base+1,base+9999,base+10001,base+20000]){
   const before=unchanged();await assert.rejects(()=>s.bid(1,offer(f,{slot,amount})));assert.deepEqual(unchanged(),before);
  }
  const first=offer(f,{slot,amount:base+10000});await s.bid(1,first);
  const next=s.market(2).slots.find(x=>x.id===slot);assert.equal(next.minimum,base+20000);assert.equal(next.maximum,next.minimum);
  for(const amount of [base,base+10000,base+19999,base+20001,base+30000]){
   const before=unchanged();await assert.rejects(()=>s.bid(2,offer(f,{slot,amount})));assert.deepEqual(unchanged(),before);
  }
  await s.bid(2,offer(f,{slot,amount:next.minimum}));assert.equal(f.balanceFor(1),5000000);assert.equal(f.balanceFor(2),5000000-next.minimum);
  const before=unchanged();await assert.rejects(()=>s.bid(1,offer(f,{slot,amount:next.minimum,requestId:'stale-ad-request-0001'})),/刷新报价/);assert.deepEqual(unchanged(),before);
  await s.bid(1,first);assert.deepEqual(unchanged(),before);
 }
});

test('existing text-slot prices stay intact and the next bid adds exactly 10000',async t=>{
 const f=fixture(t),s=f.service;await s.bid(1,offer(f,{slot:'forum',amount:50000}));
 f.db.prepare("UPDATE ad_bids SET amount=55000 WHERE slot='forum'").run();
 f.db.prepare("INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(1,-5000,'legacy raise fixture')").run();
 const slot=s.market(2).slots.find(x=>x.id==='forum');assert.equal(slot.minimum,65000);assert.equal(slot.maximum,65000);
 await s.bid(2,offer(f,{slot:'forum',amount:65000}));assert.equal(f.balanceFor(1),5000000);assert.equal(f.balanceFor(2),4935000);
});

test('04:00 wins once across restart and publishes only today; visits obey cooldown and expiry',async t=>{
 const f=fixture(t);await f.service.bid(1,offer(f));await f.service.bid(2,offer(f,{slot:'forum',amount:50000}));assert.equal(f.service.visit(2,true).popup,null);
 f.advance(120000);const s=f.restart(),d=s.visit(2,true);assert.equal(d.popup.body,'夜班见。');assert.equal(d.items[0].slot,'forum');assert.equal(f.balanceFor(1),4500000);assert.equal(s.market(1).mine[0].status,'won');assert.equal(s.visit(2,true).popup,null);
 f.advance(30*60000-1);assert.equal(s.visit(2,true).popup,null);f.advance(1);assert.ok(s.visit(2,true).popup);assert.equal(f.balanceFor(1),4500000);
 f.advance(86400000);assert.deepEqual(s.visit(2,true).items,[]);assert.equal(s.visit(2,true).popup,null);
});

test('renewable protection stacks exact duration, retries do not charge and hides all advertisements',async t=>{
 const f=fixture(t);await f.service.bid(1,offer(f));await f.service.bid(1,offer(f,{slot:'casino',amount:50000,requestId:'advertising-request-0002'}));f.advance(120000);
 const buy={days:1,confirmed:true,requestId:'protection-request-0001'},first=f.service.protect(2,buy);assert.equal(first.protectionUntil,f.now()+86400000);assert.equal(f.balanceFor(2),4980000);f.service.protect(2,buy);assert.equal(f.balanceFor(2),4980000);
 assert.throws(()=>f.service.protect(2,{...buy,days:3}),/凭据/);assert.throws(()=>f.service.protect(3,buy),/余额/);assert.throws(()=>f.service.protect(2,{...buy,days:99}),/时长/);
 assert.deepEqual(f.service.visit(2,true).items,[]);assert.equal(f.service.visit(2,true).popup,null);
 const second=f.service.protect(2,{days:3,confirmed:true,requestId:'protection-request-0002'});assert.equal(second.protectionUntil,first.protectionUntil+3*86400000);assert.equal(f.balanceFor(2),4930000);
 f.advance(5*86400000);const third=f.service.protect(2,{days:7,confirmed:true,requestId:'protection-request-0003'});assert.equal(third.protectionUntil,f.now()+7*86400000);
});

test('editable tomorrow creatives freeze at 04:00; other accounts cannot edit or see future image URLs',async t=>{
 const f=fixture(t),image='data:image/png;base64,'+(await sharp({create:{width:120,height:80,channels:4,background:'#aabbcc'}}).png().toBuffer()).toString('base64');
 const r=await f.service.bid(1,offer(f,{body:'',image}));assert.match(r.bid.imageUrl,/\/images\//);assert.equal(f.service.market(2).slots[0].bidId,null);assert.equal(f.service.market(2).mine.length,0);
 await assert.rejects(()=>f.service.edit(2,r.bid.id,{body:'更改'}),/未找到/);
 await f.service.edit(1,r.bid.id,{body:'新文字',image,signature:'另一种署名'});assert.equal(f.service.market(1).mine[0].body,'新文字');
 await assert.rejects(()=>f.service.bid(2,offer(f,{slot:'forum',amount:50000,image})),/仅支持文字/);
 await assert.rejects(()=>f.service.bid(2,offer(f,{image:'data:image/png;base64,broken'})),/读取/);
 f.advance(120000);await assert.rejects(()=>f.service.edit(1,r.bid.id,{body:'过期修改'}),/明日广告/);
 assert.equal(f.service.visit(2,true).popup.body,'新文字');assert.equal(f.balanceFor(2),5000000);
});

test('failed ledger or insert transactions preserve previous leader and balances; removal refunds once',async t=>{
 const f=fixture(t),r=await f.service.bid(1,offer(f));f.db.exec("CREATE TRIGGER reject_ad BEFORE INSERT ON ad_bids BEGIN SELECT RAISE(ABORT,'rollback fixture');END;");
 await assert.rejects(()=>f.service.bid(2,offer(f,{amount:510000})),/rollback/);assert.equal(f.balanceFor(1),4500000);assert.equal(f.balanceFor(2),5000000);assert.equal(f.service.market(1).slots[0].mine,true);
 f.db.exec('DROP TRIGGER reject_ad');f.service.remove(r.bid.id,'内容处理');assert.equal(f.balanceFor(1),5000000);f.service.remove(r.bid.id,'重试');assert.equal(f.balanceFor(1),5000000);assert.equal(f.service.market(1).mine[0].removedReason,'内容处理');
});

test('image processing crossing the deadline cannot place a bid for an expired day',async t=>{
 const f=fixture(t),image='data:image/png;base64,'+(await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer()).toString('base64');
 const pending=f.service.bid(1,offer(f,{image}));f.advance(120000);await assert.rejects(()=>pending,/截止/);assert.equal(f.balanceFor(1),5000000);
});

test('creative format limits are authoritative and rejected layouts never debit the wallet',async t=>{
 const f=fixture(t),balance=f.balanceFor(1);
 for(const change of [{title:''},{title:'标'.repeat(21)},{title:'第一行\n第二行'},{signature:'名'.repeat(21)},{signature:'一\n二'},{body:'文'.repeat(161)},{body:Array(7).fill('一行').join('\n')},{slot:'forum',amount:50000,body:'文'.repeat(61)},{slot:'casino',amount:50000,body:'一\n二\n三'}]){
  await assert.rejects(()=>f.service.bid(1,offer(f,{title:'夜班通讯',...change})));assert.equal(f.balanceFor(1),balance);
 }
 const created=await f.service.bid(1,offer(f,{title:'标'.repeat(20),body:'文'.repeat(160),signature:'名'.repeat(20)}));assert.equal(created.bid.title,'标'.repeat(20));
 await f.service.edit(1,created.bid.id,{title:'交接通知',body:'第一行\r\n第二行',signature:'前台'});
 assert.equal(f.service.market(1).mine[0].body,'第一行\n第二行');assert.equal(f.service.market(1).mine[0].note,'今晚营业');
 f.advance(120000);const delivered=f.service.visit(2,true).popup;assert.equal(delivered.title,'交接通知');assert.equal('note' in delivered,false,'internal notes are excluded from public delivery');
});

test('adding titles preserves existing bids, content, holds and retry receipts',async t=>{
 const f=fixture(t),created=await f.service.bid(1,offer(f)),balance=f.balanceFor(1);
 f.db.exec('ALTER TABLE ad_bids DROP COLUMN title');
 const upgraded=f.restart(),row=upgraded.market(1).mine[0];assert.equal(row.id,created.bid.id);assert.equal(row.title,'');assert.equal(row.body,'夜班见。');assert.equal(f.balanceFor(1),balance);
 await upgraded.bid(1,offer(f));assert.equal(f.balanceFor(1),balance);assert.equal(f.db.prepare('SELECT count(*) n FROM ad_bids').get().n,1);
});


test('auction stays open across midnight and switches delivery exactly at 04:00 Shanghai time',async t=>{
 const f=fixture(t),s=f.service;f.advance(-4*3600000);
 const day='2026-11-19',cutoff=Date.parse(day+'T04:00:00+08:00');
 assert.equal(s.market(1).tomorrow,day);assert.equal(s.market(1).endsAt,cutoff);
 const first=await s.bid(1,offer(f));
 f.advance(120000);assert.equal(s.market(1).tomorrow,day);assert.equal(s.market(1).mine[0].status,'leading');assert.equal(s.visit(2,true).popup,null);
 await s.edit(1,first.bid.id,{body:'零点之后仍可修改'});
 f.advance(4*3600000-1);await s.bid(2,offer(f,{amount:510000}));assert.equal(s.market(2).mine[0].status,'leading');
 f.advance(1);assert.equal(s.market(2).mine[0].status,'won');assert.equal(s.market(1).tomorrow,'2026-11-20');assert.equal(s.visit(3,true).popup.body,'夜班见。');
 await assert.rejects(()=>s.bid(1,offer(f,{day,amount:520000,requestId:'closed-four-am-request'})),/明天|截止/);
 await assert.rejects(()=>s.edit(2,s.market(2).mine[0].id,{body:'截止后修改'}),/明日广告/);
 assert.equal(s.market(1).endsAt,cutoff+86400000);
});

test('04:00 advertising day handles year boundaries without changing protection duration',()=>{
 assert.equal(adDay(Date.parse('2027-01-01T03:59:59.999+08:00')),'2026-12-31');
 assert.equal(adDay(Date.parse('2027-01-01T04:00:00+08:00')),'2027-01-01');
});
