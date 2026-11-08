/* AVED pixel card table. Private hands and legal turns are server-authoritative. */
window.AVEDCardTableUI=function({api,esc,getUser,onBalance=()=>{},playSfx=()=>{}}){
 const panel=document.getElementById('game-panel-doudizhu'),R=window.AVEDDdzRules,Stakes=window.AVEDCardStakes;
 panel.dataset.typeIgnore='';panel.classList.add('ddz-panel');
 panel.innerHTML=`<div class="ddz-shell">
  <header class="ddz-heading"><div><small>AVED / AFTER HOURS</small><h3>员工牌桌 <span>智斗太姥</span></h3></div><div class="ddz-heading-actions"><button type="button" data-ddz="rules" class="ddz-small">规则 ?</button></div></header>
  <div class="ddz-menu"><div class="ddz-mode" role="group" aria-label="牌桌人数"><button data-size="3" aria-pressed="true">三人经典</button><button data-size="4" aria-pressed="false">四人双牌</button></div><div class="ddz-entry"><button data-ddz="create">开联机房</button><button data-ddz="soloRoom" class="ddz-gold">开电脑房</button></div><button type="button" data-ddz="leave" hidden>退出牌桌</button></div>
  <label class="ddz-stakes">底注 <select data-ddz-base aria-label="牌桌底注"><option value="1000">1,000</option><option value="10000">10,000</option><option value="50000">50,000</option><option value="custom">自定义</option></select><input data-ddz-custom-base type="number" min="100" max="1000000" step="1" inputmode="numeric" value="1000" aria-label="自定义牌桌底注" hidden></label><label class="ddz-stakes">电脑难度 <select data-ddz-ai aria-label="电脑对手难度"><option value="easy">轻松</option><option value="standard" selected>标准</option><option value="smart">认真</option></select></label><div class="ddz-spectators" data-ddz-spectators></div><div class="ddz-roomline"><span data-ddz-room>CHOOSE YOUR TABLE</span><span data-ddz-reserve>开局锁定 10,000</span></div>
   <div class="ddz-turn"><i></i><span data-ddz-turn>等待入座</span><b data-ddz-clock></b></div>
  <section class="ddz-felt" aria-label="智斗太姥牌桌"><div class="ddz-grain" aria-hidden="true"></div>
   <div class="ddz-seat ddz-seat-top" data-seat="top"></div><div class="ddz-seat ddz-seat-left" data-seat="left"></div><div class="ddz-seat ddz-seat-right" data-seat="right"></div>
   <div class="ddz-table-center"><div class="ddz-watermark" aria-hidden="true">A.V.E.D.<small>EMPLOYEE CARD CLUB</small><span>♠　♥　♣　♦</span></div><div class="ddz-bottom" data-ddz-bottom></div><div class="ddz-trick" data-ddz-trick></div><div class="ddz-table-label" data-ddz-table-label>入座，开始一局。</div></div>
   <div class="ddz-score"><span>叫分 <b data-ddz-bid>—</b></span><span>倍率 <b data-ddz-mult>×1</b></span></div>
   <div class="ddz-hand" data-ddz-hand aria-label="我的手牌"></div>
   <div class="ddz-self"><div data-ddz-self></div><button data-ddz="auto" hidden>托管</button></div>
  </section>
  <div class="ddz-selection" role="status" aria-live="polite"><div><small>当前选择</small><strong data-ddz-selected>未选牌</strong></div><span data-ddz-preview></span><button data-ddz="clear" disabled>取消全选</button></div>
  <div class="ddz-money" data-ddz-money role="status">每局最多损失锁定筹码。电脑输赢由系统承担。</div><div class="ddz-actions" data-ddz-actions></div><p class="ddz-message" role="status" data-ddz-message></p>
  <footer class="ddz-foot"><span>SELECT · PLAY · PASS</span><span data-ddz-link>LOCAL CARD CLUB</span></footer>
 </div><dialog class="ddz-dialog"><header><b data-dialog-title></b><button data-dialog-close aria-label="关闭窗口">×</button></header><div data-dialog-body></div></dialog>`;
 const $=s=>panel.querySelector(s),dialog=$('dialog');let state=null,size=3,selected=new Set(),busy=false,stream=null,loaded=false,lastEvent='',hintIndex=0,lastHand='',uid=null,clockBase=null,lastRecovery=-Infinity,refreshPending=null;
 const symbols={ '♠':'M6 0h4v2h2v2h2v2h2v6h-2v2h-4v-2H6v2H2v-2H0V6h2V4h2V2h2z M6 12h4v2h2v2H4v-2h2z','♥':'M2 0h4v2h4V0h4v2h2v6h-2v2h-2v2h-2v2H8v2H6v-2H4v-2H2v-2H0V2h2z','♦':'M6 0h4v2h2v2h2v2h2v4h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V6h2V4h2V2h2z','♣':'M6 0h4v2h2v4h2v2h2v4h-2v2h-4v-2H6v2H2v-2H0V8h2V6h2V2h2z M6 12h4v2h2v2H4v-2h2z'};
 const suit=c=>`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${symbols[c.suit]||symbols['♠']}" fill="currentColor"/></svg>`;
 function card(c,interactive=false){if(!c)return '<span class="ddz-card ddz-card-back" aria-label="未公开的底牌"><i>◆</i></span>';const joker=c.val>=16,label=joker?(c.val===16?'小王':'大王'):esc(c.label),emblem=joker?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7h4v4h3V3h6v8h3V7h4v12H2zM4 21h16" fill="currentColor"/></svg>':suit(c);
  return `<${interactive?'button':'span'} aria-label="${joker?label:esc(c.label+' '+c.suit)}" ${interactive?`type="button" data-card="${c.id}" aria-pressed="${selected.has(c.id)}"`:''} class="ddz-card ${c.red?'ddz-red':''} ${joker?'ddz-joker':''} ${selected.has(c.id)&&interactive?'is-selected':''}">${interactive?'<span class="ddz-card-face" aria-hidden="true">':''}<span class="ddz-card-rank">${joker?'<span class="ddz-joker-name">'+label+'</span>':label+suit(c)}</span><span class="ddz-card-pip">${emblem}</span><span class="ddz-card-corner">${label}</span>${interactive?'<i class="ddz-card-check" aria-hidden="true">✓</i></span>':''}</${interactive?'button':'span'}>`;
 }
 function portrait(p){return `<span class="ddz-avatar" style="--avatar-tone:${['#739b90','#b99070','#9d83a3','#829bb0'][Math.abs(p.id||0)%4]}"><img src="${esc(p.avatar||'/assets/avatar-pixel-slate.debac0c8de54.svg')}" width="64" height="64" decoding="async" alt="${esc(p.name)}的头像"></span>`;}
 panel.addEventListener('error',e=>{const img=e.target,fallback='/assets/avatar-pixel-slate.debac0c8de54.svg';if(img.matches?.('.ddz-avatar img')&&img.getAttribute('src')!==fallback)img.src=fallback;},true);
 function stakeDraft(){const custom=$('[data-ddz-custom-base]');custom.hidden=$('[data-ddz-base]').value!=='custom';let reserve;try{reserve=state?.money?.rules.reserve??state?.reserve??Stakes.reserve(Stakes.read($('[data-ddz-base]').value,custom.value));}catch{}$('[data-ddz-reserve]').textContent=reserve?'开局锁定 '+reserve.toLocaleString():'请输入有效底注';}
 $('[data-ddz-base]').onchange=stakeDraft;$('[data-ddz-custom-base]').oninput=stakeDraft;
 const feedback=window.AVEDCardFeedbackUI({panel,esc,getUser});
 const reactions=window.AVEDCardReactionsUI({panel,api,esc,portrait,getState:()=>state});
 function seatMarkup(p,i){if(!p)return '<span class="ddz-empty">＋<small>空座位</small></span>';return `${portrait(p)}<div class="ddz-seat-name"><strong>${esc(p.name)}</strong><small>${p.bot?'电脑 · ':''}${p.role==='landlord'?'太姥':p.role==='farmer'?'少姥':p.ready?'已准备':'未准备'}${p.auto?' · 托管':''}</small></div><span class="ddz-count">${state?.phase==='waiting'?'—':p.count??0}<small>张</small></span><span class="ddz-seat-last">${esc(p.last?.text||'')}${state?.spectating&&p.last?.cards?'<span class="ddz-public-cards">'+p.last.cards.map(c=>card(c)).join('')+'</span>':''}</span>`;}
 function renderSeats(){const positions=state?.size===4||state?.spectating?['right','top','left']:['right','left'];for(const pos of ['left','top','right']){$(`[data-seat="${pos}"]`).innerHTML='';$(`[data-seat="${pos}"]`).hidden=pos==='top'&&(state?.size||size)!==4&&!state?.spectating;}
  positions.forEach((pos,n)=>{const i=state?state.spectating?n:(state.seat+n+1)%state.size:n+1,el=$(`[data-seat="${pos}"]`);el.innerHTML=seatMarkup(state?.seats[i],i);el.classList.toggle('is-turn',!!state&&state.turn===i&&['bidding','playing'].includes(state.phase));});
  $('[data-ddz-self]').innerHTML=state&&!state.spectating?`${portrait(state.seats[state.seat])}<span>${esc(state.seats[state.seat].name)}<small>${state.seats[state.seat].role==='landlord'?'太姥':state.landlord>=0?'少姥':'入座'} · ${state.hand.length} 张</small></span>`:state?.spectating?(state.size===4?seatMarkup(state.seats[3],3):'<span>观众席 · 公开牌面</span>'):'<span class="ddz-self-hint">你的座位</span>';
 }
 function handRows(){const hand=state?.hand||[];if(!hand.length){$('[data-ddz-hand]').innerHTML=state?'':'<div class="ddz-idle-cards">'+[3,14,13,12,11].map((val,i)=>`<span style="--tilt:${(i-2)*8}deg;--lift:${Math.abs(i-2)*5}px">${card({id:900+i,val,label:['3','A','K','Q','J'][i],suit:['♣','♥','♠','♦','♣'][i],red:i===1||i===3})}</span>`).join('')+'</div>';return;}
  const max=innerWidth<650?13:20,rows=hand.length>max?2:1,n=Math.ceil(hand.length/rows);
  $('[data-ddz-hand]').innerHTML=Array.from({length:rows},(_,i)=>{const part=hand.slice(i*n,(i+1)*n);return `<div class="ddz-hand-row" style="--count:${part.length}">${part.map(c=>card(c,true)).join('')}</div>`;}).join('');
 }
 function selection(){const hand=state?.hand||[],cards=hand.filter(c=>selected.has(c.id)),p=R.classify(cards,state?.size||size),myTurn=state?.phase==='playing'&&state.turn===state.seat&&!state.seats[state.seat].auto;
  $('[data-ddz-selected]').textContent=cards.length?`已选 ${cards.length} 张 · ${p?.label||'未成牌型'}`:'未选牌';$('[data-ddz-preview]').textContent=cards.map(c=>c.label).join(' ');
  $('[data-ddz="clear"]').disabled=!cards.length;const play=$('[data-ddz="play"]');if(play)play.disabled=busy||!myTurn||!R.beats(p,state.last);
  $('.ddz-selection').dataset.valid=cards.length?(p&&R.beats(p,state?.last)?'yes':'no'):'';
  if(cards.length&&p&&!R.beats(p,state?.last))$('[data-ddz-preview]').textContent+=' · 无法压过上手';
  panel.querySelectorAll('[data-card]').forEach(b=>{const on=selected.has(Number(b.dataset.card));b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});
 }
 function actions(){let html='';if(!state)html='<span class="ddz-idle-note">选好人数，单人开桌或邀请同事。</span>';
  else if(state.spectating)html='<span>旁观中 · 仅展示公开出牌</span>';
  else if(state.phase==='waiting'||state.phase==='ended'){
   const blocked=state.seats.some(p=>p&&!p.ready),me=state.seats[state.seat];
   const ready=`<button data-ddz="ready" class="${me.ready?'':'ddz-gold'}">${me.ready?'已准备 · 点击取消':state.readyCycle||state.phase==='ended'?'准备下一局':'准备'}</button>`;
   if(String(state.host)===String(getUser()?.id))html=(me.ready?'':ready)+`<button data-ddz="start" class="${me.ready?'ddz-gold':''}" ${blocked||state.seats.some(p=>!p)?'disabled':''}>${state.phase==='ended'||state.readyCycle?'确认并开始下一局':'确认开局'}</button>${state.seats.some(p=>!p)?'<button data-ddz="fill">补齐电脑</button>':''}`+(state.readyCycle&&me.ready?ready:'');
   else html=ready+'<small>由房主手动开局</small>';
  }else if(state.phase==='bidding'){html=[0,1,2,3].map(n=>`<button data-ddz="bid" data-bid="${n}" ${state.turn!==state.seat||state.seats[state.seat].auto||n&&n<=state.bid?'disabled':''} class="${n===3?'ddz-gold':''}">${n?n+' 分':'不叫'}</button>`).join('');}
  else html=`<button data-ddz="pass" ${state.turn!==state.seat||!state.last||state.seats[state.seat].auto?'disabled':''}>不出</button><button data-ddz="hint" ${state.turn!==state.seat||state.seats[state.seat].auto?'disabled':''}>提示</button><button data-ddz="play" class="ddz-gold" disabled>出牌</button>`;
  $('[data-ddz-actions]').innerHTML=html;if(busy)panel.querySelectorAll('[data-ddz-actions] button').forEach(b=>b.disabled=true);selection();
 }
 function render(next){if(state&&next?.id===state.id&&next.revision<state.revision)return;const previous=state;state=next;if(previous?.id!==state?.id)message(previous&&!state?'已离开牌桌，可重新开房或入座。':'');clockBase=state?{server:Number.isFinite(state.serverTime)?state.serverTime:Date.now(),local:performance.now()}:null;if(Number.isSafeInteger(next?.balance))onBalance(next.balance);if(state){size=state.size;uid=getUser()?.id;}const valid=new Set(state?.hand.map(c=>c.id)||[]);selected=new Set([...selected].filter(id=>valid.has(id)));if(previous?.id!==state?.id)selected.clear();
  panel.dataset.cardPlayers=size;panel.dataset.spectating=String(!!state?.spectating);
  const ai=$('[data-ddz-ai]');if(state?.botLevel)ai.value=state.botLevel;ai.disabled=!!state&&(state.spectating||state.host!==getUser()?.id||['bidding','playing'].includes(state.phase));
  const stake=$('[data-ddz-base]'),custom=$('[data-ddz-custom-base]');stake.disabled=custom.disabled=!!state;if(state){const base=state.base||100;stake.value=Stakes.presets.includes(base)?String(base):'custom';custom.value=String(base);}stakeDraft();
  $('[data-ddz-spectators]').innerHTML='<small>观众席 '+(state?.spectators?.length||0)+'</small>'+(state?.spectators||[]).map(p=>portrait(p)).join('');panel.dataset.cardPhase=state?.phase||'idle';
  $('[data-ddz-room]').textContent=state?`${state.mode==='solo'?'电脑对局':(state.hostName||'员工')+'的牌桌'} / ${size} 人桌`:'CHOOSE YOUR TABLE';
  $('[data-ddz="leave"]').hidden=!state;$('[data-ddz="leave"]').textContent=state?.spectating?'退出旁观':'退出牌桌';panel.querySelectorAll('[data-size]').forEach(b=>{b.disabled=!!state;b.setAttribute('aria-pressed',String(Number(b.dataset.size)===size));});
  panel.querySelectorAll('.ddz-entry button').forEach(b=>b.disabled=!!state||busy);
  $('[data-ddz-bid]').textContent=state?.bid||'—';$('[data-ddz-mult]').textContent='×'+(state?.multiplier||1);
  const receipt=state?.money?.settlement;$('[data-ddz-money]').textContent=receipt?`本局结算投入 ¤ ${receipt.stake.toLocaleString()} · 获得 ¤ ${receipt.reward.toLocaleString()} · 未使用筹码已释放`:state?.spectating?'旁观不参与下注与结算':state?.money?`本局锁定 ¤ ${state.money.rules.reserve.toLocaleString()} · 底注 ${state.base||100} × 叫分 × 倍率 · 本局结束自动释放剩余筹码`:'入座余额须满足所选底注的锁定筹码。电脑输赢由系统承担，胜方另获全桌结算筹码的 25% 奖金。';
  if(receipt?.autoOnly)$('[data-ddz-money]').textContent+=state.money.rules.autoProfitPolicy==='manual-play-v1'?' · 旧局规则：整局托管不计正收益':' · 托管按正常规则结算';
  if(receipt&&visible())window.AVEDPersonalRecord?.show(state.gameHighlight);
  if(receipt&&previous?.money?.round===state.money.round&&!previous.money.settlement&&receipt.net>0)playSfx('win');
  $('[data-ddz-bottom]').innerHTML=state?.bottom.map(c=>card(c)).join('')||'';
  const last=state?.last;$('[data-ddz-trick]').innerHTML=last?last.cards.map(c=>card(c)).join(''):'';
  $('[data-ddz-table-label]').textContent=state?.phase==='ended'?`${state.winner==='landlord'?'太姥':'少姥'}获胜${state.spring?' · 春天':''}`:last?`${state.seats[last.seat].name} · ${last.label} · ${last.count} 张`:state?.phase==='bidding'?'等待叫分':state?.phase==='waiting'?'等待同事入座':state?'本轮自由出牌':'入座，开始一局。';
  $('[data-ddz-turn]').textContent=!state?'等待入座':state.phase==='ended'?'本局结束':state.phase==='waiting'?`${state.seats.filter(Boolean).length} / ${size} 已入座`:state.turn===state.seat?'轮到你'+(state.phase==='bidding'?'叫分':'出牌'):state.seats[state.turn].name+'的回合';
  $('.ddz-turn').classList.toggle('is-mine',!!state&&!state.spectating&&state.turn===state.seat&&['bidding','playing'].includes(state.phase));
  const auto=$('[data-ddz="auto"]');auto.hidden=!state||state.spectating||!['bidding','playing'].includes(state.phase);auto.textContent=state?.seats[state.seat]?.auto?'接管牌局':'托管';
  renderSeats();const key=(state?.id||'')+':'+(state?.hand.map(c=>c.id).join(',')||'');if(key!==lastHand||!previous){lastHand=key;handRows();hintIndex=0;}
  actions();feedback.render(state,previous);clock();reactions.render(state);const event=state?state.id+':'+(state.event?.id||JSON.stringify(state.event)):'';if(previous&&event!==lastEvent&&state?.event?.type)playSfx('click');lastEvent=event;
  if(previous?.id!==state?.id||previous?.phase!==state?.phase)document.dispatchEvent(new Event('aved-card-room-change'));
 }
 function clock(){const active=state&&!state.spectating&&state.deadline>0&&['bidding','playing'].includes(state.phase),now=clockBase?clockBase.server+performance.now()-clockBase.local:Date.now();$('[data-ddz-clock]').textContent=active?String(Math.max(0,Math.ceil((state.deadline-now)/1000))).padStart(2,'0'):'';
  feedback.clock($('[data-ddz-clock]').textContent,now);
  // SSE normally advances the table. Recover only if an expired turn stays stale.
  const readyExpires=state&&!state.spectating&&state.readyCycle?[state.hostStartDeadline,...(state.seats||[]).map(p=>p?.readyDeadline)].filter(t=>t>0):[];
  const stale=active&&now>state.deadline+1200||readyExpires.some(t=>now>t+1200);
  if(stale&&visible()&&!busy&&performance.now()-lastRecovery>=4000){lastRecovery=performance.now();refresh().catch(()=>{});}
 }
 async function act(action,extra={},propagate=false){if(busy)return false;busy=true;actions();message('');try{const d=await api('/api/player/card-table',{method:'POST',body:{action,botLevel:$('[data-ddz-ai]').value,base:state?.base??(['solo','soloRoom','create'].includes(action)?Stakes.read($('[data-ddz-base]').value,$('[data-ddz-custom-base]').value):Stakes.defaultBase),size,...(state?{room:state.id,revision:state.revision,requestId:crypto.randomUUID()}:{}),...extra}});if(Number.isSafeInteger(d.balance))onBalance(d.balance);render(d.room);return true;}catch(e){message(e.message);await refresh().catch(()=>{});if(propagate)throw e;return false;}finally{busy=false;actions();panel.querySelectorAll('.ddz-entry button').forEach(b=>b.disabled=!!state);}}
 const message=text=>$('[data-ddz-message]').textContent=text;
 function refresh(){if(refreshPending)return refreshPending;refreshPending=(async()=>{const d=await api('/api/player/card-table');if(d.botLevel)$('[data-ddz-ai]').value=d.botLevel;if(Number.isSafeInteger(d.balance))onBalance(d.balance);render(d.room);loaded=true;})().finally(()=>{refreshPending=null;});return refreshPending;}
 function openDialog(title,html){$('[data-dialog-title]').textContent=title;$('[data-dialog-body]').innerHTML=html;dialog.showModal();}
 $('[data-ddz-ai]').onchange=()=>act('botLevel',{level:$('[data-ddz-ai]').value});
 $('[data-dialog-close]').onclick=()=>dialog.close();
 panel.addEventListener('click',e=>{
  const c=e.target.closest('[data-card]');if(c){const id=Number(c.dataset.card);selected.has(id)?selected.delete(id):selected.add(id);selection();playSfx('click');return;}
  const mode=e.target.closest('[data-size]');if(mode&&!state){size=Number(mode.dataset.size);render(null);return;}
  const b=e.target.closest('[data-ddz]');if(!b||b.disabled)return;const a=b.dataset.ddz;
  if(a==='clear'){selected.clear();selection();return;}
  if(a==='hint'){const choices=R.moves(state.hand,state.last,state.size);if(!choices.length){message('没有能压过上一手的牌，可以选择不出。');return;}selected=new Set(choices[hintIndex++%choices.length].cards.map(c=>c.id));selection();return;}
  if(a==='rules'){
   const example=(label,values)=>`<figure><figcaption>${label}</figcaption><div>${values.map((val,i)=>card({id:990+i,val,label:val===14?'A':String(val),suit:i%2?'♥':'♠',red:i%2===1})).join('')}</div></figure>`;
   openDialog('牌桌规则',`<h4>人数与发牌</h4><p>三人：一副牌，每人 17 张，太姥拿 3 张底牌。<br>四人：两副牌，每人 25 张，太姥拿 8 张底牌；一位太姥对三位少姥。</p><p>依次叫 1—3 分，最高分做太姥。无人叫分则重新发牌。</p><h4>牌型与大小</h4><p>单张、对子、三张、三带一／二、顺子、连对、飞机及带牌、四带二／两对、炸弹和王炸。</p><div class="ddz-rule-examples">${example('对子',[7,7])}${example('顺子',[3,4,5,6,7])}${example('炸弹',[9,9,9,9])}</div><p>顺子至少 5 张，连对至少 3 对，飞机至少 2 组；连续牌型不含 2 和王。</p><p>飞机单翼可带对子，但不能使用机身点数；对子翅膀为不同点数。</p><p>同牌型同张数比主牌点数。四人炸弹为 4—8 张同点，张数优先；四张王才是王炸。三人王炸为一大一小。</p><h4>胜负与结算</h4><p>任一少姥出完，即少姥方获胜。</p><p>底注可选 1,000、10,000、50,000，或自定义 100 至 1,000,000 的整数，再乘叫分与倍率。<br>每人锁定底注的 10 倍筹码，最低 10,000；未使用部分在结算后释放。<br>太姥承担对手人数份，其他玩家各承担一份。</p><p>超过任一方锁定筹码时，全桌结算单位统一封顶。胜方另获本局总投入的 25% 系统奖金，未使用筹码自动释放。</p><h4>托管与电脑</h4><p>联机 30 秒未操作自动托管；电脑对局不限时，可手动开启托管。电脑不读取其他人的手牌，也不根据输赢调难度。</p><p>先选择人数，再点“开联机房”或“开电脑房”；房间创建后须手动开局，不会自动发牌或续局。联机局末有 60 秒准备时间，房主也需准备；未准备者超时离桌，房主自动移交给其他真人。全员就绪后，房主有 60 秒确认开局。</p><p>手动和托管均正常计算输赢与系统奖金。只有你与电脑同桌时，你的托管与电脑使用相同的已选难度；有其他真人的联机桌使用聪明托管。新规则从下一局生效，已结算结果保持不变。</p>`);return;
  }
  if(a==='leave'&&state.spectating){act('unwatch');return;}
  if(a==='leave'){openDialog('离开牌桌',`<p>${['playing','bidding'].includes(state.phase)?'离开后继续托管，本局输赢仍计入你的余额；锁定筹码在结束后结算，不会自动开启下一局。托管按本局规则正常结算。':'确认离开这张牌桌？'}</p><button data-leave-confirm class="ddz-gold">确认离桌</button>`);$('[data-leave-confirm]').onclick=()=>{dialog.close();act('leave');};return;}
  if(a==='play')act('play',{cards:[...selected]});else if(a==='bid')act('bid',{bid:Number(b.dataset.bid)});else if(a==='fill')act('fillBots');else act(a);
 });
 function visible(){return !!getUser()&&!document.hidden&&!document.getElementById('view-casino').classList.contains('hidden')&&!panel.classList.contains('hidden');}
 async function ensure(){if(!visible()){stream?.close();stream=null;return;}if(uid&&uid!==getUser().id){loaded=false;render(null);}if(!loaded){loaded=true;try{await refresh();}catch(e){loaded=false;message(e.message);return;}}
  if(!stream){stream=new EventSource('/api/player/card-table/stream');stream.onmessage=e=>{const d=JSON.parse(e.data);if(Number.isSafeInteger(d.balance))onBalance(d.balance);render(d.room);$('[data-ddz-link]').textContent='● TABLE CONNECTED';};stream.addEventListener('reaction',e=>reactions.receive(JSON.parse(e.data)));stream.onerror=()=>{$('[data-ddz-link]').textContent='重新连接中…';};}
 }
 const observer=new MutationObserver(ensure);observer.observe(panel,{attributes:true,attributeFilter:['class']});observer.observe(document.getElementById('view-casino'),{attributes:true,attributeFilter:['class']});document.addEventListener('visibilitychange',ensure);
 window.addEventListener('resize',()=>{handRows();selection();});setInterval(()=>{if(visible())clock();},1000);
 render(null);return {ensure,async enter(action,extra){
  if(busy)return false;
  await refresh();if(state?.spectating){await act('unwatch');}if(state)throw Error('请先离开当前牌桌，或选择回到牌桌。');
  return act(action,extra,true);
 }};
};
