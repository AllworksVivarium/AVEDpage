const activityActionName=action=>({GET:'查阅',POST:'提交',PUT:'修订',DELETE:'删除',insert:'登记',update:'修订',delete:'删除',login:'接入终端',logout:'退出终端',view:'查阅',admin_password_reset:'重置凭证','stock.buy':'证券买入','stock.sell':'证券卖出','cards.start':'开启牌局','cards.play':'出牌','cards.pass':'让牌','cards.bid':'叫牌'})[action]||'登记异动';
const activityTargetName=target=>{
  const labels={employees:'员工名册',profiles:'个人档案',balance_ledger:'账户流水',checkins:'签到记录',game_tickets:'娱乐室票据',forum_threads:'匿名主题',forum_replies:'匿名回复',posts:'通告留言',dossiers:'收容卷宗',announcements:'公司通告',dossier_comments:'卷宗评议',chat_messages:'无线电通讯',stock_holdings:'证券持仓',news:'公司新闻通告',departments:'部门与员工名录',containment:'收容物卷宗',forum:'匿名论坛',casino:'员工娱乐室',profile:'个人档案',server_console:'监察控制台',activity:'监察记录',moderation:'图文核验',music:'广播曲目'};
  if(target?.startsWith('/api/admin/'))return labels[target.split('/')[3]]||'监察记录';
  return labels[target]||target||'员工终端';
};
async function renderModeration(){
  const {items}=await api('/api/admin/moderation');
  $('#panel').innerHTML='<div class="section-heading"><h3>图文审核</h3><p>待核通讯</p></div>'+items.map(x=>`<article class="notice-box"><h4>${esc(x.title)}</h4><small>${esc(x.displayName)} / ${esc(x.username)} · ${AVEDTime.markup(x.createdAt)}</small><p class="announcement-body">${esc(x.body)}</p><img class="moderation-image" src="${esc(x.imageData)}" alt="待审核图片"><div class="music-controls"><button data-review="approve" data-kind="${x.kind}" data-id="${x.id}">批准整条内容</button><button data-review="reject" data-kind="${x.kind}" data-id="${x.id}">拒绝</button></div></article>`).join('')+(items.length?'':'<p>没有待审核内容。</p>');
  document.querySelectorAll('[data-review]').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm(button.dataset.review==='approve'?'确认批准这条图文并公开显示？':'确认拒绝这条图文？'))return;
    button.disabled=true;try{await api(`/api/admin/moderation/${button.dataset.kind}/${button.dataset.id}`,{method:'POST',body:JSON.stringify({action:button.dataset.review})});await renderModeration();}catch(e){alert(e.message);button.disabled=false;}
  }));
}
async function renderActivity(before){
  const {items}=await api('/api/admin/activity'+(before?'?before='+before:''));
  const html=items.map(x=>`<article class="admin-post"><b>#${x.id} · ${esc(activityActionName(x.action))} · ${esc(activityTargetName(x.target))}</b><small>${esc(x.username||'系统/历史记录')} · 员工 #${x.employee_id??'—'} · ${AVEDTime.markup(x.created_at)}</small><details><summary>查看当时记录</summary><pre class="audit-detail">${esc(JSON.stringify(AVEDTime.sanitize(JSON.parse(x.details)),null,2))}</pre></details></article>`).join('');
  if(!before)$('#panel').innerHTML='<h3>活动记录</h3><p>监察记录 · 员工、通讯与账户异动</p><div id="activity-list"></div>';
  $('#activityMore')?.remove();$('#activity-list').insertAdjacentHTML('beforeend',html||'<p>没有更多记录。</p>');
  if(items.length===100){$('#panel').insertAdjacentHTML('beforeend','<button id="activityMore" class="small-action">加载更早记录</button>');$('#activityMore').onclick=()=>renderActivity(items.at(-1).id).catch(e=>alert(e.message));}
}
async function renderContentAdmin(){
  const [news,files,music]=await Promise.all([api('/api/announcements'),api('/api/dossiers'),api('/api/admin/music')]);
  $('#panel').innerHTML=`<h3>公告、档案与音乐</h3>
    <section class="admin-section"><h4>发布公告</h4><form id="cloud-notice-form" class="admin-form"><input name="title" required maxlength="150" placeholder="标题"><textarea name="body" required maxlength="5000" placeholder="正文"></textarea><label><input name="pinned" type="checkbox">置顶</label><button class="small-action">发布</button></form>${news.items.map(n=>`<article class="admin-post"><b>${esc(n.title)}</b><p class="announcement-body">${esc(n.body)}</p><button data-content-delete="announcements/${n.id}">删除公告</button></article>`).join('')}</section>
    <section class="admin-section"><h4>登记收容物</h4><form id="cloud-dossier-form" class="admin-form"><input name="code" required placeholder="档案编号"><input name="title" required placeholder="名称"><input name="department" placeholder="部门"><input name="status" placeholder="状态"><textarea name="summary" required maxlength="2000" placeholder="档案内容"></textarea><button class="small-action">登记</button></form>${files.items.map(f=>`<article class="admin-post"><b>${esc(f.code)} · ${esc(f.title)}</b><p>${esc(f.summary)}</p><button data-content-delete="dossiers/${f.id}">删除档案</button></article>`).join('')}</section>
    <section class="admin-section"><h4>音乐盒曲目</h4><form id="cloud-track-form" class="admin-form"><input name="title" required placeholder="曲目名称"><input name="url" type="url" required placeholder="广播音频地址（HTTPS）"><select name="kind"><option>lofi</option><option>白噪音</option></select><button class="small-action">添加</button></form>${music.items.map(m=>`<p>${esc(m.title)} <button data-content-delete="music/${m.id}">删除曲目</button></p>`).join('')}</section>`;
  for(const [form,path] of [['cloud-notice-form','announcements'],['cloud-dossier-form','dossiers'],['cloud-track-form','music']]){
    document.getElementById(form).onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const data=Object.fromEntries(new FormData(e.target));if(path==='announcements')data.pinned=!!data.pinned;await api('/api/admin/'+path,{method:'POST',body:JSON.stringify(data)});await renderContentAdmin();}catch(err){alert(err.message);button.disabled=false;}};
  }
  document.querySelectorAll('[data-content-delete]').forEach(button=>button.onclick=async()=>{if(!confirm('确认删除这项内容？相关页面将同步移除。'))return;try{await api('/api/admin/'+button.dataset.contentDelete,{method:'DELETE'});await renderContentAdmin();}catch(e){alert(e.message);}});
}
