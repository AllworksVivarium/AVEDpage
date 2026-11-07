window.AVEDJackpotTiming=function(textWidth,viewportWidth){const distance=Math.max(0,textWidth-viewportWidth+8);return {distance:distance>1?distance:0,durationMs:Math.max(5000,Math.min(8000,Math.ceil(distance/110*1000)+1600))};};
window.AVEDCreateJackpotTicker=function({api,enabled=()=>true}){
 const anchor=document.querySelector('.company-play-ticker');if(!anchor)return;
 const strip=document.createElement('div');strip.className='aved-jackpot-strip';strip.hidden=false;strip.setAttribute('aria-label','好彩时刻');
 const title=document.createElement('strong');title.textContent='好彩时刻';
 const viewport=document.createElement('div');viewport.className='aved-jackpot-viewport';
 const row=document.createElement('div');row.className='aved-jackpot-row';const text=document.createElement('span');text.className='aved-jackpot-text';row.append(text);viewport.append(row);strip.append(title,viewport);anchor.after(strip);
 const notice='暂无好彩消息';
 text.textContent=notice;strip.dataset.outcome='notice';
 const names={scratch:'刮刮乐',slot:'异常回路',sky:'高空速降',derby:'下班竞速',cards:'智斗太姥'};
 let items=[],pending=[],cursor=0,busy=false,shownUntil=0,offset=0,lastFetch=-Infinity,loopIndex=0,geometry='';
 const timestamp=x=>Date.parse(x.createdAt.includes('T')?x.createdAt:x.createdAt.replace(' ','T')+'Z');
 function fit(restart=false){
  if(viewport.clientWidth<=0)return;
  const key=text.textContent+':'+text.scrollWidth+':'+viewport.clientWidth;if(!restart&&key===geometry)return;geometry=key;
  const timing=window.AVEDJackpotTiming(text.scrollWidth,viewport.clientWidth);
  text.classList.remove('is-overflowing');viewport.scrollLeft=0;
  text.style.setProperty('--ticker-end',-timing.distance+'px');text.style.setProperty('--ticker-duration',timing.durationMs+'ms');
  void text.offsetWidth;text.classList.toggle('is-overflowing',timing.distance>0);
  shownUntil=strip.dataset.outcome==='notice'?0:Date.now()+offset+timing.durationMs;
 }
 function paint(){
  const now=Date.now()+offset;fit();if(now<shownUntil)return;
  items=items.filter(x=>now-timestamp(x)<1800000);pending=pending.filter(x=>items.some(item=>item.ticketId===x.ticketId));
  let item=pending.shift();
  if(item)loopIndex=items.findIndex(x=>x.ticketId===item.ticketId)+1;
  else if(items.length){item=items[loopIndex%items.length];loopIndex=(loopIndex+1)%items.length;}
  if(!items.length&&strip.dataset.outcome==='notice'){fit();return;}
  if(text.textContent){const outgoing=document.createElement('div');outgoing.className='aved-jackpot-outgoing';outgoing.dataset.outcome=strip.dataset.outcome;const copy=document.createElement('span');copy.textContent=text.textContent;copy.style.transform='translateX('+(text.style.getPropertyValue('--ticker-end')||'0px')+')';outgoing.append(copy);viewport.append(outgoing);setTimeout(()=>outgoing.remove(),350);}
  strip.hidden=false;
  if(item){
   const bomb=item.penalty>0;
   strip.dataset.outcome=bomb?'bomb':'award';
   text.textContent=`${item.alias} · ${names[item.game]||'游戏'} · ${bomb?'−':'+'}¤ ${Number(bomb?item.penalty:item.prize).toLocaleString()}`;
  }else{strip.dataset.outcome='notice';text.textContent=notice;}
  text.title=text.textContent;row.classList.remove('aved-jackpot-message');text.classList.remove('is-overflowing');viewport.scrollLeft=0;void row.offsetWidth;fit(true);row.classList.add('aved-jackpot-message');
 }
 async function refresh(){
  if(busy||document.hidden||!enabled()||Date.now()-lastFetch<29000)return;
  busy=true;lastFetch=Date.now();
  try{const data=await api('/api/player/game-highlights?after='+cursor);offset=(data.serverTime||Date.now())-Date.now();const merged=new Map(items.map(x=>[x.ticketId,x]));
   for(const x of data.items){if(!merged.has(x.ticketId))pending.push(x);merged.set(x.ticketId,x);cursor=Math.max(cursor,x.ticketId);}
   items=[...merged.values()];paint();
  }catch{}finally{busy=false;}
 }
 setInterval(refresh,30000);setInterval(()=>{if(!document.hidden&&enabled())paint();},250);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){fit(true);refresh();}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-nav="casino"]'))setTimeout(refresh,0);});
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>fit());observer.observe(viewport);observer.observe(text);}
 const casino=document.querySelector('#view-casino');if(casino&&typeof MutationObserver!=='undefined')new MutationObserver(()=>{if(enabled())refresh();}).observe(casino,{attributes:true,attributeFilter:['class']});
 document.fonts?.ready?.then(()=>fit());
 fit();refresh();return {refresh};
};
