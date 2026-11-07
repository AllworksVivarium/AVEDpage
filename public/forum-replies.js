window.AVEDForumReplies=function({api,container,count,renderItem,onThread,enabled,onError}){
 const more=document.createElement('button');more.type='button';more.className='community-button forum-replies-more';more.textContent='继续加载回复';more.hidden=true;container.after(more);
 let state=null;
 function merge(s,items,allowNew){
  for(const item of items){const old=s.nodes.get(item.id);if(!old&&!allowNew)continue;
   const html=renderItem(item);if(old?.html===html)continue;
   const el=document.createElement('article');el.className='inner-card-alt p-4 space-y-2';el.dataset.replyId=item.id;el.innerHTML=html;
   if(old)old.el.replaceWith(el);else{const next=[...s.nodes].sort((a,b)=>a[0]-b[0]).find(([id])=>id>item.id);if(next)next[1].el.before(el);else container.append(el);}
   s.nodes.set(item.id,{el,html});
  }
 }
 function sync(s,total){count.textContent='全部回复 ('+total+')';more.hidden=s.next===null;more.disabled=s.busy;container.querySelector('[data-empty-replies]')?.remove();if(!s.nodes.size){const empty=document.createElement('p');empty.dataset.emptyReplies='';empty.textContent='暂无回复。';container.append(empty);}}
 async function request(mode){
  const s=state;if(!s||s.busy||!enabled())return;s.busy=true;more.disabled=true;
  const initial=!s.loaded,q=initial?'':mode==='more'?'?after='+s.next:'?since='+s.cursor;
  try{const d=await api('/api/player/forum/'+s.id+q);if(state!==s||!enabled())return;
   onThread(d.thread);
   if(initial||mode==='more'){merge(s,d.items,true);s.next=d.next;s.loaded=true;if(initial)s.cursor=d.changesCursor;}
   else{for(const id of d.removed||[]){s.nodes.get(id)?.el.remove();s.nodes.delete(id);}merge(s,d.items,s.next===null);s.cursor=d.changesCursor;}
   s.total=d.thread.replyCount;sync(s,s.total);
  }catch(error){if(state===s&&enabled())onError(error.message);}
  finally{s.busy=false;if(state===s){more.disabled=false;if(!s.loaded){more.hidden=false;more.textContent='重新加载回复';}else more.textContent='继续加载回复';}}
 }
 more.onclick=()=>request('more');
 return {open(id){if(state?.id!==String(id)){state={id:String(id),nodes:new Map(),next:null,cursor:0,loaded:false,busy:false,total:0};container.replaceChildren();count.textContent='正在加载回复…';more.hidden=true;}return request('refresh');},refresh(){return request('refresh');},async reveal(id){const s=state;if(!s||!enabled())return;const d=await api('/api/player/forum/'+s.id+'?after='+(Number(id)-1));if(state!==s||!enabled())return;merge(s,d.items.filter(item=>item.id===Number(id)),true);onThread(d.thread);sync(s,d.thread.replyCount);},reset(){state=null;more.hidden=true;container.replaceChildren();}};
};
