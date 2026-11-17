(function(root){
 const budget=root.AVEDContamination.budget,leases=new Map();
 const doc=root.document,copy=root.AVEDContamination.copy;
 const containment=()=>doc.body.classList.contains('containment-access');
 let phraseBag=[],phraseSource=null,lastPhrase='',lastPortraitStyle=-1,lastScribbleAt=0;
 const messages=root.AVEDContamination.copy.apparitions;
 let timer=0,nextPopup=Date.now()+45000+Math.random()*60000,quietUntil=0,lastInput=Date.now(),route=root.location.hash,lastRouteAt=0,active=false,previewIndex=0;const transients=new Set(),labels=new Map(),portraitOwners=new Map(),path=[],jobs=new Set();
 const later=(fn,ms)=>{const id=setTimeout(()=>{jobs.delete(id);fn();},ms);jobs.add(id);return id;};
 const random=items=>items[Math.floor(Math.random()*items.length)];
 function nextPhrase(){const phrases=containment()?copy.containmentWhisper:copy.whisper;if(phraseSource!==phrases){phraseSource=phrases;phraseBag=[];}if(!phraseBag.length)phraseBag=phrases.filter(text=>text!==lastPhrase);const index=Math.floor(Math.random()*phraseBag.length);lastPhrase=phraseBag.splice(index,1)[0];return lastPhrase;}
 function messagePool(kind){if(containment()){if(kind==='purchase')return copy.containmentPurchase;if(kind==='route')return copy.containmentRoute;}return messages[kind]||messages.route;}
 function titleFor(text){const titles=['收到讯息','连接成功','我在看。'];if(/我们|我|你在看|屏幕前|不应该|真的要|欢迎回来|无处可逃/.test(text))titles.push('嘘……');return random(titles);}
 let encounterUntil=0,encounterRates={};
 function encounter(kind){const now=Date.now();if(now>=encounterUntil){const quiet=Math.random()<.38;encounterUntil=now+45000+Math.random()*135000;encounterRates={route:quiet?.015+Math.random()*.045:.12+Math.random()*.48,refresh:quiet?.02+Math.random()*.05:.15+Math.random()*.5,idle:quiet?.03+Math.random()*.07:.2+Math.random()*.55};}return Math.random()<encounterRates[kind];}

 const allowed=()=>root.AVEDContamination?.enabled()&&!doc.hidden&&!root.matchMedia('(prefers-reduced-motion: reduce)').matches&&doc.body.classList.contains('theme-inner');
 const visible=el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().bottom>0&&el.getBoundingClientRect().top<root.innerHeight&&(!el.checkVisibility||el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
 const portraitPage=()=>root.location.hash==='#/profile'&&!doc.body.classList.contains('bar-room-open')&&!doc.querySelector('#inner-app-view')?.inert&&!doc.querySelector('#view-profile')?.classList.contains('hidden');
 function transient(className,text,rect,onStop){const el=doc.createElement('span');el.className='haunt-transient '+className;el.setAttribute('aria-hidden','true');el.textContent=text;el.style.left=Math.max(12,Math.min(rect.left,root.innerWidth-100))+'px';el.style.top=Math.max(12,Math.min(rect.top,root.innerHeight-50))+'px';el.style.maxWidth=Math.min(rect.width||320,root.innerWidth-24)+'px';const release=budget.acquire(className==='haunt-label-clear'?'whisper':'residue',onStop||(()=>remove(el)));if(!release)return null;leases.set(el,release);doc.body.append(el);transients.add(el);return el;}
 function remove(el){leases.get(el)?.();leases.delete(el);const owner=portraitOwners.get(el);if(owner){owner.classList.remove('haunt-portrait-active');portraitOwners.delete(el);}el.remove();transients.delete(el);}
 function positionPortrait(layer,avatar){
  if(!portraitPage()||!allowed()||!avatar.isConnected||!visible(avatar)){remove(layer);return;}
  const rect=avatar.getBoundingClientRect(),scribble=layer.dataset.kind==='scribble';
  Object.assign(layer.style,{left:(rect.left-(scribble?rect.width*.3:6))+'px',top:(rect.top-(scribble?rect.height*.25:3))+'px',width:(scribble?rect.width*2:rect.width+12)+'px',height:(scribble?rect.height*2:rect.height+6)+'px'});
 }
 function trackPortrait(layer,avatar){if(!layer.isConnected)return;positionPortrait(layer,avatar);if(layer.isConnected)later(()=>trackPortrait(layer,avatar),150);}
 function portrait(kind,force=false){
  if(!allowed()||!portraitPage()||doc.querySelector('dialog[open]'))return;
  const avatar=doc.querySelector('#view-profile .hud-avatar');if(!avatar||!visible(avatar))return;
  const previous=[...portraitOwners].find(([,owner])=>owner===avatar);if(previous){if(!force)return;remove(previous[0]);}
  kind=kind||random(['mask','mask','mask','mask','scribble']);if(kind==='scribble'&&!force&&Date.now()-lastScribbleAt<120000)return;
  const layer=doc.createElement('span');layer.className='haunt-portrait-mark';layer.dataset.contaminationExempt='';layer.setAttribute('aria-hidden','true');layer.dataset.kind=kind;const release=budget.acquire('portrait-'+kind,()=>remove(layer));if(!release)return;leases.set(layer,release);
  layer.style.setProperty('--portrait-tilt',(Math.random()-.5)*5+'deg');
  let drawing='',duration;const jitter=range=>(Math.random()-.5)*range;
  if(kind==='mask'){
   const draw=Math.random(),count=draw<.4?1:draw<.85?2:3,bars=[];layer.dataset.bars=String(count);
   for(let n=0;n<count;n++){
    const y=Math.random()<.8?52+Math.random()*50:30+Math.random()*105,h=10+Math.random()*17,placement=Math.random();
    const left=placement<.35?-27+Math.random()*38:placement<.7?65+Math.random()*83:20+Math.random()*80;
    const right=placement<.35?80+Math.random()*130:placement<.7?239+Math.random()*32:Math.min(259,left+75+Math.random()*100);
    const width=right-left,d='M '+left+' '+y+' L '+(left+width*.24)+' '+(y+jitter(3))+' L '+(left+width*.65)+' '+(y+jitter(4))+' L '+right+' '+(y+jitter(3))+' L '+(right-2)+' '+(y+h*.5)+' L '+(right+1)+' '+(y+h)+' L '+(left+width*.4)+' '+(y+h+jitter(3))+' L '+(left-1)+' '+(y+h)+' Z';
    bars.push('<g class="haunt-censor-float" style="--bar-float-x:'+jitter(5)+'px;--bar-float-y:'+jitter(3)+'px;--bar-drift:'+(2800+Math.random()*2500)+'ms;--bar-phase:'+(-Math.random()*3000)+'ms"><g transform="rotate('+jitter(5)+' '+((left+right)/2)+' '+y+')"><path class="haunt-censor haunt-censor-ghost" transform="translate(4 2)" d="'+d+'"/><path class="haunt-censor haunt-censor-ghost haunt-censor-ghost-back" transform="translate(-3 -1)" d="'+d+'"/><path class="haunt-censor" d="'+d+'"/></g></g>');
   }
   drawing=bars.join('');duration=4500+Math.random()*4500;
  }else{
   lastScribbleAt=Date.now();const strokes=[],style=(lastPortraitStyle+1+Math.floor(Math.random()*3))%4;lastPortraitStyle=style;layer.dataset.variant=['loops','crosses','mixed','wandering-loops'][style];
   const add=points=>{
    let d='M '+points[0][0]+' '+points[0][1],length=0;
    for(let i=1;i<points.length;i++){
     length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
     if(i===points.length-1)d+=' L '+points[i][0]+' '+points[i][1];else d+=' Q '+points[i][0]+' '+points[i][1]+' '+((points[i][0]+points[i+1][0])/2)+' '+((points[i][1]+points[i+1][1])/2);
    }
    strokes.push({d,time:Math.max(650,length/(330+Math.random()*140)*1000)});
   };
   const circle=(cx,cy,rx,ry)=>{
    const points=[],phase=Math.random()*Math.PI*2,direction=Math.random()<.5?-1:1;
    for(let i=0;i<=25;i++){const angle=phase+direction*i/24*Math.PI*2,rough=1+jitter(.15);points.push([cx+Math.cos(angle)*rx*rough+jitter(11),cy+Math.sin(angle)*ry*rough+jitter(12)]);}add(points);
   };
   const cross=()=>{
    const dx=jitter(45),dy=jitter(40);
    add([[-29+dx,-31+dy],[55+dx+jitter(28),37+dy+jitter(32)],[141+dx+jitter(34),120+dy+jitter(32)],[225+dx+jitter(26),194+dy+jitter(30)],[301+dx,255+dy]]);
    add([[283+dx,-27+dy],[207+dx+jitter(28),39+dy+jitter(30)],[125+dx+jitter(30),131+dy+jitter(34)],[39+dx+jitter(32),207+dy+jitter(30)],[-28+dx,263+dy]]);
   };
   if(style===0)for(let n=0;n<6+Math.floor(Math.random()*3);n++)circle(120+jitter(40),92+jitter(38),143+Math.random()*42,119+Math.random()*38);
   if(style===1)for(let n=0;n<4+Math.floor(Math.random()*3);n++)cross();
   if(style===2)for(let n=0;n<3;n++){circle(120+jitter(40),92+jitter(32),145+Math.random()*35,122+Math.random()*30);cross();}
   if(style===3){for(let n=0;n<6;n++)circle(51+n*40+jitter(25),65+n*20+jitter(25),95+Math.random()*35,94+Math.random()*30);cross();}
   let elapsed=0;
   drawing=strokes.map(({d,time})=>{const delay=elapsed;elapsed+=time+100+Math.random()*280;return '<path class="haunt-pen-stroke" pathLength="1" style="--pen-delay:'+Math.round(delay)+'ms;--pen-time:'+Math.round(time)+'ms;--pen-width:'+(1.6+Math.random()*2.1)+';--pen-opacity:'+(.84+Math.random()*.16)+'" d="'+d+'"/>';}).join('');
   duration=elapsed+3500+Math.random()*3500;layer.dataset.drawMs=String(Math.round(elapsed));
  }
  layer.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(kind==='mask'?'0 0 240 184':'-72 -46 480 368')+'" preserveAspectRatio="none" focusable="false">'+drawing+'</svg>';
  avatar.classList.add('haunt-portrait-active');doc.body.append(layer);portraitOwners.set(layer,avatar);transients.add(layer);trackPortrait(layer,avatar);
  later(()=>{if(!layer.isConnected){remove(layer);return;}layer.classList.add('haunt-portrait-fading');later(()=>remove(layer),350);},duration);
 }
 function textEcho(text,rect,style){if(!allowed())return;const el=transient('haunt-text-echo',Array.from(text).slice(0,50).join(''),rect);if(!el)return;if(style){el.style.font=style.font;el.style.lineHeight=style.lineHeight;}later(()=>remove(el),145);}
 function leaveText(text,rect){if(!allowed())return;const chars=Array.from(text),el=transient('haunt-dialog-residue',text,rect);if(!el)return;const hold=550+Math.random()*350;for(let n=1;n<=Math.ceil(chars.length/2);n++)later(()=>{el.textContent=chars.slice(n,chars.length-n).join('');if(n===Math.ceil(chars.length/2))remove(el);},hold+n*45);}
 function whisperResidue(overlay){
  if(!allowed())return;const rect=overlay.getBoundingClientRect(),style=root.getComputedStyle(overlay),el=transient('haunt-whisper-residue',overlay.textContent,rect);if(!el)return;
  el.dataset.contaminationExempt='';el.dataset.typeIgnore='';el.style.font=style.font;el.style.lineHeight=style.lineHeight;el.style.letterSpacing=style.letterSpacing;
  const hold=1300+Math.random()*1300,linger=Math.random()<.55,fade=850+Math.random()*500;
  for(let n=1;n<=12;n++)later(()=>{const progress=n/12,inset=progress*(linger?36:50);el.style.clipPath='inset(0 '+inset+'%)';el.style.opacity=String(.62-progress*(linger?.22:.55));if(n===12){if(linger)later(()=>remove(el),650+Math.random()*650);else remove(el);}},hold+fade*n/12);
 }
 function restoreLabel(el,echo=false){const state=labels.get(el);if(!state)return;if(echo&&el.isConnected&&visible(el))whisperResidue(state.overlay);remove(state.overlay);if(el.firstChild===state.run)el.replaceChildren(...state.nodes);if(!allowed())for(const span of el.querySelectorAll('.hud-ambient-shear'))span.replaceWith(...span.childNodes);el.classList.remove('haunt-label');labels.delete(el);}
 function positionWhisper(el,state){if(!el.isConnected||!visible(el)){restoreLabel(el);return;}const rect=el.getBoundingClientRect();state.overlay.style.left=rect.left+'px';state.overlay.style.top=rect.top+'px';}
 function whisper(){
  if(!allowed())return;
  const residues=[...doc.querySelectorAll('.haunt-whisper-residue')].map(el=>el.getBoundingClientRect());
  const pool=[...doc.querySelectorAll('.hud-key-en,.hud-topline>span,.hud-personnel-tag,.hud-system-copy>span,.hud-micro-label>span,.hud-signal-footer>span,.section-kicker,#inner-app-view [lang=en],.game-radio-heading>small,.bar-brand>small')].filter(el=>{if(!visible(el)||el.closest('dialog,#inner-app-view>header,.hud-pollution-target,.hud-corruption-run')||labels.has(el)||![...el.children].every(child=>child.matches('.hud-ambient-shear')&&!child.children.length))return false;const r=el.getBoundingClientRect();return!residues.some(other=>r.top<other.bottom+8&&r.bottom>other.top-8&&r.left<other.right+40&&r.right>other.left-40);});
  if(labels.size)return;if(!pool.length){root.AVEDPresence?.whisper?.();return;}
  const el=random(pool),nodes=[...el.childNodes],rect=el.getBoundingClientRect(),style=root.getComputedStyle(el),run=doc.createElement('span'),text=nextPhrase();
  run.textContent=text;run.setAttribute('aria-hidden','true');
  const overlay=transient('haunt-label-clear',text,rect,()=>restoreLabel(el));if(!overlay)return;overlay.dataset.typeIgnore='';overlay.dataset.contaminationExempt='';overlay.style.font=style.font;overlay.style.lineHeight=style.lineHeight;overlay.style.letterSpacing=style.letterSpacing;overlay.style.maxWidth=Math.max(100,root.innerWidth-rect.left-12)+'px';
  el.style.setProperty('--haunt-label-width',rect.width+'px');el.style.setProperty('--haunt-label-height',rect.height+'px');el.classList.add('haunt-label');
  const state={nodes,run,overlay};labels.set(el,state);el.replaceChildren(run);positionWhisper(el,state);
  later(()=>restoreLabel(el,true),3500+Math.random()*3500);
 }
 function repositionWhispers(){for(const [el,state] of [...labels])positionWhisper(el,state);for(const [layer,avatar] of [...portraitOwners])positionPortrait(layer,avatar);}
 doc.addEventListener('scroll',repositionWhispers,{capture:true,passive:true});root.addEventListener('resize',repositionWhispers,{passive:true});

 function apparition(kind='route',force=false){if(!allowed()||doc.querySelector('dialog[open]')||!force&&(Date.now()<nextPopup||Date.now()<quietUntil))return;nextPopup=Date.now()+90000+Math.random()*270000;const d=doc.createElement('dialog'),trigger=doc.activeElement;d.className='pollution-dialog haunt-apparition';d.dataset.tone=Math.random()<.5?'red':'black';const text=random(messagePool(kind)),title=titleFor(text);d.setAttribute('aria-label',title);const body=doc.createElement('div');body.className='pollution-window';body.innerHTML='<header><span></span></header><div class="pollution-dialog-body"><p></p><div class="pollution-dialog-actions"><button type="button" data-pollution-confirm>确认</button></div></div>';body.querySelector('header span').textContent=title;body.querySelector('p').textContent=text;d.append(body);doc.body.append(d);transients.add(d);const close=()=>{const p=d.querySelector('p');leaveText(p.textContent,p.getBoundingClientRect());d.close();remove(d);trigger?.focus?.();};d.addEventListener('click',e=>{if(e.target.closest('button'))close();});d.addEventListener('cancel',e=>{e.preventDefault();close();});d.showModal();}
 function pointer(){if(!allowed()||!root.matchMedia('(hover:hover) and (pointer:fine)').matches||path.length<3)return;const samples=path.slice(-35),el=doc.createElement('span');const release=budget.acquire('pointer',()=>remove(el));if(!release)return;leases.set(el,release);el.className='haunt-transient haunt-pointer';el.setAttribute('aria-hidden','true');el.innerHTML='<svg viewBox="0 0 20 28" width="20" height="28"><path d="M2 1v22l5-6 5 10 4-2-5-9h8Z" fill="currentColor"/></svg>';doc.body.append(el);transients.add(el);samples.forEach((p,i)=>later(()=>{el.style.left=p.x+'px';el.style.top=p.y+'px';},i*480/samples.length));later(()=>remove(el),500);}
 function checkRoute(){if(!allowed()||root.location.hash===route)return;route=root.location.hash;for(const el of [...labels.keys()])restoreLabel(el);if(Date.now()-lastRouteAt>2000&&encounter('route'))apparition('route');lastRouteAt=Date.now();}
 function onClick(event){lastInput=Date.now();const button=event.target.closest('button,[role=button]');if(!button)return;const text=button.textContent+' '+(button.getAttribute('aria-label')||'');if(/刷新/.test(text)&&encounter('refresh'))later(()=>apparition('refresh'),500);later(checkRoute,80);}
 function onPointer(event){lastInput=Date.now();if(!allowed()||event.pointerType!=='mouse')return;const now=Date.now();if(path.length&&now-path.at(-1).time<32)return;path.push({x:event.clientX,y:event.clientY,time:now});while(path.length>70)path.shift();}
 function tick(){clearTimeout(timer);timer=0;if(!allowed())return;const now=Date.now();checkRoute();if(budget.bursting||now>=quietUntil){const draw=Math.random();if(draw<.86)whisper();else if(draw<.875)pointer();else if(draw>.965&&!budget.bursting){const duration=35000+Math.random()*35000;quietUntil=now+duration;root.AVEDContamination.quietFor(duration);}if((budget.bursting||now>=quietUntil)&&Math.random()<(budget.bursting?.55:.26))portrait();if(now-lastInput>90000&&encounter('idle'))apparition('idle');}timer=setTimeout(tick,budget.bursting?1800+Math.random()*1800:9000+Math.random()*7000);}
 function clear(){clearTimeout(timer);timer=0;for(const job of jobs)clearTimeout(job);jobs.clear();for(const el of [...labels.keys()])restoreLabel(el);for(const el of [...transients]){if(el.tagName==='DIALOG')el.close();remove(el);}path.length=0;quietUntil=0;}
 function sync(){if(!portraitPage())for(const layer of [...portraitOwners.keys()])remove(layer);const on=allowed();if(!on){clear();active=false;}else if(!active){active=true;route=root.location.hash;lastInput=Date.now();timer=setTimeout(tick,5000+Math.random()*5000);}}
 function onPreview(event){if(!allowed())return;if(event.effect==='whisper')whisper();else if(event.effect==='apparition')apparition(['route','refresh','idle'][previewIndex++%3],true);else if(event.effect==='pointer')pointer();else if(event.effect==='portrait-mask')portrait('mask',true);else if(event.effect==='portrait-scribble')portrait('scribble',true);}
 doc.addEventListener('aved-contamination-surge',event=>{if(event.active)quietUntil=0;if(allowed()){clearTimeout(timer);timer=setTimeout(tick,event.active?500:9000+Math.random()*7000);}});
 doc.addEventListener('aved-contamination-change',sync);doc.addEventListener('visibilitychange',sync);doc.addEventListener('aved-effects-change',sync);doc.addEventListener('aved-contamination-preview',onPreview);doc.addEventListener('click',onClick);doc.addEventListener('pointermove',onPointer,{passive:true});for(const event of ['keydown','scroll','touchstart'])doc.addEventListener(event,()=>{lastInput=Date.now();},{passive:true});for(const event of ['hashchange','popstate','aved-bar-change'])root.addEventListener(event,()=>later(checkRoute,100));
 new MutationObserver(sync).observe(doc.body,{attributes:true,attributeFilter:['class']});root.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',sync);
 root.AVEDHaunt={textEcho,leaveText,titleFor,purchaseWarning:()=>apparition('purchase',true)};sync();
})(window);
