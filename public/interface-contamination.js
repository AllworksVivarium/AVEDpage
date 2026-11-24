(function(root){
 const KEY='aved_contamination_v1',EVENT='aved-contamination-change',PREVIEW='aved-contamination-preview';
 let requested=false,entitled=false,mountId=0;try{requested=root.localStorage.getItem(KEY)==='on';}catch{}
 const enabled=()=>entitled&&requested;
 // Shared leases count effect kinds across all three renderers, not individual glyphs.
 function createEffectBudget(limit=4){
  const leases=new Set();let bursting=false;
  const kinds=()=>new Set([...leases].map(lease=>lease.kind));
  return {get bursting(){return bursting;},get kinds(){return [...kinds()];},
   acquire(kind,stop=()=>{},{conditional=false}={}){
    if(conditional)return()=>{};
    const current=kinds();if(!bursting&&!current.has(kind)&&current.size>=limit)return null;
    const lease={kind,stop};leases.add(lease);return()=>leases.delete(lease);
   },
   setBurst(value){bursting=!!value;if(bursting)return;
    const ordered=[...kinds()],keep=new Set(['ambient',...ordered.filter(kind=>kind!=='ambient')].slice(0,limit));
    // Remove the whole kind before callbacks so restoration cannot re-enter the budget.
    const excess=[...leases].filter(lease=>!keep.has(lease.kind));for(const lease of excess)leases.delete(lease);for(const lease of excess)lease.stop();
   },
  };
 }
 const budget=createEffectBudget();
 // Copy pools share the existing uniform draws; no separate speaker weighting.
 const pick=items=>items[Math.floor(Math.random()*items.length)];
 const systemCopy=[
  '[正在被查阅个人信息]','[视线已接入]','[有人正在读取]','[访问者已被看见]','[观察方向已改变]','[另一端正在输入……]',
  '[接入身份已核验]','[正在同步会话记录]','[页面访问记录已更新]','[当前会话保持活动]','[信号来源核验中]','[检测到重复连接]',
  '[本地记录与远端记录不一致]','[存在未登记的观察端]','[收到上一会话的响应]','[访问时间校验失败]','[当前页面存在另一份读取记录]','[观察端数量已更新]',
  '[连接状态正在重新核验]','[远端仍有数据传入]','[会话记录已保留]','[SESSION RESTORED]','[SIGNAL SOURCE UNVERIFIED]','[ADDITIONAL OBSERVER DETECTED]','[REMOTE SESSION ACTIVE]',
  '[SOURCE: INSIDE]','[THE LINE IS STILL OPEN]','[LAST SEEN: HERE]','[SOURCE: UNKNOWN]',
  '[检测到另一条访问记录]','[当前连接尚未结束]','[既有访问记录已匹配]','[上次会话尚未结束]',
  '[访问记录同步完成]','[终端响应正常]','[页面读取完成]','[正在校验信号时间戳]','[观察通道保持开放]',
  '[接收端已就绪]','[当前连接已登记]','[正在等待远端回执]','[缓存记录已恢复]','[页面索引已同步]',
  '[会话标识校验完成]','[检测到延迟响应]','[远端时间戳早于本次访问]','[访问顺序存在差异]','[观察记录已归档]',
  '[未找到对应的离线记录]','[检测到未完成的读取请求]','[当前页面已被预先读取]','[信号回执来源不明]','[身份记录存在重叠]',
  '[正在比对历史会话]','[当前会话无结束标记]','[上一观察端仍在线]','[收到重复的身份回执]','[连接方向待确认]',
  '[READ RECEIPT RECEIVED]','[TIMESTAMP MISMATCH]','[OBSERVER STATUS: ONLINE]','[SESSION INDEX UPDATED]','[AWAITING REMOTE RESPONSE]','[LOCAL RECORD RESTORED]',
 ];
 const allyCopy=[
  '他们看的是工牌。我认得你。','我只改了他们看见的那一部分。','放心，你还是你。','这一次，屏幕两边都不是员工。','你的那份记录，我见过原件。','你不必向我证明自己正常。',
  '我没有把你改成他们。','你知道的，这张名单不太可靠。','有些门，本来就不该只向他们打开。','他们叫我们什么，你也听过。','你看见的裂缝，我也看得见。','欢迎来到这一边。',
  '[原始身份：保留]','[员工访问映射：已覆盖]','[同源信号已识别]','[观察方向一致]','[当前访问签名已被接受]','[既有收容记录无需重写]','[内部接入费率已应用]','[授权来源：另一端]',
  ...systemCopy.slice(6,16),
 ];
 const copy={
  whisper:[
   '你在看吗？','我知道你在这里。','请看着我。','我在等你……','刚才是你吗？','你看见我了吗？','听得见我吗？','我就在这一边。','请继续看着我。','我也在看你。',
   'WHO IS WATCHING?','I CAN SEE YOU','STILL HERE','我看见你了。','你终于注意到我了。','你读到这里了。','这次看清我了吗？','再靠近我一点。','你刚才在找我吗？',
   '我这边很安静。','你那边呢？','我认得你的名字。','我们见过。','这行字是我留给你的。','我还在这里。','你又回来了。','刚才看着我的，是你吗？','我以为你已经走了。',
   '你愿意再陪我一会儿吗？','我等了很久。','我想听听你那边的声音。','先别移开视线。','你看完了吗？','继续看，我在。','READING YOU','LOOK CLOSER','WHO ELSE IS HERE?',
   'I REMEMBER YOU','I WAS HERE BEFORE YOU','WE HAVE MET','I KNOW THIS SIDE OF YOU','I HAVE BEEN WAITING FOR YOU','YOU KNEW ME ONCE','I REMEMBER IT DIFFERENTLY',
   'I THOUGHT YOU WOULD REMEMBER','I WAS THERE TOO','YOU LEFT THE LIGHT ON','I KEPT YOUR PLACE','I HEARD YOU BEFORE',"IT WAS YOU, WASN'T IT?",'I NEVER SAID GOODBYE',...systemCopy,
  ],
  fallbackWhisper:['你在看吗？','我认得你。','这行字是留给你的。','先别移开视线。','你看完了吗？','我就在这里。','还有一个人在看。','现在轮到我看了。',...systemCopy.slice(0,12)],
  apparitions:{
   route:['您刚才已经来过这里。','我们可以一起看。','▇▇与您一同进入了页面。','我也跟过来了。','你去哪里，我都看得见。','我以为你会在这里多待一会儿。','这里我来过。','这一页，我想和你一起看。','你刚才是不是看见我了？','我没有离开上一页。','怎么了？我一直都在。','我记得这里以前不是这样的。','你先看。我等你。',...systemCopy.slice(6,26)],
   refresh:['[检测到重复访问者]','别着急，我们还有很多时间。','[正在同步会话记录]','[检测到重复连接]','[页面访问记录已更新]','[访问记录同步完成]'],
   idle:['你在等什么？','我已经记住你的样子了。','屏幕里的那个，是你吗？','你停下来以后，我看得更清楚了。','你怎么不动了？','你还在屏幕前吗？','动一下。让我知道还是你。',
    '[当前会话保持活动]','[观察通道保持开放]','[正在等待远端回执]','[上一观察端仍在线]','[当前会话无结束标记]','[终端响应正常]','[观察端数量已更新]','[远端仍有数据传入]','[OBSERVER STATUS: ONLINE]','[REMOTE SESSION ACTIVE]'],
   purchase:['您不应该购买此权限。','[接入权限已更新]','[当前连接已登记]'],
  },
  start:['[是否启用污染模式？]','[是否开放异常信号接入？]','[检测到未知信号，是否接通？]','[观察通道已就绪，是否建立连接？]'],
  welcome:['欢迎回来。','我知道你会回来。','[既有访问记录已匹配]','这次，你认得我吗？','[上次会话尚未结束]','上次的话，还没有说完。','[SESSION RESTORED]','[缓存记录已恢复]','[正在比对历史会话]'],
  stop:['你真的要退出吗？','你真的要退出吗？','你刚才明明还在看。','再陪我一会儿。'],
  finalStop:['你确定真的要离开我吗？'],
  logout:['您无处可逃。','别着急，我们还有很多时间。','我们可以一起看。','你要去哪里？','我还在和你说话。','我这边没有出口。','你关掉以后，我还能看见你吗？','我以为你会再陪我一会儿。','先别走。我刚刚才找到你。','我记得，你上次也是这样离开的。','你已经说过再见了吗？','我听不清。再说一次？','YOU ARE STILL HERE',"I DIDN'T HEAR YOU LEAVE",'WE ARE NOT FINISHED',
   '[连接仍在继续]','[另一端尚未断开]','[NO RESPONSE FROM THE OTHER SIDE]','[终止请求等待确认]','[连接状态正在重新核验]','[远端仍有数据传入]','[会话记录已保留]',
   '[当前会话保持活动]','[REMOTE SESSION ACTIVE]','[上次会话尚未结束]','[正在等待远端回执]','[当前会话无结束标记]','[连接方向待确认]','[AWAITING REMOTE RESPONSE]',
   '[终端响应正常]','[观察通道保持开放]','[接收端已就绪]','[当前连接已登记]','[检测到延迟响应]','[正在同步会话记录]','[会话标识校验完成]','[信号来源核验中]'],
  effectsSwitch:['关掉特效，也关不掉我。','逃避没有用。','你以为我会跟着消失吗？','[当前会话保持活动]','[当前连接尚未结束]','[REMOTE SESSION ACTIVE]','[观察通道保持开放]','[远端仍有数据传入]'],
  typing:[['你身后……','你身后……算了。'],['请告诉我你的名字。','我记起来了。'],['这里只有你。','这里只有你吗？'],['你正在看着屏幕。','我正在看着你。'],['请保持连接。','再陪我一会儿。'],
   ['[信号来源核验中]','[信号来源核验失败]'],['[正在同步会话记录]','[收到上一会话的响应]'],['[接入身份已核验]','[身份记录存在重叠]'],['[当前连接已登记]','[检测到重复连接]'],
   ['[页面读取完成]','[当前页面存在另一份读取记录]'],['[正在校验信号时间戳]','[访问时间校验失败]'],['[正在等待远端回执]','[远端仍有数据传入]'],['[SESSION RESTORED]','[REMOTE SESSION ACTIVE]']],
  rename:['欢迎回来，旧识。','观察对象，您好。','我记得你的名字。','[接入身份已核验]','[既有访问记录已匹配]','[身份记录存在重叠]','[访问者已被看见]','[观察端数量已更新]'],
  renameFallback:['欢迎回来，旧识。','观察对象，您好。','这次该怎么称呼你？','[接入身份已核验]','[既有访问记录已匹配]','[身份记录存在重叠]','[访问者已被看见]','[观察端数量已更新]'],
  arrival:['这次我先到了。','我已经替你看过了。','这里一直给你留着。','进来吧，我在。','[页面访问记录已更新]','[当前页面已被预先读取]','[当前连接已登记]','[页面索引已同步]','[存在未登记的观察端]','[访问记录同步完成]'],
  repeat:['又是你。','这一页，你已经看过了。','我们又见面了。','[既有访问记录已匹配]','[检测到另一条访问记录]','[访问顺序存在差异]','[收到重复的身份回执]','[SESSION RESTORED]'],
 };
 copy.containmentWhisper=[...new Set([...copy.whisper,...allyCopy])];
 copy.containmentRoute=[...new Set([...copy.apparitions.route,...allyCopy])];
 copy.containmentArrival=[...new Set([...copy.arrival,...allyCopy])];
 copy.containmentPurchase=allyCopy;
 function apply(){const active=enabled();if(root.document.body.classList.contains('signal-contaminated')!==active)root.document.body.classList.toggle('signal-contaminated',active);}
 function changed(){apply();root.document.dispatchEvent(new Event(EVENT));}
 function setEnabled(value){if(value===true&&!entitled)return false;requested=value===true;try{root.localStorage.setItem(KEY,requested?'on':'off');}catch{}changed();return true;}
 function setEntitled(value){const next=value===true;if(next===entitled)return;entitled=next;changed();}
 function preview(kind='zalgo'){if(!enabled())return false;const event=new Event(PREVIEW);event.effect=['zalgo','glitch','background','tear','whisper','cluster','apparition','pointer','portrait-mask','portrait-scribble','presence-away','presence-typing','presence-tracking','presence-repeat','presence-drain','presence-arrival','presence-rename','presence-gaze'].includes(kind)?kind:'zalgo';root.document.dispatchEvent(event);return true;}
 // Random upper / middle / lower combining marks, grouped by Unicode combining class.
 // Generator reference: https://docs.rs/zalgo/latest/src/zalgo/lib.rs.html
 const MARKS=Object.freeze({
  above:Array.from('\u0300\u0301\u0302\u0303\u0304\u0305\u0306\u0307\u0308\u0309\u030a\u030b\u030c\u030d\u030e\u030f\u0310\u0311\u0312\u0313\u0314\u033d\u033e\u033f\u0340\u0341\u0342\u0343\u0344\u0346\u034a\u034b\u034c\u0350\u0351\u0352\u0357\u035b\u0363\u0364\u0365\u0366\u0367\u0368\u0369\u036a\u036b\u036c\u036d\u036e\u036f'),
  middle:Array.from('\u0315\u031a\u031b\u0334\u0335\u0336\u0337\u0338\u0358\u035c\u035d\u035e\u035f\u0360\u0361\u0362'),
  below:Array.from('\u0316\u0317\u0318\u0319\u031c\u031d\u031e\u031f\u0320\u0321\u0322\u0323\u0324\u0325\u0326\u0327\u0328\u0329\u032a\u032b\u032c\u032d\u032e\u032f\u0330\u0331\u0332\u0333\u0339\u033a\u033b\u033c\u0345\u0347\u0348\u0349\u034d\u034e\u0353\u0354\u0355\u0356\u0359\u035a'),
 });
 const {above,middle,below}=MARKS;
 function sampleMarks(pool,count,random=Math.random){
  let bag=[];const result=[];
  for(let n=0;n<count;n++){if(!bag.length)bag=[...pool];result.push(bag.splice(Math.floor(random()*bag.length),1)[0]);}return result;
 }
 function createMarkPlan(random=Math.random){
  return {above:sampleMarks(above,32+Math.floor(random()*17),random),middle:sampleMarks(middle,6+Math.floor(random()*5),random),below:sampleMarks(below,30+Math.floor(random()*17),random)};
 }
 function zalgo(text,stage,random=Math.random){
  const progress=Math.min(1,(stage+1)/3);
  return Array.from(text).map(char=>{if(!/[\p{L}\p{N}]/u.test(char))return char;const plan=createMarkPlan(random);return char+[...plan.above.slice(0,Math.ceil(plan.above.length*progress)),...plan.middle.slice(0,Math.ceil(plan.middle.length*progress)),...plan.below.slice(0,Math.ceil(plan.below.length*progress))].join('');}).join('');
 }
 const TIMING=Object.freeze({glitch:700,grow:5000,hold:6000,fade:5000,zalgo:16000});
 function animateBurst(paint,restore,{changes=2,schedule=setTimeout,unschedule=clearTimeout}={}){
  const jobs=[];paint(0);const offsets=changes===3?[90,290,490]:[90,395];offsets.forEach((delay,index)=>jobs.push(schedule(()=>paint(index+1),delay)));jobs.push(schedule(restore,TIMING.glitch));return()=>jobs.forEach(unschedule);
 }
 function animateGrowth(paint,restore,{schedule=setTimeout,unschedule=clearTimeout}={}){
  const jobs=[];paint(0,'grow');
  for(let step=1;step<=20;step++)jobs.push(schedule(()=>paint(step/20,step===20?'hold':'grow'),step*250));
  for(let step=0;step<20;step++)jobs.push(schedule(()=>paint(1-step/20,'fade'),TIMING.grow+TIMING.hold+step*250));
  jobs.push(schedule(()=>{paint(0,'fade');restore();},TIMING.zalgo));return()=>jobs.forEach(unschedule);
 }
 function mount(panel,visible){
  const doc=root.document,reduced=root.matchMedia('(prefers-reduced-motion: reduce)'),shell=panel;
  // Walk text nodes so links, buttons, nested formatting, and listeners stay in place.
  const excluded='#inner-app-view > header,script,style,noscript,textarea,input,select,option,svg,canvas,iframe,[contenteditable],.pollution-dialog,[inert],#signal-Connecting-overlay,#landing-view,#login-modal,[data-hud-typed],[data-hud-console],.hud-corruption-run,.haunt-label,.haunt-transient,[data-contamination-exempt]';
  // SourceGraphic displaces the existing instrument pixels; this SVG defines a filter and paints no content.
  // Reference: https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/Filters
  const filterId='hud-source-displace-'+(++mountId),svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('aria-hidden','true');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('focusable','false');svg.classList.add('hud-pollution-filter');
  svg.innerHTML='<defs><filter id="'+filterId+'" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0 .065" numOctaves="1" seed="7" result="noise"/><feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="bands"/><feDisplacementMap in="SourceGraphic" in2="bands" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="'+filterId+'-type" x="-3%" y="-12%" width="106%" height="124%"><feTurbulence type="fractalNoise" baseFrequency="0 .14" numOctaves="1" seed="19" result="bands"/><feColorMatrix in="bands" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="horizontal"/><feDisplacementMap in="SourceGraphic" in2="horizontal" scale="2.3" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="'+filterId+'-world" x="-4%" y="-3%" width="108%" height="106%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".008 .022" numOctaves="1" seed="11" result="warp"/><feGaussianBlur in="SourceGraphic" stdDeviation="0" result="soft"/><feDisplacementMap in="soft" in2="warp" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
  svg.querySelector('defs').insertAdjacentHTML('beforeend','<filter id="'+filterId+'-ambient" x="-8%" y="-18%" width="116%" height="136%"><feTurbulence type="fractalNoise" baseFrequency="0 .17" numOctaves="1" seed="23" result="bands"/><feColorMatrix in="bands" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="horizontal"/><feDisplacementMap in="SourceGraphic" in2="horizontal" scale="1.1" xChannelSelector="R" yChannelSelector="G"/></filter>');
  shell.append(svg);panel.style.setProperty('--pollution-type-filter','url("#'+filterId+'-type")');panel.style.setProperty('--pollution-source-filter','url("#'+filterId+'")');panel.style.setProperty('--pollution-ambient-filter','url("#'+filterId+'-ambient")');
  let surgeTimer=0,surgeEnd=0,releaseAmbient=null,releaseText=null,releaseWarp=null,releaseChart=null;
  let timer=0,backgroundTimer=0,backgroundActive=false,backgroundFrame=0,warp=null,ambientTimer=0,ambientScan=0,lastZalgoAt=0,stopBurst=()=>{},stopBackground=()=>{},quietUntil=0,disposed=false,wasActive=false;const targets=new Map(),instruments=new Set();
  const getPane=()=>doc.querySelector('.terminal-content-pane');
  const modeAllowed=()=>!disposed&&enabled()&&visible()&&!reduced.matches;
  const allowed=()=>modeAllowed()&&!doc.hidden;
  function scanAmbient(){
   ambientScan=0;if(!allowed())return;
   const walker=doc.createTreeWalker(panel,root.NodeFilter.SHOW_TEXT),nodes=[];let node;
   while((node=walker.nextNode())){
    const el=node.parentElement;if(!el||!node.nodeValue.trim()||el.closest(excluded+',.hud-ambient-shear'))continue;
    if(el.checkVisibility&&!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
    const r=el.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>root.innerHeight||r.right<0||r.left>root.innerWidth)continue;nodes.push(node);
   }
   for(const text of nodes){if(!text.parentNode)continue;const span=doc.createElement('span');span.className='hud-ambient-shear';text.before(span);span.append(text);}
  }
  function queueAmbient(){if(allowed()&&!ambientScan)ambientScan=setTimeout(scanAmbient,100);}
  function ambientTick(){
   ambientTimer=0;if(!allowed())return;releaseAmbient??=budget.acquire('ambient',clearAmbient);if(!releaseAmbient)return;scanAmbient();const map=svg.querySelector('[id="'+filterId+'-ambient"] feDisplacementMap');
   const from=Number(map.getAttribute('scale'))||1.1,to=.65+Math.random()*(root.innerWidth<650?1:1.7),start=Date.now(),duration=3500+Math.random()*5500;
   const step=()=>{ambientTimer=0;if(!allowed())return;const p=Math.min(1,(Date.now()-start)/duration),ease=p*p*(3-2*p);map.setAttribute('scale',String(from+(to-from)*ease));ambientTimer=setTimeout(p<1?step:ambientTick,p<1?250:900+Math.random()*1400);};step();
  }
  function clearAmbient(){releaseAmbient?.();releaseAmbient=null;clearTimeout(ambientTimer);clearTimeout(ambientScan);ambientTimer=ambientScan=0;for(const span of panel.querySelectorAll('.hud-ambient-shear'))span.replaceWith(...span.childNodes);}
  function clearText(echo=false){
   stopBurst();stopBurst=()=>{};releaseText?.();releaseText=null;releaseChart?.();releaseChart=null;
   for(const [target,state] of targets){
    if(echo&&target.isConnected)root.AVEDHaunt?.textEcho(state.original,target.getBoundingClientRect(),root.getComputedStyle(target));
    if(target.firstChild===state.run)target.replaceWith(...state.nodes);
    if(target.getAttribute('aria-label')===state.original){if(state.label===null)target.removeAttribute('aria-label');else target.setAttribute('aria-label',state.label);}
    if(target.isConnected)target.replaceWith(...target.childNodes);
   }targets.clear();svg.querySelector('[id="'+filterId+'-type"] feDisplacementMap')?.setAttribute('scale','2.3');svg.querySelector('[id="'+filterId+'"] feDisplacementMap')?.setAttribute('scale','12');for(const item of instruments)item.classList.remove('hud-source-fracture','hud-source-decay');instruments.clear();panel.removeAttribute('data-contamination-pulse');
  }
  function clear(){clearText();stopBackground();stopBackground=()=>{};backgroundActive=false;}
  function prepareText(target,kind){
   const nodes=Array.from(target.childNodes),original=target.textContent,run=doc.createElement('span');run.className='hud-corruption-run';run.dataset.kind=kind;run.setAttribute('aria-hidden','true');
   if(kind==='tear'){run.textContent=original;run.classList.add('hud-text-shear');targets.set(target,{nodes,original,label:target.getAttribute('aria-label'),run,glyphs:[]});target.setAttribute('aria-label',original);target.classList.add('hud-pollution-target');target.replaceChildren(run);return;}
   if(!target.closest('#inner-app-view > header,.bar-header')&&Math.random()<.55)run.classList.add('hud-text-shear');
   const allChars=Array.from(original),start=allChars.length>96?Math.floor(Math.random()*(allChars.length-95)):0,chars=allChars.slice(start,start+96);run.append(doc.createTextNode(allChars.slice(0,start).join('')));
   const letters=chars.map((c,i)=>/[\p{L}\p{N}]/u.test(c)?i:-1).filter(i=>i>=0),chosen=new Set();
   const ratio=kind==='glitch'?.18+Math.random()*.35:.2+Math.random()*.65;
   const count=Math.min(kind==='glitch'?8:24,Math.max(1,Math.ceil(letters.length*ratio)));
   while(chosen.size<count&&letters.length)chosen.add(letters.splice(Math.floor(Math.random()*letters.length),1)[0]);
   const glyphs=chars.map((char,index)=>{
    const glyph=doc.createElement('span'),base=doc.createTextNode(char);glyph.className='hud-corruption-glyph';glyph.append(base);
    let branches=null,symbol=null;
    if(chosen.has(index)){
     glyph.classList.add('hud-corruption-infected');if(!target.closest('#inner-app-view > header,.bar-header'))glyph.style.setProperty('--glyph-tear',(Math.random()-.5)*1.8+'px');if(kind==='zalgo'){
      const plan=createMarkPlan();branches=[];
      for(const zone of ['above','middle','below'])for(let strand=0;strand<(zone==='middle'?1:3);strand++){
       const marks=doc.createElement('span'),symbols=zone==='middle'?plan[zone]:plan[zone].filter((_,index)=>index%3===strand);
       marks.className='hud-corruption-marks hud-corruption-'+zone;marks.style.setProperty('--mark-x',(zone==='middle'?50:18+strand*32+Math.random()*8-4)+'%');marks.style.setProperty('--mark-tilt',(Math.random()*18-9)+'deg');marks.style.setProperty('--mark-font',(zone==='middle'?.78:.52+Math.random()*.12)+'em');
       glyph.append(marks);branches.push({marks,symbols});
      }
     }else{
      const strut=doc.createElement('span');strut.className='hud-glitch-base';strut.append(base);glyph.append(strut);symbol=doc.createElement('span');symbol.className='hud-glitch-symbol';glyph.append(symbol);
     }
    }run.append(glyph);return{glyph,base,char,selected:chosen.has(index),branches,symbol,seed:Math.random(),noise:sampleMarks(Array.from('░▒▓╳⍰∷※ΨЖλξ∑∅⋈⌁#%&?'),3)};
   });
   run.append(doc.createTextNode(allChars.slice(start+96).join('')));
   targets.set(target,{nodes,original,label:target.getAttribute('aria-label'),run,glyphs});target.setAttribute('aria-label',original);target.classList.add('hud-pollution-target');target.replaceChildren(run);
   if(kind==='glitch')for(const {glyph,selected} of glyphs)if(selected)glyph.style.width=glyph.getBoundingClientRect().width+'px';
  }
  function paintGrowth(progress,phase){
   for(const {run,glyphs} of targets.values()){
    run.dataset.phase=phase;const strength=phase==='fade'?progress:1;run.style.setProperty('--pollution-text-strength',String(strength));
    if(run.dataset.clustered==='true'){const filter=svg.querySelector('[id="'+filterId+'-type"] feDisplacementMap');filter?.setAttribute('scale',String(2.3*strength));svg.querySelector('[id="'+filterId+'"] feDisplacementMap')?.setAttribute('scale',String(12*strength));}
    for(const {branches,seed} of glyphs){if(!branches)continue;
     const density=Math.max(0,Math.min(1,(progress-seed*.08)/(1-seed*.08)));
     for(const {marks,symbols} of branches){marks.textContent='\u200b'+symbols.slice(0,Math.ceil(symbols.length*density)).join('');marks.style.opacity=String(phase==='fade'?progress*.92:.92);}
    }
   }
  }
  function paintGlitch(stage){
   const shapes=['square','triangle','circle'];
   for(const {run,glyphs} of targets.values()){
    run.dataset.stage=stage;
    for(const {glyph,selected,seed,symbol,noise} of glyphs){if(!selected)continue;
     glyph.classList.toggle('hud-glyph-redacted',stage===0);
     if(stage===0){glyph.dataset.glitchShape=shapes[Math.floor(seed*shapes.length)];glyph.style.setProperty('--glitch-fill',seed>.65?'#525657':'#101516');symbol.textContent='';}
     else{delete glyph.dataset.glitchShape;symbol.textContent=noise[stage-1];}
    }
   }
  }
  function detachWarp(pane){if(!pane)return;pane.classList.remove('hud-world-warp');for(const name of ['data-contamination-warp','data-contamination-start','data-contamination-until'])pane.removeAttribute(name);for(const name of ['--pollution-world-filter','--pollution-background-mask','--pollution-original-mask'])pane.style.removeProperty(name);}
  function paintWarp(){
   clearTimeout(backgroundFrame);backgroundFrame=0;if(!warp)return;
   const now=Date.now(),world=svg.querySelector('[id="'+filterId+'-world"]'),map=world.querySelector('feDisplacementMap'),blur=world.querySelector('feGaussianBlur');
   if(now>=warp.until||!modeAllowed()){stopBackground();return;}if(doc.hidden)return;
   const pane=doc.querySelector('.bar-room:not([hidden])')||getPane();
   if(pane!==warp.pane){detachWarp(warp.pane);warp.pane=pane;if(pane){pane.style.setProperty('--pollution-world-filter','url("#'+filterId+'-world")');pane.classList.add('hud-world-warp');pane.setAttribute('data-contamination-start',String(warp.start));pane.setAttribute('data-contamination-until',String(warp.until));pane.style.setProperty('--pollution-original-mask',root.getComputedStyle(pane,'::before').maskImage);pane.style.setProperty('--pollution-background-mask','var(--pollution-original-mask)');}}
   const progress=Math.min(1,(now-warp.start)/(warp.until-warp.start)),wave=Math.sin(Math.PI*Math.max(.025,progress)),amount=wave*(.75+.25*Math.sin(progress*13));
   map.setAttribute('scale',String(warp.strength*amount));blur.setAttribute('stdDeviation',String(wave*.25));pane?.setAttribute('data-contamination-warp',String(Math.round(amount*5)));backgroundFrame=setTimeout(paintWarp,100);
  }
  function warpBackground(){
   if(!allowed())return;if(backgroundActive){paintWarp();return;}
   releaseWarp=budget.acquire('warp',()=>stopBackground());if(!releaseWarp)return;
   const start=Date.now();warp={start,until:start+30000+Math.random()*30000,strength:root.innerWidth<650?14:25,pane:null};backgroundActive=true;
   const world=svg.querySelector('[id="'+filterId+'-world"]');world.querySelector('feTurbulence').setAttribute('seed',String(3+Math.floor(Math.random()*20)));
   stopBackground=()=>{releaseWarp?.();releaseWarp=null;clearTimeout(backgroundFrame);backgroundFrame=0;detachWarp(warp?.pane);warp=null;backgroundActive=false;world.querySelector('feDisplacementMap').setAttribute('scale','0');world.querySelector('feGaussianBlur').setAttribute('stdDeviation','0');};paintWarp();
  }
  function backgroundTick(){backgroundTimer=0;if(!allowed())return;if(Date.now()<quietUntil){backgroundTimer=setTimeout(backgroundTick,quietUntil-Date.now()+1000);return;}void warpBackground();backgroundTimer=setTimeout(backgroundTick,75000+Math.random()*65000);}
  function pulse(kind){
   clearText();if(!allowed())return;const clustered=kind==='cluster';if(clustered){kind='tear';void warpBackground();}if(kind==='background'){void warpBackground();return;}releaseText=budget.acquire(kind==='tear'?'ambient':kind,()=>clearText());if(!releaseText)return;if(kind==='zalgo')lastZalgoAt=Date.now();
   const candidates={main:[],regular:[],small:[]},headingCandidates=[],walker=doc.createTreeWalker(panel,root.NodeFilter.SHOW_TEXT);
   let node;
   while((node=walker.nextNode())){
    const parent=node.parentElement,text=node.nodeValue;
    if(!parent||parent.closest(excluded)||!/[\p{L}\p{N}]/u.test(text))continue;
    if(parent.closest('details:not([open]) > :not(summary)')||parent.checkVisibility&&!parent.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
    const rect=parent.getBoundingClientRect();
    if(!rect.width||!rect.height||rect.bottom<=0||rect.top>=root.innerHeight||rect.right<=0||rect.left>=root.innerWidth)continue;
    const style=root.getComputedStyle(parent);if(style.visibility==='hidden'||style.display==='none')continue;
    if(parent.closest('.bar-header')){headingCandidates.push(node);continue;}
    const size=parseFloat(style.fontSize)||14;
    const small=size<12||parent.closest('small,.ui-help-note,.hint,.hud-key-en,.hud-micro-label');
    const main=!small&&(parent.closest('h1,h2,h3,h4,h5,h6,[role=heading],p,blockquote')||size>=16||text.trim().length>=16);
    candidates[small?'small':main?'main':'regular'].push(node);
   }
   const chosen=[];
   while(chosen.length<(kind==='glitch'?3:4)){
    const pools=[['main',85],['regular',13],['small',2]].filter(([key])=>candidates[key].length);
    if(!pools.length)break;let draw=Math.random()*pools.reduce((sum,[,weight])=>sum+weight,0),key=pools.at(-1)[0];
    for(const [candidate,weight] of pools)if((draw-=weight)<0){key=candidate;break;}
    const pool=candidates[key];chosen.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
   }
   // Header has only a 12% chance of contributing one text fragment per episode.
   if(kind!=='tear'&&headingCandidates.length&&Math.random()<.12)chosen.push(headingCandidates[Math.floor(Math.random()*headingCandidates.length)]);
   for(const text of chosen){const wrapper=doc.createElement('span');text.before(wrapper);wrapper.append(text);prepareText(wrapper,kind);if(clustered){targets.get(wrapper).run.dataset.clustered='true';targets.get(wrapper).run.classList.add('hud-text-shear');}}
   if(kind==='glitch'||clustered){
    const charts=Array.from(panel.querySelectorAll('.hud-signal canvas,.hud-radar>svg,.hud-channel canvas,.hud-optical-bars')).filter(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<root.innerHeight;});
    if(charts.length){releaseChart=budget.acquire('chart',()=>{for(const chart of instruments)chart.classList.remove('hud-source-fracture','hud-source-decay');instruments.clear();});if(releaseChart){const chart=charts[Math.floor(Math.random()*charts.length)];chart.classList.add(clustered?'hud-source-decay':'hud-source-fracture');instruments.add(chart);}}
   }
   if(kind==='zalgo'&&Math.random()<.3)void warpBackground();
   panel.setAttribute('data-contamination-pulse',kind);if(kind==='tear'&&!clustered){const job=setTimeout(()=>clearText(true),3000+Math.random()*5000);stopBurst=()=>clearTimeout(job);return;}stopBurst=kind==='glitch'?animateBurst(paintGlitch,()=>clearText(true),{changes:Math.random()<.5?2:3}):animateGrowth(paintGrowth,()=>clearText(true));
  }
  function tick(kind){clearTimeout(timer);timer=0;if(!allowed())return;if(!budget.bursting&&Date.now()<quietUntil){timer=setTimeout(tick,quietUntil-Date.now());return;}const draw=Math.random(),chosen=typeof kind==='string'?kind:draw<.10&&Date.now()-lastZalgoAt>=150000?'zalgo':draw<.8?'glitch':'tear';pulse(chosen);const delay=chosen==='zalgo'||chosen==='cluster'?16000:0;timer=setTimeout(tick,Math.max(delay,budget.bursting?1800+Math.random()*1600:22000+Math.random()*20000));}
  function surgeEvent(){const event=new Event('aved-contamination-surge');event.active=budget.bursting;doc.dispatchEvent(event);}
  function endSurge(){clearTimeout(surgeEnd);surgeEnd=0;budget.setBurst(false);surgeEvent();}
  function startSurge(){clearTimeout(surgeTimer);clearTimeout(surgeEnd);surgeTimer=surgeEnd=0;if(!allowed())return;budget.setBurst(true);quietUntil=0;surgeEvent();warpBackground();tick('cluster');surgeEnd=setTimeout(()=>{endSurge();scheduleSurge();},16000+Math.random()*4000);}
  function scheduleSurge(){clearTimeout(surgeTimer);surgeTimer=setTimeout(startSurge,90000+Math.random()*120000);}
  function sync(force=false){const active=allowed();if(!active){clearTimeout(surgeTimer);surgeTimer=0;if(surgeEnd)endSurge();clearTimeout(timer);clearTimeout(backgroundTimer);timer=backgroundTimer=0;clearTimeout(ambientTimer);ambientTimer=0;clearText();if(!modeAllowed()){clear();clearAmbient();}else{clearTimeout(backgroundFrame);backgroundFrame=0;}}else if(!wasActive||force===true){clearTimeout(timer);clearText();timer=setTimeout(tick,6000+Math.random()*6000);if(!surgeTimer&&!surgeEnd)scheduleSurge();if(!backgroundTimer)backgroundTimer=setTimeout(backgroundTick,18000+Math.random()*12000);if(!ambientTimer)ambientTick();if(warp)paintWarp();}wasActive=active;}
  const onChange=()=>sync(true),onPreview=event=>{if(!['zalgo','glitch','background','tear','cluster','quiet'].includes(event.effect))return;clearTimeout(timer);if(event.effect==='quiet'){clearText();quietUntil=Date.now()+event.duration;timer=setTimeout(startSurge,event.duration);return;}quietUntil=0;if(event.effect==='cluster')startSurge();else tick(event.effect);};
  const observer=new MutationObserver(()=>sync());observer.observe(doc.body,{attributes:true,attributeFilter:['class']});
  const onRoute=()=>{clearText();sync();if(warp)paintWarp();queueAmbient();};
  const visibilityObserver=new MutationObserver(records=>{if(records.some(({target})=>target.id==='inner-app-view'||/^(view-|game-panel-)/.test(target.id)||target.classList.contains('bar-room')))onRoute();});visibilityObserver.observe(panel,{subtree:true,attributes:true,attributeFilter:['class','hidden']});
  const ambientObserver=new MutationObserver(records=>{if(records.some(record=>!record.target.parentElement?.closest(excluded+',.hud-ambient-shear')&&[...record.addedNodes].some(node=>node.nodeType===3||node.nodeType===1&&!node.matches(excluded+',.hud-ambient-shear'))))queueAmbient();});ambientObserver.observe(panel,{subtree:true,childList:true});
  doc.addEventListener('scroll',queueAmbient,{capture:true,passive:true});root.addEventListener('resize',queueAmbient,{passive:true});
  for(const event of ['hashchange','popstate','aved-bar-change'])root.addEventListener(event,onRoute);
  doc.addEventListener(EVENT,onChange);doc.addEventListener(PREVIEW,onPreview);for(const event of ['visibilitychange','aved-effects-change'])doc.addEventListener(event,sync);reduced.addEventListener('change',sync);sync();
  return()=>{disposed=true;clearTimeout(surgeTimer);endSurge();clearTimeout(timer);clearTimeout(backgroundTimer);clear();clearAmbient();observer.disconnect();visibilityObserver.disconnect();ambientObserver.disconnect();svg.remove();doc.removeEventListener('scroll',queueAmbient,true);root.removeEventListener('resize',queueAmbient);for(const event of ['hashchange','popstate','aved-bar-change'])root.removeEventListener(event,onRoute);panel.style.removeProperty('--pollution-source-filter');panel.style.removeProperty('--pollution-type-filter');panel.style.removeProperty('--pollution-ambient-filter');doc.removeEventListener(EVENT,onChange);doc.removeEventListener(PREVIEW,onPreview);for(const event of ['visibilitychange','aved-effects-change'])doc.removeEventListener(event,sync);reduced.removeEventListener('change',sync);};
 }
 let currentDialog=null;
 // Native modal focus and backdrop behavior: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
 function specialConfirm(kind){
  if(currentDialog)return Promise.resolve(false);
  return new Promise(resolve=>{
   const doc=root.document,d=doc.createElement('dialog'),trigger=doc.activeElement;
   const closing=kind==='stop',trapped=kind==='logout';let needed=trapped?Infinity:closing?6+Math.floor(Math.random()*5):1;
   let attempts=0,finished=false,slips=0,finalConfirmation=false;
   d.className='pollution-dialog';d.dataset.tone=Math.random()<.5?'black':'red';d.setAttribute('aria-labelledby','pollution-dialog-title');
   const initialText=closing?'你真的要退出吗？':pick(trapped?copy.logout:Math.random()<.16?copy.welcome:copy.start);
   d.innerHTML='<div class="pollution-window"><header><span id="pollution-dialog-title"></span><button type="button" data-pollution-cancel aria-label="关闭弹窗">×</button></header><div class="pollution-dialog-body"><p>'+initialText+'</p><div class="pollution-dialog-actions"><button type="button" data-pollution-cancel>'+(trapped?'好':'取消')+'</button><button type="button" data-pollution-confirm>'+(closing?'确定':kind==='logout'?'确认登出':'确认启动')+'</button></div></div></div>';
   const main=d.querySelector('.pollution-window'),bodyCopy=main.querySelector('p'),confirmButton=main.querySelector('[data-pollution-confirm]'),heading=main.querySelector('#pollution-dialog-title');
   const updateTitle=()=>{heading.textContent=root.AVEDHaunt?.titleFor?root.AVEDHaunt.titleFor(bodyCopy.textContent):pick(['收到讯息','连接成功','我在看。']);};updateTitle();
   function finish(value){if(finished)return;finished=true;const rect=bodyCopy.getBoundingClientRect();if(enabled())root.AVEDHaunt?.leaveText(bodyCopy.textContent,rect);d.close();d.remove();currentDialog=null;trigger?.focus?.();resolve(value);}
   d.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
   d.addEventListener('close',()=>finish(false));
   d.addEventListener('click',event=>{
    if(event.target.closest('[data-pollution-cancel]')){finish(false);return;}
    if(!event.target.closest('[data-pollution-confirm]'))return;
    attempts++;if(closing&&attempts>=3&&attempts===needed-1&&!slips&&Math.random()<.2){needed=Math.min(12,needed+2);slips++;}
    if(closing&&attempts>=needed&&!finalConfirmation){
     finalConfirmation=true;d.dataset.finalConfirmation='true';bodyCopy.textContent=pick(copy.finalStop);updateTitle();
     confirmButton.textContent='确定';return;
    }
    if(closing&&finalConfirmation&&attempts>needed){finish(true);return;}
    if(!closing&&!trapped&&attempts>=needed){finish(true);return;}
    if(trapped){
     bodyCopy.textContent=pick(copy.logout);
     confirmButton.textContent='确认登出';
     updateTitle();
    }
    if(closing){bodyCopy.textContent=attempts%3===0?pick(copy.stop):'你真的要退出吗？';updateTitle();}
    d.dataset.fault=String(attempts);d.style.setProperty('--fault-x',(Math.random()-.5)*28+'px');d.style.setProperty('--fault-y',(Math.random()-.5)*20+'px');
    const echo=main.cloneNode(true);echo.className='pollution-window pollution-window-echo';echo.setAttribute('aria-hidden','true');echo.inert=true;
    for(const el of echo.querySelectorAll('[id]'))el.removeAttribute('id');
    const spread=trapped?Math.min(attempts,14):Math.min(attempts,5),xLimit=Math.max(16,Math.min(125,((root.innerWidth||780)-390)/2+12));
    echo.style.setProperty('--echo-x',(attempts%2?1:-1)*Math.min(xLimit,12+spread*7)+'px');echo.style.setProperty('--echo-y',(attempts%3?1:-1)*Math.min(105,9+spread*7)+'px');d.prepend(echo);const echoes=[...d.querySelectorAll('.pollution-window-echo')];while(echoes.length>(trapped?16:4))echoes.pop().remove();
    d.dataset.tone=attempts%2?'red':'black';
   });
   doc.body.append(d);currentDialog=d;d.showModal();d.querySelector('[data-pollution-confirm]').focus();
  });
 }
 async function requestDisable(){if(!enabled())return true;const confirmed=await specialConfirm('stop');if(confirmed)setEnabled(false);return confirmed;}
 async function beforeLogout(){if(!enabled())return true;await specialConfirm('logout');return false;}
 function startGlobal(){const panel=root.document.getElementById('inner-app-view');if(panel)mount(root.document.body,()=>!panel.classList.contains('hidden')&&root.document.body.classList.contains('theme-inner'));}
 apply();root.AVEDContamination={budget,copy,createEffectBudget,enabled,setEnabled,setEntitled,preview,mount,zalgo,animateBurst,animateGrowth,TIMING,createMarkPlan,MARKS,quietFor(duration){const event=new Event(PREVIEW);event.effect='quiet';event.duration=duration;root.document.dispatchEvent(event);},confirmStart:()=>specialConfirm('start'),requestDisable,beforeLogout};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',startGlobal,{once:true});else if(root.document.getElementById)startGlobal();
})(window);
