(function(root){
 const doc=root.document,isContainment=user=>user?.identityKind==='player_containment';
 let active=false,identified=false;
 const overlay=()=>doc.getElementById('signal-Connecting-overlay');
 const reduced=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,reduced()?0:ms));
 const wordExcluded='script,style,noscript,textarea,input,select,option,svg,canvas,iframe,[contenteditable],.containment-fracture,.containment-employee-word,[data-contamination-exempt],[data-type-ignore],#landing-view,#login-modal,#signal-Connecting-overlay,.rank-person,.containment-ranking-alias,.bar-ranking-list b,[data-board-ranking] b';
 const identityPattern='真实员工身份|员工福利|真实员工|员工编号|员工|职业规划|PERSONNEL\\b|EMPLOYEE\\b|工资|工牌|归岗|同事';
 const identityMatch=new RegExp(identityPattern),extraExcluded='.ddz-panel,.rank-person,.bar-room,.company-ticker,[data-hud-typed],[data-hud-console],[data-type-run]';
 let wordObserver=null,wordFrame=0;const wordPending=new Set();
 function markEmployeeWords(node){
  if(!active||!node.isConnected)return;
  const texts=[];
  if(node.nodeType===3)texts.push(node);
  else{const walk=doc.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(walk.nextNode())texts.push(walk.currentNode);}
  for(const text of texts){
   if(!identityMatch.test(text.data)||text.parentElement?.closest(wordExcluded))continue;
   const limited=!!text.parentElement?.closest(extraExcluded),fragment=doc.createDocumentFragment();let cursor=0;
   for(const match of text.data.matchAll(new RegExp(limited?'员工':identityPattern,'g'))){
    const value=match[0];if(match.index>cursor)fragment.append(doc.createTextNode(text.data.slice(cursor,match.index)));
    const word=doc.createElement('span');word.className='containment-employee-word';word.dataset.contaminationExempt='';word.dataset.typeIgnore='';word.append(doc.createTextNode(value));
    // Visual copies contain no text nodes, so selection and labels keep the original wording.
    const shadow=doc.createElement('span');shadow.className='containment-employee-shadow';shadow.dataset.word=value;shadow.setAttribute('aria-hidden','true');word.append(shadow);fragment.append(word);cursor=match.index+value.length;
   }
   if(!cursor)continue;
   if(cursor<text.data.length)fragment.append(doc.createTextNode(text.data.slice(cursor)));
   text.replaceWith(fragment);
  }
  const placeholders=node.nodeType===1?[...(node.matches('input[placeholder],textarea[placeholder]')?[node]:[]),...node.querySelectorAll('input[placeholder],textarea[placeholder]')]:[];
  for(const field of placeholders)field.toggleAttribute('data-containment-employee-placeholder',identityMatch.test(field.getAttribute('placeholder')||''));
 }
 function queueWords(node){
  if(!active||!node.isConnected||node.nodeType!==1&&node.nodeType!==3)return;
  if((node.nodeType===1?node:node.parentElement)?.closest(wordExcluded)&&!node.matches?.('input[placeholder],textarea[placeholder]'))return;
  if(node.nodeType===3&&!identityMatch.test(node.data))return;
  // A queued ancestor already covers this subtree, including newly added text.
  for(let parent=node.parentNode;parent;parent=parent.parentNode)if(wordPending.has(parent))return;
  for(const pending of wordPending)if(node.contains(pending))wordPending.delete(pending);
  wordPending.add(node);if(wordFrame)return;
  wordFrame=requestAnimationFrame(()=>{wordFrame=0;const nodes=[...wordPending];wordPending.clear();for(const target of nodes)markEmployeeWords(target);});
 }
 function startWords(){
  if(wordObserver)return;
  wordObserver=new MutationObserver(records=>{for(const record of records){if(record.type==='childList'){for(const node of record.addedNodes)queueWords(node);}else queueWords(record.target);}});
  wordObserver.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder']});queueWords(doc.body);
 }
 function stopWords(){
  wordObserver?.disconnect();wordObserver=null;cancelAnimationFrame(wordFrame);wordFrame=0;wordPending.clear();
  for(const word of doc.querySelectorAll('.containment-employee-word'))word.replaceWith(doc.createTextNode(word.firstChild?.nodeValue||''));
  for(const field of doc.querySelectorAll('[data-containment-employee-placeholder]'))field.removeAttribute('data-containment-employee-placeholder');
 }
 function fracture(el,text,{neutral=false}={}){
  if(!el)return;
  el.classList.add('containment-fracture');el.dataset.contaminationExempt='';el.dataset.typeIgnore='';
  el.classList.toggle('containment-fracture-neutral',neutral);
  // Keep one readable name and two visual-only copies; never change the account name.
  el.replaceChildren(doc.createTextNode(text));
  for(let n=0;n<2;n++){const copy=doc.createElement('span');copy.className='containment-fracture-copy';copy.setAttribute('aria-hidden','true');copy.textContent=text;el.append(copy);}
 }
 function sync(user){
  active=isContainment(user);doc.body.classList.toggle('containment-access',active);
  if(active)startWords();else stopWords();
  for(const [nav,normal,changed] of [['departments','员工名录','管理名单'],['containment','收容一览','狱友一览']]){
   for(const button of doc.querySelectorAll('[data-nav="'+nav+'"]')){const label=button.querySelector('.sidebar-label');if(label)label.textContent=active?changed:normal;button.setAttribute('aria-label',active?changed:normal);}
  }
  const banner=doc.getElementById('welcome-employee-banner');
  if(active&&banner){banner.replaceChildren(doc.createTextNode('当前用户：'));const name=doc.createElement('span');banner.append(name);fracture(name,user.name||user.displayName||'');}
  else if(banner?.querySelector('.containment-fracture'))banner.textContent='当前用户';
 }
 function reset(){active=false;identified=false;doc.body.classList.remove('containment-access');const pane=overlay();if(pane){delete pane.dataset.containment;pane.removeAttribute('data-rewriting');}const title=doc.getElementById('signal-status-title');if(title){title.classList.remove('containment-fracture');title.textContent='员工身份核验中';delete title.dataset.contaminationExempt;delete title.dataset.typeIgnore;}sync(null);}
 async function identify(user){
  if(!isContainment(user)||identified)return;
  identified=true;active=true;const pane=overlay(),title=doc.getElementById('signal-status-title');
  if(!pane||!title)return;
  pane.dataset.containment='true';pane.classList.remove('hidden');pane.classList.add('flex');pane.setAttribute('aria-busy','true');
  title.textContent='员工身份核验中';pane.dataset.rewriting='verify';
  await wait(420);
  pane.dataset.rewriting='erase';title.replaceChildren();
  const erased=doc.createElement('span');erased.className='containment-erased';erased.textContent='员工身份核验中';title.append(erased);
  const logs=doc.getElementById('signal-log-lines');logs.replaceChildren();
  for(const text of ['[身份记录不一致：收容物]','[收到未知来源的授权回执]','[员工访问映射正在重建]']){const line=doc.createElement('div');line.textContent='> '+text;logs.append(line);}
  await wait(620);
  pane.dataset.rewriting='connected';fracture(title,'连接中');
  doc.getElementById('signal-noise-code').textContent='IDENTITY // REWRITTEN';
  await wait(850);
 }
 function phase(title,progress,line){
  if(!active)return {title,line};
  return {title:progress===100?'接入完成':'连接中',line:progress===100?'[员工访问映射生效；原始收容记录保留]':progress<40?'[正在恢复员工访问映射]':progress<80?'[收容物身份已识别；接入链路保持开放]':'[授权回执已覆盖，正在挂接员工终端]'};
 }
 function decorate(panel,user){
  if(!isContainment(user))return;
  fracture(panel.querySelector('.hud-name-row h1'),user.name);
  fracture(panel.querySelector('.hud-department'),'收容部');
  const alias=panel.querySelector('[data-hud-alias] strong');
  if(alias)fracture(alias,alias.firstChild?.nodeValue??alias.textContent,{neutral:true});
 }
 root.AVEDContainmentAccess={isContainment,identify,reset,sync,phase,fracture,decorate};
})(window);
