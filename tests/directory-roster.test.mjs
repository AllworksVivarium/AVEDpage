import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {directoryEmployees} from '../server-directory.mjs';

test('directory cards show department plus custom title and only the title for unassigned personnel',()=>{
 const source=readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
 const start=source.indexOf('function renderDepartmentsAndPersonnel()');
 const render=source.slice(start,source.indexOf('// ======================================================================',start));
 const grid={innerHTML:'',parentElement:{classList:{add(){}},hidden:false}},view={dataset:{},append(){}};
 const nodes={'view-departments':view,'personnel-directory-grid':grid,'directory-unassigned':{},'company-leadership-directory':{}};
 const employees=[['甲','收容部','部长'],['乙','收容部','部长'],['丙','收容部','档案管理员'],['丁','公司直属','特别顾问']].map(([name,department,positionTitle])=>({name,department,positionTitle,isLeadership:true,stats:[0,0,0,0,0,0],bracketTag:positionTitle,location:'',abilityNote:''}));
 const context={window:{avedDepartmentFilter:'收容部'},document:{getElementById:id=>nodes[id]||null},byId:id=>nodes[id],employees,departmentsData:[]};
 vm.runInNewContext(render+';renderDepartmentsAndPersonnel();',context);
 assert.equal((grid.innerHTML.match(/职务：<strong>部长<\/strong>/g)||[]).length,2);
 assert.ok(grid.innerHTML.includes('所属部门：<strong>收容部</strong><br>职务：<strong>档案管理员</strong>'));
 assert.equal((grid.innerHTML.match(/>部长档案</g)||[]).length,1);
 context.window.avedDepartmentFilter='公司直属';vm.runInNewContext('renderDepartmentsAndPersonnel();',context);
 assert.ok(grid.innerHTML.includes('职务：<strong>特别顾问</strong>'));assert.ok(!grid.innerHTML.includes('所属部门：'));
});

test('the public directory excludes company robots while retaining real personnel and planning NPCs',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT,department TEXT,identity_kind TEXT,enabled INTEGER,position_title TEXT,is_npc INTEGER,is_leadership INTEGER);
   CREATE TABLE profiles(employee_id INTEGER,avatar_url TEXT,avatar_preset TEXT,bio TEXT);
   CREATE TABLE company_robots(employee_id INTEGER PRIMARY KEY,codename TEXT);
   INSERT INTO employees VALUES(1,'玩家','收容部','player_employee',1,'成员',0,0),(2,'企划职员','公司直属','planning_member',0,'监察员',1,1),(3,'公司机器人','','player_employee',0,'',1,0);
   INSERT INTO company_robots VALUES(3,'演绎代号');`);
  const publicNames=directoryEmployees(db).map(e=>e.displayName);assert.deepEqual(publicNames,['玩家','企划职员']);
  assert.equal(db.prepare('SELECT codename FROM company_robots WHERE employee_id=3').get().codename,'演绎代号','fictional forum identities remain available');
  assert.equal(db.prepare('SELECT count(*) n FROM employees').get().n,3,'hiding does not delete accounts');
 }finally{db.close();}
});

test('every department click selects its own roster and scrolls to the result rather than the last overview card',()=>{
 const source=readFileSync(new URL('../public/player-community.js',import.meta.url),'utf8');
 const handler=source.split('\n').find(line=>line.includes("closest('#view-departments [data-department-filter]')"));
 const title={textContent:''};let click,selected='',scroll;
 const context={window:{},document:{addEventListener:(type,fn)=>{assert.equal(type,'click');click=fn;}},byId:id=>id==='directory-active'?title:{parentElement:{scrollIntoView:options=>scroll=options}},renderDepartments(){selected=context.window.avedDepartmentFilter;}};
 vm.runInNewContext(handler,context);
 for(const department of ['收容部','武装部','医疗部','科研部','后勤部','公司直属']){
  click({target:{closest:()=>({dataset:{departmentFilter:department}})}});
  assert.equal(selected,department);assert.equal(title.textContent,department+' / 人员档案');assert.equal(scroll.block,'start');
 }
});
