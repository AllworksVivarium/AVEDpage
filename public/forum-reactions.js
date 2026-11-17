/* Pixel reactions share no reacting account names, avatars or identity references. */
window.AVEDForumReactions=function({api,esc,getUser,getThread,onBalance,showToast}){
 const art={
  question:['？','<path fill="#e7cf86" d="M5 2h6v2h2v4h-2v2H9v2H6V9h2V7h2V5H6v2H3V4h2zm1 11h3v3H6z"/>'],
  heart:['喜欢','<path fill="#d67b82" d="M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2z"/><path fill="#f3bbb4" d="M3 5h2v2H3z"/>'],
  eyes:['围观','<path fill="#dfdac4" d="M1 4h5v2h2V4h5v2h2v7h-2v2H8v-2H6v2H1v-2H0V6h1z"/><path fill="#514e54" d="M4 7h2v5H4zm7 0h2v5h-2z"/>'],
  applause:['鼓掌','<path fill="#d8b78f" d="M2 7h2V3h2v5h2V2h2v7h2V5h2v7h-2v3H4v-2H2z"/><path fill="#eedda5" d="M0 1h2v3H0zm12-1h2v3h-2zm2 3h2v2h-2z"/><path fill="#af8b72" d="M5 9h5v2H5z"/>'],
  cup:['敬一杯','<path fill="#c2c9bd" d="M2 2h9v2h4v7h-4v4H2zm9 4v3h2V6z"/><path fill="#dab76b" d="M4 5h5v7H4z"/><path fill="#f2e3bd" d="M4 3h5v2H4z"/>'],
  flower:['送花','<path fill="#a2b282" d="M7 7h2v9H7zm2 4h4v2H9zm-6-1h4v2H3z"/><path fill="#cc8c9d" d="M6 0h4v3h3v4h-3v3H6V7H3V3h3z"/><path fill="#efd18a" d="M6 3h4v4H6z"/>'],
  spark:['闪闪发光','<g class="reaction-pulse"><path fill="#efd189" d="M7 1h2v4h2v2h4v2h-4v2H9v4H7v-4H5V9H1V7h4V5h2z"/><path fill="#fff0c3" d="M7 6h2v4H7z"/></g><path fill="#c3a3bf" d="M1 1h2v2H1zm12 12h2v2h-2z"/>'],
  fire:['热烈回应','<g class="reaction-flame"><path fill="#cd7161" d="M7 0h2v3h2v3h2V4h2v4h1v5h-2v2H3v-2H1V8h2V5h2v3h2z"/><path fill="#eab86b" d="M7 7h2v3h3v4H5v-4h2z"/><path fill="#f7df9a" d="M7 11h2v3H7z"/></g>'],
  signal:['异常共鸣','<g class="reaction-echo"><path fill="#c9777c" d="M5 2h6v2h3v2h2v5h-2v2h-3v2H5v-2H2v-2H0V6h2V4h3zm0 4H3v5h2v2h6v-2h2V6h-2V4H5z"/><path fill="#d8cda3" d="M7 5h2v2h2v3H9v2H7v-2H5V7h2z"/></g>']
 };
 const icon=id=>`<svg class="forum-reaction-icon" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">${art[id]?.[1]||art.question[1]}</svg>`;
 const view=document.getElementById('view-forum'),dialog=document.createElement('dialog');dialog.className='community-dialog forum-reaction-dialog';dialog.setAttribute('aria-label','留下反应');dialog.innerHTML='<header><h2>留下反应</h2><button type="button" aria-label="关闭反应选择">×</button></header><div class="forum-reaction-options"></div><form class="forum-reaction-confirm"><p data-reaction-description></p><small>每种反应限一次。</small><button type="submit" disabled>选择反应</button><p role="alert" data-reaction-error></p></form>';view.append(dialog);
 let catalog=null,target=null,selected=null,busy=false,owner=null,version=0;
 const states=new Map(),key=(kind,id)=>kind+':'+id;
 const markup=(kind,id,items=[])=>{states.set(key(kind,id),items);return `<div class="forum-reactions" data-reactions-kind="${kind}" data-reactions-id="${id}" aria-label="发言反应">${items.filter(x=>art[x.id]).map(x=>`<button type="button" class="forum-reaction-chip ${x.mine?'is-mine':''}" data-reaction="${x.id}" title="${esc(art[x.id][0])} · ${x.count} 人${x.mine?' · 已留下':''}" aria-label="${esc(art[x.id][0])}，${x.count} 人${x.mine?'，你已留下':''}">${icon(x.id)}<span>${x.count}</span></button>`).join('')}<button type="button" class="forum-reaction-add" aria-label="给这条发言留下反应" title="留下反应">＋</button></div>`;};
 function paint(){
  const mine=states.get(key(target.kind,target.id))||[];
  dialog.querySelector('.forum-reaction-options').innerHTML=(catalog||[]).map(x=>{const given=mine.some(m=>m.id===x.id&&m.mine);return `<button type="button" data-pick-reaction="${x.id}" aria-pressed="${selected?.id===x.id}" ${given||busy?'disabled':''}>${icon(x.id)}<b>${esc(x.name)}</b><small>${given?'已留下':x.price.toLocaleString()+' A 币'}</small>${x.animated?'<i>动态</i>':''}</button>`;}).join('');
  const submit=dialog.querySelector('[type=submit]');submit.disabled=busy||!selected;submit.textContent=busy?'正在留下…':selected?'花费 '+selected.price.toLocaleString()+' A 币':'选择反应';
  dialog.querySelector('[data-reaction-description]').textContent=selected?'已选「'+selected.name+'」':'';
 }
 async function open(kind,id,choice){
  if(busy||!getUser())return;const visit=++version;owner=getUser().id;target={kind,id};selected=null;dialog.querySelector('[data-reaction-error]').textContent='';dialog.querySelector('.forum-reaction-options').textContent='正在读取反应…';dialog.querySelector('[type=submit]').disabled=true;
  if(!dialog.open)dialog.showModal();
  try{if(!catalog)catalog=(await api('/api/player/forum/reactions')).items;if(visit!==version||getUser()?.id!==owner)return;const existing=states.get(key(kind,id))||[];selected=catalog.find(x=>x.id===choice&&!existing.some(m=>m.id===x.id&&m.mine))||null;paint();}catch(error){dialog.querySelector('[data-reaction-error]').textContent=error.message;}
 }
 dialog.querySelector('header button').onclick=()=>{if(!busy){version++;dialog.close();}};
 dialog.addEventListener('cancel',event=>{event.stopPropagation();if(busy)event.preventDefault();else version++;});
 dialog.addEventListener('click',event=>{const b=event.target.closest('[data-pick-reaction]');if(b&&!b.disabled&&!busy){selected=catalog.find(x=>x.id===b.dataset.pickReaction);paint();}});
 view.addEventListener('click',event=>{
  const row=event.target.closest('[data-reactions-kind]');if(row){const b=event.target.closest('button');if(b)open(row.dataset.reactionsKind,Number(row.dataset.reactionsId),b.dataset.reaction);return;}
  if(event.target.closest('button,a,input,textarea,select,dialog,img')||window.getSelection()?.toString())return;
  const reply=event.target.closest('.forum-reply-entry'),topic=event.target.closest('#forum-detail-main-post');if(reply)open('reply',Number(reply.dataset.replyId));else if(topic&&getThread())open('thread',getThread().id);
 });
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();if(busy||!selected||getUser()?.id!==owner)return;busy=true;paint();const chosen={...target},reaction=selected.id;dialog.querySelector('[data-reaction-error]').textContent='';
  try{const result=await api('/api/player/forum/reactions',{method:'POST',body:{kind:chosen.kind,targetId:chosen.id,reaction,confirmed:true}});if(getUser()?.id!==owner)return;
   view.querySelector(`[data-reactions-kind="${chosen.kind}"][data-reactions-id="${chosen.id}"]`)?.replaceWith(document.createRange().createContextualFragment(markup(chosen.kind,chosen.id,result.reactions)));
   onBalance(result.balance);dialog.close();showToast(result.charged?'反应已留下。':'你已经留下过这个反应。');
  }catch(error){dialog.querySelector('[data-reaction-error]').textContent=error.message;}finally{busy=false;if(dialog.open)paint();}
 };
 return {markup};
};
