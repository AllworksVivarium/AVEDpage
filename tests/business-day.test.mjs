import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {businessDay,businessDayStart,businessDayEnd} from '../server-business-day.mjs';import {adDay} from '../server-ads.mjs';import {barBusinessDay} from '../server-bar-drinking.mjs';import {installBegging} from '../server-begging.mjs';import {installHourlyRewards} from '../server-rewards.mjs';

test('all shared daily keys and reset clocks change at Beijing 04:00, including calendar and year boundaries',()=>{
 for(const day of ['2026-11-19','2027-01-01','2028-03-01']){
  const boundary=Date.parse(day+'T04:00:00+08:00'),previous=new Date(boundary-86400000+4*3600000).toISOString().slice(0,10);
  for(const key of [businessDay,adDay,barBusinessDay]){assert.equal(key(boundary-1),previous);assert.equal(key(boundary),day);assert.equal(key(boundary-4*3600000),previous);}
  assert.equal(businessDayEnd(boundary-1),boundary);assert.equal(businessDayStart(boundary),boundary);assert.equal(businessDayEnd(boundary),boundary+86400000);
 }
});

test('daily countdown stays on the same cycle at midnight and refreshes exactly at 04:00',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE hourly_claims(employee_id INTEGER,hour INTEGER,reward INTEGER,PRIMARY KEY(employee_id,hour))');const s=installHourlyRewards({db});const end=Date.parse('2026-11-19T04:00:00+08:00');for(const at of ['2026-11-18T23:59:59+08:00','2026-11-19T00:00:00+08:00','2026-11-19T03:59:59.999+08:00'])assert.equal(s.state(1,Date.parse(at)).dailyResetAt,end);assert.equal(s.state(1,end).dailyResetAt,end+86400000);}finally{db.close();}
});

test('begging quota is per recipient and 04:00 business day, preserving previous-day pending requests and retry identities',async()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT,enabled INTEGER,is_npc INTEGER);INSERT INTO employees VALUES(1,'甲',1,0),(2,'乙',1,0),(3,'丙',1,0);CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT);CREATE TABLE employee_preferences(employee_id INTEGER,ranking_identity TEXT);CREATE TABLE company_robots(employee_id INTEGER,codename TEXT);CREATE TABLE employee_donations(id INTEGER PRIMARY KEY);`);
  let now=Date.parse('2026-11-18T23:59:59.999+08:00');const options={db,balanceFor:()=>1000000,clock:()=>now,highest:()=>[{id:2},{id:3}],isContainment:()=>false,requireEmployee:req=>({id:req.id}),readBody:async req=>req.body,send:(res,status,data)=>Object.assign(res,{status,data})};let service=installBegging(options);
  const call=async(body,path='/api/player/begging',id=1)=>{const res={};await service.handle({id,method:'POST',body},res,new URL(path,'http://local'));return res;};
  const body={recipientId:2,amount:100,requestId:'business-day-original'};const first=await call(body);assert.equal(first.status,200);
  now=Date.parse('2026-11-19T00:00:00+08:00');assert.equal((await call({...body,requestId:'business-day-midnight'})).status,409);assert.equal((await call({...body,recipientId:3,requestId:'business-day-other-one'})).status,200);
  now=Date.parse('2026-11-19T03:59:59.999+08:00');assert.equal((await call({...body,requestId:'business-day-before-four'})).status,409);
  now++;assert.equal((await call(body)).data.id,first.data.id,'a retry of yesterday is not a new request');
  const today=await call({...body,requestId:'business-day-after-four'});assert.equal(today.status,200);assert.notEqual(today.data.id,first.data.id);assert.equal(db.prepare("SELECT COUNT(*) n FROM employee_begging_requests WHERE sender_id=1 AND recipient_id=2 AND status='pending'").get().n,2);
  assert.equal((await call({decision:'declined'},'/api/player/begging/'+today.data.id,2)).status,200);assert.equal((await call({...body,requestId:'business-day-after-decline'})).status,409);
  service=installBegging(options);assert.equal((await call({...body,requestId:'business-day-after-restart'})).status,409);
  assert.throws(()=>db.prepare('INSERT INTO employee_begging_requests(sender_id,recipient_id,request_key,created_at,requested_amount) VALUES(1,2,?,?,100)').run('direct-same-day',now),/每日只能乞讨一次/);
  now+=86400000;assert.equal((await call({...body,requestId:'business-day-third-day'})).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_begging_requests').get().n,4);assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 }finally{db.close();}
});

