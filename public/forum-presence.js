/* Shared with the reply reminder poll: no per-avatar requests or connections. */
window.AVEDForumPresence=function({view,onChange}){
 const tab=crypto.randomUUID(),states=new Map();let requestedAuthors='';
 const labels={forum:'茶水间潜水中',cards:'正在打牌',sky:'正在直升机速降',derby:'正在看随便跑跑',stocks:'研究财务报表中',slot:'正在异常回路',scratch:'正在刮刮乐',profile:'整理员工档案中',news:'正在查阅通告',departments:'正在翻员工名录',containment:'正在查阅收容档案',life:'正在看生活记录',bar:'正在酒吧',home:'公司大厅摸鱼中'};
 function activity(){const parts=location.hash.replace(/^#\/?/,'').split('/'),page=parts[0];if(page==='casino')return ({doutailao:'cards',skydive:'sky',derby:'derby',stocks:'stocks',slots:'slot',scratch:'scratch'})[parts[1]]||'home';return Object.hasOwn(labels,page)?page:'home';}
 function authors(){return [...new Set([...view.querySelectorAll('[data-forum-presence]')].filter(el=>!el.closest('.hidden,[hidden]')).map(el=>el.dataset.forumPresence).filter(Boolean))].slice(0,64);}
 function paint(){const now=Date.now();for(const el of view.querySelectorAll('[data-forum-presence]')){
  const state=states.get(el.dataset.forumPresence),online=!!state&&state.until>now,label=online?labels[state.activity]||'公司内网在线':'';
  if(el.dataset.online!==String(online))el.dataset.online=String(online);
  const dot=el.querySelector('.forum-online-dot'),text=el.querySelector('.forum-author-activity');
  if(dot){dot.hidden=!online;dot.title=online?'在线':'';}
  if(text){text.hidden=!online;if(text.textContent!==label)text.textContent=label;}
 }}
 const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('[data-forum-presence]')||n.querySelector('[data-forum-presence]'))))){paint();if(!document.hidden&&authors().join(',')!==requestedAuthors)onChange(true);}});
 observer.observe(view,{childList:true,subtree:true});
 window.addEventListener('hashchange',()=>onChange(true));
 window.addEventListener('aved-bar-change',()=>onChange(true));
 document.addEventListener('visibilitychange',()=>onChange(true));
 return {request(){paint();const keys=document.hidden?[]:authors();requestedAuthors=keys.join(',');return {tab,activity:activity(),active:!document.hidden,authors:keys};},receive(data){
  if(!data)return;const now=Date.now();for(const item of data.items||[]){if(item.online)states.set(item.key,{activity:item.activity,until:now+Math.max(0,Math.min(75000,item.expiresIn||0))});else states.delete(item.key);}
  for(const [key,state] of states)if(state.until<=now)states.delete(key);paint();
 },reset(){states.clear();paint();}};
};
