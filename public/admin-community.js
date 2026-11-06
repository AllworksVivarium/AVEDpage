const sourceLabels={thread:'论坛主题',reply:'论坛回复',comment:'通告留言',dossier:'卷宗评议',chat:'无线电通讯',life:'生活记录'};
const adminConnecting=document.createElement('section');adminConnecting.className='admin-loading';adminConnecting.hidden=true;adminConnecting.innerHTML='<div><p class="eyebrow">INTERNAL CARRIER</p><h2>欢迎回到公司</h2><p>正在接通管理终端</p><progress aria-label="接通进度"></progress></div>';document.body.append(adminConnecting);
function showAdminConnecting(){adminConnecting.hidden=false;adminConnecting.classList.add('admin-connecting-active');}
function hideAdminConnecting(){adminConnecting.hidden=true;adminConnecting.classList.remove('admin-connecting-active');}
document.querySelector('#sidebar').prepend(document.querySelector('#sidebarToggle'));
function auditDateField(name,label,end){
 const options=(max,selected)=>Array.from({length:max},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${i+1===selected?'selected':''}>${i+1}</option>`).join('');
 return `<label>${label}<span data-audit-date="${name}"><select data-part="year" aria-label="${label}年份"><option value="2026">2026</option><option value="2027" ${end?'selected':''}>2027</option></select><select data-part="month" aria-label="${label}月份">${options(12,end?12:1)}</select><select data-part="day" aria-label="${label}日期">${options(31,end?31:1)}</select></span><input type="hidden" name="${name}" value="${end?'2027-12-31':'2026-01-01'}"></label>`;
}
const filterMarkup=id=>`<form id="${id}" class="community-filters">${auditDateField('from','起始区间',false)}${auditDateField('to','结束区间',true)}<input name="keyword" maxlength="120" placeholder="关键词、员工或内容" aria-label="查找关键词"><button class="small-action">检索</button></form>`;
function bindAuditDates(form){
 for(const field of form.querySelectorAll('[data-audit-date]')){
  const year=field.querySelector('[data-part=year]'),month=field.querySelector('[data-part=month]'),day=field.querySelector('[data-part=day]');
  function sync(){const selected=Number(day.value),max=new Date(Date.UTC(Number(year.value),Number(month.value),0)).getUTCDate();day.innerHTML=Array.from({length:max},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${i+1}</option>`).join('');day.value=String(Math.min(selected,max)).padStart(2,'0');form.elements[field.dataset.auditDate].value=[year.value,month.value,day.value].join('-');}
  field.addEventListener('change',sync);sync();
 }
}

async function renderModeration(){
 const {items}=await api('/api/admin/moderation');
 $('#panel').innerHTML='<div class="section-heading"><h3>图文核验</h3><p>待核材料</p></div>'+items.map(x=>`<article class="notice-box"><h4>${esc(x.title)}</h4><small>发布用户：${esc(x.displayName)}（${esc(x.username)} / #${x.employeeId}）<br>来源：${esc(({thread:'匿名聊天论坛 · 主题',reply:'匿名聊天论坛 · 回复',life:'生活记录'})[x.kind]||x.kind)}<br>${AVEDTime.markup(x.createdAt)}</small><p class="announcement-body">${esc(x.body)}</p><img class="moderation-image" src="${esc(x.imageData)}" alt="待核影像"><div class="moderation-actions"><button class="small-action" data-archive-id="${x.archiveId}" data-review="approve" data-kind="${x.kind}" data-id="${x.id}">批准</button><button class="small-action" data-archive-id="${x.archiveId}" data-review="reject" data-kind="${x.kind}" data-id="${x.id}">拒绝</button></div></article>`).join('')+(items.length?'':'<p>暂无待核材料。</p>');
 document.querySelectorAll('[data-review]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`/api/admin/moderation/${b.dataset.kind}/${b.dataset.id}`,{method:'POST',body:JSON.stringify({action:b.dataset.review,archiveId:Number(b.dataset.archiveId)})});await renderModeration();}catch(e){alert(e.message);b.disabled=false;}});
}

async function renderActivity(){
 const categories={speech:'发言记录',image:'图片记录'};
 $('#panel').innerHTML='<h3>活动记录</h3><p>选择记录分类后加载，每次最多 50 条。</p><div class="community-filters" id="audit-categories">'+Object.entries(categories).map(([key,label])=>`<button type="button" class="small-action" data-audit-category="${key}" aria-pressed="false">${label}</button>`).join('')+'</div>'+filterMarkup('activity-filters')+'<div id="activity-list"><p>请选择要调阅的记录分类。</p></div><button id="activityMore" class="small-action" hidden>调阅更早记录</button>';
 const panel=$('#panel'),form=$('#activity-filters');bindAuditDates(form);const status=document.createElement('select');status.name='status';status.setAttribute('aria-label','图片审核状态');status.hidden=true;status.innerHTML='<option value="">全部审核状态</option><option value="pending">待审核</option><option value="approved">已批准</option><option value="rejected">已拒绝</option>';form.querySelector('button').before(status);let category='',next=null,serial=0,applied=null;
 async function search(more=false){
  if(!category){$('#activity-list').innerHTML='<p>请先选择记录分类。</p>';return;}
  const current=++serial,q=new URLSearchParams(more?applied:new FormData(form));q.set('category',category);if(more&&next)q.set('before',next);
  if(category!=='image')q.delete('status');
  const button=$('#activityMore');button.disabled=true;
  try{
   const data=await api('/api/admin/activity?'+q);if(current!==serial||!panel.contains(form))return;
   const html=data.items.map(x=>`<article class="admin-post"><b>#${x.id} ${esc(categories[x.category]||'记录')} · ${esc(activityTargetName(x.target))}</b><small>${esc(x.display_name||'')} ${esc(x.username||'公司系统')} ${AVEDTime.markup(x.created_at)}</small>${x.category==='image'?`<p>来源：${esc(x.sourceBoard)}<br>审核状态：<strong>${esc(({pending:'待审核',approved:'已批准',rejected:'已拒绝'})[x.moderation]||'待审核')}</strong>${x.reviewer_name?`<br>审核人：${esc(x.reviewer_name)} ${AVEDTime.markup(x.reviewed_at)}`:''}</p>`:''}<details><summary>调阅留存记录</summary><pre class="audit-detail">${esc(JSON.stringify(AVEDTime.sanitize(JSON.parse(x.details)),null,2))}</pre>${x.imageUrl?`<button type="button" class="small-action" data-audit-image="${esc(x.imageUrl)}">加载图片</button>`:''}</details></article>`).join('');
   if(more)$('#activity-list').insertAdjacentHTML('beforeend',html);else $('#activity-list').innerHTML=html||'<p>未检索到记录。</p>';
   applied=new URLSearchParams(q);applied.delete('before');next=data.next;button.hidden=!next;
   $('#activity-list').querySelectorAll('[data-audit-image]').forEach(b=>b.onclick=()=>{const img=document.createElement('img');img.className='moderation-image';img.alt='留存图片';img.src=b.dataset.auditImage;img.onerror=()=>{img.replaceWith(document.createTextNode('图片已移除或不可读取。'));};b.replaceWith(img);});
  }finally{if(current===serial)button.disabled=false;}
 }
 $('#audit-categories').onclick=e=>{const b=e.target.closest('[data-audit-category]');if(!b)return;category=b.dataset.auditCategory;status.hidden=category!=='image';next=null;$('#activityMore').hidden=true;for(const option of $('#audit-categories').querySelectorAll('button'))option.setAttribute('aria-pressed',String(option===b));search().catch(e=>alert(e.message));};
 form.onsubmit=e=>{e.preventDefault();search().catch(e=>alert(e.message));};$('#activityMore').onclick=()=>search(true).catch(e=>alert(e.message));
}

async function renderSpeechRecords(){
 $('#panel').innerHTML='<h3>通讯追溯</h3>'+filterMarkup('speech-filters')+'<div id="speech-results"><p>请选择检索范围。</p></div><button id="speech-more" class="small-action" hidden>调阅更多通讯</button>';
 bindAuditDates($('#speech-filters'));
 $('#speech-filters').querySelector('button').insertAdjacentHTML('beforebegin','<select name="sourceType" aria-label="通讯来源"><option value="">全部来源</option>'+Object.entries(sourceLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')+'</select>');let serial=0,offset=0;
 async function search(more=false){const current=++serial,q=new URLSearchParams(new FormData($('#speech-filters')));if(!more)offset=0;q.set('offset',offset);const {items}=await api('/api/admin/speech-records?'+q);if(current!==serial)return;
  const markup=items.map(x=>`<article class="admin-post ${x.deletedAt?'deleted-record':''}"><div class="admin-post-head"><h4>${esc(sourceLabels[x.sourceType])} #${x.sourceId} ${esc(x.title)}</h4>${x.deletedAt?'':`<button class="small-action danger" data-speech-remove="${x.sourceType}" data-id="${x.sourceId}">移除公开内容</button>`}</div><div class="audit-identity"><span>实名 ${esc(x.displayName||'离职员工')}</span><span>账号 ${esc(x.username)}</span><span>QQ ${esc(x.qqNumber||'未绑定')}</span><span>当前代号 ${esc(x.anonymousName)}</span></div><p>曾用代号：${x.aliases.map(esc).join(' / ')||'—'}</p><small>${AVEDTime.markup(x.createdAt)}</small><p class="announcement-body">${esc(x.body)}</p>${x.editedAt?`<p>已编辑 ${AVEDTime.markup(x.editedAt)}</p>`:''}${x.deletedAt?`<p>管理员 #${x.deletedBy} 于 ${AVEDTime.markup(x.deletedAt)} 删除</p>`:''}${x.revisions.length?`<details><summary>修订历史 (${x.revisions.length})</summary><div class="audit-revisions">${x.revisions.map(v=>`<section><small>${AVEDTime.markup(v.createdAt)}</small><p>修订前：${esc(v.before.title||'')} ${esc(v.before.body)}</p><p>修订后：${esc(v.after.title||'')} ${esc(v.after.body)}</p></section>`).join('')}</div></details>`:''}</article>`).join('');if(more)$('#speech-results').insertAdjacentHTML('beforeend',markup);else $('#speech-results').innerHTML=markup||'<p>未检索到通讯。</p>';offset+=items.length;$('#speech-more').hidden=items.length<50;
  document.querySelectorAll('[data-speech-remove]').forEach(b=>b.onclick=async()=>{if(!confirm('确认移除这条公开内容？'))return;const type=b.dataset.speechRemove,path=type==='thread'?'/api/admin/forum/threads/':type==='reply'?'/api/admin/forum/replies/':'/api/admin/speech/'+({comment:'posts',dossier:'dossier_comments',chat:'chat_messages',life:'life_records'})[type]+'/';b.disabled=true;try{await api(path+b.dataset.id,{method:'DELETE'});await search();}catch(e){alert(e.message);b.disabled=false;}});
 }
 $('#speech-filters').onsubmit=e=>{e.preventDefault();search().catch(e=>alert(e.message));};$('#speech-more').onclick=()=>search(true).catch(e=>alert(e.message));
}

async function renderContentAdmin(section='announcements'){
 const [news,files]=await Promise.all([section==='announcements'?api('/api/announcements'):{items:[]},section==='dossiers'?api('/api/dossiers'):{items:[]}]);
 const publicationInput=n=>new Date(AVEDTime.parse(n?.publishedAt||n?.createdAt||new Date().toISOString()).getTime()+8*3600000).toISOString().slice(0,19);
 const noticeFields=n=>`<label>标题<input name="title" required maxlength="150" value="${esc(n?.title||'')}"></label><label>正文<textarea name="body" required maxlength="5000" rows="5">${esc(n?.body||'')}</textarea></label><label>称呼（选填，留空不显示）<input name="recipient" maxlength="200" placeholder="例如：各部门、全体员工：" value="${esc(n?.recipient||'')}"></label><label>落款（选填，留空不显示）<input name="issuer" maxlength="80" placeholder="例如：万业携生行政部" value="${esc(n?.issuer||'')}"></label><label>发布时间（北京时间）<input name="publishedAt" type="datetime-local" step="1" required value="${publicationInput(n)}"></label><label><span><input name="pinned" type="checkbox" ${n?.pinned?'checked':''}>置顶</span></label><button class="small-action">${n?'保存修改':'发布公告'}</button>`;
 const fields=f=>`<label>编号<input name="code" required maxlength="30" value="${esc(f?.code||'')}"></label><label>名称<input name="title" required maxlength="100" value="${esc(f?.title||'')}"></label><label>所属部门<input name="department" maxlength="80" value="${esc(f?.department||'')}"></label><label>收容状态<input name="status" maxlength="40" value="${esc(f?.status||'观察中')}"></label><label>卷宗正文<textarea name="summary" required maxlength="12000" rows="6">${esc(f?.summary||'')}</textarea></label><button class="small-action">${f?'保存修改':'登记卷宗'}</button>`;
 $('#panel').innerHTML=`<h3>公告与收容卷宗</h3><section class="admin-section" data-content-section="announcements"><h4>公告</h4><details><summary>发布新公告</summary><form class="community-form" data-content-form="announcements">${noticeFields()}</form></details>${news.items.map(n=>`<article class="admin-post"><h4>${esc(n.title)}</h4><small>${AVEDTime.markup(n.createdAt)}</small><p class="announcement-body">${esc(n.body)}</p><details><summary>编辑公告</summary><form class="community-form" data-content-form="announcements" data-id="${n.id}">${noticeFields(n)}</form></details><button class="small-action danger" data-content-delete="announcements/${n.id}">删除公告</button></article>`).join('')}</section><section class="admin-section" data-content-section="dossiers"><h4>收容卷宗</h4><details><summary>登记新收容物</summary><form class="community-form" data-content-form="dossiers">${fields()}</form></details>${files.items.map(f=>`<article class="admin-post"><h4>${esc(f.code)} ${esc(f.title)}</h4><details><summary>编辑卷宗</summary><form class="community-form" data-content-form="dossiers" data-id="${f.id}">${fields(f)}</form></details><button class="small-action danger" data-content-delete="dossiers/${f.id}">删除卷宗</button></article>`).join('')}</section>`;
 for(const item of document.querySelectorAll('[data-content-section]')){if(item.dataset.contentSection!==section)item.remove();else item.querySelector('h4')?.remove();}
 bindContentForms(()=>renderContentAdmin(section));
}

function bindContentForms(render){
 document.querySelectorAll('[data-content-form]').forEach(form=>form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{const data=Object.fromEntries(new FormData(form));if(form.dataset.contentForm==='announcements')data.pinned=!!data.pinned;await api('/api/admin/'+form.dataset.contentForm+(form.dataset.id?'/'+form.dataset.id:''),{method:form.dataset.id?'PUT':'POST',body:JSON.stringify(data)});await render();}catch(err){alert(err.message);button.disabled=false;}
 });
 document.querySelectorAll('[data-content-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('确认删除这项内容？前台将同步移除。'))return;b.disabled=true;try{await api('/api/admin/'+b.dataset.contentDelete,{method:'DELETE'});await render();}catch(e){alert(e.message);b.disabled=false;}});
}

async function renderBroadcastAdmin(){
 const {items}=await api('/api/admin/music'),kinds=['环境音','白噪音','音乐'];
 const fields=m=>`<label>曲目名称<input name="title" required maxlength="100" value="${esc(m?.title||'')}"></label><label>音频地址<input name="url" required maxlength="1000" value="${esc(m?.url||'')}" placeholder="HTTPS 音频地址"></label><label>分类<select name="kind">${kinds.map(k=>`<option ${m?.kind===k?'selected':''}>${k}</option>`).join('')}</select></label><button class="small-action">${m?'保存修改':'添加曲目'}</button>`;
 $('#panel').innerHTML=`<h3>广播</h3><section class="admin-section"><details><summary>添加广播曲目</summary><form class="community-form" data-content-form="music">${fields()}</form></details>${items.map(m=>`<article class="admin-post"><h4>${esc(m.title)}</h4><p>${esc(m.kind)}</p><details><summary>编辑曲目</summary><form class="community-form" data-content-form="music" data-id="${m.id}">${fields(m)}</form></details><button class="small-action danger" data-content-delete="music/${m.id}">删除曲目</button></article>`).join('')||'<p>暂无广播曲目。</p>'}</section>`;
 bindContentForms(renderBroadcastAdmin);
}

async function renderTerminology(){
 const {items}=await api('/api/admin/terminology');
 const fields=x=>`<label>原词<input name="pattern" required maxlength="80" value="${esc(x?.pattern||'')}"></label><label>替换为<input name="replacement" maxlength="160" value="${esc(x?.replacement||'')}"></label>${x?.isRegex?'<p>此项为旧版表达式规则，保存时保留原有匹配方式。</p>':''}<label><span><input name="enabled" type="checkbox" ${!x||x.enabled?'checked':''}>启用</span></label><button class="small-action">保存词条</button>`;
 $('#panel').innerHTML='<h3>公司用语规范</h3><p>直接填写要替换的原词和替换后的文字，无需表达式或特殊语法。</p><details class="admin-section" open><summary>登记词条</summary><form class="community-form terminology-form">'+fields()+'</form></details>'+items.map(x=>`<details class="admin-post" data-keep-original><summary>${esc(x.pattern)} → ${esc(x.replacement)} ${x.enabled?'启用':'停用'}</summary><form class="community-form terminology-form" data-id="${x.id}" data-legacy-regex="${x.isRegex?'true':'false'}">${fields(x)}</form><button class="small-action danger" data-rule-remove="${x.id}">移除词条</button></details>`).join('');
 document.querySelectorAll('.terminology-form').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),b=form.querySelector('button');b.disabled=true;try{await api('/api/admin/terminology'+(form.dataset.id?'/'+form.dataset.id:''),{method:form.dataset.id?'PUT':'POST',body:JSON.stringify({pattern:f.get('pattern'),replacement:f.get('replacement'),isRegex:form.dataset.legacyRegex==='true',enabled:f.has('enabled')})});window.AVEDTerminology?.refreshRules();await renderTerminology();}catch(e){alert(e.message);b.disabled=false;}});
 document.querySelectorAll('[data-rule-remove]').forEach(b=>b.onclick=async()=>{if(!confirm('确认移除这条用语规范？'))return;await api('/api/admin/terminology/'+b.dataset.ruleRemove,{method:'DELETE'});window.AVEDTerminology?.refreshRules();await renderTerminology();});
}
