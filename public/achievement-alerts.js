window.AVEDAchievementAlerts={create({getUser,api,onAward=()=>{}}){
 let source=null,owner='',queue=[],queued=new Set(),card=null,timer;const seen=new Set();
 const key=id=>'aved-achievement-alerts:'+id;
 function acknowledge(code,id){if(String(getUser()?.id)!==id)return;api('/api/player/achievement-alerts/read',{method:'POST',body:{codes:[code]},retries:0}).catch(()=>{});}
 function close(){clearTimeout(timer);card?.remove();card=null;}
 function show(){if(card||!queue.length||document.hidden||String(getUser()?.id)!==owner)return;const award=queue.shift();queued.delete(award.code);if(seen.has(award.code)){show();return;}
  seen.add(award.code);try{localStorage.setItem(key(owner),JSON.stringify([...seen].slice(-256)));}catch{}
  card=document.createElement('aside');card.className='achievement-alert';card.setAttribute('role','status');card.setAttribute('aria-live','polite');const header=document.createElement('header'),tag=document.createElement('span'),button=document.createElement('button'),title=document.createElement('strong'),body=document.createElement('p');tag.textContent='成就已解锁';button.type='button';button.textContent='×';button.setAttribute('aria-label','关闭成就提醒');title.textContent=award.title;body.textContent=award.description;header.append(tag,button);card.append(header,title,body);document.body.append(card);button.onclick=()=>{close();show();};timer=setTimeout(()=>{close();show();},6000);acknowledge(award.code,owner);onAward(award);
 }
 function ensure(){const id=String(getUser()?.id||'');if(owner!==id){source?.close();source=null;close();owner=id;queue=[];queued.clear();seen.clear();try{const saved=JSON.parse(localStorage.getItem(key(id))||'[]');if(Array.isArray(saved))saved.filter(c=>typeof c==='string').slice(-256).forEach(c=>seen.add(c));}catch{}}
  if(!id||document.hidden||document.getElementById('inner-app-view')?.classList.contains('hidden')){source?.close();source=null;return;}
  if(!source){const idAtOpen=id;source=new EventSource('/api/player/achievement-alerts/stream');source.onmessage=e=>{if(String(getUser()?.id)!==idAtOpen)return;try{for(const award of JSON.parse(e.data).items||[]){if(String(award.employeeId)!==idAtOpen||typeof award.code!=='string')continue;if(seen.has(award.code)){acknowledge(award.code,idAtOpen);continue;}if(!queued.has(award.code)&&queue.length<20){queued.add(award.code);queue.push(award);}}show();}catch{}};}
  show();
 }
 const root=document.getElementById('inner-app-view');if(root)new MutationObserver(ensure).observe(root,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close();ensure();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();show();}});
 return {ensure,close};
}};
