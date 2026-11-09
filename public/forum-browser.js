window.AVEDForumBrowser=function({api,getUser,onData,onError}){
 const form=document.getElementById('new-forum-topic-form'),list=document.getElementById('forum-threads-list-container');
 const bar=document.createElement('div');bar.className='forum-browse-tools';bar.innerHTML='<form class="forum-search"><input type="search" maxlength="100" aria-label="搜索帖子" placeholder="搜索标题或正文"><button type="submit" class="community-button">搜索</button></form><div class="forum-browse-actions"><label>排序 <select aria-label="帖子排序"><option value="newest">最新发帖</option><option value="activity">最后回复</option></select></label><button type="button" class="community-button" data-compose aria-expanded="false" aria-controls="new-forum-topic-form">发帖</button></div>';
 form.before(bar);form.hidden=true;
 const input=bar.querySelector('input'),sort=bar.querySelector('select'),compose=bar.querySelector('[data-compose]');
 let state={page:1,pages:1,q:'',sort:'newest',total:0},request=0,busy=false,touched=false;
 const pagers=[window.AVEDForumPager({label:'帖子顶部翻页',onPage:p=>load({page:p},true)}),window.AVEDForumPager({label:'帖子底部翻页',onPage:p=>load({page:p},true)})];list.before(pagers[0].el);list.after(pagers[1].el);
 const status=document.createElement('p');status.className='forum-load-status';status.setAttribute('role','status');list.before(status);
 function paint(){for(const p of pagers){p.el.hidden=state.pages<=1;p.render(state,busy);}sort.disabled=busy;bar.querySelector('[type=submit]').disabled=busy;list.setAttribute('aria-busy',String(busy));}
 function closeComposer(){form.hidden=true;compose.textContent='发帖';compose.setAttribute('aria-expanded','false');}
 compose.onclick=()=>{form.hidden=!form.hidden;compose.textContent=form.hidden?'发帖':'收起编辑';compose.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)document.getElementById('new-topic-title').focus();};
 bar.querySelector('form').onsubmit=e=>{e.preventDefault();load({page:1,q:input.value.trim()},true);};sort.onchange=()=>load({page:1,sort:sort.value},true);
 async function load(patch={},scroll=false){
  touched=true;const wanted={...state,...patch},token=++request,owner=getUser()?.id;if(!owner)return;busy=true;status.textContent='正在加载帖子…';paint();
  try{const d=await api('/api/player/forum?'+new URLSearchParams({page:wanted.page,sort:wanted.sort,q:wanted.q}));if(token!==request||getUser()?.id!==owner)return;state={...state,...d};onData(d);status.textContent=d.total?'共 '+d.total+' 个主题':'没有找到符合条件的帖子';if(scroll)bar.scrollIntoView({block:'start',behavior:'instant'});}
  catch(error){if(token===request){status.textContent='加载失败，请重新搜索或刷新。';sort.value=state.sort;onError(error.message);}}
  finally{if(token===request){busy=false;paint();}}
 }
 return {load,closeComposer,seed(d){if(busy||touched)return;state={...state,...d};onData(d);status.textContent=d.total?'共 '+d.total+' 个主题':'';paint();},reset(){request++;busy=false;touched=false;state={page:1,pages:1,q:'',sort:'newest',total:0};input.value='';sort.value='newest';status.textContent='';closeComposer();paint();}};
};
