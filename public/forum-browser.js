window.AVEDForumBrowser=function({api,getUser,onData,onError}){
 const form=document.getElementById('new-forum-topic-form'),list=document.getElementById('forum-threads-list-container');
 const bar=document.createElement('div');bar.className='forum-browse-tools';bar.innerHTML='<form class="forum-search"><input type="search" maxlength="100" aria-label="搜索帖子" placeholder="搜索标题或正文"><button type="submit" class="community-button">搜索</button></form><div class="forum-browse-actions"><label>分类 <select aria-label="帖子分类"><option value="0">全部分类</option></select></label><label>排序 <select aria-label="帖子排序"><option value="activity">最新回复</option><option value="newest">最新发帖</option></select></label><button type="button" class="community-button" data-compose aria-expanded="false" aria-controls="new-forum-topic-form">发帖</button></div>';
 form.before(bar);form.hidden=true;
 const input=bar.querySelector('input'),category=bar.querySelector('[aria-label=帖子分类]'),sort=bar.querySelector('[aria-label=帖子排序]'),categoryInput=document.getElementById('new-topic-category'),compose=bar.querySelector('[data-compose]');
 let state={page:1,pages:1,q:'',sort:'activity',categoryId:0,total:0},request=0,busy=false,touched=false,hasData=false,seedBusy=false,failedPatch=null;
 const pagers=[window.AVEDForumPager({label:'帖子顶部翻页',onPage:p=>load({page:p},true)}),window.AVEDForumPager({label:'帖子底部翻页',onPage:p=>load({page:p},true)})];list.before(pagers[0].el);list.after(pagers[1].el);
 const status=document.createElement('p');status.className='forum-load-status';status.setAttribute('role','status');list.before(status);
 const retry=document.createElement('button');retry.type='button';retry.className='community-button forum-load-retry';retry.textContent='重新加载帖子';retry.hidden=true;retry.onclick=()=>load(failedPatch||{});status.after(retry);
 const loading=window.AVEDForumSkeleton?.({target:list,placeholder:document.getElementById('forum-skeleton-container')});
 function updateCategories(items){
  if(!Array.isArray(items))return;
  const option=(value,text)=>{const el=document.createElement('option');el.value=String(value);el.textContent=text;return el;};
  const selected=form.hidden?'':categoryInput.value;
  category.replaceChildren(option(0,'全部分类'),...items.map(c=>option(c.id,c.name)));category.value=String(state.categoryId);
  categoryInput.replaceChildren(...items.map(c=>option(c.id,c.name)));
  categoryInput.value=items.some(c=>String(c.id)===selected)?selected:String(state.categoryId||items[0]?.id||'');categoryInput.disabled=!items.length;
 }
 function paint(){for(const p of pagers){p.el.hidden=state.pages<=1;p.render(state,busy);}sort.disabled=busy;category.disabled=busy;bar.querySelector('[type=submit]').disabled=busy;list.setAttribute('aria-busy',String(busy));}
 function closeComposer(){form.hidden=true;compose.textContent='发帖';compose.setAttribute('aria-expanded','false');}
 compose.onclick=()=>{form.hidden=!form.hidden;compose.textContent=form.hidden?'发帖':'收起编辑';compose.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)document.getElementById('new-topic-title').focus();};
 bar.querySelector('form').onsubmit=e=>{e.preventDefault();load({page:1,q:input.value.trim()},true);};sort.onchange=()=>load({page:1,sort:sort.value},true);category.onchange=()=>load({page:1,categoryId:Number(category.value)},true);
 async function load(patch={},scroll=false){
  const owner=getUser()?.id;if(!owner)return;touched=true;seedBusy=false;const wanted={...state,...patch},token=++request;busy=true;retry.hidden=true;status.textContent=hasData&&!Object.keys(patch).length?'正在刷新帖子…':'正在加载帖子…';loading?.start({replace:!hasData||Object.keys(patch).length>0});paint();
  try{const d=await api('/api/player/forum?'+new URLSearchParams({page:wanted.page,sort:wanted.sort,q:wanted.q,category:wanted.categoryId||''}));if(token!==request||getUser()?.id!==owner)return;state={...state,...d};hasData=true;updateCategories(d.categories);sort.value=state.sort;onData(d);status.textContent=d.total?'共 '+d.total+' 个主题':wanted.q?'没有找到符合条件的帖子':'暂无帖子。';if(scroll)bar.scrollIntoView({block:'start',behavior:'instant'});}
  catch(error){if(token===request&&getUser()?.id===owner){failedPatch=patch;status.textContent='帖子加载失败。';retry.hidden=false;sort.value=state.sort;category.value=String(state.categoryId);onError(error.message);}}
  finally{if(token===request){busy=false;loading?.end();paint();}}
 }
 return {load,closeComposer,published:categoryId=>{categoryInput.value=String(categoryId);return load({page:1,categoryId:state.categoryId?categoryId:0});},hasData:()=>hasData,
  beginSeed(){if(touched||busy)return;seedBusy=true;busy=true;status.textContent='正在加载帖子…';loading?.start();paint();},
  endSeed(error){if(!seedBusy)return;seedBusy=false;busy=false;loading?.end();if(error){status.textContent='帖子加载失败。';retry.hidden=false;}paint();},
  seed(d){if(touched)return;state={...state,...d};hasData=true;updateCategories(d.categories);sort.value=state.sort;onData(d);status.textContent=d.total?'共 '+d.total+' 个主题':'暂无帖子。';this.endSeed();paint();},
  reset(){request++;busy=false;touched=false;seedBusy=false;hasData=false;loading?.end();retry.hidden=true;state={page:1,pages:1,q:'',sort:'activity',categoryId:0,total:0};input.value='';sort.value='activity';updateCategories([]);status.textContent='';closeComposer();paint();}};
};
