/* Decorative reels only. The server response supplies every final symbol and payout. */
window.AVEDSlotEffects=function({panel,grid,playSfx=()=>{}}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),symbols=['eye','rad','lock','file','dna','pill'];
 const visible=()=>!document.hidden&&!panel.classList.contains('hidden')&&!document.getElementById('view-casino').classList.contains('hidden');
 const motion=()=>visible()&&!reduced.matches&&window.AVEDEffectsEnabled?.()!==false;
 let run=null,award=null,awardTimer=null;
 const icon=id=>window.AVEDPixelIcons.render(id);
 function cancel(){if(!run)return;run.active=false;for(const task of run.tasks){clearTimeout(task.id);task.resolve();}run.tasks.clear();run.overlay?.remove();for(const [el,disabled]of run.controls)el.disabled=disabled;grid.classList.remove('slot-is-spinning');grid.removeAttribute('aria-busy');run=null;}
 function clearAward(){clearTimeout(awardTimer);award?.remove();award=null;if(panel.classList.contains('slot-power-up')||panel.classList.contains('slot-overloaded'))panel.classList.remove('slot-power-up','slot-overloaded');}
 function start(){
  cancel();clearAward();const current={active:true,started:performance.now(),tasks:new Set(),controls:[],overlay:null};run=current;
  for(const el of panel.querySelectorAll('input,[data-slot-chip],#slot5x3-minus-btn,#slot5x3-plus-btn,#slot5x3-double-btn')){current.controls.push([el,el.disabled]);el.disabled=true;}
  grid.setAttribute('aria-busy','true');
  if(!motion())return;
  const rect=grid.getBoundingClientRect(),gap=parseFloat(getComputedStyle(grid).rowGap)||8;
  const overlay=document.createElement('div');overlay.className='slot-reel-overlay';overlay.setAttribute('aria-hidden','true');overlay.style.setProperty('--reel-cell',Math.max(40,(rect.height-gap*2)/3)+'px');overlay.style.setProperty('--reel-gap',gap+'px');
  for(let c=0;c<5;c++){
   const reel=document.createElement('div');reel.className='slot-reel-window';
   const offset=Math.floor(Math.random()*symbols.length),sequence=Array.from({length:6},(_,i)=>symbols[(i+offset+c)%symbols.length]);
   reel.innerHTML='<div class="slot-moving-strip">'+[...sequence,...sequence].map(id=>'<div class="slot-roll-symbol">'+icon(id)+'</div>').join('')+'</div>';
   reel.style.setProperty('--reel-speed',(430+c*37)+'ms');overlay.append(reel);
  }
  current.overlay=overlay;grid.append(overlay);grid.classList.add('slot-is-spinning');playSfx('click');
 }
 function wait(current,ms){return new Promise(resolve=>{const task={resolve,id:null};task.id=setTimeout(()=>{current.tasks.delete(task);resolve();},Math.max(0,ms));current.tasks.add(task);});}
 async function finish(result){
  const current=run;if(!current)return false;
  if(motion()&&current.overlay){
   await Promise.all([...current.overlay.children].map(async(reel,c)=>{
    await wait(current,Math.max(0,850-(performance.now()-current.started))+c*210);
    if(!current.active)return;
    reel.innerHTML='<div class="slot-stopped-strip">'+result.result.board.map(row=>'<div class="slot-roll-symbol">'+icon(row[c].id)+'</div>').join('')+'</div>';
    reel.classList.add('is-stopped');playSfx('click');
   }));
   if(current.active)await wait(current,240);
  }
  const completed=current.active&&visible();if(run===current)cancel();return completed;
 }
 function show(result){
  if(!visible())return;clearAward();
  const {cost,prize,penalty=0}=result,profit=prize>cost+penalty,multiplier=cost?prize/cost:0;
  const tier=penalty?'overload':!profit?'return':multiplier>=50?'supreme':multiplier>=10?'jackpot':multiplier>=5?'big':'profit';
  const titles={overload:'回路过载',return:'本局返还',profit:'回路接通',big:'组合大奖',jackpot:'能量爆发',supreme:'极限大奖'};
  const layer=document.createElement('section');layer.className='slot-award-layer';layer.dataset.tier=tier;layer.setAttribute('data-type-ignore','');
  layer.innerHTML='<div class="slot-award-card" role="status" aria-live="polite"><small>ANOMALY CIRCUIT / RESULT</small><strong>'+titles[tier]+'</strong><b>¤ '+Number(prize).toLocaleString()+'</b>'+(penalty?'<span>额外维修费 ¤ '+penalty.toLocaleString()+'</span>':'')+'<button type="button" aria-label="关闭回路结果">×</button></div>';
  layer.querySelector('button').onclick=clearAward;
  if(motion()&&(profit||penalty)){
   const count=penalty?20:multiplier>=50?100:multiplier>=10?76:multiplier>=5?52:28;
   for(let i=0;i<count;i++){const particle=document.createElement('i');particle.className='slot-energy-pixel';const angle=i/count*Math.PI*2,distance=(70+Math.random()*180)*(multiplier>=10?1.3:1);particle.style.cssText=`--px:${Math.cos(angle)*distance}px;--py:${Math.sin(angle)*distance}px;--delay:${Math.random()*450}ms;--color:${penalty?'#eb8875':['#eec66e','#fff4c8','#8ad5ce'][i%3]}`;layer.append(particle);}
   panel.classList.add(penalty?'slot-overloaded':'slot-power-up');
  }
  if(penalty)playSfx('scratch-bomb-3');else if(profit)playSfx(multiplier>=50?'scratch-jackpot-supreme':multiplier>=10?'scratch-jackpot':multiplier>=5?'scratch-big':'scratch-win');
  panel.querySelector('.slot-machine').append(layer);award=layer;awardTimer=setTimeout(clearAward,penalty?3400:multiplier>=10?5000:profit?3200:1800);
 }
 function check(){if(!visible()){cancel();clearAward();}else if(!motion())cancel();}
 document.addEventListener('visibilitychange',check);document.addEventListener('aved-effects-change',check);reduced.addEventListener('change',check);
 new MutationObserver(check).observe(panel,{attributes:true,attributeFilter:['class']});
 new MutationObserver(check).observe(document.getElementById('view-casino'),{attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')clearAward();});
 return {start,finish,cancel,show};
};
