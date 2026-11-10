(function(){
 let workshopLoad;
 window.AVEDLoadForumWorkshop=()=>workshopLoad||(workshopLoad=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/forum-workshop.js?v=company-robots-2';script.onload=()=>resolve(window.AVEDForumWorkshop);script.onerror=()=>{script.remove();workshopLoad=null;reject(Error('演绎编排暂时无法加载，请重试。'));};document.head.append(script);}));
 window.AVEDForumSocial=function({api,esc,getUser,getThread,openThread,getReply,getContext,showToast,refreshForum,getReplyRevision=()=>0,onRepliesChanged=()=>{},onStockRisk=()=>{}}){
  const view=document.getElementById('view-forum'),tools=view.querySelector('.forum-action-toolbar'),nav=document.querySelector('[data-nav="forum"]');
  const inboxButton=document.createElement('button');inboxButton.type='button';inboxButton.className='community-button forum-inbox-button';inboxButton.textContent='回复提醒';tools.prepend(inboxButton);
  const toolbarBack=document.createElement('button');toolbarBack.type='button';toolbarBack.id='forum-toolbar-back';toolbarBack.className='community-button';toolbarBack.textContent='← 返回';toolbarBack.setAttribute('aria-label','返回帖子列表');toolbarBack.hidden=true;toolbarBack.onclick=()=>document.getElementById('forum-global-back')?.click();inboxButton.after(toolbarBack);
  const dot=document.createElement('span');dot.className='forum-unread-dot';dot.hidden=true;dot.setAttribute('aria-hidden','true');nav.append(dot);
  const dialog=document.createElement('dialog');dialog.className='community-dialog forum-social-dialog';dialog.innerHTML='<header><h2>回复提醒</h2><button type="button" aria-label="关闭回复提醒">×</button></header><div class="forum-inbox-list"></div>';view.append(dialog);dialog.querySelector('header button').onclick=()=>dialog.close();
  let inbox={unread:0,items:[]},busy=false,lastPoll=0,uid=null,capability=false,people=[],personaBusy=false,replyTarget=null;
  let syncTimer=null,queuedSync=false;
  const presence=window.AVEDForumPresence?.({view,onChange:changed=>{clearTimeout(syncTimer);syncTimer=setTimeout(()=>{if(changed){if(busy)queuedSync=true;else poll(true);}else poll();},changed?250:500);}});
  const readPositions=new Map(),forms=['new-forum-topic-form','forum-detail-reply-form'].map(id=>document.getElementById(id));
  const quote=document.createElement('div');quote.className='forum-compose-quote';quote.hidden=true;forms[1].prepend(quote);
  function cancelReply(){replyTarget=null;quote.hidden=true;quote.replaceChildren();}
  function replyTo(item){if(!item)return;replyTarget=item;quote.innerHTML=`<div>回复 <b>${esc(item.anonymousName)} · ${item.floor} 楼</b><button type="button" aria-label="取消指定回复">×</button></div><p>${esc(item.body.slice(0,120))}</p>`;quote.hidden=false;quote.querySelector('button').onclick=cancelReply;const input=document.getElementById('forum-detail-reply-text');input.focus({preventScroll:true});quote.scrollIntoView({block:'nearest',behavior:'smooth'});}
  view.addEventListener('click',async e=>{
   const b=e.target.closest('[data-forum-reply]');if(b)replyTo(getReply(Number(b.dataset.forumReply)));
   const q=e.target.closest('[data-forum-quote]');if(!q||q.disabled)return;
   const existing=q.nextElementSibling?.classList.contains('forum-quote-context')?q.nextElementSibling:null;
   if(existing){existing.hidden=!existing.hidden;q.setAttribute('aria-expanded',String(!existing.hidden));return;}
   q.disabled=true;try{const item=await getContext(Number(q.dataset.forumQuote));if(!item||!q.isConnected)return;const box=document.createElement('div');box.className='forum-quote-context';box.innerHTML=`<b>${esc(item.anonymousName)} · ${item.floor} 楼</b><p>${esc(item.body)}</p><button type="button" class="forum-reply-action" data-forum-reply="${item.id}">回复此楼</button>`;q.after(box);q.setAttribute('aria-expanded','true');}catch(error){showToast(error.message,'warn');}finally{q.disabled=false;}
  });
  async function reveal(id){if(!view.querySelector(`[data-reply-id="${id}"]`))await getReply(id,true);const target=view.querySelector(`[data-reply-id="${id}"]`);if(target){target.scrollIntoView({block:'center',behavior:'smooth'});target.classList.remove('forum-reply-highlight');requestAnimationFrame(()=>target.classList.add('forum-reply-highlight'));}}
  function paintInbox(){const count=inbox.unread;inboxButton.textContent=count?'回复提醒 ('+(count>99?'99+':count)+')':'回复提醒';inboxButton.dataset.unread=String(count>0);dot.hidden=!count;nav.setAttribute('aria-label',count?'匿名论坛，'+count+' 条新回复':'匿名论坛');dialog.querySelector('.forum-inbox-list').innerHTML=inbox.items.map(n=>`<button type="button" data-notice-thread="${n.threadId}" data-notice-reply="${n.replyId}"><strong>${esc(n.authorName||'新回复')} · ${n.kind==='reply'?'回复了你的评论':'回复了你的主题'}</strong><span>${esc(n.excerpt||n.title)}</span><small>${esc(n.title)} · ${n.floor||''} 楼 →</small></button>`).join('')||'<p>暂时没有新回复。</p>';}
  async function poll(force=false){const user=getUser();if(uid!==(user?.id??null)){uid=user?.id??null;inbox={unread:0,items:[]};people=[];capability=false;lastPoll=0;readPositions.clear();presence?.reset();onStockRisk(null);cancelReply();paintInbox();renderPeople();if(!user){dialog.close();workshopDialog?.close();}}if(!user||document.hidden&&!force||busy||!force&&Date.now()-lastPoll<30000)return;busy=true;const id=user.id;lastPoll=Date.now();try{
   const threadId=!document.hidden&&!view.classList.contains('hidden')?getThread()?.id||0:0;
   const body=presence?{...presence.request(),threadId,revision:getReplyRevision()}:null;
   const d=await api('/api/player/forum/notifications',body?{method:'POST',body}:undefined);if(getUser()?.id!==id)return;
   inbox=d;paintInbox();presence?.receive(d.presence);onStockRisk(d.stockRisk);
   if(d.repliesChanged&&String(d.threadId)===String(getThread()?.id)&&!document.hidden&&!view.classList.contains('hidden'))await onRepliesChanged();
  }catch(e){if(force&&!document.hidden)showToast(e.message,'warn');}finally{busy=false;if(getUser()?.id!==id)poll();else if(queuedSync){queuedSync=false;poll(true);}}}
  inboxButton.onclick=()=>{paintInbox();dialog.showModal();poll(true);};
  dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-notice-thread]');if(!b||b.disabled)return;b.disabled=true;try{await openThread(Number(b.dataset.noticeThread),Number(b.dataset.noticeReply));dialog.close();await reveal(Number(b.dataset.noticeReply));}catch(e){showToast(e.message,'warn');b.disabled=false;}});
  function renderPeople(){for(const form of forms){let row=form.querySelector('.forum-persona-row');if(!capability){row?.remove();continue;}if(!row){row=document.createElement('div');row.className='forum-persona-row';row.innerHTML='<label>发言身份 <select name="personaId" aria-label="演绎发言身份"></select></label><button type="button" class="community-button" data-workshop-open>演绎编排</button>';form.querySelector('.forum-compose-footer').before(row);row.querySelector('select').onchange=()=>{const real=form.querySelector('[data-forum-real]');real.disabled=!!row.querySelector('select').value;};row.querySelector('button').onclick=workshop;}const select=row.querySelector('select'),old=select.value;select.innerHTML='<option value="">本人</option>'+people.map(p=>`<option value="${p.id}">${esc(p.name)} · ¤ ${Number(p.balance).toLocaleString()}</option>`).join('');select.value=people.some(p=>String(p.id)===old)?old:'';form.querySelector('[data-forum-real]').disabled=!!select.value;}}
  async function loadPeople(){const owner=getUser()?.id;if(!owner||personaBusy)return;personaBusy=true;try{const d=await api('/api/player/forum/personas');if(getUser()?.id!==owner)return;people=d.items;capability=d.canManage;renderPeople();}catch(e){if(getUser()?.id===owner){delete forms[0].dataset.personasLoaded;showToast(e.message,'warn');}}finally{personaBusy=false;if(getUser()?.id!==owner)loadPeople();}}
  let workshopDialog;
  async function workshop(){try{if(!workshopDialog){workshopDialog=document.createElement('dialog');workshopDialog.className='community-dialog forum-social-dialog forum-workshop-dialog';workshopDialog.innerHTML='<header><h2>论坛演绎</h2><button type="button" aria-label="关闭演绎编排">×</button></header><div data-workshop-content></div>';view.append(workshopDialog);workshopDialog.querySelector('header button').onclick=()=>workshopDialog.close();}workshopDialog.showModal();const mount=await window.AVEDLoadForumWorkshop();await mount({container:workshopDialog.querySelector('[data-workshop-content]'),api,threadId:getThread()?.id,threadTitle:getThread()?.title,onChange:loadPeople,onPublished:async result=>{await refreshForum();await openThread(result.threadId);loadPeople();}});}catch(e){showToast(e.message,'warn');}}
  let readBusy=false,readTimer=null,readWanted=null;
  async function flushRead(){
   if(readBusy||!readWanted)return;const wanted=readWanted;readWanted=null;
   if(getUser()?.id!==wanted.owner)return;readBusy=true;
   try{await api('/api/player/forum/'+wanted.thread+'/read',{method:'POST',body:{replyIds:[...wanted.ids]}});if(getUser()?.id===wanted.owner){for(const id of wanted.ids)readPositions.set(wanted.thread+':'+id,true);await poll(true);}}
   catch{}finally{readBusy=false;if(readWanted)flushRead();}
  }
  function seenReplies(thread,ids){
   const owner=getUser()?.id;if(!owner||!thread||document.hidden||view.classList.contains('hidden'))return;
   const unseen=ids.filter(id=>!readPositions.has(thread+':'+id));if(!unseen.length)return;
   if(!readWanted||readWanted.thread!==thread||readWanted.owner!==owner)readWanted={thread,owner,ids:new Set()};
   for(const id of unseen)if(readWanted.ids.size<20)readWanted.ids.add(id);
   clearTimeout(readTimer);readTimer=setTimeout(flushRead,250);
  }
  let oldThread=null;
  const observer=new MutationObserver(()=>{const user=getUser();poll();if(!user)return;if(!view.classList.contains('hidden')){if(!forms[0].dataset.personasLoaded||forms[0].dataset.personasLoaded!==String(user.id)){forms[0].dataset.personasLoaded=String(user.id);loadPeople();}const thread=getThread()?.id||null;if(thread!==oldThread){oldThread=thread;cancelReply();}}});observer.observe(document.getElementById('inner-app-view'),{attributes:true,attributeFilter:['class']});observer.observe(view,{attributes:true,attributeFilter:['class']});
  if(!presence)document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});setInterval(()=>poll(),30000);
  return {seenReplies,cancelReply,compose(form){return {personaId:form.elements.personaId?.value?Number(form.elements.personaId.value):null,replyToId:form===forms[1]?replyTarget?.id||null:null};},afterPublish(form,personaId){cancelReply();if(form.elements.personaId){form.elements.personaId.value=personaId||'';form.elements.personaId.dispatchEvent(new Event('change'));}poll(true);},reveal};
 };
})();
