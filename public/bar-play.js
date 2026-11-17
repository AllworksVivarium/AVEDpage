window.AVEDBarPlay=function({root,api,esc,getSnapshot,getIdentity,apply,onError}){
 const make=(name,title,body)=>{const dialog=document.createElement('dialog');dialog.className='bar-menu-dialog '+name;dialog.setAttribute('aria-label',title);dialog.innerHTML=`<header><h2>${title}</h2><button type="button" data-play-close aria-label="关闭${title}">×</button></header>${body}<p class="bar-play-error" role="alert" hidden></p>`;root.append(dialog);dialog.querySelector('[data-play-close]').onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>event.stopPropagation());return dialog;};
 const action=make('bar-action-dialog','我的这一杯','<div class="bar-serving-summary"><b data-serving-name></b><p data-serving-remaining></p><small data-serving-today></small></div><div class="bar-serving-actions"><button type="button" data-bar-sip>喝一口</button><button type="button" data-bar-coaster>翻开杯垫</button><button type="button" data-bar-ranking>饮酒榜</button></div>');
 const coaster=make('bar-coaster-dialog','杯垫留言','<section class="bar-coaster-card"><small data-coaster-author></small><p data-coaster-body>翻开杯垫……</p></section><div class="bar-coaster-controls"><button type="button" data-coaster-another>换一张</button></div><form class="bar-coaster-form"><label for="bar-coaster-text">留给下一位客人</label><textarea id="bar-coaster-text" maxlength="120" rows="3" placeholder="写点什么……" aria-label="杯垫留言内容"></textarea><div><select aria-label="杯垫留言身份"><option value="anonymous">匿名</option><option value="real">实名</option></select><button type="submit">留下留言</button></div></form>');
 const ranking=make('bar-ranking-dialog','饮酒榜','<p class="bar-ranking-date" data-ranking-date></p><ol class="bar-ranking-list" data-ranking-list></ol><p class="bar-ranking-mine" data-ranking-mine></p>');
 const board=document.createElement('aside');board.className='bar-rank-board';board.hidden=true;board.setAttribute('aria-label','吧台饮酒榜');board.innerHTML='<header><b>酒量榜</b><button type="button" class="bar-board-close" aria-label="收起榜单" title="收起榜单">×</button></header><ol data-board-ranking></ol>';root.querySelector('.bar-scene').append(board);
 root.insertAdjacentHTML('beforeend','<svg class="bar-drunk-svg" width="0" height="0" aria-hidden="true"><defs><filter id="bar-drunk-warp" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".008 .024" numOctaves="1" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="warped"/><feOffset in="warped" dx="0" dy="1" result="offset"/><feComponentTransfer in="offset" result="ghost"><feFuncA type="linear" slope="0"/></feComponentTransfer><feMerge><feMergeNode in="warped"/><feMergeNode in="ghost"/></feMerge></filter></defs></svg>');
 const toggle=document.createElement('button');toggle.type='button';toggle.className='bar-drunk-toggle';toggle.hidden=true;root.querySelector('.bar-scene-bottom').prepend(toggle);
 let generation=0,busy=false,coasterBusy=false,coasterMessage=null,pendingSip=null,coasterLoaded=false,visualsOff=false,lastLevel=0,recoveryTimer=0,conditionReceivedAt=0,conditionKey=null;
 try{visualsOff=localStorage.getItem('aved_bar_drunk_visuals')==='off';}catch{}
 const drunkStatus=status=>{const elapsed=Math.max(0,Date.now()-conditionReceivedAt),units=status?.intoxicationUnits===undefined?(status?.weightedUnits||0):Math.max(0,status.intoxicationUnits-elapsed*(status.recoveryUnitsPerMs||0)),ratio=units/Math.max(1,status?.thresholdUnits||20000),level=ratio>=2.4?3:ratio>=1.6?2:ratio>=1?1:0;return {...status,level,levelLabel:['清醒','微醺','醉意渐浓','酩酊'][level]};};
 const seenSips=new Set(),error=(dialog,message)=>{const box=dialog.querySelector('.bar-play-error');box.textContent=message;box.hidden=!message;};
 function show(dialog){for(const opened of root.querySelectorAll('dialog[open]'))if(opened!==dialog)opened.close();error(dialog,'');if(!dialog.open)dialog.showModal();}
 function paintEffects(status){
  const level=Math.max(0,Math.min(3,Number(status?.level)||0));lastLevel=level;root.dataset.drunk=String(visualsOff?0:level);root.dataset.drunkSuppressed=String(visualsOff);toggle.hidden=level===0;toggle.textContent=visualsOff?'醉意效果':'清醒视图';toggle.setAttribute('aria-pressed',String(visualsOff));
  root.querySelector('feDisplacementMap').setAttribute('scale',String([0,4,10,18][level]));root.querySelector('feOffset').setAttribute('dx',String([0,3,7,12][level]));root.querySelector('feFuncA').setAttribute('slope',String([0,.12,.22,.3][level]));
 }
 toggle.onclick=()=>{visualsOff=!visualsOff;try{localStorage.setItem('aved_bar_drunk_visuals',visualsOff?'off':'on');}catch{}paintEffects({level:lastLevel});};
 function paintAction(){
  const data=getSnapshot(),drink=data?.myDrink,menu=data?.menu||[],item=menu.find(item=>item.id===drink?.drinkId);
  action.querySelector('[data-serving-name]').textContent=item?.name||'我的这一杯';action.querySelector('[data-serving-remaining]').textContent=drink?`${drink.remainingMl??0} / ${drink.volumeMl??0} mL`:'还没有点酒';
  action.querySelector('[data-serving-today]').textContent=`本日已饮用 ${data?.drinking?.totalMl||0} mL · ${drunkStatus(data?.drinking).levelLabel}`;
  const button=action.querySelector('[data-bar-sip]');button.disabled=busy||!(drink?.remainingMl>0);button.textContent=busy?'饮用中…':drink?.remainingMl===0?'已喝完':'喝一口';
  const direct=root.querySelector('[data-bar-drink-button]');direct.disabled=button.disabled;direct.textContent=button.textContent;direct.title=drink?`${drink.remainingMl||0} / ${drink.volumeMl||0} mL`:'先点一杯酒';
 }
 function animateSips(items,{initial=false}={}){
  for(const item of items||[]){if(seenSips.has(item.id))continue;seenSips.add(item.id);if(initial)continue;if(item.employeeId===getSnapshot()?.selfId)window.AVEDBarSipSound?.();if(matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('effects-off'))continue;const sprite=root.querySelector(`[data-glass-owner="${item.employeeId}"] .bar-drink-sprite`);if(sprite)sprite.animate([{transform:'translateY(0)'},{transform:'translateY(-22px)',offset:.25},{transform:'translateY(-22px)',offset:.78},{transform:'translateY(0)'}],{duration:1400,easing:'ease-in-out'});}
  if(seenSips.size>150){const keep=[...seenSips].slice(-60);seenSips.clear();keep.forEach(id=>seenSips.add(id));}
 }
 const drinkOnce=async()=>{
  const data=getSnapshot(),drink=data?.myDrink;if(busy||!(drink?.remainingMl>0))return;window.AVEDBarSipSound?.(true);const visit=generation;busy=true;paintAction();error(action,'');
  if(pendingSip?.orderId!==drink.id)pendingSip={orderId:drink.id,requestId:crypto.randomUUID(),identityMode:getIdentity()};
  try{const updated=await api('/api/player/bar/sip',{method:'POST',body:pendingSip});pendingSip=null;if(visit!==generation)return;apply(updated);onError?.('');if(action.open)action.close();}
  catch(problem){if(visit===generation){if(action.open)error(action,problem.message);else onError?.(problem.message);}if(!['NETWORK','TIMEOUT','INVALID_RESPONSE'].includes(problem.code))pendingSip=null;}
  finally{setTimeout(()=>{if(visit===generation){busy=false;paintAction();}},1450);}
 };
 action.querySelector('[data-bar-sip]').onclick=drinkOnce;
 function renderCoaster(data,{fillOwn=false}={}){
  coasterMessage=data.message;coaster.querySelector('[data-coaster-author]').textContent=data.message?.alias||'空白的杯垫';coaster.querySelector('[data-coaster-body]').textContent=data.message?.body||'还没有人留下话。';
  if(fillOwn){coaster.querySelector('textarea').value=data.own?.body||'';coaster.querySelector('select').value=data.own?.identityMode||getIdentity();}
 }
 async function openCoaster(){
  show(coaster);const visit=generation;error(coaster,'');try{const data=await api('/api/player/bar/coaster');if(visit!==generation||!coaster.open)return;renderCoaster(data,{fillOwn:!coasterLoaded});coasterLoaded=true;}catch(problem){if(visit===generation)error(coaster,problem.message);}
 }
 coaster.querySelector('[data-coaster-another]').onclick=async()=>{if(coasterBusy)return;const visit=generation;coasterBusy=true;const button=coaster.querySelector('[data-coaster-another]');button.disabled=true;try{const data=await api('/api/player/bar/coaster?exclude='+(coasterMessage?.id||0));if(visit===generation&&coaster.open)renderCoaster(data);}catch(problem){if(visit===generation)error(coaster,problem.message);}finally{coasterBusy=false;button.disabled=false;}};
 coaster.querySelector('form').onsubmit=async event=>{
  event.preventDefault();if(coasterBusy)return;const body=coaster.querySelector('textarea').value.trim();if(!body)return;const visit=generation;coasterBusy=true;const button=coaster.querySelector('[type=submit]');button.disabled=true;error(coaster,'');
  try{const data=await api('/api/player/bar/coaster',{method:'POST',body:{body,identityMode:coaster.querySelector('select').value}});if(visit===generation){renderCoaster(data);button.textContent='已留下';}}
  catch(problem){if(visit===generation)error(coaster,problem.message);}finally{coasterBusy=false;button.disabled=false;}
 };
 coaster.querySelector('textarea').addEventListener('input',()=>{coaster.querySelector('[type=submit]').textContent='留下留言';});
 function paintRanking(board){
  if(!board)return;ranking.querySelector('[data-ranking-date]').textContent=board.day+' · 每日 04:00 换榜';
  const list=ranking.querySelector('[data-ranking-list]'),self=getSnapshot()?.selfId,key=JSON.stringify([board.items,self]);if(list.dataset.key!==key){list.dataset.key=key;list.innerHTML=board.items.length?board.items.map(item=>`<li class="${item.employeeId===self?'mine':''}"><span>${item.rank}</span><b>${esc(item.alias)}</b><small>${item.totalMl} mL</small></li>`).join(''):'<li class="bar-ranking-empty">今晚还没有饮用记录。</li>';}
  ranking.querySelector('[data-ranking-mine]').textContent='我本日已饮用 '+(getSnapshot()?.drinking?.totalMl||0)+' mL';
  paintBoard(board);
 }
 function paintBoard(data){
  if(board.hidden||!data)return;const self=getSnapshot()?.selfId,list=board.querySelector('[data-board-ranking]'),items=data.items.slice(0,5),key=JSON.stringify([items,self]);if(list.dataset.key===key)return;list.dataset.key=key;
  list.innerHTML=items.length?items.map(item=>`<li class="${item.employeeId===self?'mine':''}" title="${esc(item.alias)} · ${item.totalMl} mL"><span>${item.rank}</span><b>${esc(item.alias)}</b><small>${item.totalMl}</small></li>`).join(''):'<li class="bar-board-empty">尚无人上榜</li>';
 }
 function setBoard(visible){board.hidden=!visible;root.dataset.rankBoardOpen=String(visible);for(const button of root.querySelectorAll('[data-bar-ranking]')){button.textContent=visible?'收起榜单':'展开榜单';button.setAttribute('aria-expanded',String(visible));}if(visible){for(const opened of root.querySelectorAll('dialog[open]'))opened.close();paintBoard(getSnapshot()?.leaderboard);}}
 function openRanking(){setBoard(board.hidden);}
 board.querySelector('.bar-board-close').onclick=()=>setBoard(false);
 setBoard(false);
 for(const button of root.querySelectorAll('[data-bar-coaster]'))button.onclick=openCoaster;
 for(const button of root.querySelectorAll('[data-bar-ranking]'))button.onclick=openRanking;
 return {sip:drinkOnce,openAction(){paintAction();show(action);},receive(data,options={}){const nextCondition=JSON.stringify([data.drinking?.intoxicationAt,data.drinking?.intoxicationUnits,data.drinking?.recoveryUnitsPerMs]);if(nextCondition!==conditionKey){conditionKey=nextCondition;conditionReceivedAt=Date.now();}if(!recoveryTimer)recoveryTimer=setInterval(()=>{if(!document.hidden){paintEffects(drunkStatus(getSnapshot()?.drinking));if(action.open)paintAction();}},2000);paintAction();paintEffects(drunkStatus(data.drinking));if(ranking.open)paintRanking(data.leaderboard);if(!board.hidden)paintBoard(data.leaderboard);animateSips(data.recentSips,options);},close(){clearInterval(recoveryTimer);recoveryTimer=0;conditionKey=null;generation++;busy=false;coasterBusy=false;coasterLoaded=false;pendingSip=null;for(const dialog of [action,coaster,ranking])if(dialog.open)dialog.close();setBoard(false);root.dataset.drunk='0';}};
};
