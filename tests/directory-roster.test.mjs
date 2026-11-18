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
  db.exec("ALTER TABLE employees ADD COLUMN containment_classification TEXT NOT NULL DEFAULT ''");
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

test('uniform roster cards use profile messages safely even without a character sheet',()=>{
 const source=readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
 const mapper=source.split('\n').find(line=>line.includes('function employeeDirectoryCard(e)'));
 const start=source.indexOf('function renderDepartmentsAndPersonnel()');
 const render=source.slice(start,source.indexOf('// ======================================================================',start));
 const grid={innerHTML:'',parentElement:{classList:{add(){}},hidden:false}};
 const nodes={'view-departments':{dataset:{},append(){}},'personnel-directory-grid':grid,'directory-unassigned':{},'company-leadership-directory':{}};
 const context={window:{avedDepartmentFilter:'医疗部',AVEDDepartmentArchive:{render(){},isPersonnel:()=>true}},document:{getElementById:id=>nodes[id]||null},byId:id=>nodes[id],employees:[],departmentsData:[],esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
 vm.runInNewContext(mapper,context);
 context.employees=[context.employeeDirectoryCard({id:1,displayName:'职员甲',department:'医疗部',identityKind:'player_employee',bio:'值班中。\n<img src=x onerror=alert(1)>',avatarUrl:''}),context.employeeDirectoryCard({id:2,displayName:'职员乙',department:'医疗部',identityKind:'player_employee',bio:'',avatarUrl:''})];
 vm.runInNewContext(render+';renderDepartmentsAndPersonnel();',context);
 assert.ok(grid.innerHTML.includes('职员甲'));assert.ok(grid.innerHTML.includes('职员乙'));
 assert.equal((grid.innerHTML.match(/directory-personal-message/g)||[]).length,1);
 assert.ok(grid.innerHTML.includes('值班中。\n&lt;img'));assert.ok(!grid.innerHTML.includes('<img src=x'));
 assert.equal(grid.parentElement.hidden,false);
 context.window.AVEDDepartmentArchive.isPersonnel=()=>false;vm.runInNewContext('renderDepartmentsAndPersonnel();',context);assert.equal(grid.parentElement.hidden,true);
 context.window.AVEDDepartmentArchive.isPersonnel=()=>true;
 context.employees.reverse();
 context.employees[0].department='公司直属';context.employees[1].department='收容部';
 context.window.avedDepartmentFilter='*';vm.runInNewContext('renderDepartmentsAndPersonnel();',context);
 assert.ok(grid.innerHTML.indexOf('>收容部</h3>')<grid.innerHTML.indexOf('>其他职位</h3>'));
 assert.equal((grid.innerHTML.match(/directory-role-heading/g)||[]).length,2);
 assert.ok(grid.innerHTML.includes('职员甲'));assert.ok(grid.innerHTML.includes('职员乙'));
 context.window.avedDepartmentFilter='公司直属';vm.runInNewContext('renderDepartmentsAndPersonnel();',context);
 assert.ok(grid.innerHTML.includes('职员乙'));assert.ok(!grid.innerHTML.includes('职员甲'));
});


test('department archive starts at the overview and keeps other positions in personnel only',()=>{
 const source=readFileSync(new URL('../public/department-archive.js',import.meta.url),'utf8');
 const host={innerHTML:'',addEventListener(type,fn){this.click=fn;}};
 const root={dataset:{}},grid={parentElement:{before(){},hidden:false}};
 const nodes={'view-departments':root,'departments-grid':grid};
 const context={window:{avedDepartmentFilter:'医疗部'},document:{getElementById:id=>nodes[id],createElement:()=>host}};
 vm.runInNewContext(source,context);
 const archive=context.window.AVEDDepartmentArchive;
 const render=()=>archive.render({employees:[],onChange:render});render();
 const click=dataset=>host.click({target:{closest:()=>({dataset,hasAttribute:name=>name==='data-division-back'?dataset.divisionBack!==undefined:name==='data-division-keep'?dataset.divisionKeep!==undefined:false})}});
 assert.equal(context.window.avedDepartmentFilter,'');assert.ok(host.innerHTML.includes('division-overview'));
 assert.ok(!host.innerHTML.includes('division-dossier'));assert.ok(!host.innerHTML.includes('公司直属'));
 const names=[...host.innerHTML.matchAll(/data-division-department="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(names,['收容部','武装部','医疗部','科研部','后勤部']);
 click({divisionDepartment:'武装部'});assert.ok(host.innerHTML.includes('division-dossier'));
 click({divisionView:'personnel',divisionKeep:''});assert.equal(context.window.avedDepartmentFilter,'武装部');assert.equal(archive.isPersonnel(),true);
 click({divisionView:'department'});assert.equal(context.window.avedDepartmentFilter,'');
 click({divisionView:'personnel'});assert.equal(context.window.avedDepartmentFilter,'*');assert.ok(host.innerHTML.includes('其他职位'));
 const departmentNav=host.innerHTML.match(/<nav class="division-departments"[^>]*>(.*?)<\/nav>/)[1];
 assert.equal((departmentNav.match(/<button/g)||[]).length,5);assert.ok(!departmentNav.includes('其他职位'));assert.ok(!departmentNav.includes('全部人员'));
 click({divisionDepartment:'公司直属'});assert.ok(host.innerHTML.includes('<h3>其他职位</h3>'));assert.ok(!host.innerHTML.includes('division-dossier'));
 click({divisionView:'department'});click({divisionDepartment:'收容部'});click({divisionBack:''});assert.equal(context.window.avedDepartmentFilter,'');
 click({divisionView:'personnel'});archive.reset();render();assert.equal(archive.isPersonnel(),false);assert.ok(host.innerHTML.includes('division-overview'));
});
