(()=>{
 'use strict';
 const catalog={
  '医疗部':{code:'MED',en:'MEDICAL DIVISION',images:['medical'],desc:'承担公司职业健康管理、现场医疗支持及异常暴露后的医学观察。为外勤与收容作业提供医疗保障，组织伤后治疗、隔离评估和复岗检查，并维护相关健康记录。'},
  '武装部':{code:'ARM',en:'ARMED DIVISION',images:['armed-dark','armed-light'],desc:'承担公司设施安保、外勤护卫与异常事件的现场处置。根据任务等级配置人员及装备，协助开展目标回收、区域封控和紧急转移，并与收容、医疗部门完成后续交接。'},
  '科研部':{code:'RES',en:'RESEARCH DIVISION',images:['research'],desc:'负责异常样本分析、现象机理研究及应用技术评估。接收各部门提交的样本与观测记录，组织实验验证，为收容方案、风险分级和专用设备开发提供技术依据。'},
  '收容部':{code:'CON',en:'CONTAINMENT DIVISION',images:[],desc:'负责公司收容设施的日常运行、对象管理与状态监测。落实各项收容规程，组织接收、转运及作业交接；发现指标偏离时，协调相关部门开展评估与处置，维护完整的运行记录。'},
  '后勤部':{code:'LOG',en:'LOGISTICS DIVISION',images:['suit'],desc:'统筹公司采购、仓储、运输与设施维护，为各部门提供物资及运行支持。根据常规需求和专项任务安排配给、检修与调度，保障收容区域及办公设施的持续运转。'}
 };
 const focus={'收容部':'设施巡检 对象接收与转运 状态观测 作业交接','武装部':'巡逻警戒 外勤护卫 区域封控 紧急转移','医疗部':'现场救治 暴露观察 伤后治疗 复岗检查','科研部':'样本分析 实验验证 风险评估 设备研发','后勤部':'采购配给 仓储运输 设施检修 任务调度'};

 const order=['收容部','武装部','医疗部','科研部','后勤部'];
 const descriptionsEnglish={'收容部':'Oversees containment operations, entity management and monitoring, including intake, transfers, shift handovers and coordinated responses to abnormal readings.','武装部':'Provides facility security, field escorts and incident response, coordinating recovery, access control and emergency transfers with containment and medical teams.','医疗部':'Provides occupational health care, field medical support and post-exposure observation, including treatment, isolation assessments and return-to-duty examinations.','科研部':'Conducts anomaly analysis, experimental research and technical assessment to support containment planning, risk classification and specialist equipment development.','后勤部':'Coordinates procurement, storage, transport and facility maintenance, keeping departments supplied and company operations running.'};
 const summaries={'收容部':'收容设施运行、对象管理与状态监测。','武装部':'设施安保、外勤护卫与现场处置。','医疗部':'职业健康、医疗支持与异常暴露观察。','科研部':'异常分析、实验研究与技术评估。','后勤部':'物资配给、设施维护与运行保障。'};
 // The frame crops only the preview; opening an image always uses the original.
 const frames={'medical':[56.5,'#b4baba'],'armed-dark':[55.3,'#b6b7b9'],'armed-light':[54.8,'#b6b7b9'],'research':[50.1,'#b5b5b5'],'suit':[54.7,'#c0c0c2'],'coat':[54.5,'#c0c0c2']};
 let host,options,view='department',lastKey='',uniform=0,previousDepartment='',dialog,sort='default';
 const sorts=[['default','默认顺序'],['name-asc','姓名 拼音正序'],['name-desc','姓名 拼音倒序'],['stroke','姓名 笔画顺序']];
 const pinyin=new Intl.Collator('zh-CN-u-co-pinyin',{numeric:true,sensitivity:'base'}),stroke=new Intl.Collator('zh-CN-u-co-stroke',{numeric:true,sensitivity:'base'});
 const name=person=>String(person.sortName??person.name??'').normalize('NFKC').trim();
 const direct=person=>person.department==='公司直属'&&!person.identityKind?.endsWith('_containment');
 function roster(items,filter=window.avedDepartmentFilter){
  const compare=sort==='stroke'?stroke:pinyin,direction=sort==='name-desc'?-1:1;
  return items.filter(person=>filter==='*'||(filter==='公司直属'? !order.includes(person.department):person.department===filter)).sort((a,b)=>(sort==='default'?Number(direct(b))-Number(direct(a)):0)||direction*compare.compare(name(a),name(b))||pinyin.compare(String(a.id??''),String(b.id??'')));
 }
 const cards={'医疗部':'card-medical','武装部':'card-armed','科研部':'card-research','收容部':'card-containment','后勤部':'card-general'};
 const art=name=>name==='card-containment'?'/assets/department-cards/card-containment.91f0da994b01.jpeg':Object.values(cards).includes(name)?'/assets/department-cards/'+name+'.png':'/assets/uniforms/'+name+(['medical','armed-dark','armed-light','suit'].includes(name)?'-clean.webp':'.jpeg');
 const frame=name=>'--uniform-center:'+frames[name][0]+'%;--uniform-bg:'+frames[name][1];
 function image(name,label){return '<button type="button" class="division-image" style="'+frame(name)+'" data-division-image="'+name+'" aria-label="放大查看'+label+'"><img src="'+art(name)+'" alt="'+label+'" loading="lazy"><span>查看图版 ↗</span></button>';}
 function watchImage(img){
  const box=img.parentElement;if(!box)return;
  box.classList.add('division-media');
  let status=box.querySelector('.division-media-loader');
  if(!status){status=document.createElement('i');status.className='division-media-loader';status.setAttribute('role','status');status.setAttribute('aria-label','加载中');box.append(status);}
  box.dataset.mediaState='loading';box.setAttribute('aria-busy','true');status.hidden=false;
  const settle=()=>{if(!img.complete)return;box.dataset.mediaState=img.naturalWidth>0?'ready':'error';box.setAttribute('aria-busy','false');status.hidden=true;};
  img.onload=settle;img.onerror=settle;settle();
 }
 function watchImages(root){root.querySelectorAll('img').forEach(watchImage);}
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
   else if(b.dataset.divisionDepartment){window.avedDepartmentFilter=view==='personnel'&&window.avedDepartmentFilter===b.dataset.divisionDepartment?'*':b.dataset.divisionDepartment;uniform=0;refresh();}
   else if(b.dataset.divisionUniform!==undefined)selectUniform(Number(b.dataset.divisionUniform));
   else if(b.dataset.divisionImage)openImage(b.dataset.divisionImage,b.querySelector('img').alt,b);
  });
  host.addEventListener('change',e=>{const control=e.target.closest('[data-division-sort]');if(control&&sorts.some(([value])=>value===control.value)){sort=control.value;options.onChange();}});
  return true;
 }
 function selectUniform(index){
  const selected=window.avedDepartmentFilter,d=catalog[selected];if(view!=='department'||!d)return;
  const images=d.images;if(!Number.isInteger(index)||index<0||index>=images.length||index===uniform)return;
  const picture=host.querySelector('.division-dossier .division-spread>figure .division-image'),number=host.querySelector('[data-division-uniform-number]');if(!picture||!number)return;
  uniform=index;lastKey=[selected,view,uniform].join(':');
  const name=images[index],label=selected+' 服装规程',img=picture.querySelector('img');
  picture.dataset.divisionImage=name;picture.style.cssText=frame(name);picture.setAttribute('aria-label','放大查看'+label);img.src=art(name);img.alt=label;watchImage(img);
  number.textContent=String(index+1).padStart(2,'0');
  host.querySelectorAll('[data-division-uniform]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.divisionUniform)===index)));
 }
 function openImage(name,title,opener){
  if(!dialog){dialog=document.createElement('dialog');dialog.className='division-image-dialog';dialog.setAttribute('aria-label','服装规程图版');dialog.innerHTML='<header><span></span><button type="button" aria-label="关闭图版">×</button></header><div><img alt=""></div>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});}
  dialog.setAttribute('aria-label',title);dialog.querySelector('header span').textContent=title;dialog.querySelector('img').src=art(name);dialog.querySelector('img').alt=title;dialog.onclose=()=>opener?.isConnected&&opener.focus();watchImage(dialog.querySelector('img'));dialog.showModal();
 }
 const hebrew={'收容部':'אגף הכליאה','武装部':'אגף הביטחון','医疗部':'אגף הרפואה','科研部':'אגף המחקר','后勤部':'אגף הלוגיסטיקה'};
 function departmentPlate(d,he){return '<svg class="division-letterplate" viewBox="0 0 640 280" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M18 26H622M18 54H622M18 190H622M18 230H622M18 254H622M420 14V264"/><text x="18" y="44">ALLWORKS VIVARIUM // DEPARTMENT ARCHIVE</text><text class="division-letterplate-title" x="16" y="143">'+d.en.replace(' DIVISION','')+'</text><text x="18" y="180">PERSONNEL ACCESS / INTERNAL CORRESPONDENCE / ARCHIVE REGISTER</text><text x="18" y="216">'+d.en+' // A.V.E.D. INTRANET</text><text x="18" y="248" text-anchor="start" lang="he">'+he+'</text><text x="18" y="270">SECURE. CONTAIN. PROTECT. // ALLWORKS VIVARIUM</text></svg>';}
 function overview(){return '<div class="division-overview">'+order.map(name=>{const d=catalog[name],cover=d.images[0];return '<button type="button" class="division-overview-card" data-division-department="'+name+'">'+departmentPlate(d,hebrew[name])+'<div class="division-card-meta"><span lang="en">AVED / '+d.code+'</span><span lang="en">INTERNAL PERSONNEL ARCHIVE</span></div><div class="division-card-body"><div class="division-card-copy"><span class="division-card-hebrew" lang="he" dir="rtl">'+hebrew[name]+'</span><h3>'+name+'</h3><span class="division-card-english" lang="en">'+d.en+'</span><p>'+summaries[name]+'</p><span class="division-card-caption" lang="en">SECURE. CONTAIN. PROTECT.</span></div>'+(cover?'<div class="division-card-portrait" style="'+frame(cover)+'"><img src="'+art(cover)+'" alt="" loading="lazy"></div>':'<div class="division-card-seal" aria-hidden="true"><span>'+d.code+'</span><i></i><small lang="en">A.V.E.D.</small></div>')+'</div><div class="division-card-register" lang="en">ALLWORKS VIVARIUM // DEPARTMENT REGISTER // AUTHORIZED ACCESS</div><footer><span class="division-card-network"><span lang="en">INTERNAL NETWORK</span><span lang="he" dir="rtl">רשת פנימית</span></span><b>查阅部门 ↗</b></footer></button>';}).join('')+'</div>';}
 function department(selected){
  const d=catalog[selected],images=d.images;uniform=Math.max(0,Math.min(uniform,images.length-1));
  return '<nav class="division-breadcrumb" aria-label="档案路径"><button type="button" data-division-back>← 返回</button></nav><article class="division-dossier"><header><span class="division-dossier-brand"><span lang="en">ALLWORKS VIVARIUM / DEPARTMENT ARCHIVE</span><span lang="he" dir="rtl">ארכיון החברה</span></span><span>AVED / '+d.code+'</span></header><div class="division-spread"><figure>'+(images.length?'<div class="division-figure-label"><span lang="en">COMPANY ISSUE / UNIFORM STUDY</span><span lang="he" dir="rtl">לבוש</span></div>'+image(images[uniform],selected+' 服装规程')+'<figcaption><span>服装规程 / <span data-division-uniform-number>'+String(uniform+1).padStart(2,'0')+'</span></span><span>AVED / UNIFORM</span></figcaption>':'<div class="division-uniform-placeholder" aria-hidden="true"><span>'+d.code+'</span><small lang="en">A.V.E.D.</small></div>')+'</figure><section class="division-intro"><span class="division-kicker" lang="en">DEPARTMENT DOSSIER / '+d.code+'</span><div class="division-editorial-title"><span class="division-title-watermark" aria-hidden="true">'+d.en.replace(' DIVISION','')+'</span><span class="division-title-hebrew" lang="he" dir="rtl">'+hebrew[selected]+'</span><h3>'+selected+'</h3><p class="division-en" lang="en">'+d.en+'</p><span class="division-title-caption" lang="en">SECURE. CONTAIN. PROTECT.</span></div><div class="division-rule"></div><div class="division-section-label"><span>部门职责</span><span lang="en">MANDATE / RESPONSIBILITIES</span></div><p class="division-description">'+d.desc+'</p><p class="division-description-en" lang="en">'+descriptionsEnglish[selected]+'</p><div class="division-focus"><h4 class="division-section-label"><span>常规事务</span><span lang="en">OPERATIONS / SCOPE</span></h4><p>'+focus[selected]+'</p></div>'+(images.length>1?'<div class="division-thumbnails" aria-label="服装图版">'+images.map((x,i)=>'<button type="button" style="'+frame(x)+'" data-division-uniform="'+i+'" aria-pressed="'+(i===uniform)+'" aria-label="图版 '+(i+1)+'"><img src="'+art(x)+'" alt="" loading="lazy"><span>0'+(i+1)+'</span></button>').join('')+'</div>':'')+'<button type="button" class="division-roster-link" data-division-view="personnel" data-division-keep>调阅本部员工档案 ↗</button></section></div><footer><span lang="en">A.V.E.D. / PERSONNEL &amp; OPERATIONS</span><span lang="en">'+d.code+' // INTERNAL USE</span></footer></article><section class="division-card-attachment"><button type="button" data-division-image="'+cards[selected]+'" aria-label="放大查看'+selected+'资料图"><img src="'+art(cards[selected])+'" alt="'+selected+'资料图" width="'+(selected==='收容部'?2862:1280)+'" height="'+(selected==='收容部'?1600:715)+'" loading="lazy"></button></section>';
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
  const nav=(view==='personnel'||selected)?'<nav class="division-departments" aria-label="选择部门">'+order.map(name=>'<button type="button" data-division-department="'+name+'" aria-pressed="'+(name===selected)+'">'+name+'</button>').join('')+'</nav>':'';
  const tools=view==='personnel'?'<div class="division-roster-tools"><label>姓名排序<select data-division-sort aria-label="姓名排序">'+sorts.map(([value,label])=>'<option value="'+value+'" '+(sort===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>':'';
  host.innerHTML='<nav class="division-view-tabs" aria-label="部门页面"><button type="button" data-division-view="department" aria-pressed="'+(view==='department')+'">部门展示 <small>DIVISIONS</small></button><button type="button" data-division-view="personnel" aria-pressed="'+(view==='personnel')+'">员工档案 <small>PERSONNEL</small></button></nav>'+nav+tools+(view==='department'?(selected?department(selected):overview()):'');
  watchImages(host);
 }
 window.AVEDDepartmentArchive={render,roster,isPersonnel:()=>view==='personnel',reset(){view='department';window.avedDepartmentFilter='';lastKey='';uniform=0;sort='default';}};
})();
