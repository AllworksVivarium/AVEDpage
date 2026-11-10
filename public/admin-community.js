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
 document.querySelectorAll('[data-review]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`/api/admin/moderation/${b.dataset.kind}/${b.dataset.id}`,{method:'POST',body:JSON.stringify({action:b.dataset.review,archiveId:Number(b.dataset.archiveId)})});await renderModeration();}catch(e){window.AVEDFeedback.alert(e.message);b.disabled=false;}});
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
 $('#audit-categories').onclick=e=>{const b=e.target.closest('[data-audit-category]');if(!b)return;category=b.dataset.auditCategory;status.hidden=category!=='image';next=null;$('#activityMore').hidden=true;for(const option of $('#audit-categories').querySelectorAll('button'))option.setAttribute('aria-pressed',String(option===b));search().catch(e=>window.AVEDFeedback.alert(e.message));};
 form.onsubmit=e=>{e.preventDefault();search().catch(e=>window.AVEDFeedback.alert(e.message));};$('#activityMore').onclick=()=>search(true).catch(e=>window.AVEDFeedback.alert(e.message));
}

async function renderSpeechRecords(){
 $('#panel').innerHTML='<h3>通讯追溯</h3>'+filterMarkup('speech-filters')+'<div id="speech-results"><p>请选择检索范围。</p></div><button id="speech-more" class="small-action" hidden>调阅更多通讯</button>';
 bindAuditDates($('#speech-filters'));
 $('#speech-filters').querySelector('button').insertAdjacentHTML('beforebegin','<select name="sourceType" aria-label="通讯来源"><option value="">全部来源</option>'+Object.entries(sourceLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')+'</select>');let serial=0,offset=0;
 async function search(more=false){const current=++serial,q=new URLSearchParams(new FormData($('#speech-filters')));if(!more)offset=0;q.set('offset',offset);const {items}=await api('/api/admin/speech-records?'+q);if(current!==serial)return;
  const markup=items.map(x=>`<article class="admin-post ${x.deletedAt?'deleted-record':''}"><div class="admin-post-head"><h4>${esc(sourceLabels[x.sourceType])} #${x.sourceId} ${esc(x.title)}</h4>${x.deletedAt?'':`<button class="small-action danger" data-speech-remove="${x.sourceType}" data-id="${x.sourceId}">移除公开内容</button>`}</div><div class="audit-identity"><span>实名 ${esc(x.displayName||'离职员工')}</span><span>账号 ${esc(x.username)}</span><span>QQ ${esc(x.qqNumber||'未绑定')}</span><span>当前代号 ${esc(x.anonymousName)}</span>${x.personaName?`<span>演绎身份 ${esc(x.personaName)}</span>`:''}</div><p>曾用代号：${x.aliases.map(esc).join(' / ')||'—'}</p><small>${AVEDTime.markup(x.createdAt)}</small><p class="announcement-body">${esc(x.body)}</p>${x.editedAt?`<p>已编辑 ${AVEDTime.markup(x.editedAt)}</p>`:''}${x.deletedAt?`<p>管理员 #${x.deletedBy} 于 ${AVEDTime.markup(x.deletedAt)} 删除</p>`:''}${x.revisions.length?`<details><summary>修订历史 (${x.revisions.length})</summary><div class="audit-revisions">${x.revisions.map(v=>`<section><small>${AVEDTime.markup(v.createdAt)}</small><p>修订前：${esc(v.before.title||'')} ${esc(v.before.body)}</p><p>修订后：${esc(v.after.title||'')} ${esc(v.after.body)}</p></section>`).join('')}</div></details>`:''}</article>`).join('');if(more)$('#speech-results').insertAdjacentHTML('beforeend',markup);else $('#speech-results').innerHTML=markup||'<p>未检索到通讯。</p>';offset+=items.length;$('#speech-more').hidden=items.length<50;
  document.querySelectorAll('[data-speech-remove]').forEach(b=>b.onclick=async()=>{if(!await window.AVEDFeedback.confirm('确认移除这条公开内容？'))return;const type=b.dataset.speechRemove,path=type==='thread'?'/api/admin/forum/threads/':type==='reply'?'/api/admin/forum/replies/':'/api/admin/speech/'+({comment:'posts',dossier:'dossier_comments',chat:'chat_messages',life:'life_records'})[type]+'/';b.disabled=true;try{await api(path+b.dataset.id,{method:'DELETE'});await search();}catch(e){window.AVEDFeedback.alert(e.message);b.disabled=false;}});
 }
 $('#speech-filters').onsubmit=e=>{e.preventDefault();search().catch(e=>window.AVEDFeedback.alert(e.message));};$('#speech-more').onclick=()=>search(true).catch(e=>window.AVEDFeedback.alert(e.message));
}

async function renderContentAdmin(section='announcements'){
 const [news,files]=await Promise.all([section==='announcements'?api('/api/admin/announcements'):{items:[]},section==='dossiers'?api('/api/admin/dossiers'):{items:[]}]);
 const publicationInput=n=>new Date(AVEDTime.parse(n?.publishedAt||n?.createdAt||new Date().toISOString()).getTime()+8*3600000).toISOString().slice(0,19);
 const noticeFields=n=>`<label>标题<input name="title" required maxlength="150" value="${esc(n?.title||'')}"></label><label>正文<textarea name="body" required maxlength="5000" rows="5">${esc(n?.body||'')}</textarea></label><label>称呼（选填，留空不显示）<input name="recipient" maxlength="200" placeholder="例如：各部门、全体员工：" value="${esc(n?.recipient||'')}"></label><label>落款（选填，留空不显示）<input name="issuer" maxlength="80" placeholder="例如：万业携生行政部" value="${esc(n?.issuer||'')}"></label><label>发布时间（北京时间）<input name="publishedAt" type="datetime-local" step="1" required value="${publicationInput(n)}"></label><label><span><input name="pinned" type="checkbox" ${n?.pinned?'checked':''}>置顶</span></label><button class="small-action">${n?'保存修改':'发布公告'}</button>`;
 const fields=f=>`<label>编号<input name="code" required maxlength="30" value="${esc(f?.code||'')}"></label><label>名称<input name="title" required maxlength="100" value="${esc(f?.title||'')}"></label><label>所属部门<input name="department" maxlength="80" value="${esc(f?.department||'')}"></label><label>收容状态<input name="status" maxlength="40" value="${esc(f?.status||'观察中')}"></label><label>卷宗正文<textarea name="summary" required maxlength="12000" rows="6">${esc(f?.summary||'')}</textarea></label><div class="dossier-image-editor"><label>卷宗图片（选填）<input type="file" name="dossierImage" accept="image/png,image/jpeg,image/webp"></label><small>PNG、JPG、WEBP，最大 1.5 MB；仅供管理端查看。</small><img data-dossier-preview src="${esc(f?.imageUrl||'')}" alt="卷宗图片预览" loading="lazy" ${f?.imageUrl?'':'hidden'}><button class="small-action" type="button" data-dossier-image-remove>移除图片</button><span data-dossier-image-status role="status"></span></div><button class="small-action">${f?'保存修改':'登记卷宗'}</button>`;
 $('#panel').innerHTML=`<h3>公告与收容卷宗</h3><section class="admin-section" data-content-section="announcements"><h4>公告</h4><details><summary>发布新公告</summary><form class="community-form" data-content-form="announcements">${noticeFields()}</form></details><div id="admin-notice-list"></div><button id="admin-notice-more" class="small-action" type="button">继续加载</button></section><section class="admin-section" data-content-section="dossiers"><h4>收容卷宗</h4><details><summary>登记新收容物</summary><form class="community-form" data-content-form="dossiers">${fields()}</form></details>${files.items.map(f=>`<article class="admin-post"><h4>${esc(f.code)} ${esc(f.title)}</h4><details><summary>编辑卷宗</summary><form class="community-form" data-content-form="dossiers" data-id="${f.id}">${fields(f)}</form></details><button class="small-action danger" data-content-delete="dossiers/${f.id}">删除卷宗</button></article>`).join('')}</section>`;
 for(const item of document.querySelectorAll('[data-content-section]')){if(item.dataset.contentSection!==section)item.remove();else item.querySelector('h4')?.remove();}
 bindContentForms(()=>renderContentAdmin(section));
 if(section==='announcements'){
  const list=$('#admin-notice-list'),more=$('#admin-notice-more');let next=news.next,busy=false;
  function append(items){
   for(const n of items){
    const article=document.createElement('article');article.className='admin-post';
    article.innerHTML=`<h4>${n.pinned?'置顶 · ':''}${esc(n.title)}</h4><small>${AVEDTime.markup(n.createdAt)}</small><p class="announcement-body admin-notice-excerpt">${esc(n.excerpt)}</p><details data-notice-editor><summary>查看与编辑</summary><div data-notice-content></div></details><button class="small-action danger" data-content-delete="announcements/${n.id}">删除公告</button>`;
    list.append(article);const details=article.querySelector('[data-notice-editor]'),content=article.querySelector('[data-notice-content]');let loaded=false,loading=false;
    details.addEventListener('toggle',async()=>{
     if(!details.open||loaded||loading)return;loading=true;content.textContent='正在读取公告…';
     try{const {item}=await api('/api/admin/announcements/'+n.id);if(!article.isConnected)return;
      content.innerHTML=`<form class="community-form" data-content-form="announcements" data-id="${n.id}">${noticeFields(item)}</form><details data-notice-comments><summary>公告评论</summary><div data-comment-list></div><button class="small-action" type="button" data-comment-more>继续加载评论</button></details>`;
      bindContentForms(()=>renderContentAdmin(section));loaded=true;
      const comments=content.querySelector('[data-notice-comments]'),box=content.querySelector('[data-comment-list]'),button=content.querySelector('[data-comment-more]');let cursor=0,fetching=false,started=false;
      async function readComments(){if(fetching||cursor===null)return;fetching=true;button.disabled=true;
       try{const page=await api('/api/admin/announcements/'+n.id+'/comments?offset='+cursor);if(!article.isConnected)return;
        for(const c of page.items){const row=document.createElement('article');row.className='admin-post';row.innerHTML=`<b>${esc(c.displayName||'离职员工')}</b><p class="announcement-body">${esc(c.body)}</p><form class="community-form"><label>发布日期与时间（北京时间）<input name="createdAt" type="datetime-local" step="1" required value="${publicationInput(c)}"></label><button class="small-action">保存评论时间</button><span role="status"></span></form>`;
         const form=row.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const save=form.querySelector('button'),status=form.querySelector('[role=status]');save.disabled=true;status.textContent='';try{await api('/api/admin/posts/'+c.id,{method:'PUT',body:JSON.stringify({createdAt:form.elements.createdAt.value})});status.textContent='已保存';}catch(error){status.textContent=error.message;}finally{save.disabled=false;}};box.append(row);
        }
        cursor=page.next;button.hidden=cursor===null;started=true;if(!box.children.length)box.textContent='暂无评论。';
       }catch(error){window.AVEDFeedback.alert(error.message);}finally{fetching=false;button.disabled=false;}
      }
      comments.addEventListener('toggle',()=>{if(comments.open&&!started)readComments();});button.onclick=readComments;
     }catch(error){content.textContent=error.message+'；收起后重新展开可重试。';}finally{loading=false;}
    });
   }
   bindContentForms(()=>renderContentAdmin(section));
  }
  append(news.items);if(!news.items.length)list.textContent='暂无公告。';more.hidden=next===null;
  more.onclick=async()=>{if(busy||next===null)return;busy=true;more.disabled=true;try{const page=await api('/api/admin/announcements?offset='+next);if(!list.isConnected)return;append(page.items);next=page.next;more.hidden=next===null;}catch(error){window.AVEDFeedback.alert(error.message);}finally{busy=false;more.disabled=false;}};
 }
}

function bindDossierImageEditors(){
 document.querySelectorAll('[data-content-form="dossiers"]').forEach(form=>{
  if(form.dataset.imageBound)return;form.dataset.imageBound='true';
  const input=form.elements.dossierImage,preview=form.querySelector('[data-dossier-preview]'),status=form.querySelector('[data-dossier-image-status]');let revision=0;
  if(!input)return;
  input.onchange=()=>{
   const token=++revision,file=input.files[0];if(!file)return;
   if(file.size>1500000||!['image/png','image/jpeg','image/webp'].includes(file.type)){input.value='';status.textContent='请选择 1.5 MB 以内的 PNG、JPG 或 WEBP 图片。';return;}
   const reader=new FileReader();reader.onload=()=>{if(token!==revision||!form.isConnected)return;preview.src=reader.result;preview.hidden=false;form.dataset.removeImage='false';status.textContent='保存卷宗后更新图片。';};reader.onerror=()=>{status.textContent='图片读取失败。';};reader.readAsDataURL(file);
  };
  form.querySelector('[data-dossier-image-remove]').onclick=()=>{revision++;input.value='';preview.removeAttribute('src');preview.hidden=true;form.dataset.removeImage='true';status.textContent='保存卷宗后移除图片。';};
 });
}
function bindContentForms(render){
 bindDossierImageEditors();
 document.querySelectorAll('[data-content-form]').forEach(form=>form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('button[type=submit],button:not([type])');button.disabled=true;
  try{const data=Object.fromEntries(new FormData(form));if(form.dataset.contentForm==='announcements')data.pinned=!!data.pinned;
   if(form.dataset.contentForm==='dossiers'){
    delete data.dossierImage;
    const file=form.elements.dossierImage?.files[0];
    if(file){if(file.size>1500000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 1.5 MB 以内的 PNG、JPG 或 WEBP 图片。');data.imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败。'));reader.readAsDataURL(file);});}
    else if(form.dataset.removeImage==='true')data.imageData='';
   }await api('/api/admin/'+form.dataset.contentForm+(form.dataset.id?'/'+form.dataset.id:''),{method:form.dataset.id?'PUT':'POST',body:JSON.stringify(data)});await render();}catch(err){window.AVEDFeedback.alert(err.message);button.disabled=false;}
 });
 document.querySelectorAll('[data-content-delete]').forEach(b=>b.onclick=async()=>{if(!await window.AVEDFeedback.confirm('确认删除这项内容？前台将同步移除。'))return;b.disabled=true;try{await api('/api/admin/'+b.dataset.contentDelete,{method:'DELETE'});await render();}catch(e){window.AVEDFeedback.alert(e.message);b.disabled=false;}});
}

async function renderTerminology(){
 const {items}=await api('/api/admin/terminology');
 const fields=x=>`<label>原词<input name="pattern" required maxlength="80" value="${esc(x?.pattern||'')}"></label><label>替换为<input name="replacement" maxlength="160" value="${esc(x?.replacement||'')}"></label>${x?.isRegex?'<p>此项为旧版表达式规则，保存时保留原有匹配方式。</p>':''}<label><span><input name="enabled" type="checkbox" ${!x||x.enabled?'checked':''}>启用</span></label><button class="small-action">保存词条</button>`;
 $('#panel').innerHTML='<h3>公司用语规范</h3><p>直接填写要替换的原词和替换后的文字，无需表达式或特殊语法。</p><details class="admin-section" open><summary>登记词条</summary><form class="community-form terminology-form">'+fields()+'</form></details>'+items.map(x=>`<details class="admin-post" data-keep-original><summary>${esc(x.pattern)} → ${esc(x.replacement)} ${x.enabled?'启用':'停用'}</summary><form class="community-form terminology-form" data-id="${x.id}" data-legacy-regex="${x.isRegex?'true':'false'}">${fields(x)}</form><button class="small-action danger" data-rule-remove="${x.id}">移除词条</button></details>`).join('');
 document.querySelectorAll('.terminology-form').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),b=form.querySelector('button');b.disabled=true;try{await api('/api/admin/terminology'+(form.dataset.id?'/'+form.dataset.id:''),{method:form.dataset.id?'PUT':'POST',body:JSON.stringify({pattern:f.get('pattern'),replacement:f.get('replacement'),isRegex:form.dataset.legacyRegex==='true',enabled:f.has('enabled')})});window.AVEDTerminology?.refreshRules();await renderTerminology();}catch(e){window.AVEDFeedback.alert(e.message);b.disabled=false;}});
 document.querySelectorAll('[data-rule-remove]').forEach(b=>b.onclick=async()=>{if(!await window.AVEDFeedback.confirm('确认移除这条用语规范？'))return;await api('/api/admin/terminology/'+b.dataset.ruleRemove,{method:'DELETE'});window.AVEDTerminology?.refreshRules();await renderTerminology();});
}

async function renderForumWorkshopAdmin(){
 $('#panel').innerHTML='<div class="section-heading"><h3>论坛演绎</h3><p>角色代发 / 对话编排</p></div><div id="admin-forum-workshop"></div>';
 const target=$('#admin-forum-workshop'),mount=await AVEDLoadForumWorkshop();if(!target.isConnected)return;
 await mount({container:target,api:(path,options={})=>api(path,{...options,...(options.body?{body:JSON.stringify(options.body)}:{})})});
}
