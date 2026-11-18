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
 assert.ok(!grid.innerHTML.includes('directory-role-heading'));
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
 assert.ok(!grid.innerHTML.includes('directory-role-heading'));
 assert.ok(grid.innerHTML.includes('职员甲'));assert.ok(grid.innerHTML.includes('职员乙'));
 context.window.avedDepartmentFilter='公司直属';vm.runInNewContext('renderDepartmentsAndPersonnel();',context);
 assert.ok(grid.innerHTML.includes('职员乙'));assert.ok(!grid.innerHTML.includes('职员甲'));
});


test('personnel opens directly without redundant headings and department filters toggle back to all',()=>{
 const source=readFileSync(new URL('../public/department-archive.js',import.meta.url),'utf8');
 const host={innerHTML:'',addEventListener(type,fn){this[type]=fn;}};
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
 click({divisionView:'personnel'});assert.equal(context.window.avedDepartmentFilter,'*');
 assert.ok(!host.innerHTML.includes('division-personnel-scope'));assert.ok(!host.innerHTML.includes('division-roster-heading'));
 assert.ok(host.innerHTML.includes('data-division-sort'));assert.ok(!host.innerHTML.includes('全部人员'));assert.ok(!host.innerHTML.includes('其他职位'));
 const departmentNav=host.innerHTML.match(/<nav class="division-departments"[^>]*>(.*?)<\/nav>/)[1];
 assert.equal((departmentNav.match(/<button/g)||[]).length,5);assert.ok(!departmentNav.includes('其他职位'));assert.ok(!departmentNav.includes('全部人员'));
 click({divisionDepartment:'医疗部'});assert.equal(context.window.avedDepartmentFilter,'医疗部');
 click({divisionDepartment:'医疗部'});assert.equal(context.window.avedDepartmentFilter,'*');
 click({divisionView:'department'});click({divisionDepartment:'收容部'});click({divisionBack:''});assert.equal(context.window.avedDepartmentFilter,'');
 click({divisionView:'personnel'});archive.reset();render();assert.equal(archive.isPersonnel(),false);assert.ok(host.innerHTML.includes('division-overview'));
});

test('default prioritizes only direct employees; manual name ordering includes everyone and respects department filters',()=>{
 const host={innerHTML:'',addEventListener(type,fn){this[type]=fn;}},root={dataset:{}},grid={parentElement:{before(){},hidden:false}};
 const nodes={'view-departments':root,'departments-grid':grid};
 const context={window:{},document:{getElementById:id=>nodes[id],createElement:()=>host}};
 vm.runInNewContext(readFileSync(new URL('../public/department-archive.js',import.meta.url),'utf8'),context);
 const archive=context.window.AVEDDepartmentArchive,render=()=>archive.render({onChange:render});render();
 const staff=[
  {id:1,name:'阿字',department:'公司直属',identityKind:'player_containment'},
  {id:2,name:'张员工',department:'武装部',identityKind:'player_employee'},
  {id:3,name:'白职员',department:'收容部',identityKind:'player_employee'},
  {id:4,name:'赵顾问',department:'公司直属',identityKind:'planning_member'},
  {id:5,name:'陈总部',department:'公司直属',identityKind:'player_employee'},
  {id:6,name:'王部长',department:'医疗部',identityKind:'planning_member',isLeadership:true},
  {id:7,name:'阿尔法10',department:'后勤部',identityKind:'player_employee'},
  {id:8,name:'阿尔法2',department:'后勤部',identityKind:'player_employee'}
 ];
 const before=staff.map(x=>x.id),ids=(filter='*')=>Array.from(archive.roster(staff,filter),x=>x.id);
 const choose=value=>host.change({target:{closest:()=>({value})}});
 assert.deepEqual(ids(),[5,4,8,7,1,3,6,2]);assert.deepEqual(staff.map(x=>x.id),before,'sorting never changes the shared source roster');
 assert.deepEqual(ids('医疗部'),[6],'direct employees do not bypass department filtering');
 choose('name-asc');assert.deepEqual(ids(),[8,7,1,3,5,6,2,4]);
 assert.deepEqual(ids('后勤部'),[8,7]);
 choose('name-desc');assert.deepEqual(ids(),[4,2,6,5,3,1,7,8]);assert.deepEqual(ids('后勤部'),[7,8]);
 const strokes=['一','二','三'].map((name,id)=>({id,name,department:'医疗部'}));
 choose('name-asc');assert.deepEqual(Array.from(archive.roster(strokes,'*'),p=>p.name),['二','三','一']);
 choose('stroke');assert.deepEqual(Array.from(archive.roster(strokes,'*'),p=>p.name),['一','二','三']);
 archive.reset();render();assert.deepEqual(ids(),[5,4,8,7,1,3,6,2]);
});

test('switching uniform plates preserves the surrounding dossier and focused thumbnail',()=>{
 let replacements=0,html='',changes=0;
 const image={src:'',alt:''},picture={dataset:{},style:{},setAttribute(key,value){this[key]=value;},querySelector:()=>image},number={textContent:''};
 const thumbnails=[0,1].map(index=>({dataset:{divisionUniform:String(index)},setAttribute(key,value){this[key]=value;}}));
 const host={get innerHTML(){return html;},set innerHTML(value){html=value;replacements++;},addEventListener(type,fn){this[type]=fn;},querySelector:selector=>selector==='[data-division-uniform-number]'?number:picture,querySelectorAll:()=>thumbnails};
 const root={dataset:{}},grid={parentElement:{before(){},hidden:false}},nodes={'view-departments':root,'departments-grid':grid};
 const context={window:{},document:{getElementById:id=>nodes[id],createElement:()=>host}};
 vm.runInNewContext(readFileSync(new URL('../public/department-archive.js',import.meta.url),'utf8'),context);
 const archive=context.window.AVEDDepartmentArchive,render=()=>{changes++;archive.render({onChange:render});};render();
 const click=dataset=>host.click({target:{closest:()=>({dataset,hasAttribute:()=>false})}});
 click({divisionDepartment:'武装部'});const initialReplacements=replacements,initialChanges=changes;
 for(const index of [1,0,1]){
  click(thumbnails[index].dataset);
  assert.equal(image.src,'/assets/uniforms/armed-'+(index?'light':'dark')+'-clean.webp');
  assert.equal(picture.dataset.divisionImage,index?'armed-light':'armed-dark');
  assert.equal(number.textContent,index?'02':'01');assert.equal(thumbnails[index]['aria-pressed'],'true');assert.equal(thumbnails[1-index]['aria-pressed'],'false');
  assert.equal(replacements,initialReplacements,'headings and thumbnail nodes must not be replaced');assert.equal(changes,initialChanges,'switching art must not rerender the whole directory');
 }
 for(const index of [1,-1,NaN,2])click({divisionUniform:String(index)});
 assert.equal(replacements,initialReplacements);assert.equal(number.textContent,'02');
 archive.render({onChange:render});assert.equal(replacements,initialReplacements,'an unrelated refresh must keep the selected plate');
});
