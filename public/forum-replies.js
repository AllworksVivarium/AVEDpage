window.AVEDForumPager=function({label,onPage}){
 const el=document.createElement('nav');el.className='forum-pagination';el.setAttribute('aria-label',label);
 let page=1,pages=1;
 el.innerHTML='<button type="button" data-prev>上一页</button><label><select aria-label="'+label+'页码"></select><span data-page-count></span></label><button type="button" data-next>下一页</button>';
 const select=el.querySelector('select'),prev=el.querySelector('[data-prev]'),next=el.querySelector('[data-next]'),pageCount=el.querySelector('[data-page-count]');
 prev.onclick=()=>onPage(page-1);next.onclick=()=>onPage(page+1);select.onchange=()=>onPage(Number(select.value));
 return {el,render(data,busy=false){page=data.page||1;pages=data.pages||1;const options=Array.from({length:pages},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'</option>').join('');if(select.innerHTML!==options)select.innerHTML=options;select.value=String(page);pageCount.textContent=' / '+pages+' 页';prev.disabled=busy||page<=1;next.disabled=busy||page>=pages;select.disabled=busy||pages<=1;el.setAttribute('aria-busy',String(busy));}};
};
window.AVEDForumReplies=function({api,container,count,renderItem,onThread,onLoading=()=>{},enabled,onError}){
 let state=null,serial=0;
 const pagers=[window.AVEDForumPager({label:'回复顶部翻页',onPage:page=>request('page',page,true)}),window.AVEDForumPager({label:'回复底部翻页',onPage:page=>request('page',page,true)})];
 container.before(pagers[0].el);container.after(pagers[1].el);
 const status=document.createElement('p');status.className='forum-replies-status';status.setAttribute('role','status');container.before(status);
 const loading=window.AVEDForumSkeleton?.({target:container,kind:'reply'});
 function paint(s,data){
  const next=new Map();
  for(const item of data.items){const html=renderItem(item),old=s.nodes.get(item.id);let el=old?.html===html?old.el:document.createElement('article');if(el!==old?.el){el.className='forum-reply-entry';el.dataset.replyId=item.id;el.tabIndex=0;el.setAttribute('aria-haspopup','dialog');el.innerHTML=html;}next.set(item.id,{el,html,item});}
  s.nodes=next;container.replaceChildren(...[...next.values()].map(n=>n.el));
  if(!next.size){const empty=document.createElement('p');empty.textContent='暂无回复。';container.append(empty);}
 }
 function sync(s){count.textContent=s.loaded?'全部回复 ('+s.total+')':'全部回复';container.setAttribute('aria-busy',String(s.busy));for(const p of pagers){p.el.hidden=s.pages<=1;p.render(s,s.busy);}}
 async function request(mode='refresh',value,scroll=false){
  const s=state;if(!s||!enabled()||mode==='refresh'&&s.busy)return false;
  const token=++serial;s.busy=true;status.textContent='正在加载回复…';loading?.start({replace:!s.loaded||mode!=='refresh'});onLoading(true,s.loaded);sync(s);
  const query=new URLSearchParams(mode==='reveal'?{reply:value}:{page:mode==='page'?value:s.page});
  if(mode==='refresh'&&s.loaded)query.set('revision',s.cursor);
  try{const data=await api('/api/player/forum/'+s.id+'?'+query);if(state!==s||token!==serial||!enabled())return false;
   onThread(data.thread);if(data.page!==s.page)s.context.clear();Object.assign(s,{page:data.page,pages:data.pages,total:data.total,cursor:data.changesCursor,loaded:true});
   if(!data.notModified)paint(s,data);status.textContent='共 '+s.total+' 条回复';
   if(scroll)pagers[0].el.scrollIntoView({block:'start',behavior:'instant'});return true;
  }catch(error){if(state===s&&token===serial){status.textContent='回复加载失败。';onError(error.message);if(!s.loaded){container.replaceChildren();const retry=document.createElement('button');retry.type='button';retry.className='community-button forum-load-retry';retry.textContent='重新加载回复';retry.onclick=()=>request();container.append(retry);}}}
  finally{if(state===s&&token===serial){s.busy=false;loading?.end();onLoading(false,s.loaded);sync(s);}}
  return false;
 }
 return {
  get(id){return state?.nodes.get(Number(id))?.item||state?.context.get(Number(id));},
  open(id,replyId){if(state?.id!==String(id)){state={id:String(id),nodes:new Map(),context:new Map(),page:1,pages:1,total:0,cursor:0,loaded:false,busy:false};container.replaceChildren();}return replyId?request('reveal',replyId):state.loaded?Promise.resolve(true):request();},
  refresh(){return request();},
  revision(){return state?.cursor||0;},
  reveal(id){return request('reveal',id);},
  async context(id){const s=state;if(!s||!enabled())return;const known=s.nodes.get(Number(id))?.item||s.context.get(Number(id));if(known)return known;const data=await api('/api/player/forum/'+s.id+'?reply='+Number(id)+'&context=1');if(state!==s||!enabled())return;const item=data.items[0];s.context.set(item.id,item);return item;},
  reset(){serial++;state=null;loading?.end();onLoading(false,false);status.textContent='';for(const p of pagers)p.el.hidden=true;container.replaceChildren();}
 };
};
