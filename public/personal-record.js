(function(root){
 const games={scratch:'刮刮乐',slot:'异常回路',sky:'高空速降',derby:'下班竞速',cards:'智斗太姥'};
 function gate({getUser,storage,now=Date.now}){
  const users=new Map();
  return event=>{
   const id=String(getUser()?.id||'');
   if(!id||!event||String(event.employeeId)!==id||event.personalBest!==1||!games[event.game]||!Number.isSafeInteger(event.ticketId)||event.ticketId<=0||!Number.isSafeInteger(event.cost)||!Number.isSafeInteger(event.prize)||event.prize<=event.cost+(event.penalty||0))return false;
   const raw=String(event.createdAt||''),at=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(raw)?raw:raw.replace(' ','T')+'Z'),age=now()-at;
   if(!Number.isFinite(age)||age< -30000||age>300000)return false;
   const key='aved_personal_records_v1:'+id;
   if(!users.has(id))users.set(id,new Set());
   try{const saved=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(saved))for(const ticket of saved.filter(Number.isSafeInteger).slice(-128))users.get(id).add(ticket);}catch{}
   const seen=users.get(id);if(seen.has(event.ticketId))return false;seen.add(event.ticketId);while(seen.size>128)seen.delete(seen.values().next().value);
   try{storage.setItem(key,JSON.stringify([...seen]));}catch{}return true;
  };
 }
 function create({getUser,enabled,playSfx,onRecord=()=>{}}){
  let storage;try{storage=localStorage;}catch{storage={getItem(){},setItem(){}};}
  const accept=gate({getUser,storage}),reduced=matchMedia('(prefers-reduced-motion: reduce)');let card,timer;
  function close(){clearTimeout(timer);card?.remove();card=null;}
  function quiet(){if(document.hidden||!enabled()){close();return;}if(reduced.matches||root.AVEDEffectsEnabled?.()===false)card?.querySelectorAll('i').forEach(el=>el.remove());}
  function show(event){
   if(document.hidden||!enabled()||!accept(event))return false;close();onRecord();
   card=document.createElement('aside');card.className='personal-record-toast';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
   const label=document.createElement('strong');label.textContent='刷新本玩法个人纪录！';
   const amount=document.createElement('b');amount.textContent='¤ '+event.prize.toLocaleString();
   const game=document.createElement('span');game.textContent=games[event.game];
   const button=document.createElement('button');button.type='button';button.textContent='×';button.setAttribute('aria-label','关闭破纪录提示');button.onclick=close;card.append(label,amount,game,button);
   if(!reduced.matches&&root.AVEDEffectsEnabled?.()!==false){for(let i=0;i<24;i++){const p=document.createElement('i');p.setAttribute('aria-hidden','true');p.style.cssText='--x:'+((i%8)*14)+'%;--delay:'+(i%5)*90+'ms;--drift:'+((i%3-1)*45)+'px';card.append(p);}}
   document.body.append(card);playSfx?.('scratch-record');timer=setTimeout(close,5000);return true;
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});document.addEventListener('visibilitychange',quiet);document.addEventListener('aved-effects-change',quiet);reduced.addEventListener('change',quiet);
  const casino=document.getElementById('view-casino');if(casino)new MutationObserver(quiet).observe(casino,{attributes:true,attributeFilter:['class']});
  return {show,close};
 }
 root.AVEDPersonalRecords={gate,create};
})(globalThis);
