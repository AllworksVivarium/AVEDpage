window.AVEDCreateJackpotTicker=function({api,enabled=()=>true}){
 const anchor=document.querySelector('.company-play-ticker');if(!anchor)return;
 const strip=document.createElement('div');strip.className='aved-jackpot-strip';strip.setAttribute('aria-label','近30分钟大奖');
 const title=document.createElement('strong');title.textContent='好彩时刻';const viewport=document.createElement('div');viewport.className='aved-jackpot-viewport';const text=document.createElement('span');viewport.append(text);strip.append(title,viewport);anchor.after(strip);
 const names={scratch:'刮刮乐',slot:'抑制矩阵',sky:'高空速降',derby:'赛马竞速',cards:'假人牌桌'};let items=[],cursor=0,lastKey='',busy=false,shownUntil=0,offset=0,lastFetch=0;const shown=new Map();
 const timestamp=x=>Date.parse(x.createdAt.includes('T')?x.createdAt:x.createdAt.replace(' ','T')+'Z');
 function paint(){
  const now=Date.now()+offset;if(now<shownUntil)return;
  items=items.filter(x=>now-timestamp(x)<1800000);for(const [key,time] of shown)if(now-time>1800000)shown.delete(key);
  const eligible=items.filter(x=>now-(shown.get(x.ticketId)||0)>=30000).sort((a,b)=>(shown.get(a.ticketId)||0)-(shown.get(b.ticketId)||0)||b.ticketId-a.ticketId);
  const item=eligible[0],key=item?.ticketId||'empty';shownUntil=now+10000;
  if(item)shown.set(item.ticketId,now);
  if(key===lastKey)return;lastKey=key;
  const multiplier=item?Number((item.prize/item.cost).toFixed(2)):0;
  text.textContent=item?`${item.alias} · ${names[item.game]||'游戏'} · 获得 ¤ ${Number(item.prize).toLocaleString()} · ${multiplier} 倍${multiplier>=50?'稀有超级大奖':multiplier>=10?'超级大奖':'大奖'}`:'近 30 分钟好彩轮播 · 5 倍及以上奖金在此留名';
  text.title=text.textContent;text.classList.remove('aved-jackpot-message');void text.offsetWidth;text.classList.add('aved-jackpot-message');
 }
 async function refresh(){if(busy||document.hidden||!enabled()||Date.now()-lastFetch<29000)return;busy=true;lastFetch=Date.now();try{const data=await api('/api/player/game-highlights?after='+cursor);offset=(data.serverTime||Date.now())-Date.now();const merged=new Map(items.map(x=>[x.ticketId,x]));for(const x of data.items){merged.set(x.ticketId,x);cursor=Math.max(cursor,x.ticketId);}items=[...merged.values()];if(lastKey==='empty')shownUntil=0;paint();}catch{}finally{busy=false;}}
 setInterval(refresh,30000);setInterval(()=>{if(!document.hidden&&enabled())paint();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});document.addEventListener('click',e=>{if(e.target.closest('[data-nav="casino"]'))setTimeout(refresh,0);});paint();refresh();

};
