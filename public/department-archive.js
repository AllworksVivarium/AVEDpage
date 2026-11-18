(()=>{
 'use strict';
 const catalog={
  '医疗部':{code:'MED',en:'MEDICAL DIVISION',images:['medical'],desc:'承担公司职业健康管理、现场医疗支持及异常暴露后的医学观察。为外勤与收容作业提供医疗保障，组织伤后治疗、隔离评估和复岗检查，并维护相关健康记录。'},
  '武装部':{code:'ARM',en:'ARMED DIVISION',images:['armed-dark','armed-light'],desc:'承担公司设施安保、外勤护卫与异常事件的现场处置。根据任务等级配置人员及装备，协助开展目标回收、区域封控和紧急转移，并与收容、医疗部门完成后续交接。'},
  '科研部':{code:'RES',en:'RESEARCH DIVISION',images:['research'],desc:'负责异常样本分析、现象机理研究及应用技术评估。接收各部门提交的样本与观测记录，组织实验验证，为收容方案、风险分级和专用设备开发提供技术依据。'},
  '收容部':{code:'CON',en:'CONTAINMENT DIVISION',images:[],desc:'负责公司收容设施的日常运行、对象管理与状态监测。落实各项收容规程，组织接收、转运及作业交接；发现指标偏离时，协调相关部门开展评估与处置，维护完整的运行记录。'},
  '后勤部':{code:'LOG',en:'LOGISTICS DIVISION',images:[],desc:'统筹公司采购、仓储、运输与设施维护，为各部门提供物资及运行支持。根据常规需求和专项任务安排配给、检修与调度，保障收容区域及办公设施的持续运转。'}
 };
 const attire='公共区域及非部门作业期间应着西服；部门作业期间，可按岗位需要换着本部门配发服装。';

 const order=['收容部','武装部','医疗部','科研部','后勤部'];
 const summaries={'收容部':'收容设施运行、对象管理与状态监测。','武装部':'设施安保、外勤护卫与现场处置。','医疗部':'职业健康、医疗支持与异常暴露观察。','科研部':'异常分析、实验研究与技术评估。','后勤部':'物资配给、设施维护与运行保障。'};
 // The frame crops only the preview; opening an image always uses the original.
 const frames={'medical':[1.08,-2],'armed-dark':[1.08,-7],'armed-light':[1.08,-6],'research':[1.08,-3],'suit':[1.08,-3],'coat':[1.08,-3]};
 let host,options,view='department',lastKey='',uniform=0,previousDepartment='',dialog;
 const art=name=>'/assets/uniforms/'+name+'.jpeg';
 const frame=name=>'--uniform-scale:'+frames[name][0]+';--uniform-shift:'+frames[name][1]+'%';
 function image(name,label){return '<button type="button" class="division-image" data-division-image="'+name+'" aria-label="放大查看'+label+'"><img src="'+art(name)+'" alt="'+label+'" loading="lazy"><span>查看图版 ↗</span></button>';}
 function refresh(){lastKey='';options.onChange();}
 function mount(){
  const root=document.getElementById('view-departments'),grid=document.getElementById('departments-grid');
  if(!root||!grid)return false;
  window.avedDepartmentFilter='';root.dataset.departmentArchive='true';grid.parentElement.hidden=true;
  host=document.createElement('div');host.id='department-archive';grid.parentElement.before(host);
  host.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.dataset.divisionView){view=b.dataset.divisionView;if(!b.hasAttribute('data-division-keep'))window.avedDepartmentFilter=view==='personnel'?'*':'';refresh();}
   else if(b.hasAttribute('data-division-back')){window.avedDepartmentFilter='';refresh();}
   else if(b.dataset.divisionDepartment){window.avedDepartmentFilter=b.dataset.divisionDepartment;uniform=0;refresh();}
   else if(b.dataset.divisionUniform!==undefined){uniform=Number(b.dataset.divisionUniform);refresh();}
   else if(b.dataset.divisionImage)openImage(b.dataset.divisionImage,b.querySelector('img').alt,b);
  });
  return true;
 }
 function openImage(name,title,opener){
  if(!dialog){dialog=document.createElement('dialog');dialog.className='division-image-dialog';dialog.setAttribute('aria-label','服装规程图版');dialog.innerHTML='<header><span></span><button type="button" aria-label="关闭图版">关闭 ×</button></header><div><img alt=""></div>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});}
  dialog.querySelector('header span').textContent=title;dialog.querySelector('img').src=art(name);dialog.querySelector('img').alt=title;dialog.onclose=()=>opener?.isConnected&&opener.focus();dialog.showModal();
 }
 function overview(){return '<header class="division-register-heading"><span>DIVISION REGISTER / 05</span><h3>部门</h3></header><div class="division-overview">'+order.map((name,i)=>{const d=catalog[name],cover=d.images[0];return '<button type="button" class="division-overview-card" data-division-department="'+name+'"><div class="division-card-meta"><span>AVED / '+d.code+'</span><span>0'+(i+1)+'</span></div><div class="division-card-body"><div><h3>'+name+'</h3><p>'+summaries[name]+'</p></div>'+(cover?'<div class="division-card-portrait" style="'+frame(cover)+'"><img src="'+art(cover)+'" alt="" loading="lazy"></div>':'<div class="division-card-seal" aria-hidden="true"><span>'+d.code+'</span><i></i></div>')+'</div><footer><span>'+d.en+'</span><b>查阅部门 ↗</b></footer></button>';}).join('')+'</div>';}
 function department(selected){
  const d=catalog[selected],images=d.images.length?d.images:['suit','coat'];uniform=Math.min(uniform,images.length-1);
  return '<nav class="division-breadcrumb" aria-label="档案路径"><button type="button" data-division-back>← 部门一览</button><span>/ '+selected+'</span></nav><article class="division-dossier"><header><span>万业携生 / 部门资料</span><span>FILE NO. AVE-'+d.code+'-001</span></header><div class="division-spread"><figure>'+image(images[uniform],selected+' · 服装规程')+'<figcaption><span>服装规程 / '+String(uniform+1).padStart(2,'0')+'</span><span>AVED / UNIFORM</span></figcaption></figure><section class="division-intro"><span class="division-kicker">DEPARTMENT DOSSIER / '+d.code+'</span><h3>'+selected+'</h3><p class="division-en">'+d.en+'</p><div class="division-rule"></div><p class="division-description">'+d.desc+'</p><div class="division-attire"><h4>服装规程</h4><p>'+attire+'</p></div>'+(images.length>1?'<div class="division-thumbnails" aria-label="服装图版">'+images.map((x,i)=>'<button type="button" style="'+frame(x)+'" data-division-uniform="'+i+'" aria-pressed="'+(i===uniform)+'" aria-label="图版 '+(i+1)+'"><img src="'+art(x)+'" alt="" loading="lazy"><span>0'+(i+1)+'</span></button>').join('')+'</div>':'')+'<button type="button" class="division-roster-link" data-division-view="personnel" data-division-keep>调阅本部员工档案 ↗</button></section></div><footer><span>DIVISION ARCHIVE</span><span>'+d.code+' / 01</span></footer></article>'+(d.images.length?'<section class="division-common"><header><h3>服装规程</h3><span>公司配发 / STANDARD ISSUE</span></header><div>'+['suit','coat'].map((name,i)=>'<figure>'+image(name,'服装规程 · 西服 '+(i+1))+'<figcaption>图版 0'+(i+1)+'</figcaption></figure>').join('')+'</div></section>':'');
 }
 function render(context){
  options=context;if(!host&&!mount())return;
  const root=document.getElementById('view-departments');root.dataset.directoryView='archive';
  const leader=document.getElementById('company-leadership-directory');if(leader)leader.hidden=true;
  let selected=window.avedDepartmentFilter||'';
  if(view==='department'&&!catalog[selected])selected=window.avedDepartmentFilter='';
  if(view==='personnel'&&!catalog[selected]&&selected!=='公司直属')selected=window.avedDepartmentFilter='*';
  if(previousDepartment!==selected){uniform=0;previousDepartment=selected;}
  const key=[selected,view,uniform].join(':');if(key===lastKey)return;lastKey=key;
  const nav=(view==='personnel'||selected)?'<nav class="division-departments" aria-label="选择部门">'+order.map(name=>'<button type="button" data-division-department="'+name+'" aria-pressed="'+(name===selected)+'">'+name+'</button>').join('')+'</nav>'+(view==='personnel'?'<nav class="division-personnel-scope" aria-label="人员范围"><button type="button" data-division-department="*" aria-pressed="'+(selected==='*')+'">全部人员</button><button type="button" data-division-department="公司直属" aria-pressed="'+(selected==='公司直属')+'">其他职位 ↗</button></nav>':''):'';
  host.innerHTML='<nav class="division-view-tabs" aria-label="部门页面"><button type="button" data-division-view="department" aria-pressed="'+(view==='department')+'">部门展示 <small>DIVISIONS</small></button><button type="button" data-division-view="personnel" aria-pressed="'+(view==='personnel')+'">员工档案 <small>PERSONNEL</small></button></nav>'+nav+(view==='department'?(selected?department(selected):overview()):'<header class="division-roster-heading"><span>PERSONNEL DIRECTORY</span><h3>'+(selected==='*'?'员工档案':selected==='公司直属'?'其他职位':selected+' · 员工档案')+'</h3></header>');
 }
 window.AVEDDepartmentArchive={render,isPersonnel:()=>view==='personnel',reset(){view='department';window.avedDepartmentFilter='';lastKey='';uniform=0;}};
})();
