import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {attributeSnapshot,installSealdiceSync} from '../server-sealdice-sync.mjs';

function fixture(t,token=''){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,qq_number TEXT,identity_kind TEXT,attributes_json TEXT,enabled INTEGER DEFAULT 1,is_npc INTEGER DEFAULT 0,password_hash TEXT DEFAULT 'private');
 CREATE TABLE company_robots(employee_id INTEGER);`);
 const add=(id,overrides={})=>{const row={username:'staff'+id,name:'员工'+id,qq:String(1234500+id),kind:'player_employee',attributes:'[90,80,70,60,50,40]',enabled:1,npc:0,...overrides};db.prepare('INSERT INTO employees(id,username,display_name,qq_number,identity_kind,attributes_json,enabled,is_npc) VALUES(?,?,?,?,?,?,?,?)').run(id,row.username,row.name,row.qq,row.kind,row.attributes,row.enabled,row.npc);};
 const service=installSealdiceSync({db,token,send:(res,status,data,headers)=>Object.assign(res,{status,data,headers}),requireAdmin:(req,res)=>{if(req.admin)return {id:1};Object.assign(res,{status:403});return null;}});
 const call=(path,{method='GET',admin=false,authorization,cookie}={})=>{const res={};service.handle({method,admin,headers:{authorization,cookie}},res,new URL(path,'http://local'));return res;};
 return {db,add,call};
}
const adminPath='/api/admin/employees/attributes/export',pullPath='/api/integrations/sealdice/attributes';

test('SealDice read-only endpoint defaults closed and requires a dedicated sufficiently long bearer token',t=>{
 const f=fixture(t);f.add(1);
 assert.equal(f.call(pullPath,{admin:true,cookie:'admin-session'}).status,503);
 assert.equal(f.call(adminPath).status,403);assert.equal(f.call(adminPath,{admin:true}).data.syncEnabled,false);
 assert.equal(f.call(adminPath,{admin:true,method:'POST'}).status,405);
 const weak=fixture(t,'short');assert.equal(weak.call(pullPath,{authorization:'Bearer short'}).status,503);
 const secret='test-only-dedicated-sync-token-123456789',live=fixture(t,secret);live.add(1);
 for(const authorization of [undefined,'Bearer wrong-token-of-sufficient-length-12345',secret,'Bearer '+secret+' x'])assert.equal(live.call(pullPath,{authorization,admin:true}).status,401);
 const result=live.call(pullPath,{authorization:'Bearer '+secret});assert.equal(result.status,200);assert.equal(result.data.records.length,1);assert.equal(result.data.issues,undefined);assert.equal(result.data.exportRows,undefined);assert.equal(JSON.stringify(result.data).includes(secret),false);assert.equal(JSON.stringify(result.data).includes('private'),false);
 assert.equal(live.call(pullPath,{authorization:'Bearer '+secret,method:'PUT'}).status,405);
});

test('snapshot preserves six exact values including containment overflow and excludes robots and display archives',t=>{
 const {db,add}=fixture(t);add(1);add(2,{kind:'planning_member'});add(3,{kind:'player_containment',attributes:'[150,95,100,200,0,60]'});
 add(4,{kind:'company_containment'});add(5,{npc:1});add(6,{enabled:0});add(7,{username:'AVED'});add(8);db.exec('INSERT INTO company_robots VALUES(8)');
 const data=attributeSnapshot(db);assert.deepEqual(data.records.map(x=>x.employeeId),[1,2,3]);assert.deepEqual(Object.values(data.records[2].attributes),[150,95,100,200,0,60]);
 assert.deepEqual(Object.keys(data.records[0]),['employeeId','name','qqNumber','attributes','revision']);
 const revision=data.revision;assert.equal(attributeSnapshot(db).revision,revision);
 db.exec("UPDATE employees SET password_hash='rotated' WHERE id=1");assert.equal(attributeSnapshot(db).revision,revision);
 db.exec("UPDATE employees SET attributes_json='[95,80,70,60,50,40]' WHERE id=1");assert.notEqual(attributeSnapshot(db).revision,revision);
});

test('ambiguous or unregistered QQ and incomplete attributes are reported to administrators and skipped by sync',t=>{
 const {db,add,call}=fixture(t);add(1,{qq:''});add(2,{qq:'123456'});add(3,{qq:'123456',attributes:''});add(4,{attributes:'[1,2]'});add(5,{qq:'not-a-QQ'});add(6);
 const data=call(adminPath,{admin:true}).data;assert.deepEqual(data.records.map(x=>x.employeeId),[6]);assert.deepEqual(data.exportRows.map(x=>x.employeeId),[1,2,5,6]);assert.equal(data.issues.length,5);
 assert.match(data.issues.find(x=>x.employeeId===2).reason,/多份档案/);
 const old=data.revision;db.exec('DELETE FROM employees WHERE id=6');assert.notEqual(attributeSnapshot(db).revision,old);
});
