window.AVEDCreateJackpotTicker=function({api,enabled=()=>true}){
 const anchor=document.querySelector('.company-play-ticker');if(!anchor)return;
 const strip=document.createElement('div');strip.className='aved-jackpot-strip';strip.hidden=false;strip.setAttribute('aria-label','好彩时刻');
 const title=document.createElement('strong');title.textContent='好彩时刻';
 const viewport=document.createElement('div');viewport.className='aved-jackpot-viewport';
 const row=document.createElement('div');row.className='aved-jackpot-row';const text=document.createElement('span');text.className='aved-jackpot-text';row.append(text);viewport.append(row);strip.append(title,viewport);anchor.after(strip);
 const notice='近 30 分钟的大奖与炸弹消息，将在此轮播。';
 text.textContent=notice;strip.dataset.outcome='notice';
 const names={scratch:'刮刮乐',slot:'抑制矩阵',sky:'高空速降',derby:'赛马竞速',cards:'假人牌桌'};
 let items=[],pending=[],cursor=0,busy=false,shownUntil=0,offset=0,lastFetch=-Infinity,loopIndex=0;
 const timestamp=x=>Date.parse(x.createdAt.includes('T')?x.createdAt:x.createdAt.replace(' ','T')+'Z');
 const fit=()=>{const distance=Math.max(0,text.scrollWidth-viewport.clientWidth);text.style.setProperty('--ticker-start',-distance+'px');text.classList.toggle('is-overflowing',distance>1);};
 function paint(){
  const now=Date.now()+offset;if(now<shownUntil)return;
  items=items.filter(x=>now-timestamp(x)<1800000);pending=pending.filter(x=>items.some(item=>item.ticketId===x.ticketId));
  let item=pending.shift();
  if(item)loopIndex=items.findIndex(x=>x.ticketId===item.ticketId)+1;
  else{const cycle=[...items,null];item=cycle[loopIndex%cycle.length];loopIndex=(loopIndex+1)%cycle.length;}
  if(!items.length&&strip.dataset.outcome==='notice'){fit();return;}
  if(text.textContent){const outgoing=document.createElement('div');outgoing.className='aved-jackpot-outgoing';outgoing.dataset.outcome=strip.dataset.outcome;outgoing.textContent=text.textContent;viewport.append(outgoing);setTimeout(()=>outgoing.remove(),350);}
  strip.hidden=false;shownUntil=now+6000;
  if(item){
   const bomb=item.penalty>0,multiplier=Number((item.prize/item.cost).toFixed(2)),bombName=item.penalty>=item.cost*4?'超大炸弹':item.penalty>=item.cost*2?'大炸弹':'炸弹';
   strip.dataset.outcome=bomb?'bomb':'award';
   text.textContent=bomb?`${item.alias} · ${names[item.game]||'游戏'} · 刮出${bombName}了！本局扣除医疗费 ¤ ${Number(item.penalty).toLocaleString()}`:`${item.alias} · ${names[item.game]||'游戏'} · 获得 ¤ ${Number(item.prize).toLocaleString()} · ${multiplier} 倍${multiplier>=50?'稀有超级大奖':multiplier>=10?'超级大奖':'大奖'}`;
  }else{strip.dataset.outcome='notice';text.textContent=notice;}
  text.title=text.textContent;row.classList.remove('aved-jackpot-message');text.classList.remove('is-overflowing');void row.offsetWidth;fit();row.classList.add('aved-jackpot-message');
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
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 document.addEventListener('click',e=>{if(e.target.closest('[data-nav="casino"]'))setTimeout(refresh,0);});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(fit).observe(viewport);
 fit();refresh();return {refresh};
};
