/* Pixel reactions share no reacting account names, avatars or identity references. */
window.AVEDForumReactions=function({api,esc,getUser,getThread,onBalance,showToast}){
 const {art,icon}=window.AVEDForumReactionArt;
 const view=document.getElementById('view-forum'),dialog=document.createElement('dialog');dialog.className='community-dialog forum-reaction-dialog';dialog.setAttribute('aria-label','留下反应');dialog.innerHTML='<header><h2>留下反应</h2><button type="button" aria-label="关闭反应选择">×</button></header><div class="forum-reaction-options"></div><form class="forum-reaction-confirm"><p data-reaction-description></p><small>每种反应限一次。</small><button type="submit" disabled>选择反应</button><p role="alert" data-reaction-error></p></form>';view.append(dialog);
 const topic=view.querySelector('#forum-detail-main-post');topic.tabIndex=0;topic.setAttribute('aria-haspopup','dialog');
 let catalog=null,target=null,selected=null,busy=false,owner=null,version=0;
 const states=new Map(),key=(kind,id)=>kind+':'+id;
 const markup=(kind,id,items=[])=>{states.set(key(kind,id),items);return `<div class="forum-reactions" data-reactions-kind="${kind}" data-reactions-id="${id}" aria-label="发言反应">${items.filter(x=>art[x.id]).map(x=>`<button type="button" class="forum-reaction-chip ${x.mine?'is-mine':''}" data-reaction="${x.id}" aria-label="${esc(art[x.id][0])}，${x.count} 人${x.mine?'，你已留下':''}">${icon(x.id)}<span>${x.count}</span></button>`).join('')}</div>`;};
 function paint(){
  const mine=states.get(key(target.kind,target.id))||[];
  dialog.querySelector('.forum-reaction-options').innerHTML=(catalog||[]).map(x=>{const given=mine.some(m=>m.id===x.id&&m.mine);return `<button type="button" data-pick-reaction="${x.id}" aria-label="${esc(x.name)}" aria-pressed="${selected?.id===x.id}" ${given||busy?'disabled':''}><span class="forum-reaction-artwork ${x.id==='fan'?'has-label':''}">${icon(x.id)}${x.id==='fan'?'<b class="forum-fan-label">我扇<span class="forum-fan-punctuation" aria-hidden="true">！</span></b>':''}</span><small>${given?'已留下':x.price.toLocaleString()+' ¤'}</small></button>`;}).join('');
  const submit=dialog.querySelector('[type=submit]');submit.disabled=busy||!selected;submit.textContent=busy?'正在留下…':selected?'花费 '+selected.price.toLocaleString()+' ¤':'选择反应';
  dialog.querySelector('[data-reaction-description]').textContent='';
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
 view.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const post=event.target.closest('.forum-reply-entry,#forum-detail-main-post');if(!post||event.target!==post)return;
  event.preventDefault();if(post.dataset.replyId)open('reply',Number(post.dataset.replyId));else if(getThread())open('thread',getThread().id);
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
