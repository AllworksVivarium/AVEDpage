import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import parser from '../public/employee-import.js';
import {installEmployeeImport} from '../server-employee-import.mjs';

test('employee table parser accepts reordered headers, Excel blanks, CSV quotes and named dice attributes',()=>{
 const cases=[
  ['姓名\t部门\tQQ号\t力量\t意志\t洞察\t敏捷\t智力\t体质\n张三\t收容部\t\t60\t50\t40\t30\t20\t10',[60,50,40,30,20,10]],
  ['体质,姓名,智力,意志,洞察,力量,敏捷\n10,"张,三",20,50,40,60,30',[60,50,40,30,20,10]],
  ['张三 60 50 40 30 20 10',[60,50,40,30,20,10]],
  ['张三 收容部 .st体质10智力20敏捷30洞察40意志50力量60',[60,50,40,30,20,10]],
  ['张三，收容部，，６０，５０，４０，３０，２０，１０',[60,50,40,30,20,10]]
 ];
 for(const [text,expected] of cases){const result=parser.parse(text);assert.deepEqual(result.errors,[],text);assert.deepEqual(result.rows[0].attributes,expected);}
 assert.equal(parser.parse('姓名\t用户名\t部门\n张三\t张三\t公司直属').rows[0].department,'公司直属');
 assert.equal(parser.parse('李四').rows[0].attributes,null);
 assert.equal(parser.parse('李四').rows[0].department,'公司直属');
 const blank=parser.parse('姓名\t部门\tQQ号\t力量\t意志\t洞察\t敏捷\t智力\t体质\n空白六维\t收容部\t\t\t\t\t\t\t');assert.deepEqual(blank.errors,[]);assert.equal(blank.rows[0].attributes,null);
});
test('employee parser identifies exact bad lines and rejects partial, fractional, duplicate or ambiguous data',()=>{
 for(const text of ['张三 1 2 3 4 5 101','张三 1 2 3 4 5 1.5','张三 其他部 1 2 3 4 5 6','张三 .st力量60意志50','张三 .st力量50力量60意志50洞察50敏捷50智力50体质50','姓名\t用户名\t部门\n张三\t李四\t收容部','姓名,密码\n张三,secret','姓名,力量,力量\n张三,20,30'])assert.ok(parser.parse(text).errors.length,text);
 assert.equal(parser.parse('张三\n张三').errors[0].line,2);
 assert.ok(parser.parse('张三','attributes').errors.length);
 assert.ok(parser.parse('','create').errors.length);
 assert.ok(parser.parse(Array.from({length:101},(_,i)=>'员工'+i).join('\n')).errors.length);
 assert.ok(parser.parse('姓名\t部门').errors.length);
 assert.ok(parser.parse('张三','role-admin').errors.length);
});
function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password_hash TEXT,display_name TEXT,qq_number TEXT UNIQUE,department TEXT,role TEXT,position_title TEXT,is_npc INTEGER,is_leadership INTEGER,enabled INTEGER,identity_kind TEXT,attributes_json TEXT,containment_classification TEXT);
 CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY REFERENCES employees(id),anonymous_name TEXT,bio TEXT);
 CREATE TABLE company_robots(employee_id INTEGER REFERENCES employees(id));
 CREATE TABLE balance_ledger(employee_id INTEGER,delta INTEGER);
 INSERT INTO employees VALUES(1,'admin','old-hash','管理员',NULL,'公司直属','admin','成员',0,0,1,'player_employee','[1,2,3,4,5,6]','');`);
 let serial=0,logCount=0;
 const app=installEmployeeImport({db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireAdmin:(req,res)=>{if(req.actor==='player'){Object.assign(res,{status:403,data:{error:'只有管理员可使用'}});return null;}return {id:1};},hashPassword:async password=>{assert.equal(password,'000000');return 'salt-'+(++serial)+':derived';},log(){logCount++;}});
 const call=async(path,body,actor)=>{const res={};await app.handle({method:'POST',body,actor},res,new URL('http://local'+path));return res;};
 const preview=async(text,mode='create')=>(await call('/api/admin/employees/import/preview',{text,mode})).data;
 const commit=async(text,mode='create',extra={})=>{const p=await preview(text,mode);return call('/api/admin/employees/import',{text,mode,fingerprint:p.fingerprint,requestId:randomUUID(),...extra});};
 return {db,call,preview,commit,app,logs:()=>logCount};
}

test('bulk creation saves the capitalized real name and matching username without renaming attribute targets',async t=>{
 const {db,preview,commit}=fixture(t);
 assert.equal((await preview('alice')).rows[0].name,'Alice');
 assert.equal((await commit('alice')).status,200);
 assert.equal(db.prepare("SELECT display_name FROM employees WHERE username='Alice'").get().display_name,'Alice');
 assert.ok((await preview('alice')).errors.length);
 db.exec("INSERT INTO employees(username,display_name,identity_kind,is_npc,enabled,attributes_json) VALUES('bob','既有员工','player_employee',0,1,'[1,2,3,4,5,6]')");
 assert.ok((await preview('bob')).errors.length);
 assert.equal((await commit('bob 60 50 40 30 20 10','attributes')).status,200);
 assert.equal(db.prepare("SELECT attributes_json FROM employees WHERE username='bob'").get().attributes_json,'[60,50,40,30,20,10]');
 assert.equal(db.prepare("SELECT display_name FROM employees WHERE username='bob'").get().display_name,'既有员工');
});
test('100 employees import atomically with fixed account defaults, separate salted hashes and idempotent retries',async t=>{
 const {db,call,preview,logs}=fixture(t),text=Array.from({length:100},(_,i)=>'批量员工'+i+' 收容部 60 50 40 30 20 10').join('\n');
 const p=await preview(text);assert.equal(p.count,100);assert.equal(p.errors.length,0);
 const payload={text,mode:'create',fingerprint:p.fingerprint,requestId:randomUUID(),role:'admin',initialBalance:999999,password:'injected'};
 const saved=await call('/api/admin/employees/import',payload);assert.equal(saved.status,200);assert.equal(saved.data.count,100);
 assert.deepEqual((await call('/api/admin/employees/import',payload)).data,saved.data);assert.equal(logs(),1);
 const employees=db.prepare('SELECT * FROM employees WHERE id<>1').all();assert.equal(employees.length,100);
 assert.ok(employees.every(e=>e.username===e.display_name&&e.role==='employee'&&e.enabled===1&&e.identity_kind==='player_employee'&&e.department==='收容部'&&e.attributes_json==='[60,50,40,30,20,10]'));
 assert.equal(new Set(employees.map(e=>e.password_hash)).size,100);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,100);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM balance_ledger').get().n,0);
 assert.equal((await call('/api/admin/employees/import',{...payload,text:'不同员工'})).status,409);
});
test('six-dimension updates preserve password, money, role, department and identity, and detect stale previews',async t=>{
 const {db,call,preview}=fixture(t),text='admin 60 50 40 30 20 10',p=await preview(text,'attributes');
 db.exec("UPDATE employees SET attributes_json='[9,9,9,9,9,9]' WHERE id=1");
 assert.equal((await call('/api/admin/employees/import',{text,mode:'attributes',fingerprint:p.fingerprint,requestId:randomUUID()})).status,409);
 const current=await preview(text,'attributes'),payload={text,mode:'attributes',fingerprint:current.fingerprint,requestId:randomUUID()};
 assert.equal((await call('/api/admin/employees/import',payload)).status,200);
 const employee=db.prepare('SELECT * FROM employees WHERE id=1').get();assert.equal(employee.password_hash,'old-hash');assert.equal(employee.role,'admin');assert.equal(employee.department,'公司直属');assert.equal(employee.identity_kind,'player_employee');assert.equal(employee.attributes_json,'[60,50,40,30,20,10]');
 assert.equal((await call('/api/admin/employees/import',payload)).status,200);
});
test('invalid batches and authorization failures write nothing; database failure rolls back every row and profile',async t=>{
 const {db,call,preview,commit}=fixture(t);
 assert.equal((await call('/api/admin/employees/import/preview',{text:'员工甲',mode:'create'},'player')).status,403);
 assert.ok((await preview('admin')).errors.length);assert.ok((await preview('没有此人 1 2 3 4 5 6','attributes')).errors.length);
 assert.ok((await preview('员工甲 收容部 12345\n员工乙 医疗部 12345')).errors.length);
 assert.equal((await commit('员工甲\n员工乙 1 2 3 4 5 999')).status,400);
 db.exec("CREATE TRIGGER reject_second BEFORE INSERT ON employees WHEN NEW.username='员工乙' BEGIN SELECT RAISE(ABORT,'failure'); END");
 assert.equal((await commit('员工甲\n员工乙')).status,409);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM employees').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM employee_import_batches').get().n,0);
});


test('downloaded CSV templates share parser headers and accept Excel BOM and blank six-dimensional columns',()=>{
 for(const mode of ['create','attributes']){
  const template=parser.templateFile(mode);assert.ok(template.startsWith('\uFEFF'));assert.deepEqual(template.slice(1).trim().split(','),parser.headers(mode));
  const row=mode==='create'?'模板员工,收容部,123456789,60,50,40,30,20,10':'模板员工,60,50,40,30,20,10';
  const parsed=parser.parse(template+row+'\r\n',mode);assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.rows[0].attributes,[60,50,40,30,20,10]);
 }
 assert.deepEqual(parser.parse(parser.templateFile('create')+'空白员工,医疗部,,,,,,,\r\n').rows[0].attributes,null);
});


test('imports warn above 90 without blocking and apply containment bounds to the matched account',async t=>{
 const {db,preview,commit}=fixture(t);let plan=await preview('提醒员工 95 90 80 70 60 50');assert.equal(plan.errors.length,0);assert.equal(plan.warnings.length,1);
 assert.equal((await commit('提醒员工 95 90 80 70 60 50')).status,200);
 plan=await preview('admin 150 50 40 30 20 10','attributes');assert.ok(plan.errors.length);
 db.exec("UPDATE employees SET identity_kind='player_containment' WHERE id=1");plan=await preview('admin 150 50 40 30 20 10','attributes');assert.equal(plan.errors.length,0);assert.equal(plan.warnings.length,0);
 assert.equal((await commit('admin 150 50 40 30 20 10','attributes')).status,200);assert.equal(db.prepare('SELECT attributes_json FROM employees WHERE id=1').get().attributes_json,'[150,50,40,30,20,10]');
});
