import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {installSessionPolicy,NORMAL_IDLE_MS,REMEMBER_MS} from '../server-session-policy.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,employee_id INTEGER,expires_at INTEGER,issued_at INTEGER);
 CREATE TABLE employees(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,department TEXT,identity_kind TEXT,containment_classification TEXT,position_title TEXT,role TEXT,enabled INTEGER);
 INSERT INTO employees VALUES(1,'one','one','收容部','player_containment','SAFE','','employee',1);`);
 let time=1800000000000;
 const digest=value=>createHash('sha256').update(value).digest('hex');
 return {db,digest,clock:()=>time,advance:ms=>{time+=ms;},request:token=>({headers:{cookie:'wy_session='+token}})};
}
test('normal sessions expire after five idle hours; reads do not renew; actual activity renews cookie and DB',()=>{
 const f=fixture(),service=installSessionPolicy(f),token='n'.repeat(43),req=f.request(token);
 assert.match(service.issue(1,token,false),/Max-Age=18000/);
 const first=service.inspect(req).data.expiresAt;
 f.advance(NORMAL_IDLE_MS-1000);
 assert.equal(service.inspect(req).data.expiresAt,first);
 assert.equal(service.employee(req).identityKind,'player_containment');
 const active=service.inspect(req,{activity:true});assert.equal(active.data.expiresAt,f.clock()+NORMAL_IDLE_MS);assert.match(active.cookie,/Max-Age=18000/);
 f.advance(NORMAL_IDLE_MS);assert.equal(service.inspect(req,{activity:true}),null,'expired sessions cannot be resurrected');f.db.close();
});
test('remembered login survives five idle hours but cannot renew beyond seven days',()=>{
 const f=fixture(),service=installSessionPolicy(f),token='r'.repeat(43),req=f.request(token);
 assert.match(service.issue(1,token,true),/Max-Age=604800/);
 const deadline=f.clock()+REMEMBER_MS;f.advance(NORMAL_IDLE_MS+1);
 assert.equal(service.inspect(req,{activity:true}).data.expiresAt,deadline);
 assert.equal(service.inspect(req,{activity:true}).cookie,null);
 f.advance(REMEMBER_MS-NORMAL_IDLE_MS-1);assert.equal(service.inspect(req),null);f.db.close();
});
test('legacy eight-hour and thirty-day sessions migrate once without extending or losing identity',()=>{
 const f=fixture(),normal='n'.repeat(43),remember='r'.repeat(43);
 const add=f.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)');
 add.run(f.digest(normal),1,f.clock()+8*3600000,f.clock());add.run(f.digest(remember),1,f.clock()+30*86400000,f.clock());
 let service=installSessionPolicy(f);
 assert.equal(service.inspect(f.request(normal)).data.expiresAt,f.clock()+NORMAL_IDLE_MS);
 assert.equal(service.inspect(f.request(remember)).data.expiresAt,f.clock()+REMEMBER_MS);
 f.advance(3600000);service.inspect(f.request(normal),{activity:true});
 service=installSessionPolicy(f);assert.equal(service.inspect(f.request(normal)).data.expiresAt,f.clock()+NORMAL_IDLE_MS,'restart does not reapply initial cap');f.db.close();
});
test('duplicate cookies pick the latest valid session; disabled accounts cannot renew; no token is returned in identity',()=>{
 const f=fixture(),service=installSessionPolicy(f),one='a'.repeat(43),two='b'.repeat(43);
 service.issue(1,one,false);f.advance(1);service.issue(1,two,true);
 const req={headers:{cookie:`wy_session=${two}; wy_session=${one}`}};
 assert.equal(service.inspect(req).data.remembered,true);
 assert.doesNotMatch(JSON.stringify(service.employee(req)),/token|hash/);
 f.db.exec('UPDATE employees SET enabled=0');assert.equal(service.inspect(req,{activity:true}),null);f.db.close();
});
