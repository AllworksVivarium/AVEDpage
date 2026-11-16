(function(root){
 const pick=items=>items[Math.floor(Math.random()*items.length)];
 function elapsedText(ms){const seconds=Math.max(1,Math.floor(ms/1000));return seconds<60?seconds+' 秒':Math.floor(seconds/60)+' 分 '+seconds%60+' 秒';}
 function createVisits(limit=64){const pages=new Map();let current=null;return {enter(key,now){if(key===current)return null;if(current&&pages.has(current))pages.get(current).left=now;const old=pages.get(key),visit={count:(old?.count||0)+1,left:null};pages.delete(key);pages.set(key,visit);current=key;while(pages.size>limit)pages.delete(pages.keys().next().value);return {count:visit.count,away:old?.left==null?null:now-old.left};},reset(){pages.clear();current=null;}};}
 function pupilOffset(x,y,rect){return {x:Math.max(-7,Math.min(7,(x-rect.left-rect.width/2)/25)),y:Math.max(-4,Math.min(4,(y-rect.top-rect.height/2)/35))};}
 const api={elapsedText,createVisits,pupilOffset};root.AVEDPresence=api;if(!root.document)return;
 const budget=root.AVEDContamination.budget;
 const doc=root.document,visits=createVisits(),effects=new Set(),jobs=new Set();
 const kinds=['typing','tracking','gaze','rename','drain'];let bag=[],timer=0,watch=0,active=false,hiddenAt=null,lastRoute='',quietUntil=0,point={x:root.innerWidth/2,y:root.innerHeight/2};
 const later=(fn,ms)=>{const id=setTimeout(()=>{jobs.delete(id);fn();},ms);jobs.add(id);return id;};
 const allowed=()=>root.AVEDContamination?.enabled()&&root.AVEDEffectsEnabled?.()!==false&&!doc.hidden&&doc.body.classList.contains('theme-inner')&&!root.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>60&&r.top<root.innerHeight&&getComputedStyle(el).visibility!=='hidden'&&(!el.checkVisibility||el.checkVisibility({checkVisibilityCSS:true}));};
 function pane(){const bar=doc.querySelector('.bar-room:not([hidden])');if(bar&&visible(bar))return bar;return [...doc.querySelectorAll('#inner-app-view [id^="view-"]')].find(el=>visible(el))||null;}
 function routeKey(){const p=pane();return root.location.hash+'|'+(p?.id||'')+'|'+(root.history.state?.avedForum?.thread||'');}
 function candidates(selector){const p=pane();return p?[...p.querySelectorAll(selector)].filter(el=>visible(el)&&!el.closest('dialog,button,a,form,[contenteditable],.haunt-label,[data-contamination-exempt],.presence-hidden')):[];}
 function anchor(){return candidates('h1,h2,h3,.section-kicker,.notice-kicker,.bar-brand')[0]||pane();}
 function stop(effect,residue=false){if(!effects.has(effect))return;effects.delete(effect);effect.release?.();effect.animation?.cancel();effect.target?.classList.remove('presence-hidden');if(residue&&effect.el?.textContent)root.AVEDHaunt?.leaveText(effect.el.textContent,effect.el.getBoundingClientRect());effect.el?.remove();}
 function clean(){for(const effect of [...effects])stop(effect);for(const id of jobs)clearTimeout(id);jobs.clear();clearTimeout(timer);clearInterval(watch);timer=watch=0;}
 function portal(target,kind,{replace=false,corner=false,conditional=false}={}){
  if(!target||!conditional&&doc.querySelector('dialog[open]'))return null;
  let effect;const release=budget.acquire(kind==='message'?'whisper':kind,()=>stop(effect),{conditional});if(!release)return null;
  const el=doc.createElement('span');el.className='haunt-transient presence-effect presence-'+kind;el.dataset.contaminationExempt='';el.dataset.typeIgnore='';el.setAttribute('aria-hidden','true');doc.body.append(el);
  effect={el,target,replace,corner,release,conditional,route:routeKey()};effects.add(effect);if(replace)target.classList.add('presence-hidden');position(effect);return effect;
 }
 function position(effect){if(!effect.el)return;if(!effect.target.isConnected||!visible(effect.target)||effect.route!==routeKey()){stop(effect);return;}const r=effect.target.getBoundingClientRect(),eyeWidth=effect.el.classList.contains('presence-tracking')?110:140,width=Math.min(effect.corner?eyeWidth:320,root.innerWidth-32),x=effect.corner?r.right-eyeWidth:r.left,y=effect.corner?r.top+10:effect.replace?r.top:r.bottom+5;
  effect.el.style.left=Math.max(16,Math.min(x,root.innerWidth-width-16))+'px';effect.el.style.top=Math.max(65,Math.min(y,root.innerHeight-55))+'px';effect.el.style.maxWidth=width+'px';
 }
 function message(text,duration=4800,conditional=false){const effect=portal(anchor(),'message',{conditional});if(!effect)return;effect.el.textContent=text;later(()=>stop(effect,true),duration);}
 api.whisper=()=>message(pick(['你在看吗？','我认得你。','这行字是留给你的。','先别移开视线。','你看完了吗？','我就在这里。','还有一个人在看。','现在轮到我看了。']),4500);
 function typing(){const effect=portal(anchor(),'typing');if(!effect)return;const [first,last]=pick([['你身后……','你身后……算了。'],['请告诉我你的名字。','我记起来了。'],['这里只有你。','这里只有你吗？'],['你正在看着屏幕。','我正在看着你。'],['请保持连接。','再陪我一会儿。']]);let at=0;
  effect.el.textContent='另一端正在输入';
  const write=()=>{if(!effects.has(effect))return;if(at<first.length){effect.el.textContent=first.slice(0,++at);later(write,100+Math.random()*170);}else later(erase,1000+Math.random()*900);};
  const erase=()=>{if(!effects.has(effect))return;if(at>0){effect.el.textContent=first.slice(0,--at);later(erase,55+Math.random()*45);}else later(rewrite,600);};
  const rewrite=()=>{if(!effects.has(effect))return;effect.el.textContent=last.slice(0,++at);if(at<last.length)later(rewrite,110+Math.random()*160);else later(()=>stop(effect,true),3500);};later(write,900);
 }
 function rename(){const headings=candidates('h1,h2,.hud-personnel-tag,.section-kicker');const target=headings.find(el=>el.textContent.trim().length<45);if(!target){message(pick(['欢迎回来，旧识。','观察对象，您好。','这次该怎么称呼你？']));return;}const effect=portal(target,'rename',{replace:true});if(!effect)return;const style=getComputedStyle(target);effect.el.style.fontSize=Math.min(26,parseFloat(style.fontSize)||18)+'px';effect.el.textContent=pick(['欢迎回来，旧识。','观察对象，您好。','第六位访问者','仍有响应的那一位','我记得你的名字。','这次，轮到你了。']);later(()=>stop(effect,true),3000+Math.random()*2500);}
 function stippledEye(){
  const dots=[],iris=[],dot=(out,x,y,r,alpha)=>out.push('<circle cx="'+x.toFixed(2)+'" cy="'+y.toFixed(2)+'" r="'+r.toFixed(2)+'" opacity="'+alpha.toFixed(2)+'"/>');
  // Broken eyelid hatching and scattered grains suggest an eye without a solid outline.
  for(let i=0;i<550;i++){
   const x=8+Math.random()*144,t=(x-8)/144,upper=Math.random()<.65,curve=Math.sin(t*Math.PI),spread=Math.random()**2*10;
   const y=40+(upper?-1:1)*(curve*(upper?24:18)+spread)+(Math.random()-.5)*2;
   if(Math.random()<.18||x>125&&Math.random()<.45)continue;
   dot(dots,x,y,.2+Math.random()*.52,.15+Math.random()*.65);
  }
  // Uneven radial fibres surround a partly veiled pupil.
  for(let ray=0;ray<110;ray++){
   const angle=ray/110*Math.PI*2+(Math.random()-.5)*.05,length=13+Math.random()*8;
   for(let radius=8+Math.random()*3;radius<length;radius+=.9+Math.random()*1.3){
    const x=80+Math.cos(angle)*radius,y=39+Math.sin(angle)*radius*.93;
    if(y<22||y>56||Math.random()<.2)continue;
    dot(iris,x,y,.2+Math.random()*.46,.2+Math.random()*.65);
   }
  }
  for(let i=0;i<160;i++){const angle=Math.random()*Math.PI*2,radius=Math.sqrt(Math.random())*7;dot(iris,80+Math.cos(angle)*radius,39+Math.sin(angle)*radius,.3+Math.random()*.45,.45+Math.random()*.45);}
  return '<svg viewBox="0 0 160 80" aria-hidden="true"><g class="presence-lids">'+dots.join('')+'<g class="presence-pupils">'+iris.join('')+'</g></g></svg>';
 }
 function eyes(tracking=false){const targets=candidates('.retro-corner-box,.hud-frame,article,.game-rule-card,.bar-scene,.bar-chat,.bar-brand,h1,h2');const target=pick(targets.length?targets:[anchor()]);const effect=portal(target,tracking?'tracking':'gaze',{corner:true});if(!effect)return;
  effect.el.innerHTML=tracking?'<svg viewBox="0 0 110 44" aria-hidden="true"><g class="presence-lids"><path d="M3 22 Q24 1 45 22 Q24 40 3 22 M64 22 Q85 1 106 22 Q85 40 64 22"/><g class="presence-pupils"><circle cx="24" cy="22" r="5"/><circle cx="85" cy="22" r="5"/></g></g></svg>':stippledEye();
  const look=()=>{if(!effects.has(effect))return;position(effect);if(tracking){const offset=pupilOffset(point.x,point.y,effect.el.getBoundingClientRect());effect.el.style.setProperty('--eye-x',offset.x*1.35+'px');effect.el.style.setProperty('--eye-y',offset.y*1.35+'px');}later(look,60);};look();
  const blink=()=>{if(!effects.has(effect))return;effect.el.classList.add('presence-blink');later(()=>effect.el.classList.remove('presence-blink'),180);later(blink,2300+Math.random()*3500);};later(blink,1700);
  later(()=>{effect.el.classList.add('presence-leaving');later(()=>stop(effect),1000);},tracking?10000+Math.random()*8000:5000+Math.random()*5000);
 }
 function drain(){const targets=candidates('.retro-corner-box,.hud-frame,article,.game-rule-card,.bar-scene,.bar-chat,img').filter(el=>!el.matches('.hud-world-warp')&&!el.querySelector('.presence-hidden')&&el.getBoundingClientRect().height<root.innerHeight*.85);const target=pick(targets);if(!target)return;let effect;const release=budget.acquire('drain',()=>stop(effect));if(!release)return;const base=getComputedStyle(target).filter;const filter=base==='none'?'':base+' ';const animation=target.animate([{filter:filter+'grayscale(0) brightness(1)'},{filter:filter+'grayscale(1) brightness(.78)',offset:.35},{filter:filter+'grayscale(1) brightness(.78)',offset:.65},{filter:filter+'grayscale(0) brightness(1)'}],{duration:22000+Math.random()*14000,easing:'ease-in-out'});effect={target,animation,release,route:routeKey()};effects.add(effect);animation.onfinish=()=>stop(effect);}
 function run(kind){if(!allowed()||doc.querySelector('dialog[open]'))return;if(kind==='typing')typing();else if(kind==='tracking')eyes(true);else if(kind==='gaze')eyes(false);else if(kind==='rename')rename();else if(kind==='drain')drain();else if(kind==='arrival')message(pick(['这次我先到了。','我已经替你看过了。','这里一直给你留着。','进来吧，我在。']),2800);else if(kind==='repeat')message(pick(['又是你。','这一页，你已经看过了。','我们又见面了。']));}
 function schedule(){clearTimeout(timer);timer=later(()=>{if(allowed()&&(budget.bursting||Date.now()>=quietUntil)){if(!bag.length)bag=[...kinds];run(bag.splice(Math.floor(Math.random()*bag.length),1)[0]);}schedule();},budget.bursting?1400+Math.random()*1600:18000+Math.random()*14000);}
 function routeChanged(){if(!allowed())return;const key=routeKey();if(key===lastRoute)return;lastRoute=key;for(const effect of [...effects])stop(effect);const visit=visits.enter(key,Date.now());const expected=key;later(()=>{if(!allowed()||routeKey()!==expected)return;if(visit?.away!=null)message('你离开了 '+elapsedText(visit.away)+'。',4800,true);else if(visit?.count>1)message('我们又见面了。',4800,true);else if(Math.random()<.55)run('arrival');},650);}
 function sync(){if(!allowed()){if(doc.hidden&&active&&hiddenAt===null)hiddenAt=Date.now();clean();active=false;if(!root.AVEDContamination?.enabled()){visits.reset();lastRoute='';hiddenAt=null;}return;}if(active)return;active=true;routeChanged();if(hiddenAt!==null){const away=Date.now()-hiddenAt;hiddenAt=null;later(()=>message('你离开了 '+elapsedText(away)+'。我还在这里。',4800,true),900);}schedule();watch=setInterval(()=>{routeChanged();for(const effect of [...effects]){if(effect.el)position(effect);else if(!effect.target.isConnected||effect.route!==routeKey())stop(effect);}},400);}
 doc.addEventListener('aved-contamination-surge',event=>{if(event.active)quietUntil=0;if(allowed())schedule();});
 doc.addEventListener('visibilitychange',sync);doc.addEventListener('aved-contamination-change',sync);doc.addEventListener('aved-effects-change',sync);
 doc.addEventListener('pointermove',event=>{point={x:event.clientX,y:event.clientY};},{passive:true});doc.addEventListener('pointerdown',event=>{point={x:event.clientX,y:event.clientY};},{passive:true});
 doc.addEventListener('aved-contamination-preview',event=>{if(event.effect==='quiet'){quietUntil=Date.now()+event.duration;return;}if(!event.effect.startsWith('presence-'))return;for(const effect of [...effects])stop(effect);const kind=event.effect.slice(9);if(kind==='away')message('你离开了 17 秒。',4500);else run(kind);});
 new MutationObserver(sync).observe(doc.body,{attributes:true,attributeFilter:['class']});root.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',sync);sync();
})(globalThis);
