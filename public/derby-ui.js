/* Shared five-runner race. Clients animate snapshots; only the server accepts wagers. */
window.AVEDDerbyUI=function({api,byId,esc,getUser,onBalance,showToast,playSfx=()=>{}}){
 const panel=byId('game-panel-derby');panel.dataset.typeIgnore='';
 const messages=byId('derby-chat-messages'),chat=byId('derby-chat-form');
 panel.innerHTML=`<section class="animal-race">
 <div class="animal-race-layout"><div><section class="animal-stage"><div class="animal-topline"><span id="derby-round-label">等待场次</span><div class="race-topline-tools"><button type="button" id="race-supporter-toggle" aria-expanded="false" aria-controls="race-supporter-window">已下注</button><strong id="derby-clock">同步中</strong></div></div><div class="animal-track"><canvas id="animal-race-canvas" aria-label="三只猫、小猪与法斗法棍的共享五跑道比赛"></canvas></div><div id="animal-names" class="animal-names"></div><section id="race-supporter-window" class="race-supporter-board" role="region" aria-label="已下注" hidden><header><span>已下注</span><button type="button" id="race-supporter-close" aria-label="关闭已下注">×</button></header><div class="race-supporter-content"><p class="race-supporter-legend">1 头名 · 5 末名</p><div id="race-supporter-labels" class="race-supporter-labels"></div><div id="race-supporters" class="race-supporters"></div></div></section><p id="derby-commentary" class="animal-status" role="status">五名选手正在准备。</p></section></div>
 <aside><form id="shared-race-form" class="race-slip"><h3 id="derby-ticket-state">本场竞猜</h3><div class="race-market-tabs" role="group" aria-label="竞猜位次"><button type="button" data-market="first" aria-pressed="true">第一名</button><button type="button" data-market="last" aria-pressed="false">最后一名</button></div><div class="race-select"><fieldset id="shared-runner-options" class="animal-options" aria-label="选择选手"></fieldset></div><div class="race-stake"><label class="race-amount" for="shared-race-bet">本笔投入<input id="shared-race-bet" type="number" min="100" max="500000" step="1" value="1000" required inputmode="numeric"></label><div class="race-amounts"><button type="button" data-race-chip="1000">1,000</button><button type="button" data-race-chip="10000">10,000</button><button type="button" data-race-chip="50000">50,000</button></div><button type="submit" class="race-submit" disabled>同步中</button></div><div id="derby-self-result" class="race-tickets" role="status"></div><p class="race-rule-note" id="derby-return-rule">第一名、最后一名各可下一笔，每场合计最多 500,000，封盘后不可修改。每个选手每个位次的概率均为 20%；命中返还 6.25 倍（含本金），未命中返还 0。15 秒下注 · 25 秒比赛 · 6 秒领奖。</p></form></aside><section class="animal-radio"><h3>看台无线电 <small>LIVE RADIO</small></h3><div id="derby-radio-slot"></div></section></div></section>`;
 byId('derby-radio-slot').append(messages,chat);
 const root=panel.querySelector('.animal-race'),form=byId('shared-race-form'),scene=window.AVEDDerbyScene(byId('animal-race-canvas'),{onFinish:()=>{if(motion())playSfx('win');}});
 let supportersKey='',state=null,source=null,lastMessage=0,lastPoll=0,polling=false,submitting=false,market='first',clockOffset=null,bestRtt=Infinity,receivedAt=0,raf=0,lastFrame=0,celebratedAt=0,optionsKey='',uiKey='',ticketsKey='';
 const drafts={first:{runner:0,bet:1000},last:{runner:4,bet:1000}},text=new WeakMap();
 const setText=(el,value)=>{value=String(value);if(text.get(el)!==value){el.textContent=value;text.set(el,value);}};
 const money=n=>'¤ '+Number(n).toLocaleString(),marketName=m=>m==='first'?'第一名':'最后一名';
 const visible=()=>!!getUser()&&!document.hidden&&!byId('view-casino').classList.contains('hidden')&&!panel.classList.contains('hidden');
 const motion=()=>window.AVEDEffectsEnabled?.()!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const now=()=>state?Math.min(clockOffset==null?state.serverTime+performance.now()-receivedAt:performance.now()+clockOffset,state.serverTime+3000):0;
 function remember(){if(!state?.bets?.some(b=>b.market===market)){drafts[market]={runner:Number(form.elements.runner?.value||0),bet:byId('shared-race-bet').value};}}
 function chooseMarket(value){remember();market=value;uiKey='';updateControls();}
 function updateControls(){
  if(!state)return;const remaining=Math.max(0,500000-state.bets.reduce((n,b)=>n+b.cost,0));const selected=state.bets.find(b=>b.market===market),fresh=performance.now()-lastMessage<3500,locked=submitting||!fresh||state.phase!=='BETTING'||now()>=state.startAt||!!selected||remaining<100;
  const key=[state.round,market,locked,selected?.runner,selected?.cost,submitting,remaining].join(':');if(key===uiKey)return;uiKey=key;
  root.querySelectorAll('[data-market]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.market===market));b.disabled=submitting||state.version!==2&&b.dataset.market==='last';});
  form.querySelectorAll('input,[data-race-chip]').forEach(el=>el.disabled=locked);
  form.elements.runner.value=String(selected?.runner??drafts[market].runner);byId('shared-race-bet').max=String(selected?.cost??remaining);byId('shared-race-bet').value=selected?.cost??Math.min(Number(drafts[market].bet),remaining);
  const button=form.querySelector('[type=submit]');button.disabled=locked;
  setText(button,submitting?'确认中':!fresh?'等待同步':selected?'此项已下注':remaining<100?'本场额度已用完':state.phase!=='BETTING'||now()>=state.startAt?'本场已封盘':'下注 · '+marketName(market));
  setText(byId('derby-ticket-state'),state.bets.length?'本场已下 '+state.bets.length+' 笔':'本场竞猜');
 }
 function render(d){
  if(!getUser()||state&&(d.round<state.round||d.round===state.round&&d.serverTime<state.serverTime))return;
  const previous=state;remember();state=d;receivedAt=performance.now();lastMessage=receivedAt;
  const totalCost=d.bets.reduce((n,b)=>n+b.cost,0),totalPrize=d.bets.reduce((n,b)=>n+b.prize,0);
  if(previous?.round===d.round&&previous.phase!=='RESULT'&&d.phase==='RESULT'&&totalPrize>totalCost){celebratedAt=d.serverTime;playSfx('win');}
  if(previous?.round!==d.round){celebratedAt=0;uiKey='';}
  if(getUser().balance!==d.balance)onBalance(d.balance);
  setText(byId('derby-round-label'),'#'+String(d.round).padStart(5,'0')+' / '+d.entrants+' 人同场');
  const key=d.runners.map(r=>r.id+r.name+r.kind).join(':');
  if(key!==optionsKey){optionsKey=key;byId('race-supporter-labels').innerHTML=d.runners.map(r=>'<span>'+esc(r.name)+'</span>').join('');byId('animal-names').innerHTML=d.runners.map(r=>`<span><b>${r.id+1}</b>${esc(r.name)}</span>`).join('');byId('shared-runner-options').innerHTML=d.runners.map(r=>`<label><input type="radio" name="runner" value="${r.id}" ${r.id===0?'checked':''}><img src="${scene.thumbnail(r.kind||'orange')}" alt="" width="40" height="33"><span>${esc(r.name)}${r.kind==='frenchie'?'<small class="animal-code">AVED-007</small>':''}</span><small>${r.kind==='frenchie'?'法斗':r.kind==='pig'?'小猪':'猫'}</small></label>`).join('');uiKey='';}
  const audience=JSON.stringify(d.supporters||[]);if(audience!==supportersKey){
   supportersKey=audience;byId('race-supporters').innerHTML=d.runners.map(r=>{
    const supporters=(d.supporters||[]).filter(p=>p.runner===r.id),extra=supporters.length-3;
    return '<div class="race-supporter-faces" aria-label="'+esc(r.name+'支持者')+'">'+supporters.slice(0,3).map(p=>'<span class="race-supporter-avatar" role="img" aria-label="'+marketName(p.market)+'下注头像"><img src="'+esc(p.avatar||'/assets/avatar-pixel-slate.debac0c8de54.svg')+'" alt="" width="22" height="22" loading="lazy"><b aria-hidden="true">'+(p.market==='first'?'1':'5')+'</b></span>').join('')+(extra>0?'<span class="race-supporter-overflow" aria-label="另有 '+extra+' 笔下注">+'+extra+'</span>':'')+'</div>';
   }).join('');
  }
  const receipt=JSON.stringify(d.bets);if(receipt!==ticketsKey){ticketsKey=receipt;byId('derby-self-result').innerHTML=d.bets.map(b=>`<p>${marketName(b.market)} · ${esc(d.runners[b.runner].name)}<br>投入 ${money(b.cost)}${b.settled?' / 返还 '+money(b.prize):' / 已封存'}</p>`).join('')||'<p>可只选一项，也可两项都下注。</p>';}

  const status=byId('derby-commentary');status.classList.toggle('is-profit',d.phase==='RESULT'&&totalPrize>totalCost);
  setText(status,d.phase==='BETTING'?'纸箱就位，等大家下注。':d.phase==='RESULT'?(totalPrize>totalCost?'竞猜命中！返还 '+money(totalPrize)+' · ':'')+'第一名 '+d.runners[d.winner].name+(d.last!=null?' / 最后一名 '+d.runners[d.last].name:''):'已封盘 · 五名选手正在奔向下班大门');
  if(d.version!==2)setText(byId('derby-return-rule'),'旧场次正在结束，保持原票面规则；下一场开始五选手竞速。');
  else setText(byId('derby-return-rule'),'第一名、最后一名各可下一笔，每场合计最多 500,000，封盘后不可修改。每个选手每个位次概率均为 20%；命中返还 '+((d.returnPercent||125)/20).toFixed(2)+' 倍（含本金），未命中返还 0。15 秒下注 · 25 秒比赛 · 6 秒领奖。');
  if(visible()&&d.phase==='RESULT')window.AVEDPersonalRecord?.show(d.gameHighlight);
  updateControls();schedule();
 }
 function paint(){raf=0;if(!visible()||!state)return;const time=performance.now();if(time-lastFrame>=32){lastFrame=time;const at=now(),target=state.phase==='BETTING'?state.startAt:state.phase==='RACING'?state.finishAt:state.nextAt,seconds=Math.max(0,Math.ceil((target-at)/1000));setText(byId('derby-clock'),(state.phase==='BETTING'?'下注 ':state.phase==='RACING'?'比赛 ':'下场 ')+seconds+' s');scene.paint(state,at,motion(),celebratedAt);updateControls();}schedule();}
 function schedule(){if(visible()&&state&&!raf)raf=requestAnimationFrame(paint);}
 async function poll(){if(polling||!visible())return;polling=true;lastPoll=performance.now();try{const sent=performance.now(),d=await api('/api/player/games/derby/current'),arrived=performance.now(),rtt=arrived-sent;if(rtt<bestRtt*1.5+20){bestRtt=Math.min(bestRtt,rtt);clockOffset=d.serverTime+rtt/2-arrived;}render(d);}catch{}finally{polling=false;}}
 function setSupporters(open,restoreFocus=false){byId('race-supporter-window').hidden=!open;byId('race-supporter-toggle').setAttribute('aria-expanded',String(open));if(restoreFocus)byId('race-supporter-toggle').focus();}
 byId('race-supporter-toggle').onclick=()=>setSupporters(byId('race-supporter-window').hidden);
 byId('race-supporter-close').onclick=()=>setSupporters(false,true);
 document.addEventListener('pointerdown',e=>{if(!byId('race-supporter-window').hidden&&!e.target.closest('#race-supporter-window,#race-supporter-toggle'))setSupporters(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('race-supporter-window').hidden){e.preventDefault();setSupporters(false,true);}});
 function ensure(){
  if(!visible()){setSupporters(false);source?.close();source=null;if(raf)cancelAnimationFrame(raf);raf=0;return;}
  if(!source){source=new EventSource('/api/player/games/derby/stream');source.onmessage=e=>{try{render(JSON.parse(e.data));}catch(error){console.warn('Race update:',error);}};poll();}
  if(performance.now()-lastMessage>3500&&performance.now()-lastPoll>5000)poll();schedule();
 }
 form.onsubmit=async e=>{e.preventDefault();if(submitting||!state||form.querySelector('[type=submit]').disabled)return;remember();const body={round:state.round,market,runner:Number(form.elements.runner.value),bet:Number(byId('shared-race-bet').value)};submitting=true;updateControls();try{render(await api('/api/player/games/derby/bet',{method:'POST',body}));}catch(error){showToast(error.message);await poll();}finally{submitting=false;uiKey='';updateControls();}};
 form.addEventListener('input',remember);root.querySelectorAll('[data-market]').forEach(b=>b.onclick=()=>chooseMarket(b.dataset.market));root.querySelectorAll('[data-race-chip]').forEach(b=>b.onclick=()=>{byId('shared-race-bet').value=b.dataset.raceChip;remember();});
 new MutationObserver(ensure).observe(panel,{attributes:true,attributeFilter:['class']});new MutationObserver(ensure).observe(byId('view-casino'),{attributes:true,attributeFilter:['class']});
 setInterval(ensure,1000);document.addEventListener('visibilitychange',ensure);return {ensure};
};
