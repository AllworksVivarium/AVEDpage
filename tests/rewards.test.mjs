import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installHourlyRewards} from '../server-rewards.mjs';

function fixture(t,time='2026-11-18T00:01:00+08:00') {
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec('CREATE TABLE hourly_claims(employee_id INTEGER,hour INTEGER,reward INTEGER,PRIMARY KEY(employee_id,hour));CREATE TABLE balance_ledger(employee_id INTEGER,delta INTEGER,reason TEXT);');
 let now=Date.parse(time);
 const recordLedger=(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger VALUES(?,?,?)').run(id,delta,reason);
 const options={db,recordLedger,clock:()=>now},service=installHourlyRewards(options);
 return {db,service,options,at:time=>now=Date.parse(time),advance:ms=>now+=ms,total:()=>db.prepare('SELECT COALESCE(SUM(delta),0) n FROM balance_ledger').get().n};
}

test('all 24 hours pay once each without a daily cap, including after service restart',t=>{
 const f=fixture(t),s=f.service;
 assert.equal(s.state(1).dailyReward,8000);assert.equal(s.state(1).hourlyReward,2000);
 for(let hour=0;hour<24;hour++){
  const active=hour<12?s:installHourlyRewards(f.options);
  assert.equal(active.state(1).hourlyClaimed,false);assert.equal(active.claim(1).reward,2000);
  assert.equal(active.claim(1).reward,0);assert.equal(active.state(1).hourlyClaimed,true);
  f.advance(3600000);
 }
 assert.equal(f.total(),48000);assert.equal(s.state(2).hourlyClaimed,false);
 assert.equal(s.state(1).hourlyClaimed,false);assert.equal(s.claim(1).reward,2000);
});

test('midnight opens a new hourly slot and missed hours never accrue',t=>{
 const f=fixture(t,'2026-11-18T21:01:00+08:00');
 for(let i=0;i<3;i++){f.service.claim(1);f.advance(3600000);}
 f.at('2026-11-18T23:59:59.999+08:00');assert.equal(f.service.claim(1).reward,0);
 assert.equal(f.service.state(1).hourlyResetAt,Date.parse('2026-11-19T00:00:00+08:00'));
 f.advance(1);assert.equal(f.service.state(1).hourlyClaimed,false);assert.equal(f.service.claim(1).reward,2000);
 assert.equal(f.service.state(1).dailyResetAt,Date.parse('2026-11-20T00:00:00+08:00'));
 f.at('2026-11-19T23:59:00+08:00');assert.equal(f.service.claim(1).reward,2000);assert.equal(f.service.claim(1).reward,0);assert.equal(f.total(),10000);
});

test('old higher-value claims stay unchanged and only block repeats in their own hour',t=>{
 const f=fixture(t,'2026-11-18T20:00:00+08:00'),dayStart=Date.parse('2026-11-18T00:00:00+08:00')/3600000;
 for(let i=-1;i<3;i++)f.db.prepare('INSERT INTO hourly_claims VALUES(?,?,5000)').run(1,dayStart+i);
 assert.equal(f.service.claim(1).reward,2000);assert.equal(f.total(),2000);
 f.at('2026-11-18T02:30:00+08:00');assert.equal(f.service.claim(1).reward,0);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM hourly_claims WHERE reward=5000').get().n,4);assert.equal(f.total(),2000);
});

test('a failed ledger write rolls back both allowance consumption and payment',t=>{
 const f=fixture(t);f.db.exec("CREATE TRIGGER reject_supply BEFORE INSERT ON balance_ledger BEGIN SELECT RAISE(ABORT,'ledger failed'); END;");
 assert.throws(()=>f.service.claim(1),/ledger failed/);assert.equal(f.service.state(1).hourlyClaimed,false);assert.equal(f.total(),0);
 f.db.exec('DROP TRIGGER reject_supply');assert.equal(f.service.claim(1).reward,2000);assert.equal(f.service.claim(1).reward,0);
});
