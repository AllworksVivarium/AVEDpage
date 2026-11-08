(() => {
 const active=new Set(),money=n=>'¤ '+Number(n).toLocaleString('en-US');
 const icon='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><circle cx="29" cy="37" r="19"/><path d="m38 20 6-7 7 6-6 7M47 15c-1-10 9-6 7-13M54 6l5-3m-7 7 7 2M21 29l-3 7"/></svg>';
 function clear(){for(const el of active){clearTimeout(el.timer);el.remove();}active.clear();}
 function show({host,cost,penalty,origin,animated=true}){
  clear();if(!penalty||!animated)return;
  const total=1+penalty/cost,el=document.createElement('div'),rect=host?.getBoundingClientRect?.();
  const x=Number.isFinite(origin?.x)?origin.x:rect?rect.left+rect.width/2:innerWidth/2,y=Number.isFinite(origin?.y)?origin.y:rect?rect.top+rect.height/2:innerHeight/2;
  el.className='scratch-bomb-blast';el.dataset.level=total;el.setAttribute('aria-hidden','true');el.setAttribute('data-type-ignore','');
  const duration=total===5?2600:total===3?2100:1600;el.style.setProperty('--blast-duration',duration+'ms');el.style.setProperty('--origin-x',x+'px');el.style.setProperty('--origin-y',y+'px');
  const core=document.createElement('span');core.className='bomb-fire-core';el.append(core);
  for(let n=0;n<(total===5?3:total===3?2:1);n++){const ring=document.createElement('span');ring.className='bomb-shockwave';ring.style.setProperty('--delay',n*130+'ms');el.append(ring);}
  for(let i=0;i<(total===5?13:total===3?9:6);i++){
   const smoke=document.createElement('span'),angle=Math.PI*2*i/(total===5?13:total===3?9:6),distance=25+Math.random()*total*13;
   smoke.className='bomb-smoke-puff';smoke.style.cssText='--sx:'+Math.cos(angle)*distance+'px;--sy:'+(Math.sin(angle)*distance-35)+'px;--size:'+(55+Math.random()*total*20)+'px;--delay:'+Math.random()*120+'ms';el.append(smoke);
  }
  for(let i=0;i<(total===5?130:total===3?80:48);i++){
   const bit=document.createElement('i'),angle=Math.random()*Math.PI*2,distance=50+Math.random()*Math.min(Math.max(innerWidth,innerHeight),total*150);
   bit.className='bomb-shard'+(i%6===0?' is-coal':'');bit.style.cssText='--x:'+Math.cos(angle)*distance+'px;--y:'+(Math.sin(angle)*distance+50)+'px;--delay:'+Math.random()*180+'ms;--spin:'+(Math.random()-.5)*580+'deg;--size:'+(1+Math.random()*2)+'px;--trail:'+(4+Math.random()*10)+'px';el.append(bit);
  }
  document.body.append(el);active.add(el);el.timer=setTimeout(()=>{el.remove();active.delete(el);},duration+700);
 }
 function sound(ctx,total=2){
  if(!ctx)return;total=Math.min(5,Math.max(2,total));const at=ctx.currentTime;
  // Short warning ticks followed by a low electronic impact; no external audio files.
  for(let i=0;i<2;i++){const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='square';osc.frequency.value=620-i*130;g.gain.setValueAtTime(.0001,at+i*.12);g.gain.linearRampToValueAtTime(.025,at+i*.12+.01);g.gain.exponentialRampToValueAtTime(.0001,at+i*.12+.09);osc.connect(g);g.connect(ctx.destination);osc.onended=()=>{osc.disconnect();g.disconnect();};osc.start(at+i*.12);osc.stop(at+i*.12+.1);}
  const osc=ctx.createOscillator(),g=ctx.createGain(),start=at+.26,duration=.55+total*.07;
  osc.type='sawtooth';osc.frequency.setValueAtTime(115,start);osc.frequency.exponentialRampToValueAtTime(26,start+duration);g.gain.setValueAtTime(.0001,start);g.gain.linearRampToValueAtTime(.065,start+.018);g.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(g);g.connect(ctx.destination);osc.onended=()=>{osc.disconnect();g.disconnect();};osc.start(start);osc.stop(start+duration+.02);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 document.addEventListener('aved-effects-change',clear);
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',clear);
 window.AVEDScratchBomb={show,sound,clear,icon};
})();
