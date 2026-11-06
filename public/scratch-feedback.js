window.AVEDScratchFeedback=function({playSfx=()=>{},isActive=()=>true}={}){
 const layers=new Set();
 const paperColors=['#d84b4b','var(--inner-text-main,#d9ceb8)','var(--brand-red,#5279a4)','#a72f3c'];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const animated=()=>isActive()&&!document.hidden&&!reduced.matches&&window.AVEDEffectsEnabled?.()!==false;
 function clear(){for(const layer of layers){clearTimeout(layer.cleanupTimer);layer.remove();}layers.clear();}
 function burst(intensity=1){
  if(!animated())return;
  const layer=document.createElement('div');layer.className='scratch-electronic-confetti';layer.setAttribute('aria-hidden','true');layer.setAttribute('data-type-ignore','');
  for(const side of [-1,1])for(let i=0;i<22*intensity;i++){
   const p=document.createElement('i'),distance=Math.min(innerWidth*.48,540)*(0.25+Math.random()*.75);
   p.className='scratch-electronic-particle';p.style.cssText=`${side<0?'left':'right'}:-8px;--dx:${-side*distance}px;--lift:${-90-Math.random()*180}px;--drop:${innerHeight*.8}px;--spin:${side*(180+Math.random()*540)}deg;--duration:${1200+Math.random()*550}ms;--delay:${Math.random()*90}ms;width:${3+Math.floor(Math.random()*5)}px;height:${3+Math.floor(Math.random()*9)}px;--particle-color:${paperColors[i%paperColors.length]}`;
   p.addEventListener('animationend',()=>p.remove(),{once:true});layer.append(p);
  }
  document.body.append(layer);layers.add(layer);layer.cleanupTimer=setTimeout(()=>{layer.remove();layers.delete(layer);},1950);
 }
 function rain(multiplier){
  if(!animated())return;
  const layer=document.createElement('div');layer.className='scratch-electronic-confetti scratch-rain';layer.setAttribute('aria-hidden','true');layer.setAttribute('data-type-ignore','');
  const count=multiplier>=100?168:multiplier>=50?128:multiplier>=20?96:72;
  for(let i=0;i<count;i++){
   const p=document.createElement('i');p.className='scratch-rain-ribbon';
   p.style.cssText=`left:${Math.random()*100}%;--drift:${-90+Math.random()*180}px;--spin:${180+Math.random()*720}deg;--duration:${2600+Math.random()*900}ms;--delay:${i/count*1700}ms;--particle-color:${paperColors[i%paperColors.length]};width:${3+Math.random()*4}px;height:${12+Math.random()*18}px`;
   p.addEventListener('animationend',()=>p.remove(),{once:true});layer.append(p);
  }
  document.body.append(layer);layers.add(layer);layer.cleanupTimer=setTimeout(()=>{layer.remove();layers.delete(layer);},5400);
 }
 function reveal(board,indices,{profit=false,winning=false}={}){
  for(const [i,index] of indices.entries()){
   const el=board.querySelector('[data-revealed-cell="'+index+'"]');if(!el)continue;
   if(animated()){el.style.setProperty('--reveal-delay','0ms');el.classList.add('scratch-cell-arriving');}
  }
  if(profit&&winning)playSfx('scratch-hit');
 }
 function hideToast(){const state=window.AVEDScratchToast;if(state){clearTimeout(state.timer);state.el.hidden=true;}}
 function showToast({prize,multiplier,record}){
  let state=window.AVEDScratchToast;
  if(!state){const el=document.createElement('div'),label=document.createElement('div'),amount=document.createElement('div');el.className='scratch-award-toast';label.className='scratch-award-label';amount.className='scratch-award-amount';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');el.append(label);el.append(amount);document.body.append(el);state=window.AVEDScratchToast={el,label,amount,timer:null};}
  clearTimeout(state.timer);
  const category=multiplier>=50?'稀有超级大奖':multiplier>=10?'超级大奖':multiplier>=5?'大奖':'开奖结果';
  state.label.textContent=(record?'个人本玩法新纪录':category)+(multiplier>=5?' · '+Number(multiplier.toFixed(2))+' 倍':'');
  state.amount.textContent='本局获得 ¤ '+Number(prize).toLocaleString();state.el.hidden=false;
  state.el.classList.remove('scratch-award-enter');if(animated()){void state.el.offsetWidth;state.el.classList.add('scratch-award-enter');}
  state.timer=setTimeout(()=>{state.el.hidden=true;},record?5000:multiplier>=10?4000:multiplier>=5?2500:1500);
 }
 function settle(banner,{cost,prize,gameHighlight},mode='manual'){
  banner.dataset.scratchFeedback=prize>cost?'profit':prize>0?'return':'empty';
  banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  banner.classList.remove('scratch-result-arriving');

  const record=!!gameHighlight?.personalBest,multiplier=cost>0?prize/cost:0;
  if(record)banner.dataset.scratchFeedback='record';
  else if(multiplier>=5)banner.dataset.scratchFeedback=multiplier>=50?'supreme':multiplier>=10?'jackpot':'big';
  if(isActive()&&!document.hidden)showToast({prize,multiplier,record});
  if(isActive()&&!document.hidden){
   if(record||prize>cost){playSfx(record?'scratch-record':multiplier>=50?'scratch-jackpot-supreme':multiplier>=20?'scratch-jackpot-major':multiplier>=10?'scratch-jackpot':multiplier>=5?'scratch-big':mode==='all'?'scratch-win-all':'scratch-win');burst(Math.max(record?4:1,multiplier>=100?7:multiplier>=50?6:multiplier>=20?5:multiplier>=10?4:multiplier>=5?3:1));if(multiplier>=10)rain(multiplier);}
   else if(prize===0)playSfx('scratch-zero');
  }
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();hideToast();}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-nav],#scratch-back-lobby-btn')){clear();hideToast();}});
 document.addEventListener('aved-effects-change',()=>{if(!animated())clear();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){clear();hideToast();}});reduced.addEventListener('change',()=>{if(reduced.matches)clear();});
 return {reveal,settle,clear};
};
