window.AVEDSkyUI=function({api,esc,byId,getUser,onBalance,showToast}){
 const panel=byId('game-panel-skydive');
 panel.innerHTML=`<header class="flight-masthead"><div><span class="section-kicker">A.V.E.D. / AIRBORNE OPERATIONS</span><h2>直升机速降</h2></div><span id="flight-link" role="status">接入待命</span></header><div class="flight-layout"><section class="flight-console"><div class="flight-topline"><span id="skydive-flight-no-label">架次待命</span><span id="flight-phase">BOARDING</span></div><div class="flight-scene" id="flight-scene"><div class="flight-altimeter"><span>100</span><span>500</span><span>1000</span><span>1500</span><span>2000 M</span><i id="flight-depth-marker"></i></div><div class="flight-clouds"></div><div class="flight-heli" aria-label="公司运输直升机"><svg viewBox="0 0 320 130" aria-hidden="true"><path class="heli-rotor" d="M25 19H288"/><path d="M161 19V40M120 103L113 115H254M230 99L239 115"/><path class="heli-body" d="M105 42H206Q249 40 270 76L268 91Q240 105 128 100L89 77 30 69 20 45 93 60Z"/><path class="heli-glass" d="M213 47Q243 48 258 72H213Z"/><path d="M139 52V87H193V52ZM30 69V84H9"/><text x="151" y="75">AVED</text></svg><div id="skydive-airship-avatars" class="flight-cabin"></div></div><div class="flight-readout"><p id="skydive-center-subtitle">等待接通舱内信号</p><strong id="skydive-center-main-num">—</strong><span id="flight-multiplier">0.50 ×</span><p id="skydive-center-subinfo">100 米返还 0.5 倍 / 200 米回本</p></div><div id="skydive-parachutes-stage" class="flight-drops" aria-hidden="true"></div><div class="flight-ground"><span>LANDING ZONE / 安全线封存</span><b id="flight-result" role="status"></b></div></div><div class="flight-action"><span id="skydive-bottom-left-hint">您尚未登机</span><button id="skydive-open-chute-btn" type="button" disabled>拉绳开伞 ↗</button></div><details class="flight-proof"><summary>调阅本班封签</summary><p id="skydive-wax-hash"></p></details></section><aside class="flight-sidebar"><form id="flight-boarding-form" class="community-form"><div class="section-kicker">BOARDING PASS</div><h3>登机委托</h3><label>本班投入<input id="skydive-bet-input" type="number" min="100" max="1000000" step="100" value="10000"></label><div class="flight-chips"><button type="button" data-flight-chip="10000">1 万</button><button type="button" data-flight-chip="50000">5 万</button><button type="button" data-flight-chip="100000">10 万</button></div><button id="skydive-board-btn" type="button" class="community-button">登上本架次</button></form><section class="flight-manifest"><div class="section-kicker">PASSENGER MANIFEST</div><h3 id="skydive-passenger-stats">本班乘员</h3><div id="skydive-passengers-list"></div></section><section class="flight-radio"><h3>机舱无线电 <small>LIVE RADIO</small></h3><div id="skydive-chat-list"></div><form id="skydive-chat-form"><input id="skydive-chat-input" required maxlength="500" placeholder="接通无线电…" aria-label="无线电消息"><button type="submit">发送</button></form></section></aside></div><section class="flight-protocol"><b>速降规程</b><p>准备阶段登机，每位乘员独立选择开伞时机。返还倍率＝开伞深度 ÷ 200；返还金额包含本金。安全线每班独立封存，越线开伞或直至终点仍未开伞，将按本班规程扣除投入。断线期间架次照常运行。</p></section>`;
 let state=null,source=null,connected=false,receivedAt=0,lastSignature='',active=false,busy=false,lastPoll=0;
 const seen=new Set();
 const money=n=>'¤ '+Number(n).toLocaleString();
 function avatar(p){return p.avatar?`<img src="${esc(p.avatar)}" alt="${esc(p.alias)}" loading="lazy">`:`<span>${esc((p.alias||'员').slice(0,1))}</span>`;}
 function animate(p){const item=document.createElement('div');item.className='flight-drop '+(p.status==='crashed'?'flight-crash':'flight-land');item.style.left=(15+(p.id*31)%65)+'%';item.innerHTML=`<svg viewBox="0 0 60 80" aria-hidden="true"><path class="drop-canopy" d="M3 30A27 27 0 0 1 57 30ZM3 30L30 59 57 30M15 30L30 59 45 30"/><circle cx="30" cy="58" r="5"/><path d="M30 63V74M22 68L30 64 38 68M30 74L23 79M30 74L37 79"/></svg><span>${esc(p.alias)} · ${p.depth} m</span>`;byId('skydive-parachutes-stage').append(item);setTimeout(()=>item.remove(),3500);}
 function render(next){
  if(state&&next.round<state.round||state&&next.round===state.round&&next.serverTime<state.serverTime)return;
  const changed=state?.round!==next.round;if(changed){seen.clear();byId('skydive-parachutes-stage').replaceChildren();lastSignature='';}
  state=next;receivedAt=performance.now();onBalance(next.balance);
  byId('skydive-flight-no-label').textContent='架次 / '+String(next.round).padStart(5,'0');
  byId('flight-phase').textContent=next.phase==='BOARDING'?'BOARDING / 准备':next.phase==='DROPPING'?'DESCENT / 下降':'DEBRIEF / 结算';
  byId('skydive-wax-hash').textContent='SHA-256 / '+next.seedHash+(next.seed?' · 封签原文 / '+next.seed:'');
  const signature=JSON.stringify(next.passengers);if(signature!==lastSignature){
   byId('skydive-passenger-stats').textContent=`本班 ${next.passengers.length} 人 · 已开伞 ${next.passengers.filter(p=>p.status!=='aboard').length}`;
   byId('skydive-passengers-list').innerHTML=next.passengers.map(p=>`<article class="flight-passenger ${p.id===Number(getUser()?.id)?'is-self':''}"><div class="flight-avatar">${avatar(p)}</div><div><b>${esc(p.alias)}</b><small>${p.status==='aboard'?'已登机 · '+money(p.cost):p.status==='landed'?'已着陆 · '+p.depth+' m':'坠落 · '+p.depth+' m'}</small></div><strong class="${p.status==='crashed'?'loss':''}">${p.status==='aboard'?'待跳':money(p.prize-p.cost)}</strong></article>`).join('')||'<p>舱内尚无乘员。</p>';
   byId('skydive-airship-avatars').innerHTML=next.passengers.filter(p=>p.status==='aboard').slice(0,5).map(p=>`<div class="flight-avatar" title="${esc(p.alias)}">${avatar(p)}</div>`).join('');lastSignature=signature;
  }
  for(const p of next.passengers){const key=next.round+':'+p.id;if(p.status!=='aboard'&&!seen.has(key)){seen.add(key);if(!changed)animate(p);}}
  const self=next.self;byId('flight-scene').classList.toggle('flight-is-crashed',self?.status==='crashed');
  byId('flight-result').textContent=self&&self.status!=='aboard'?(self.status==='landed'?'着陆确认 / ':'坠落确认 / ')+money(self.prize-self.cost):'';
  byId('skydive-center-subinfo').textContent=next.phase==='SETTLED'?'本班安全线 / '+next.safetyLine+' 米':'100 米 ×0.50 / 200 米 ×1.00 / 安全线封存';
 }
 function paint(){if(active&&state){const elapsed=Math.min(2500,performance.now()-receivedAt),now=state.serverTime+elapsed,fresh=performance.now()-receivedAt<3000;
  const d=state.phase==='DROPPING'?Math.min(2000,100+Math.max(0,now-state.departAt)*state.speed/1000):state.depth;
  byId('skydive-center-main-num').textContent=state.phase==='BOARDING'?Math.max(0,(state.departAt-now)/1000).toFixed(1)+' s':Math.floor(d)+' m';
  byId('flight-multiplier').textContent=(d/200).toFixed(2)+' ×';byId('flight-depth-marker').style.top=(Math.min(1,(d-100)/1900)*86+5)+'%';
  byId('skydive-center-subtitle').textContent=state.phase==='BOARDING'?'舱门开启倒计时':state.phase==='SETTLED'?'本班封签已揭示':'下降深度 / DESCENT';
  byId('flight-scene').classList.toggle('is-descending',state.phase==='DROPPING');
  byId('skydive-board-btn').disabled=!fresh||state.phase!=='BOARDING'||!!state.self;
  byId('skydive-open-chute-btn').disabled=!fresh||state.phase!=='DROPPING'||state.self?.status!=='aboard'||!!byId('skydive-open-chute-btn').dataset.busy;
  byId('skydive-bottom-left-hint').textContent=!fresh?'舱内信号中断，正在重接':state.self?(state.self.status==='aboard'?'本班投入 '+money(state.self.cost):'本班已结算'):'您正在旁观本架次';
 }requestAnimationFrame(paint);}
 function visible(){return !!getUser()&&!document.hidden&&!byId('view-casino').classList.contains('hidden')&&!panel.classList.contains('hidden');}
 async function poll(){if(!visible()||busy)return;busy=true;lastPoll=performance.now();try{render(await api('/api/player/games/sky/current'));}catch(e){byId('flight-link').textContent='信号重接中';}finally{busy=false;}}
 function ensure(){active=visible();if(!active){source?.close();source=null;connected=false;return;}if(!source){source=new EventSource('/api/player/games/sky/stream');source.onopen=()=>{connected=true;byId('flight-link').textContent='● 舱内链路已接通';};source.onmessage=e=>{try{render(JSON.parse(e.data));}catch{}};source.onerror=()=>{connected=false;byId('flight-link').textContent='信号重接中';};}if(!connected&&performance.now()-lastPoll>3000)poll();}
 panel.querySelectorAll('[data-flight-chip]').forEach(b=>b.onclick=()=>byId('skydive-bet-input').value=b.dataset.flightChip);
 byId('flight-boarding-form').onsubmit=e=>{e.preventDefault();byId('skydive-board-btn').click();};
 setInterval(ensure,1000);document.addEventListener('visibilitychange',ensure);requestAnimationFrame(paint);
 return {render,poll,ensure,round:()=>state?.round};
};
