window.AVEDBarInviteAlerts=function({play=()=>window.AVEDBarInviteSound?.(),canNotify=()=>true}={}){
 const seen=new Set();let owner=null,ready=false,guests=new Set();
 return {receive(data,{initial=false}={}){
  if(owner!==data.selfId){owner=data.selfId;seen.clear();ready=false;guests.clear();}
  const time=data.serverTime||Date.now(),keys=[...(data.cheersInvites||[]).filter(i=>i.recipientId===data.selfId&&i.expiresAt>time).map(i=>'cheers:'+i.id),...(data.hospitality?.gifts||[]).filter(i=>i.direction==='incoming'&&i.expiresAt>time).map(i=>'gift:'+i.id),...(data.storedDrinks?.items||[]).filter(i=>i.direction==='incoming'&&i.recipientMode!=='public'&&i.expiresAt>time).map(i=>'kept:'+i.id)];
  const present=new Set((data.guests||[]).map(g=>g.employeeId).filter(id=>id!==data.selfId));if(ready&&!initial&&[...present].some(id=>!guests.has(id))&&canNotify())window.AVEDBarDoorSound?.();guests=present;
  const fresh=keys.some(key=>!seen.has(key));for(const key of keys)seen.add(key);
  if(ready&&!initial&&fresh&&canNotify())play();ready=true;
 }};
};
window.AVEDBarNotifications=function({root,nav,api,getUser,isOpen}){
 const dot=document.createElement('span');dot.className='bar-unread-dot';dot.hidden=true;dot.setAttribute('aria-hidden','true');nav.append(dot);
 let owner=null,seen=new Set(),items=[],pending=false,lastPoll=0;
 const alerts=window.AVEDBarInviteAlerts({canNotify:isOpen});
 function user(){const id=getUser()?.id||null;if(id!==owner){owner=id;items=[];lastPoll=0;try{seen=new Set(JSON.parse(localStorage.getItem('aved_bar_kept_seen_'+id)||'[]'));}catch{seen=new Set();}dot.hidden=true;}return id;}
 function paint(){dot.hidden=!items.some(i=>!seen.has(i.id));}
 function receive(data,options){if(!user()||owner!==data.selfId)return;items=(data.storedDrinks?.items||[]).filter(i=>i.direction==='incoming'&&i.recipientMode!=='public'&&i.expiresAt>data.serverTime);paint();alerts.receive(data,options);}
 async function poll(){const id=user();if(!id||isOpen()||document.hidden||pending||Date.now()-lastPoll<15000)return;pending=true;lastPoll=Date.now();try{const data=await api('/api/player/bar/notifications');if(getUser()?.id===id){items=data.items;paint();}}catch{}finally{pending=false;}}
 root.addEventListener('aved-bar-kept-read',event=>{if(!user())return;for(const id of event.detail.ids)seen.add(id);try{localStorage.setItem('aved_bar_kept_seen_'+owner,JSON.stringify([...seen].slice(-500)));}catch{}paint();});
 for(const type of ['pointerdown','keydown'])root.addEventListener(type,()=>window.AVEDBarInviteSound?.(true),{capture:true});
 for(const type of ['visibilitychange','aved-session-change'])document.addEventListener(type,poll);
 for(const type of ['hashchange','pageshow'])window.addEventListener(type,poll);
 const app=document.getElementById('inner-app-view');if(app)new MutationObserver(poll).observe(app,{attributes:true,attributeFilter:['class']});
 setInterval(poll,30000);poll();return {receive};
};
