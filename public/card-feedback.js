/* Public table cues only. No move, wallet or automatic continuation actions. */
window.AVEDCardFeedbackUI=function({panel,esc,getUser}){
 const $=s=>panel.querySelector(s),felt=$('.ddz-felt');
 const frame=document.createElement('div'),cue=document.createElement('div'),round=document.createElement('section'),result=document.createElement('div');
 frame.className='ddz-hand-frame';frame.hidden=true;frame.innerHTML='<span data-turn-label></span><b data-turn-time></b>';felt.append(frame);
 cue.className='ddz-play-cue';cue.hidden=true;cue.setAttribute('role','status');cue.setAttribute('aria-live','polite');felt.append(cue);
 result.className='ddz-result';result.hidden=true;result.setAttribute('role','status');result.setAttribute('aria-live','polite');felt.append(result);
 const blast=document.createElement('div');blast.className='ddz-blast';blast.hidden=true;blast.setAttribute('aria-hidden','true');felt.append(blast);
 round.className='ddz-round';round.hidden=true;round.setAttribute('aria-label','开局准备');$('.ddz-money').before(round);
 let lastKey='',timer,blastTimer;
 function explode(rocket){
  clearTimeout(blastTimer);blast.hidden=false;blast.dataset.rocket=String(rocket);
  blast.innerHTML='<span class="ddz-blast-core"></span><span class="ddz-blast-wave"></span><span class="ddz-blast-wave second"></span>'+Array.from({length:18},(_,i)=>{
   const angle=i/18*Math.PI*2,reach=85+i%4*31;
   return `<i class="ddz-ember" style="--x:${Math.round(Math.cos(angle)*reach)}px;--y:${Math.round(Math.sin(angle)*reach)}px;--spin:${i*47}deg;--delay:${i%3*30}ms;--size:${3+i%3}px"></i>`;
  }).join('')+Array.from({length:5},(_,i)=>`<i class="ddz-smoke" style="--x:${(i-2)*34}px;--y:${-25-i%3*18}px;--delay:${i*40}ms"></i>`).join('');
  blast.classList.remove('is-new');void blast.offsetWidth;blast.classList.add('is-new');
  blastTimer=setTimeout(()=>{blast.hidden=true;blast.replaceChildren();},1600);
 }
 function anchor(seat,state){
  if(!state.spectating&&seat===state.seat)return $('.ddz-self');
  if(state.spectating&&seat===3)return $('.ddz-self');
  const positions=state.size===4||state.spectating?['right','top','left']:['right','left'];
  const n=state.spectating?seat:(seat-state.seat-1+state.size)%state.size;
  return $(`[data-seat="${positions[n]}"]`);
 }
 function layout(){
  if(frame.hidden)return;const hand=$('.ddz-hand');
  frame.style.top=Math.max(100,hand.offsetTop-30)+'px';frame.style.bottom='43px';
 }
 function clock(text,now){
  $('[data-turn-time]').textContent=text?text+' 秒':'';
  if(!Number.isFinite(now))return;
  round.querySelectorAll('[data-ready-deadline]').forEach(el=>{
   const seconds=Math.max(0,Math.ceil((Number(el.dataset.readyDeadline)-now)/1000));
   el.textContent=seconds+' 秒内'+(el.dataset.readyKind==='start'?'确认开局':'准备');el.classList.toggle('is-urgent',seconds<=10);
  });
 }
 function render(state,previous){
  const active=state&&['bidding','playing'].includes(state.phase),mine=active&&!state.spectating&&state.turn===state.seat;
  const manual=mine&&!state.seats[state.seat]?.auto;
  frame.hidden=!manual;$('[data-turn-label]').textContent=state?.phase==='bidding'?'轮到你叫分':'轮到你出牌';
  panel.dataset.myTurn=String(!!manual);panel.dataset.feedbackMotion=window.AVEDEffectsEnabled?.()===false?'off':'on';
  panel.querySelectorAll('.ddz-actor-tag').forEach(el=>el.remove());
  panel.querySelectorAll('.is-last-play').forEach(el=>el.classList.remove('is-last-play'));
  if(active){const node=anchor(state.turn,state);if(node&&!(mine&&manual)){const tag=document.createElement('span');tag.className='ddz-actor-tag';tag.textContent=(state.phase==='bidding'?'正在叫分':'正在出牌')+(mine&&state.seats[state.seat]?.auto?' · 托管':'');node.append(tag);}}
  const waiting=state&&!state.spectating&&['ended','waiting'].includes(state.phase);
  result.hidden=state?.phase!=='ended';
  if(!result.hidden){
   const won=!state.spectating&&((state.winner==='landlord')===(state.seat===state.landlord)),receipt=state.money?.settlement;
   result.classList.toggle('is-win',won);
   result.innerHTML=`<small>${state.spectating?'ROUND COMPLETE':won?'YOU WIN':'NEXT TIME'}</small><strong>${state.spectating?(state.winner==='landlord'?'太姥获胜':'少姥获胜'):won?'你赢了！':'下次一定……'}</strong>${receipt?`<b class="ddz-result-net">净变化 ${receipt.net>0?'+':''}${receipt.net.toLocaleString()}</b><span>投入 ${receipt.stake.toLocaleString()} · 返还 ${receipt.reward.toLocaleString()}</span>${receipt.autoOnly?'<span>'+ (state.money.rules.autoProfitPolicy==='manual-play-v1'?'旧局规则 · 托管不计正收益':'托管 · 正常结算')+'</span>':''}`:'<span>本局结束</span>'}`;
  }
  round.hidden=!waiting;panel.classList.toggle('ddz-intermission',!!waiting);
  if(waiting)round.after($('[data-ddz-actions]'));else $('.ddz-money').after($('[data-ddz-actions]'));
  if(waiting){
   const host=String(state.host)===String(getUser()?.id),notReady=state.seats.filter(p=>p&&!p.bot&&p.id!==state.host&&!p.ready),empty=state.seats.filter(p=>!p).length;
   const ownReady=state.seats[state.seat]?.ready;
   const instruction=host&&!ownReady?'请先准备，再等待其他玩家就绪后手动开局。':host?notReady.length?`还有 ${notReady.length} 位玩家未准备${empty?'，可先补齐电脑':''}，全部准备后由你手动开局。`:empty?'可等待同事入座，或先“补齐电脑”，再手动确认开局。':'全员就绪，点击下方金色按钮确认开局。':ownReady?'你已准备，等待房主确认开局。':'点击下方准备按钮，再由房主确认开局。';
   round.innerHTML=`<header><small>${state.phase==='ended'?'ROUND COMPLETE':'TABLE READY'}</small><strong>${state.phase==='ended'||state.readyCycle?'本局结束 · 下一局准备':state.mode==='solo'?'电脑房已创建 · 等待开局':'联机房已创建 · 等待入座'}</strong></header><div class="ddz-ready-seats">${state.seats.map(p=>`<span class="${p?.ready?'is-ready':''}">${p?esc(p.name):'空座位'}<b>${!p?'待入座':p.bot?'电脑就绪':(p.id===state.host?'房主 · ':'')+(p.ready?'已准备':'未准备')}</b>${p?.readyDeadline&&!p.ready?`<small class="ddz-ready-clock" data-ready-deadline="${p.readyDeadline}"></small>`:''}</span>`).join('')}</div><p>${instruction} 不会自动续局。</p>${state.readyCycle?'<p>未准备者 60 秒后自动离桌；房主超时会移交给其他真人。</p>':''}${state.hostStartDeadline?`<small class="ddz-ready-clock" data-ready-kind="start" data-ready-deadline="${state.hostStartDeadline}"></small>`:''}`;
  }
  const ev=state?.event,key=state?state.id+':'+(ev?.id||JSON.stringify([ev,state.last?.cards?.map(c=>c.id)])):'';
  const fresh=!!previous&&previous.id===state?.id&&key!==lastKey;
  lastKey=key;
  if(previous?.id!==state?.id||!state||state.phase==='waiting'||state.phase==='ended'&&previous?.phase!=='ended'||state.phase==='bidding'&&previous?.phase==='ended'){clearTimeout(timer);cue.hidden=true;clearTimeout(blastTimer);blast.hidden=true;blast.replaceChildren();}
  if(ev&&ev.seat>=0&&state&&['playing','ended'].includes(state.phase)&&state.seats[ev.seat]){
   const node=anchor(ev.seat,state);if(state.seats[ev.seat].last)node?.classList.add('is-last-play');
   const bomb=['bomb','rocket'].includes(ev.type);
   if(fresh&&(state.phase!=='ended'||bomb)){
    const name=state.seats[ev.seat].name;
    cue.className='ddz-play-cue'+(bomb?' is-bomb':'');cue.hidden=false;
    cue.innerHTML=bomb?`<svg class="ddz-bomb-glyph" viewBox="0 0 32 32" aria-hidden="true"><path fill="#efc66e" d="M19 2h5v3h-3v4h3v3h3v3h2v10h-3v3H9v-3H6V15h3v-3h4V9h6z"/><path fill="#293c2d" d="M12 16h4v4h-4zm8 0h4v4h-4zM14 23h8v2h-8z"/><path fill="#c96d48" d="M25 1h3v3h3v3h-4V4h-2z"/></svg><small>${esc(name)} 出牌</small><strong>${ev.type==='rocket'?'王炸':'炸弹'}</strong><b>当前倍率 ×${state.multiplier}</b>`:`<small>${esc(name)}</small><strong>${esc(ev.text||'出牌')}</strong>`;
    if(bomb&&panel.dataset.feedbackMotion!=='off')explode(ev.type==='rocket');
    // Animate once per public move, never on clock ticks or readiness changes.
    cue.classList.remove('is-new');void cue.offsetWidth;cue.classList.add('is-new');
    clearTimeout(timer);timer=setTimeout(()=>cue.hidden=true,bomb?1900:1350);
   }
  }
  layout();
 }
 window.addEventListener('resize',layout);
 return {render,clock};
};
