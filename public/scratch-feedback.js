window.AVEDScratchFeedback=function({playSfx=()=>{},isActive=()=>true}={}){
 const layers=new Set();
 const paperColors=['#d84b4b','var(--inner-text-main,#d9ceb8)','var(--brand-red,#5279a4)','#a72f3c'];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const animated=()=>isActive()&&!document.hidden&&!reduced.matches&&window.AVEDEffectsEnabled?.()!==false;
 function clear(){window.AVEDScratchBomb?.clear();for(const layer of layers){clearTimeout(layer.cleanupTimer);layer.remove();}layers.clear();}
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
 function positionToast(state){
  const rail=document.getElementById?.('left-sidebar')?.getBoundingClientRect?.();
  const width=typeof innerWidth==='number'?innerWidth:1200;
  const railEnd=rail&&rail.width>0?Math.min(Math.max(0,rail.right),width<768?64:260):0;
  state.el.style?.setProperty?.('--result-left',(railEnd+(width-railEnd)/2)+'px');
  state.el.style?.setProperty?.('--result-width',Math.min(340,width-railEnd-24)+'px');
 }
 function showToast({prize,multiplier,cost=0,penalty=0}){
  let state=window.AVEDScratchToast;
  if(!state){
   const el=document.createElement('section'),bar=document.createElement('div'),caption=document.createElement('span'),close=document.createElement('button'),body=document.createElement('div'),label=document.createElement('div'),amount=document.createElement('div');
   el.className='scratch-award-toast';bar.className='scratch-award-titlebar';caption.className='scratch-award-caption';caption.textContent='A.V.E.D. / RESULT';close.className='scratch-award-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','关闭开奖结果');body.className='scratch-award-body';label.className='scratch-award-label';amount.className='scratch-award-amount';
   el.setAttribute('aria-label','开奖结果');el.setAttribute('data-type-ignore','');label.setAttribute('role','status');label.setAttribute('aria-live','polite');amount.setAttribute('aria-live','polite');
   close.addEventListener('click',()=>{hideToast();clear();});el.addEventListener('keydown',e=>{if(e.key==='Escape'){hideToast();clear();}});
   bar.append(caption);bar.append(close);body.append(label);body.append(amount);el.append(bar);el.append(body);document.body.append(el);state=window.AVEDScratchToast={el,label,amount,close,caption,timer:null};
  }
  clearTimeout(state.timer);
  const category=multiplier>=50?'刮出超级大奖了！':multiplier>=5?'刮出大奖了！':'开奖结果';
  const special=penalty>0||multiplier>=5;
  state.el.dataset.tone='inverse';if(state.caption)state.caption.textContent='A.V.E.D. / RESULT';
  state.el.dataset.outcome=penalty>0?'bomb':'award';state.el.dataset.presentation=special?'special':'ordinary';
  positionToast(state);
  state.label.textContent=!special?'本局收入 ¤ '+Number(prize).toLocaleString():penalty>0?'刮出'+(penalty>=cost*4?'超大炸弹':penalty>=cost*2?'大炸弹':'炸弹')+'了！':category;
  state.amount.textContent=penalty>0?'本局扣除医疗费 ¤ '+Number(penalty).toLocaleString():'本局收入 ¤ '+Number(prize).toLocaleString();state.amount.hidden=!special;state.el.hidden=false;
  state.el.classList.remove('scratch-award-enter');if(animated()){void state.el.offsetWidth;state.el.classList.add('scratch-award-enter');}
  state.timer=setTimeout(()=>{state.el.hidden=true;},penalty>0?3500:multiplier>=10?4000:multiplier>=5?2500:1500);
 }
 function settle(banner,{cost,prize,penalty=0,cells,gameHighlight},mode='manual'){
  if(penalty>0){banner.dataset.scratchFeedback='bomb';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');if(isActive()&&!document.hidden){showToast({cost,prize,penalty,multiplier:0});playSfx('scratch-bomb-'+(1+penalty/cost));const host=document.getElementById('active-ticket-board-container'),bomb=cells?.find(c=>c.isBomb),source=bomb?host?.querySelector?.('[data-revealed-cell="'+bomb.idx+'"] svg')||host?.querySelector?.('[data-revealed-cell="'+bomb.idx+'"]'):host;const rect=source?.getBoundingClientRect?.();window.AVEDScratchBomb?.show({host,cost,penalty,origin:rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:undefined,animated:animated()});}return;}
  banner.dataset.scratchFeedback=prize>cost?'profit':prize>0?'return':'empty';
  banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  banner.classList.remove('scratch-result-arriving');

  const multiplier=cost>0?prize/cost:0;
  if(isActive()&&!document.hidden)window.AVEDPersonalRecord?.show(gameHighlight);
  if(multiplier>=5)banner.dataset.scratchFeedback=multiplier>=50?'supreme':multiplier>=10?'jackpot':'big';
  if(isActive()&&!document.hidden)showToast({prize,multiplier});
  if(isActive()&&!document.hidden){
   if(prize>cost){playSfx(multiplier>=50?'scratch-jackpot-supreme':multiplier>=20?'scratch-jackpot-major':multiplier>=10?'scratch-jackpot':multiplier>=5?'scratch-big':mode==='all'?'scratch-win-all':'scratch-win');burst(multiplier>=100?7:multiplier>=50?6:multiplier>=20?5:multiplier>=10?4:multiplier>=5?3:1);if(multiplier>=10)rain(multiplier);}
   else if(prize===0)playSfx('scratch-zero');
  }
 }
 if(typeof window.addEventListener==='function')window.addEventListener('resize',()=>{if(window.AVEDScratchToast)positionToast(window.AVEDScratchToast);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();hideToast();}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-nav],#scratch-back-lobby-btn')){clear();hideToast();}});
 document.addEventListener('aved-effects-change',()=>{if(!animated())clear();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){clear();hideToast();}});reduced.addEventListener('change',()=>{if(reduced.matches)clear();});
 // Moving to another ticket dismisses ticket-specific UI, not ongoing award particles.
 function nextTicket(){window.AVEDScratchBomb?.clear();hideToast();}
 return {reveal,settle,clear,nextTicket};
};
