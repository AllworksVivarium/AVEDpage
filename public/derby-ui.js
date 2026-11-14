/* Shared five-runner race. Clients animate snapshots; only the server accepts wagers. */
window.AVEDDerbyUI=function({api,byId,esc,getUser,onBalance,showToast,playSfx=()=>{}}){
 const panel=byId('game-panel-derby');panel.dataset.typeIgnore='';
 const messages=byId('derby-chat-messages'),chat=byId('derby-chat-form');
 panel.innerHTML=`<section class="animal-race">
 <div class="animal-race-layout"><div class="race-main"><section class="animal-stage"><div class="animal-topline"><span id="derby-round-label">等待场次</span><div class="race-topline-tools"><button type="button" id="race-supporter-toggle" aria-expanded="false" aria-controls="race-supporter-window">已下注</button><strong id="derby-clock">同步中</strong></div></div><div class="animal-track"><canvas id="animal-race-canvas" aria-label="三只猫、小猪与小狗法棍的共享五跑道比赛"></canvas></div><div id="animal-names" class="animal-names"></div><section id="race-supporter-window" class="race-supporter-board" role="region" aria-label="已下注" hidden><header><span>已下注</span><button type="button" id="race-supporter-close" aria-label="关闭已下注">×</button></header><div class="race-supporter-content"><p class="race-supporter-legend">1 头名 · 5 末名</p><div id="race-supporter-labels" class="race-supporter-labels"></div><div id="race-supporters" class="race-supporters"></div></div></section><p id="derby-commentary" class="animal-status" role="status"><span>解说：</span><span id="derby-commentary-text">五名选手正在准备。</span></p></section><section class="race-rules game-rule-card" aria-labelledby="race-rules-title"><h3 id="race-rules-title">— 玩法说明</h3><dl class="race-rule-grid"><div><dt>竞猜</dt><dd>选第一名或最后一名；两项可以各下一笔。</dd></div><div><dt>投入</dt><dd>最低 100，每场两项合计最多 500,000。</dd></div><div><dt>赔付</dt><dd>命中返还 <b id="derby-rule-payout">6.25</b> 倍，包含本金；未命中返还 0。</dd></div><div><dt>封盘</dt><dd>每项提交后即锁定；比赛开始后不能再下注。</dd></div></dl></section></div>
 <aside class="race-sidebar"><form id="shared-race-form" class="race-slip"><h3 id="derby-ticket-state">本场竞猜</h3><div class="race-market-tabs" role="group" aria-label="竞猜位次"><button type="button" data-market="first" aria-pressed="true">第一名</button><button type="button" data-market="last" aria-pressed="false">最后一名</button></div><div class="race-select"><fieldset id="shared-runner-options" class="animal-options" aria-label="选择选手"></fieldset></div><div class="race-stake"><label class="race-amount" for="shared-race-bet">本笔投入<input id="shared-race-bet" type="number" min="100" max="500000" step="1" value="1000" required inputmode="numeric"></label><div class="race-amounts"><button type="button" data-race-chip="1000">1,000</button><button type="button" data-race-chip="10000">10,000</button><button type="button" data-race-chip="50000">50,000</button></div><button type="submit" class="race-submit" disabled>同步中</button></div><div id="derby-self-result" class="race-tickets" role="status"></div></form><section class="animal-radio game-radio"><header class="game-radio-heading"><h3>看台无线电</h3><small>LIVE RADIO</small></header><div id="derby-radio-slot"></div></section></aside></div></section>`;
 byId('derby-radio-slot').append(messages,chat);
 const root=panel.querySelector('.animal-race'),form=byId('shared-race-form'),scene=window.AVEDDerbyScene(byId('animal-race-canvas'),{onFinish:()=>{if(motion())playSfx('win');}});
 let supportersKey='',state=null,source=null,lastMessage=0,lastPoll=0,polling=false,submitting=false,market='first',sourceOwner=null,receivedAt=0,raf=0,lastFrame=0,celebratedAt=0,optionsKey='',uiKey='',ticketsKey='';
 const gameClock=window.AVEDGameClock.create();
 const drafts={first:{runner:0,bet:1000},last:{runner:4,bet:1000}},text=new WeakMap();
 const setText=(el,value)=>{value=String(value);if(text.get(el)!==value){el.textContent=value;text.set(el,value);}};
 const setResult=(el,value)=>{value=String(value);if(text.get(el)!==value){el.innerHTML=window.AVEDGameResults.markup(value);text.set(el,value);}};
 const money=n=>'¤ '+Number(n).toLocaleString(),marketName=m=>m==='first'?'第一名':'最后一名';
 const visible=()=>!!getUser()&&!document.hidden&&!byId('view-casino').classList.contains('hidden')&&!panel.classList.contains('hidden');
 const motion=()=>window.AVEDEffectsEnabled?.()!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const now=()=>state?gameClock.now(state.serverTime+3000):0;
 // Templates use the current rendered positions, never the unrevealed final order.
 const commentary={
  start:['五位选手出发了，方向暂时一致。','比赛开始，纸箱也已准备就绪。','五条跑道，五种打算。','选手们动起来了，先看看谁比较着急。'],
  lead:['{第一名}暂时领先。','目前跑在最前面的是{第一名}。','{第一名}占据头名，后面的选手还在追。','{第一名}带着队伍往前跑。','{第一名}暂列第一，比赛还没结束。'],
  pass:['{选手}超过了{被超过者}！','位置发生变化，{选手}来到{被超过者}前面。','{选手}追了上来，超过{被超过者}。','{被超过者}身旁经过的是{选手}。'],
  sleep:['{选手}睡下了，比赛还醒着。','{选手}开始休息，计时没有暂停。','{选手}闭上了眼睛。看起来不是战术。','{选手}原地补觉，其他选手继续前进。'],
  wake:['{选手}醒了，重新加入比赛。','{选手}结束休息，继续往前跑。','{选手}回来了，名次得重新看看。'],
  scratch:['{选手}开始挠纸箱。纸箱暂未还手。','{选手}停下来检查纸箱的耐用程度。','{选手}正在挠纸箱，跑道先放一边。'],
  box:['{选手}钻进了纸箱，暂时退出我们的视野。','纸箱成功留住了{选手}。','{选手}找到一个合适的休息室。'],
  peek:['{选手}朝纸箱里看了一眼。','{选手}正在检查纸箱内部。','纸箱吸引了{选手}的注意。'],
  nudge:['{选手}开始推纸箱，这是另一项比赛。','{选手}决定带着纸箱一起前进。','{选手}正在给纸箱挪位置。'],
  carry:['{选手}叼起了纸箱，没打算空手走。','{选手}拿上了纸箱。比赛没有要求携带行李。','{选手}把纸箱也带上了。'],
  sniff:['{选手}停下来闻了闻纸箱。','{选手}正在进行赛道气味检查。','{选手}对纸箱有一些疑问。'],
  jump:['{选手}跳过了纸箱！','{选手}越过障碍，继续前进。','纸箱没能拦住{选手}。'],
  groom:['{选手}决定先把自己收拾一下。'],
  stretch:['{选手}伸了个懒腰。','{选手}正在舒展身体。','{选手}做起了热身，虽然比赛已经开始。'],
  yawn:['{选手}打了个哈欠。','{选手}看起来没有感受到比赛的紧张。','{选手}用一个哈欠回应了现场气氛。'],
  shake:['{选手}抖了抖身子。','{选手}原地抖了两下，稍作调整。'],
  roll:['{选手}打起了滚，路线有了新的理解。','{选手}在跑道上滚了一圈。','{选手}选择横向发挥。'],
  finish:['{选手}率先抵达终点！','第一位抵达的是{选手}！','{选手}已经到达，其他选手继续。']
 };
 // Species-specific lines supplement neutral lines; incompatible actions are excluded.
 const speciesCommentary={
  cat:{
   groom:['{选手}舔了舔爪子，开始洗脸。','{选手}停下来舔毛。名次可以等，毛不能乱。','{选手}正在整理胡须，比赛暂且放一边。'],
   scratch:['{选手}两只前爪轮流上阵，纸箱有点忙。','{选手}开始磨爪，纸箱成了临时猫抓板。'],
   box:['{选手}钻进了纸箱。猫已经有了自己的安排。','{选手}只露出一点耳朵，看来很满意这个纸箱。'],
   stretch:['{选手}把前爪往前伸，认真伸了个懒腰。'],
   shake:['{选手}抖了抖毛，重新整理一下仪容。']
  },
  pig:{
   nudge:['{选手}用鼻子拱着纸箱走。纸箱没有报名。','{选手}拿鼻子顶了顶纸箱，决定给它挪个位置。'],
   sniff:['{选手}凑近纸箱闻了闻，暂时没发现吃的。','{选手}的鼻子很忙，脚倒是停下了。'],
   roll:['{选手}翻身打了个滚，跑道成了临时床铺。','{选手}滚了一圈，这段距离不算向前。'],
   sleep:['{选手}趴下睡了，鼻子也暂时休息。'],
   shake:['{选手}抖了抖身子，四只小蹄子还在原地。']
  },
  dog:{
   carry:['{选手}叼着纸箱。这次没人喊它捡回来。','{选手}把纸箱叼起来了，嘴里有事，脚下先等等。'],
   sniff:['{选手}贴近纸箱闻了一圈，调查还在继续。','{选手}停下闻纸箱。鼻子接管了比赛。'],
   stretch:['{选手}前爪往前一伸，先松松筋骨。'],
   shake:['{选手}抖了抖毛，像刚完成一次不存在的洗澡。'],
   sleep:['{选手}趴下闭眼，纸箱留着醒了再管。']
  }
 };
 const actionSpecies={groom:['cat'],scratch:['cat'],box:['cat'],peek:['cat'],jump:['cat'],nudge:['pig'],roll:['pig'],carry:['dog'],sniff:['pig','dog']};
 const speciesOf=runner=>runner?.kind==='pig'?'pig':runner?.kind==='frenchie'?'dog':['orange','black','cow'].includes(runner?.kind)?'cat':null;
 let commentaryRound=null,commentaryPhase='',commentarySample=0,commentarySpoken=-Infinity,commentaryPoints=null;
 const lastLines={};
 function say(kind,values,at,runner=null){
  const species=speciesOf(runner);
  if(actionSpecies[kind]&&!actionSpecies[kind].includes(species))return;
  const lines=[...(commentary[kind]||[]),...(speciesCommentary[species]?.[kind]||[])];if(!lines.length)return;
  const choices=lines.filter(line=>line!==lastLines[kind]);
  const template=choices[Math.floor(Math.random()*choices.length)]||lines[0];lastLines[kind]=template;
  setText(byId('derby-commentary-text'),template.replace(/\{([^}]+)\}/g,(_,key)=>values[key]??''));commentarySpoken=at;
 }
 function updateCommentary(at){
  if(state.phase!=='RACING')return;
  if(commentaryRound!==state.round||commentaryPhase!=='RACING'){
   commentaryRound=state.round;commentaryPhase='RACING';commentaryPoints=null;commentarySample=0;commentarySpoken=-Infinity;
  }
  if(at-commentarySample<250)return;commentarySample=at;
  const points=state.runners.map(r=>({...r,...window.AVEDDerbyPosition(r,at,state.serverTime,state.frameAt??state.serverTime)}));
  const ordered=[...points].sort((a,b)=>b.progress-a.progress||a.id-b.id),old=commentaryPoints;
  commentaryPoints=points;
  const names={'第一名':ordered[0].name};
  // Sample transitions even while a line is held, so old actions are not queued.
  if(at-commentarySpoken<2800)return;
  if(!old){say(at-state.startAt<1800?'start':'lead',names,at);return;}
  const previous=id=>old.find(p=>p.id===id);
  const finished=points.find(p=>p.progress>=100&&previous(p.id)?.progress<100);
  if(finished&&!old.some(p=>p.progress>=100)){say('finish',{'选手':finished.name},at);return;}
  for(const p of points){
   const before=previous(p.id);if(!before||p.pose===before.pose)continue;
   const sleeping=pose=>pose==='sleep'||pose==='doze';
   const kind=sleeping(p.pose)?'sleep':sleeping(before.pose)&&p.pose==='run'?'wake':p.pose;
   if(commentary[kind]){say(kind,{'选手':p.name},at,p);return;}
  }
  for(const p of ordered){
   const passed=points.find(q=>q.id!==p.id&&p.progress>q.progress+.15&&previous(p.id)?.progress<=previous(q.id)?.progress&&p.progress<100);
   if(passed){say('pass',{'选手':p.name,'被超过者':passed.name},at);return;}
  }
  if(at-commentarySpoken>=5000&&ordered[0].progress>0&&ordered[0].progress<100&&ordered[0].progress-ordered[1].progress>.15)say('lead',names,at);
 }
 function remember(){if(!state?.bets?.some(b=>b.market===market)){drafts[market]={runner:Number(form.elements.runner?.value||0),bet:byId('shared-race-bet').value};}}
 function chooseMarket(value){remember();market=value;uiKey='';updateControls();}
 function updateControls(){
  if(!state)return;const remaining=Math.max(0,500000-state.bets.reduce((n,b)=>n+b.cost,0));const selected=state.bets.find(b=>b.market===market),fresh=performance.now()-lastMessage<3500,locked=submitting||!fresh||state.phase!=='BETTING'||now()>=state.startAt||!!selected||remaining<100;
  const key=[state.round,market,locked,selected?.runner,selected?.cost,submitting,remaining].join(':');if(key===uiKey)return;uiKey=key;
  root.querySelectorAll('[data-market]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.market===market));b.disabled=submitting;});
  form.querySelectorAll('input,[data-race-chip]').forEach(el=>el.disabled=locked);
  form.elements.runner.value=String(selected?.runner??drafts[market].runner);byId('shared-race-bet').max=String(selected?.cost??remaining);byId('shared-race-bet').value=selected?.cost??Math.min(Number(drafts[market].bet),remaining);
  const button=form.querySelector('[type=submit]');button.disabled=locked;
  setText(button,submitting?'确认中':!fresh?'等待同步':selected?'此项已下注':remaining<100?'本场额度已用完':state.phase!=='BETTING'||now()>=state.startAt?'本场已封盘':'下注 · '+marketName(market));
  setText(byId('derby-ticket-state'),state.bets.length?'本场已下 '+state.bets.length+' 笔':'本场竞猜');
 }
 function render(d){
  if(!getUser()||state&&(d.round<state.round||d.round===state.round&&d.serverTime<state.serverTime))return;
  const previous=state;gameClock.snapshot(d.serverTime);remember();state=d;receivedAt=performance.now();lastMessage=receivedAt;
  const totalCost=d.bets.reduce((n,b)=>n+b.cost,0),totalPrize=d.bets.reduce((n,b)=>n+(b.grossPrize??b.prize),0);
  if(previous?.round===d.round&&previous.phase!=='RESULT'&&d.phase==='RESULT'&&totalPrize>totalCost){celebratedAt=d.serverTime;playSfx('win');}
  if(previous?.round!==d.round){celebratedAt=0;uiKey='';}
  if(getUser().balance!==d.balance)onBalance(d.balance);
  setText(byId('derby-round-label'),'#'+String(d.round).padStart(5,'0')+' / '+d.entrants+' 人同场');
  const key=d.runners.map(r=>r.id+r.name+r.kind).join(':');
  if(key!==optionsKey){optionsKey=key;byId('race-supporter-labels').innerHTML=d.runners.map(r=>'<span>'+esc(r.name)+'</span>').join('');byId('animal-names').innerHTML=d.runners.map(r=>`<span><b>${r.id+1}</b>${esc(r.name)}</span>`).join('');byId('shared-runner-options').innerHTML=d.runners.map(r=>`<label><input type="radio" name="runner" value="${r.id}" ${r.id===0?'checked':''}><img src="${scene.thumbnail(r.kind||'orange')}" alt="" width="40" height="33"><span>${esc(r.name)}${r.kind==='frenchie'?'<small class="animal-code">AVED-007</small>':''}</span><small>${r.kind==='frenchie'?'狗':r.kind==='pig'?'猪':'猫'}</small></label>`).join('');uiKey='';}
  const audience=JSON.stringify(d.supporters||[]);if(audience!==supportersKey){
   supportersKey=audience;byId('race-supporters').innerHTML=d.runners.map(r=>{
    const supporters=(d.supporters||[]).filter(p=>p.runner===r.id),extra=supporters.length-3;
    return '<div class="race-supporter-faces" aria-label="'+esc(r.name+'支持者')+'">'+supporters.slice(0,3).map(p=>'<span class="race-supporter-avatar" role="img" aria-label="'+marketName(p.market)+'下注头像"><img src="'+esc(p.avatar||'/assets/avatar-pixel-slate.debac0c8de54.svg')+'" alt="" width="22" height="22" loading="lazy"><b aria-hidden="true">'+(p.market==='first'?'1':'5')+'</b></span>').join('')+(extra>0?'<span class="race-supporter-overflow" aria-label="另有 '+extra+' 笔下注">+'+extra+'</span>':'')+'</div>';
   }).join('');
  }
  const receipt=JSON.stringify(d.bets);if(receipt!==ticketsKey){ticketsKey=receipt;byId('derby-self-result').innerHTML=d.bets.map(b=>`<p>${marketName(b.market)} · ${esc(d.runners[b.runner].name)}<br>投入 ${money(b.cost)}${b.settled?' / 本局获得 '+money(b.grossPrize??b.prize):' / 已封存'}${window.AVEDGameResults.taxNote(b.tax)}</p>`).join('')||'<p>可只选一项，也可两项都下注。</p>';}

  const status=byId('derby-commentary');status.classList.toggle('is-profit',d.phase==='RESULT'&&totalPrize>totalCost);
  if(d.phase!=='RACING')commentaryPhase=d.phase;
  if(d.phase!=='RACING')setResult(byId('derby-commentary-text'),d.phase==='BETTING'?'纸箱就位，等大家下注。':d.phase==='RESULT'?(totalPrize>totalCost?'竞猜命中！返还 '+money(totalPrize)+' · ':'')+'第一名 '+d.runners[d.winner].name+(d.last!=null?' / 最后一名 '+d.runners[d.last].name:'')+(d.bets.some(b=>b.tax)?'\n已扣税 '+money(d.bets.reduce((n,b)=>n+(b.tax||0),0)):''):'五位选手已经出发。');
  setText(byId('derby-rule-payout'),((d.returnPercent||125)/20).toFixed(2));
  if(visible()&&d.phase==='RESULT')window.AVEDPersonalRecord?.show(d.gameHighlight);
  updateControls();schedule();
 }
 function paint(){raf=0;if(!visible()||!state)return;const time=performance.now();if(time-lastFrame>=32){lastFrame=time;const at=now(),target=state.phase==='BETTING'?state.startAt:state.phase==='RACING'?state.finishAt:state.nextAt,seconds=Math.max(0,Math.ceil((target-at)/1000));setText(byId('derby-clock'),(state.phase==='BETTING'?'下注 ':state.phase==='RACING'?'比赛 ':'下场 ')+seconds+' s');scene.paint(state,at,motion(),celebratedAt);updateCommentary(at);updateControls();}schedule();}
 function schedule(){if(visible()&&state&&!raf)raf=requestAnimationFrame(paint);}
 async function poll(){if(polling||!visible())return;polling=true;lastPoll=performance.now();try{const owner=getUser()?.id,sent=performance.now(),d=await api('/api/player/games/derby/current');if(owner!==getUser()?.id)return;gameClock.measure(d.serverTime,sent);render(d);}catch{}finally{polling=false;}}
 function setSupporters(open,restoreFocus=false){byId('race-supporter-window').hidden=!open;byId('race-supporter-toggle').setAttribute('aria-expanded',String(open));if(restoreFocus)byId('race-supporter-toggle').focus();}
 byId('race-supporter-toggle').onclick=()=>setSupporters(byId('race-supporter-window').hidden);
 byId('race-supporter-close').onclick=()=>setSupporters(false,true);
 document.addEventListener('pointerdown',e=>{if(!byId('race-supporter-window').hidden&&!e.target.closest('#race-supporter-window,#race-supporter-toggle'))setSupporters(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('race-supporter-window').hidden){e.preventDefault();setSupporters(false,true);}});
 function ensure(){
  if(source&&sourceOwner!==getUser()?.id){source.close();source=null;state=null;gameClock.reset();}
  if(!visible()){setSupporters(false);source?.close();source=null;if(raf)cancelAnimationFrame(raf);raf=0;return;}
  if(!source){sourceOwner=getUser()?.id;const owner=sourceOwner;source=new EventSource('/api/player/games/derby/stream');source.onmessage=e=>{if(owner!==getUser()?.id)return;try{render(JSON.parse(e.data));}catch(error){console.warn('Race update:',error);}};poll();}
  if(performance.now()-lastMessage>3500&&performance.now()-lastPoll>5000)poll();schedule();
 }
 form.onsubmit=async e=>{e.preventDefault();if(submitting||!state||form.querySelector('[type=submit]').disabled)return;remember();const body={round:state.round,market,runner:Number(form.elements.runner.value),bet:Number(byId('shared-race-bet').value)};submitting=true;updateControls();const owner=getUser()?.id,sent=performance.now();try{const d=await api('/api/player/games/derby/bet',{method:'POST',body});if(owner!==getUser()?.id)return;gameClock.measure(d.serverTime,sent);render(d);}catch(error){showToast(error.message);await poll();}finally{submitting=false;uiKey='';updateControls();}};
 form.addEventListener('input',remember);root.querySelectorAll('[data-market]').forEach(b=>b.onclick=()=>chooseMarket(b.dataset.market));root.querySelectorAll('[data-race-chip]').forEach(b=>b.onclick=()=>{byId('shared-race-bet').value=b.dataset.raceChip;remember();});
 new MutationObserver(ensure).observe(panel,{attributes:true,attributeFilter:['class']});new MutationObserver(ensure).observe(byId('view-casino'),{attributes:true,attributeFilter:['class']});
 setInterval(ensure,1000);document.addEventListener('visibilitychange',ensure);return {ensure};
};
