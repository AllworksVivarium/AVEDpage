/* AVED shared flight presentation. Outcomes always come from the server. */
window.AVEDSkyUI=function({api,esc,byId,getUser,onBalance,showToast,playSfx=()=>{},onSettled=()=>{}}){
 const panel=byId('game-panel-skydive');
 // HUD has fixed pixel metrics; exclude it from the prose typography classifier.
 panel.dataset.typeIgnore='';
 panel.innerHTML=`
 <div class="flight-layout"><div class="flight-main"><section class="flight-console">
 <div class="flight-topline"><span id="skydive-flight-no-label">FLIGHT / —</span><span id="flight-phase">BOARDING</span></div>
 <div class="flight-scene" id="flight-scene"><canvas id="flight-pixel-canvas" aria-label="共享架次的直升机、乘员与降落场景"></canvas><div id="flight-nameplates" aria-hidden="true"></div>
 <div class="flight-altimeter" aria-label="本轮共同下降深度"><span>深度<br>METERS</span><div class="flight-tape"><div id="flight-ticks"></div><i id="flight-depth-marker"></i></div><b id="flight-depth-small">100</b></div>
 <div class="flight-readout"><p id="skydive-center-subtitle">等待登机</p><strong id="skydive-center-main-num">—</strong><span id="flight-multiplier">等待同步</span><p id="skydive-center-subinfo">安全线尚未揭晓</p></div>
 <div id="flight-danmaku" class="flight-danmaku" aria-hidden="true"></div><div class="flight-safety" id="flight-safety" hidden><span id="flight-safety-label"></span></div>
 <div id="flight-feedback" class="flight-feedback" role="status" hidden></div><div class="flight-main-button"><button id="skydive-board-btn" type="button" disabled>同步中</button><button id="skydive-open-chute-btn" type="button" hidden disabled>开伞</button></div><div id="flight-result" class="flight-result" role="status"></div></div>

 <p id="flight-last-result" class="flight-last-result"></p></section>
 <form id="skydive-quick-chat-form" class="flight-quick-chat"><input id="skydive-quick-chat-input" type="text" required maxlength="500" placeholder="机舱里聊两句…" aria-label="快捷无线电消息"><button type="submit">发送</button></form><section class="flight-protocol game-rule-card" aria-labelledby="flight-rules-title"><h4 id="flight-rules-title">— 飞行规程</h4><dl class="flight-rule-grid"><div><dt>登机</dt><dd>每班开放 <span id="flight-current-wait">12</span> 秒登机；关舱后全员开始自由落体。</dd></div><div><dt>开伞</dt><dd>在触及安全线前开伞，一班只能开一次；开伞后锁定结果。</dd></div><div><dt>赔付</dt><dd id="flight-curve-description">越晚开伞，倍率越高，也越容易坠落。过早开伞可能亏损；显示倍率包含本金。</dd></div><div><dt>安全线</dt><dd>每班独立随机，事先隐藏，到达时才揭晓；尚未开伞者坠落，返还为零。</dd></div></dl></section></div><aside class="flight-sidebar"><section class="flight-stake-panel"><h3>登机投入</h3> <div class="flight-action"><div class="flight-controls"><div class="flight-bet"><label for="skydive-bet-input">登机投入</label><span class="flight-bet-row"><input id="skydive-bet-input" type="number" min="100" max="300000" step="1" value="10000" inputmode="numeric"><button id="flight-double" class="flight-bet-multiplier" type="button" aria-label="投入乘二">×2</button><button id="flight-quintuple" class="flight-bet-multiplier" type="button" aria-label="投入乘五">×5</button></span></div></div><div class="flight-action-meta"><span id="skydive-bottom-left-hint">正在读取架次</span></div></div></section>
 <section class="flight-manifest"><div class="flight-section-heading"><div><span class="section-kicker">PASSENGER MANIFEST</span><h3 id="skydive-passenger-stats">本班乘员</h3></div></div><div id="skydive-passengers-list"></div></section><section class="flight-radio"><div class="flight-section-heading"><div><span class="section-kicker">LIVE RADIO</span><h3>空中无线电</h3></div><span class="flight-live-dot">● LIVE</span></div><p class="flight-radio-note">发送到这里，也会飘过左侧天空。</p><div id="skydive-chat-list" role="log" aria-label="机舱聊天记录"></div><form id="skydive-chat-form"><input id="skydive-chat-input" type="text" required maxlength="500" placeholder="说点什么，让全机舱听见…" aria-label="无线电消息"><button type="submit" aria-label="发送弹幕">发送 ↗</button></form><div class="flight-radio-tools"><button type="button" id="flight-danmaku-toggle" aria-pressed="true">弹幕 开</button></div></section></aside></div>
`;
 let state=null,source=null,active=false,connected=false,receivedAt=0,lastPoll=0,polling=false,clockOffset=null,bestRtt=Infinity,raf=0,lastFrame=0,lastSignature='',danmakuOn=true;
 const opening=window.AVEDSkyUI.createOpening();let jumpRequest=null;
 const serverNow=(t=performance.now())=>Math.min(clockOffset==null?state.serverTime+t-receivedAt:t+clockOffset,state.serverTime+2500);
 let radioSeen=new Set(),radioStarted=false,queue=[],laneFree=[0,0,0],bullets=new Set();
 const textValues=new WeakMap();
 const setText=(el,value)=>{value=String(value);if(textValues.get(el)!==value){el.textContent=value;textValues.set(el,value);}};
 // Hard-edged 12px glyphs enlarged with nearest-neighbor sampling; no full font download.
 const pixelLabels=new Map();
 function pixelLabel(value){if(pixelLabels.has(value))return pixelLabels.get(value);const glyph=document.createElement('canvas');glyph.width=value.length*12;glyph.height=14;const ctx=glyph.getContext('2d');ctx.font='12px sans-serif';ctx.fillStyle='#fff';ctx.textBaseline='top';[...value].forEach((ch,i)=>ctx.fillText(ch,i*12,0));const pixels=ctx.getImageData(0,0,glyph.width,glyph.height);for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>=110?255:0;ctx.putImageData(pixels,0,0);const url=glyph.toDataURL();pixelLabels.set(value,url);return url;}
 function controlText(el,value){if(el.dataset.pixelText===value&&el.querySelector('.flight-pixel-label'))return;el.dataset.pixelText=value;el.setAttribute('aria-label',value);el.textContent='';const label=document.createElement('span');label.className='flight-pixel-label';label.setAttribute('aria-hidden','true');label.style.width=(value.length*14)+'px';label.style.setProperty('--pixel-label','url("'+pixelLabel(value)+'")');el.append(label);}
 let feedbackTimer;
 function feedback(value){const el=byId('flight-feedback');controlText(el,value);el.hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{el.hidden=true;},1400);}
 const money=n=>'¤ '+Number(n).toLocaleString(),motion=()=>window.AVEDEffectsEnabled?.()!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const visible=()=>!!getUser()&&!document.hidden&&!byId('view-casino').classList.contains('hidden')&&!panel.classList.contains('hidden');
 const avatar=p=>p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:'<small class="avatar-noinfo">NOINFO</small>';
 const resultText=p=>window.AVEDGameResults?AVEDGameResults.text({...p,cancelled:p.status==='cancelled'}):'返还 '+money(p.prize);
 const scene=window.AVEDSkyScene(byId('flight-pixel-canvas'),byId('flight-nameplates'));
 const ticks=Array.from({length:11},()=>{const el=document.createElement('span');byId('flight-ticks').append(el);return el;});
 let soundRound=0,soundSelf=null,landingSound=false,lastWind=0;
 function sounds(next){const self=next.self;if(soundRound!==next.round){soundRound=next.round;soundSelf=self?.status;landingSound=next.phase==='LANDING';return;}if(visible()&&soundSelf==='aboard'&&self?.status==='landed'){if(!opening.pending(next.round,Number(getUser()?.id)))playSfx('sky-open');feedback('已开伞');}soundSelf=self?.status;}
 function statusText(p){return p.status==='aboard'?(state.phase==='BOARDING'?'机舱就座':'自由落体'):p.status==='landed'?'已开伞 · '+p.depth+' m':p.status==='cancelled'?'撤班退回':'坠落 · '+p.depth+' m';}
 function radio(items){if(!radioStarted){items.forEach(x=>radioSeen.add(x.id));radioStarted=true;return;}for(const x of items){if(radioSeen.has(x.id))continue;radioSeen.add(x.id);if(visible()&&danmakuOn)queue.push(x);}queue=queue.slice(-24);if(radioSeen.size>600)radioSeen=new Set(items.map(x=>x.id));}
 function paintRadio(t){if(!danmakuOn||!queue.length)return;const lane=laneFree.findIndex(at=>t>=at);if(lane<0)return;
  const x=queue.shift(),el=document.createElement('span');el.className='flight-radio-bullet';el.textContent=x.alias+'：'+x.body.slice(0,90)+(x.body.length>90?'…':'');el.style.top=(18+lane*29)+'px';el.dataset.messageId=x.id;
  const moving=motion();el.classList.toggle('is-static',!moving);byId('flight-danmaku').append(el);bullets.add(el);laneFree[lane]=t+(moving?Math.max(2700,Math.min(6000,el.offsetWidth*19)):4500);setTimeout(()=>{el.remove();bullets.delete(el);},moving?10000:4500);
 }
 function render(next){
  if(!getUser()||state&&(next.round<state.round||next.round===state.round&&next.serverTime<state.serverTime))return;
  if(next.phase==='LANDING'&&next.self?.status==='landed'&&(state?.round!==next.round||state?.phase!=='LANDING'))onSettled();
  if(state?.round!==next.round){lastSignature='';scene.reset();}sounds(next);opening.observe(next,Number(getUser()?.id));state=next;receivedAt=performance.now();if(getUser()?.balance!==next.balance)onBalance(next.balance);
  setText(byId('skydive-flight-no-label'),'FLIGHT / '+String(next.round).padStart(5,'0'));setText(byId('flight-phase'),({BOARDING:'登机中 / BOARDING',DROPPING:'自由落体 / FREEFALL',LANDING:'安全线已揭晓 / REVEALED'})[next.phase]);
  setText(byId('flight-current-wait'),next.boardingSeconds);
  const sig=JSON.stringify([next.phase,next.passengers]);if(sig!==lastSignature){lastSignature=sig;setText(byId('skydive-passenger-stats'),`本班 ${next.passengers.length} 人 · ${next.passengers.filter(p=>p.status==='landed').length} 人开伞`);
   byId('skydive-passengers-list').innerHTML=next.passengers.map(p=>`<article class="flight-passenger ${p.id===Number(getUser()?.id)?'is-self':''}" data-passenger="${p.id}" data-status="${p.status}"><div class="flight-avatar">${avatar(p)}</div><div><b>${esc(p.alias||'员工')}${p.id===Number(getUser()?.id)?' <em>你</em>':''}</b><small>${statusText(p)}</small></div><strong>${p.status==='aboard'?money(p.cost):esc(resultText(p))}</strong></article>`).join('')||'<p class="flight-empty">机舱还很安静。<br>登机后，你的头像会出现在座位上。</p>';
  }
  if(visible()&&next.self?.status==='landed')window.AVEDPersonalRecord?.show(next.gameHighlight);
  const prev=next.previous;setText(byId('flight-last-result'),prev?'上一班 #'+prev.round+' · 安全线 '+prev.safetyLine+' m'+(prev.self?' · '+resultText(prev.self):''):'');
  byId('flight-safety').hidden=next.safetyLine==null;setText(byId('flight-safety-label'),next.safetyLine==null?'':'安全线 '+next.safetyLine+' m / LIMIT');panel.dataset.flightPhase=next.phase;panel.dataset.instantCrash=String(next.phase==='LANDING'&&next.revealedAt-next.departAt<1200);schedule();
 }
 function paint(){raf=0;if(!active||!visible())return;const t=performance.now();if(motion()&&t-lastFrame<32){schedule();return;}lastFrame=t;if(!state){scene.preview();return;}const age=t-receivedAt,fresh=age<3000;
  const now=serverNow(t),d=state.phase==='DROPPING'?Math.min(2000,100+Math.max(0,now-state.departAt)*state.speed/1000):state.depth,boarding=state.phase==='BOARDING',self=state.self,openingPending=opening.pending(state.round,Number(getUser()?.id));
  setText(byId('skydive-center-main-num'),boarding?Math.max(0,(state.departAt-now)/1000).toFixed(1)+' s':Math.floor(d)+' m');setText(byId('flight-depth-small'),Math.floor(d));ticks.forEach((el,i)=>{const value=(Math.floor(d/50)-5+i)*50;el.hidden=value<100;setText(el,value);el.style.top=(50+(value-d)*.25)+'%';});
  const currentMultiplier=window.AVEDSkyRules.multiplier(self?.status==='landed'?self.depth:d,state.payoutRules||state);
  setText(byId('flight-multiplier'),openingPending?'开伞确认中':boarding?'等待舱门开启':self?.status==='landed'?'已锁定 '+currentMultiplier.toFixed(2)+' ×':state.phase==='LANDING'?'安全线已揭晓':currentMultiplier>0?'返还 '+currentMultiplier.toFixed(2)+' ×':'等待结算');
  setText(byId('skydive-center-subtitle'),boarding?'舱门关闭倒计时':state.phase==='LANDING'?'本班安全线已揭晓':'共同下降深度 / DESCENT');setText(byId('skydive-center-subinfo'),state.phase==='LANDING'?'':'随机安全线 · 尚未揭晓');
  const board=byId('skydive-board-btn'),jump=byId('skydive-open-chute-btn');board.hidden=!boarding;jump.hidden=boarding;board.disabled=!fresh||!!self||!!board.dataset.busy;controlText(board,!fresh?'同步中':self?'已登机':board.dataset.busy?'登机中':'登机');
  jump.disabled=openingPending||!fresh||state.phase!=='DROPPING'||self?.status!=='aboard'||!!jump.dataset.busy;controlText(jump,!fresh?'同步中':openingPending||jump.dataset.busy?'开伞中':!self?'旁观中':self.status==='landed'?'已开伞':self.status==='crashed'?'已坠落':'开伞');byId('skydive-bet-input').disabled=!!board.dataset.busy;for(const id of ['flight-double','flight-quintuple'])byId(id).disabled=byId('skydive-bet-input').disabled;
  setText(byId('skydive-bottom-left-hint'),!fresh?'信号中断，正在重接':self?'本班锁定 '+money(self.cost)+' · 可预设下班金额':'金额可随时调整，登机时生效 · 最低 100');
  const elapsed=state.revealedAt==null?0:now-state.revealedAt,result=byId('flight-result');result.hidden=state.phase!=='LANDING'||elapsed<(state.revealedAt-state.departAt<1200?250:2200);setText(result,self?(self.status==='crashed'?(state.revealedAt-state.departAt<1200?'刚出舱就坠落 · 本班返还 ¤ 0':'坠落 · 本班返还 ¤ 0'):self.status==='landed'?'开伞成功 · '+resultText(self):'本班结束'):'安全线 '+state.safetyLine+' m · 等待乘员落地');
  if(fresh&&visible()){if(self?.status==='landed'&&state.phase==='DROPPING'&&t-lastWind>4000){playSfx('sky-wind');lastWind=t;}if(state.phase==='LANDING'&&!landingSound&&elapsed>=(self?.status==='landed'?window.AVEDSkyScene.landingDelay(state,self):650)){landingSound=true;if(self)playSfx(self.status==='landed'?'sky-land':'sky-crash');}}
  scene.paint(opening.view(state,Number(getUser()?.id)),now,d,motion(),Number(getUser()?.id));paintRadio(t);schedule();
 }
 function jump(){
  if(jumpRequest)return jumpRequest;
  const owner=Number(getUser()?.id),t=performance.now();
  if(!state||t-receivedAt>=3000||!opening.begin(state,owner,serverNow(t)))throw Error('架次状态已变化，请等待同步后再开伞。');
  // Predict only this player's canopy. No client time, depth, prize or balance is submitted.
  playSfx('sky-open');feedback('开伞中');controlText(byId('skydive-open-chute-btn'),'开伞中');
  const now=serverNow(t);scene.paint(opening.view(state,owner),now,100+Math.max(0,now-state.departAt)*state.speed/1000,motion(),owner);schedule();
  const round=state.round;
  jumpRequest=(async()=>{try{
   const next=await api('/api/player/games/sky/jump',{method:'POST',body:{round},timeoutMs:8000,retries:0});
   if(Number(getUser()?.id)!==owner)throw Error('账号已切换，请查看当前架次。');
   return next;
  }catch(error){
   if(Number(getUser()?.id)===owner){
    feedback('正在同步');
    // A lost response may still have committed. Read it back; never repeat a monetary command.
    try{const next=await api('/api/player/games/sky/current',{timeoutMs:3000,retries:0});if(Number(getUser()?.id)===owner){render(next);opening.clear();}}catch{opening.clear();}
   }else opening.clear();
   throw error;
  }finally{jumpRequest=null;}})();return jumpRequest;
 }
 function schedule(){if(active&&!raf)raf=motion()?requestAnimationFrame(paint):setTimeout(paint,100);}
 async function poll(){if(!visible()||polling)return;polling=true;lastPoll=performance.now();try{const sent=performance.now(),next=await api('/api/player/games/sky/current'),arrived=performance.now(),rtt=arrived-sent;if(rtt<=bestRtt*1.5+20){bestRtt=Math.min(bestRtt,rtt);clockOffset=next.serverTime+rtt/2-arrived;}render(next);}catch{}finally{polling=false;}}
 function ensure(){active=visible();if(!active){source?.close();source=null;connected=false;queue=[];for(const b of bullets)b.remove();bullets.clear();return;}schedule();if(!source){source=new EventSource('/api/player/games/sky/stream');source.onopen=()=>{connected=true;};source.onmessage=e=>{lastPoll=performance.now();try{render(JSON.parse(e.data));}catch(error){console.warn('Flight update:',error);}};source.onerror=()=>{connected=false;};}if(clockOffset==null||performance.now()-lastPoll>(connected?15000:5000))poll();}
 for(const [id,factor] of [['flight-double',2],['flight-quintuple',5]])byId(id).onclick=()=>{const input=byId('skydive-bet-input');if(input.disabled)return;try{const result=window.AVEDSkyUI.scaleBet(input.value,factor);input.value=String(result.value);input.dispatchEvent(new Event('input',{bubbles:true}));if(result.capped)showToast('登机投入上限为 300,000');}catch(error){showToast(error.message);}};
 byId('flight-danmaku-toggle').onclick=e=>{danmakuOn=!danmakuOn;e.currentTarget.textContent='弹幕 '+(danmakuOn?'开':'关');e.currentTarget.setAttribute('aria-pressed',String(danmakuOn));if(!danmakuOn){queue=[];for(const b of bullets)b.remove();bullets.clear();}};
 // React immediately when the existing panel becomes visible; no polling delay before first paint.
 new MutationObserver(ensure).observe(panel,{attributes:true,attributeFilter:['class']});
 new MutationObserver(ensure).observe(byId('view-casino'),{attributes:true,attributeFilter:['class']});
 new ResizeObserver(()=>{if(visible()){if(!state)scene.preview();ensure();}}).observe(byId('flight-scene'));
 setInterval(ensure,1000);document.addEventListener('visibilitychange',ensure);return {render,poll,ensure,radio,feedback,jump,round:()=>state?.round};
};

// Draft amounts only; this never places a bet or changes an existing passenger's cost.
window.AVEDSkyUI.scaleBet=function(value,factor){
 const amount=Number(value);
 if(!Number.isSafeInteger(amount)||amount<100)throw new Error('请输入至少 100 的整数金额');
 if(![2,5].includes(factor))throw new Error('不支持的金额倍数');
 return {value:Math.min(300000,amount*factor),capped:amount*factor>300000};
};

// Presentation prediction is isolated from the authoritative snapshot and wallet.
window.AVEDSkyUI.createOpening=function(){
 let intent=null;
 const pending=(round,owner)=>!!intent&&intent.round===round&&intent.owner===owner;
 return {pending,clear(){intent=null;},
  begin(state,owner,now){if(intent||!owner||state?.phase!=='DROPPING'||state.self?.id!==owner||state.self.status!=='aboard'||!Number.isFinite(now)||now<state.departAt)return false;intent={round:state.round,owner,at:now,depth:Math.min(2000,Math.floor(100+(now-state.departAt)*state.speed/1000))};return true;},
  observe(state,owner){if(intent&&(!pending(state.round,owner)||state.phase!=='DROPPING'||state.self?.status!=='aboard'))intent=null;},
  view(state,owner){if(!pending(state.round,owner)||state.phase!=='DROPPING'||state.self?.status!=='aboard')return state;const self={...state.self,status:'landed',depth:intent.depth,settledAt:intent.at};return {...state,self,passengers:state.passengers.map(p=>p.id===owner?self:p)};}
 };
};
