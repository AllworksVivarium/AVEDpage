import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installLogRetention} from '../server-log-retention.mjs';

function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE activity_logs(id INTEGER PRIMARY KEY,action TEXT,target TEXT,details TEXT,created_at TEXT);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,reason TEXT);
 INSERT INTO balance_ledger VALUES(1,7,90,'交易收益');`);
 const add=(action,target,details,at)=>db.prepare('INSERT INTO activity_logs(action,target,details,created_at) VALUES(?,?,?,?)').run(action,target,JSON.stringify(details),at);
 return {db,add};
}
test('retention removes only old telemetry and verifiable duplicate ledger snapshots',t=>{
 const {db,add}=fixture(t),old='2026-01-01 00:00:00',recent='2026-11-10 00:00:00';
 add('view','terminal',{},old);add('GET','terminal',{},recent);
 add('insert','balance_ledger',{id:1,employee_id:7,delta:90,reason:'交易收益'},old);
 add('insert','balance_ledger',{id:2,employee_id:7,delta:90,reason:'已删除的流水'},old);
 add('insert','balance_ledger',{id:1,employee_id:7,delta:91,reason:'交易收益'},old);
 add('insert','forum_replies',{body:'历史发言'},old);
 add('insert','life_records',{image_data:'[image]'},old);
 add('stock.buy','TEST',{leverage:10},old);
 add('unknown','terminal',{},old);
 db.prepare('INSERT INTO activity_logs(action,target,details,created_at) VALUES(?,?,?,?)').run('insert','balance_ledger','malformed',old);
 const service=installLogRetention(db,{now:()=>Date.parse('2026-11-10T12:00:00Z')});t.after(()=>service.close());
 assert.deepEqual(service.initial,{operations:1,ledgerCopies:1});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM activity_logs').get().n,8);
 assert.equal(db.prepare('SELECT SUM(delta) total FROM balance_ledger').get().total,90);
 assert.deepEqual(service.prune(),{operations:0,ledgerCopies:0});
 assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
});
test('cleanup is bounded per sweep and respects the exact retention boundary',t=>{
 const {db,add}=fixture(t),now=Date.parse('2026-11-10T12:00:00Z');
 const put=db.prepare("INSERT INTO activity_logs(action,target,details,created_at) VALUES('view','terminal','{}','2026-01-01')");
 db.exec('BEGIN');for(let i=0;i<1001;i++)put.run();db.exec('COMMIT');
 add('view','terminal',{},'2026-10-11T12:00:00Z');
 const service=installLogRetention(db,{now:()=>now});t.after(()=>service.close());
 assert.equal(service.initial.operations,500);
 assert.equal(service.prune().operations,500);assert.equal(service.prune().operations,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM activity_logs').get().n,1);
});
