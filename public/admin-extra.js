const activityActionName=action=>({GET:'查阅',POST:'提交',PUT:'修订',DELETE:'删除',insert:'发布 / 入账',update:'修订',delete:'删除',login:'接入终端',logout:'退出终端',view:'查阅',admin_password_reset:'重置凭证','stock.buy':'证券买入','stock.sell':'证券卖出','cards.start':'开启牌局','cards.play':'出牌','cards.pass':'让牌','cards.bid':'叫牌'})[action]||'登记异动';
const activityTargetName=target=>{
  const labels={employees:'员工名册',profiles:'个人档案',balance_ledger:'账户流水',checkins:'签到记录',game_tickets:'娱乐室票据',forum_threads:'匿名主题',forum_replies:'匿名回复',posts:'通告留言',dossiers:'收容卷宗',announcements:'公司通告',dossier_comments:'卷宗评议',chat_messages:'无线电通讯',stock_holdings:'证券持仓',news:'公司新闻通告',departments:'部门与员工名录',containment:'收容物卷宗',forum:'匿名论坛',casino:'员工娱乐室',profile:'个人档案',server_console:'监察控制台',activity:'监察记录',moderation:'图文核验',life_records:'生活记录'};
  if(target?.startsWith('/api/admin/'))return labels[target.split('/')[3]]||'监察记录';
  return labels[target]||target||'员工终端';
};
async function renderModeration(){
  const {items}=await api('/api/admin/moderation');
  $('#panel').innerHTML='<div class="section-heading"><h3>图文审核</h3><p>待核通讯</p></div>'+items.map(x=>`<article class="notice-box"><h4>${esc(x.title)}</h4><small>${esc(x.displayName)} / ${esc(x.username)} ${AVEDTime.markup(x.createdAt)}</small><p class="announcement-body">${esc(x.body)}</p><img class="moderation-image" src="${esc(x.imageData)}" alt="待审核图片"><div class="content-actions"><button data-review="approve" data-kind="${x.kind}" data-id="${x.id}">批准整条内容</button><button data-review="reject" data-kind="${x.kind}" data-id="${x.id}">拒绝</button></div></article>`).join('')+(items.length?'':'<p>没有待审核内容。</p>');
  document.querySelectorAll('[data-review]').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm(button.dataset.review==='approve'?'确认批准这条图文并公开显示？':'确认拒绝这条图文？'))return;
    button.disabled=true;try{await api(`/api/admin/moderation/${button.dataset.kind}/${button.dataset.id}`,{method:'POST',body:JSON.stringify({action:button.dataset.review})});await renderModeration();}catch(e){alert(e.message);button.disabled=false;}
  }));
}
async function renderActivity(before){
  const {items}=await api('/api/admin/activity'+(before?'?before='+before:''));
  const html=items.map(x=>`<article class="admin-post"><b>#${x.id} ${esc(activityActionName(x.action))} ${esc(activityTargetName(x.target))}</b><small>${esc(x.username||'系统/历史记录')} 员工 #${x.employee_id??'—'} ${AVEDTime.markup(x.created_at)}</small><details><summary>查看当时记录</summary><pre class="audit-detail">${esc(JSON.stringify(AVEDTime.sanitize(JSON.parse(x.details)),null,2))}</pre></details></article>`).join('');
  if(!before)$('#panel').innerHTML='<h3>活动记录</h3><p>监察记录 员工、通讯与账户异动</p><div id="activity-list"></div>';
  $('#activityMore')?.remove();$('#activity-list').insertAdjacentHTML('beforeend',html||'<p>没有更多记录。</p>');
  if(items.length===100){$('#panel').insertAdjacentHTML('beforeend','<button id="activityMore" class="small-action">加载更早记录</button>');$('#activityMore').onclick=()=>renderActivity(items.at(-1).id).catch(e=>alert(e.message));}
}
