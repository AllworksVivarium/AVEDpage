/* Server-backed room. Cups are personal daily orders; other guests are real SSE connections. */
window.AVEDBar=function({api,esc,getUser,onBalance,onExit}){
 const nav=document.createElement('button');nav.type='button';nav.className='nav-tab-btn w-full px-3 py-3 flex items-center gap-3 opacity-80 hover:opacity-100 text-left cursor-pointer transition';nav.dataset.nav='bar';nav.title='Sloper';nav.setAttribute('aria-label','Sloper');nav.innerHTML='<span class="sidebar-symbol" aria-hidden="true"></span><span class="sidebar-label truncate">Sloper</span>';
 document.querySelector('[data-nav=casino]').after(nav);
 const root=document.createElement('section');root.className='bar-room bar-night';root.hidden=true;root.setAttribute('aria-label','Sloper 酒吧');root.innerHTML=`<header class="bar-header"><button type="button" class="bar-exit" data-bar-exit>← 离开</button><div class="bar-brand"><b>Sloper</b><small>AFTER HOURS / AVED</small></div><span class="bar-online"><i></i><span data-bar-online>— 人在座</span></span><button type="button" data-bar-music aria-label="播放酒吧音乐" title="酒吧音乐">♫</button></header>
 <div class="bar-scene"><div class="bar-stage"><img class="bar-background" src="/assets/bar/background.png" alt="像素酒吧的酒柜"><img class="bar-neon" src="/assets/bar/background.png" alt="" aria-hidden="true"><img class="bar-npc" hidden alt="今日值班调酒师"><img class="bar-counter" src="/assets/bar/counter.png" alt="" aria-hidden="true"></div><div class="bar-scene-caption">TONIGHT'S SHIFT<span data-bar-npc>值班调酒师</span></div><div class="bar-bubble" data-bar-bubble hidden></div><div class="bar-glasses" data-bar-glasses></div><div class="bar-scene-bottom"><button type="button" class="bar-order-button" data-bar-menu>翻开酒单 ↗</button></div></div>
 <section class="bar-chat" aria-label="酒吧公共聊天"><header class="bar-chat-header"><b>吧台闲聊</b><div class="bar-cheers-invite" data-bar-cheers hidden aria-live="polite"></div></header><div class="bar-log" data-bar-log role="log" aria-label="酒吧聊天记录" aria-live="polite"><button type="button" data-bar-more hidden>调阅更早的闲聊</button><div data-bar-messages><p class="bar-chat-empty">吧台已经擦好了。<br>第一句话，想说什么？</p></div></div><form class="bar-chat-form"><select name="identityMode" aria-label="聊天身份"><option value="anonymous">匿名</option><option value="real">实名</option></select><textarea name="message" rows="1" maxlength="300" aria-label="酒吧消息" placeholder="说点什么吧……"></textarea><button type="submit">发送</button><p class="bar-feedback" data-bar-feedback role="status" hidden></p></form></section>
 <dialog class="bar-menu-dialog" aria-label="酒吧酒单"><header><div><h2>今晚喝点什么？</h2><small>THE COUNTER / DRINK MENU</small></div><button type="button" data-bar-menu-close aria-label="关闭酒单">×</button></header><p class="bar-menu-intro">余额 <strong data-bar-balance>—</strong></p><label class="bar-volume">音乐音量<input type="range" min="0" max="100" value="35" aria-label="酒吧音乐音量" data-bar-volume></label><section class="bar-menu-grid" data-bar-menu-grid></section><section class="bar-order-confirm" data-bar-confirm hidden><p data-bar-order-text></p><div><button type="button" data-bar-order-cancel>再看看</button><button type="button" class="bar-buy" data-bar-buy>确认点单</button></div></section></dialog>`;
 document.body.append(root);
 const $=selector=>root.querySelector(selector),menu=$('.bar-menu-dialog'),log=$('[data-bar-log]'),messages=$('[data-bar-messages]'),feedback=$('[data-bar-feedback]');
 let open=false,version=0,source=null,snapshot=null,drinks=[],returnHash='#/profile',welcomeTimer=0,bubbleTimer=0,chatterTimer=0,olderBusy=false,nextBefore=null,paginationStarted=false,selection=null,buying=false,pendingOrder=null,chatBusy=false,layout='';
 const stored=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};let muted=stored('aved_bar_music_muted',stored('aved_sfx_v1','on')==='off'?'true':'false')==='true';const music=AVEDBarAudio({onError:()=>{muted=true;paintMusic();tell('音乐暂时无法播放。');}});let volume=Math.max(0,Math.min(100,Number(stored('aved_bar_volume','35'))||0));music.volume(volume);$('[data-bar-volume]').value=volume;$('[data-bar-volume]').oninput=e=>{volume=Number(e.target.value);music.volume(volume);try{localStorage.setItem('aved_bar_volume',String(volume));}catch{}};
 const identity=$('[name=identityMode]');identity.onchange=()=>{const id=getUser()?.id;if(id)try{localStorage.setItem('aved_bar_identity_'+id,identity.value);}catch{}};
 const money=n=>'¤ '+Number(n||0).toLocaleString();
 let cheersBusy=false,cheersAsking=false,cheersTimer=0,receivedAt=0;const seenCheers=new Set();
 const tell=text=>{feedback.textContent=text;feedback.hidden=!text;};
 function bubble(text,duration=3500){clearTimeout(bubbleTimer);const box=$('[data-bar-bubble]');box.textContent=text;box.hidden=false;bubbleTimer=setTimeout(()=>box.hidden=true,duration);}
 function paintMusic(){const button=$('[data-bar-music]');const available=!!snapshot?.music&&snapshot.music.enabled&&(snapshot.music.tracks.length||snapshot.music.previewFallback),playing=!muted&&!!available;button.disabled=!available;button.setAttribute('aria-label',playing?'静音酒吧音乐':'播放酒吧音乐');button.setAttribute('aria-pressed',String(playing));button.title=playing?'静音酒吧音乐':'播放酒吧音乐';button.textContent=playing?'♫':'♪';button.style.opacity=playing?'1':'.5';}
 function paintGlasses(){
  if(!snapshot)return;const capacity=innerWidth<600?3:innerWidth<1000?5:6,selfId=snapshot.selfId;
  const own=snapshot.myDrink?{employeeId:selfId,alias:'你的这一杯',drink:snapshot.myDrink}:null;
  const interaction=[...(snapshot.cheers||[])].reverse().find(item=>[item.senderId,item.recipientId].includes(selfId))||snapshot.cheersInvites?.[0],partner=interaction&&(interaction.senderId===selfId?interaction.recipientId:interaction.senderId);
  const available=snapshot.guests.filter(x=>x.employeeId!==selfId&&x.drink),others=available.slice(0,capacity-(own?1:0));
  if(partner&&!others.some(guest=>guest.employeeId===partner)){const guest=available.find(item=>item.employeeId===partner);if(guest&&others.length)others[others.length-1]=guest;}
  const scene=$('.bar-scene').getBoundingClientRect(),stage=$('.bar-stage').getBoundingClientRect(),left=Math.max(28,stage.left-scene.left+stage.width*.359866+34),right=Math.min(scene.width-34,stage.right-scene.left-34);
  const shown=[...(own?[own]:[]),...others],key=JSON.stringify([capacity,shown,drinks,Math.round(left),Math.round(right)]);if(key===layout)return;layout=key;
  const positions=capacity===3?[.5,.2,.8]:capacity===5?[.5,.3,.7,.1,.9]:[.5,.34,.66,.18,.82,.06];
  $('[data-bar-glasses]').innerHTML=shown.map((guest,i)=>{const drink=drinks.find(x=>x.id===guest.drink.drinkId);if(!drink)return '';const mine=guest.employeeId===selfId,image=`<img src="${esc(drink.image)}" alt="${esc(mine?'你的'+drink.name:guest.alias+'点的'+drink.name)}">`;return `<figure class="bar-glass ${mine?'own':''}" data-glass-owner="${guest.employeeId}" style="--glass-left:${left+(right-left)*positions[i]}px" title="${esc(mine?'你的'+drink.name:guest.alias+' · '+drink.name)}">${mine?image:`<button type="button" class="bar-glass-action" data-cheers-target="${guest.employeeId}" aria-label="与${esc(guest.alias)}碰杯" title="${esc(own?'与'+guest.alias+'碰杯':'先点一杯酒')}" ${own?'':'disabled'}>${image}</button>`}<figcaption>${esc(mine?'你的这一杯':guest.alias)}</figcaption></figure>`;}).join('');
 }
 function paintCheers(){
  clearTimeout(cheersTimer);const panel=$('[data-bar-cheers]'),now=(snapshot?.serverTime||0)+Date.now()-receivedAt,invites=(snapshot?.cheersInvites||[]).filter(invite=>invite.expiresAt>now);
  if(!invites.length){panel.hidden=true;panel.dataset.key='';return;}
  const key=JSON.stringify(invites);panel.hidden=false;
  if(panel.dataset.key!==key){panel.dataset.key=key;panel.innerHTML=invites.map(invite=>{const incoming=invite.recipientId===snapshot.selfId;return `<div class="bar-cheers-row" data-cheers-id="${esc(invite.id)}">${incoming?`<span>${esc(invite.senderName)} 想和你碰一杯</span><button type="button" data-cheers-reply="accepted">碰杯</button><button type="button" data-cheers-reply="declined">婉拒</button>`:`<span>等 ${esc(invite.recipientName)} 碰一杯</span><button type="button" data-cheers-reply="cancelled">取消</button>`}</div>`;}).join('');}
  for(const button of panel.querySelectorAll('button'))button.disabled=cheersBusy;
  cheersTimer=setTimeout(paintCheers,Math.max(1,Math.min(...invites.map(invite=>invite.expiresAt-now))));
 }
 function animateCheers(items,{initial=false}={}){
  for(const item of items||[]){
   if(seenCheers.has(item.id))continue;seenCheers.add(item.id);if(initial)continue;
   const glasses=[item.senderId,item.recipientId].map(id=>$(`[data-glass-owner="${id}"] img`)).filter(Boolean),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(!reduce&&glasses.length){const centers=glasses.map(img=>{const box=img.getBoundingClientRect();return box.left+box.width/2;}),middle=centers.reduce((a,b)=>a+b,0)/centers.length;glasses.forEach((img,i)=>{const dx=glasses.length===2?middle-centers[i]+(i?-9:9):0;img.animate([{transform:'translate(0,0) rotate(0)'},{transform:`translate(${dx}px,-12px) rotate(${i?-9:9}deg)`,offset:.4},{transform:`translate(${dx}px,-10px) rotate(${i?-5:5}deg)`,offset:.6},{transform:'translate(0,0) rotate(0)'}],{duration:950,easing:'ease-in-out'});});}
   if([item.senderId,item.recipientId].includes(snapshot.selfId)&&stored('aved_sfx_v1','on')!=='off')window.AVEDBarClink?.();
  }
  if(seenCheers.size>100){const recent=[...seenCheers].slice(-50);seenCheers.clear();recent.forEach(id=>seenCheers.add(id));}
 }
 const messageStore=new Map();
 function paintMessages(items,{older=false,initial=false}={}){
  const pinned=log.scrollHeight-log.scrollTop-log.clientHeight<70,oldHeight=log.scrollHeight,oldTop=log.scrollTop;
  for(const item of items)messageStore.set(item.id,item);
  const oldestTime=Date.now()-5*86400000;for(const [id,item] of messageStore)if(Date.parse(item.createdAt)<oldestTime)messageStore.delete(id);
  const sorted=[...messageStore.values()].sort((a,b)=>a.id-b.id);
  // Rebuild only when IDs/content change; heartbeat updates do not move a reader.
  const key=JSON.stringify(sorted);if(messages.dataset.key===key)return;messages.dataset.key=key;
  messages.innerHTML=sorted.map(item=>`<article class="bar-message ${item.employeeId===snapshot?.selfId?'mine':''}"><header><span>${esc(item.alias)}</span><time>${esc(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(item.createdAt)))}</time></header><p>${esc(item.body)}</p></article>`).join('')||'<p class="bar-chat-empty">吧台已经擦好了。<br>第一句话，想说什么？</p>';
  if(older)log.scrollTop=oldTop+log.scrollHeight-oldHeight;else if(initial||pinned)log.scrollTop=log.scrollHeight;
 }
 function receive(data,{initial=false}={}){
  if(!open||String(data.selfId)!==String(getUser()?.id))return;
  const dayChanged=snapshot&&snapshot.day!==data.day;snapshot=data;receivedAt=Date.now();music.configure(data.music);paintMusic();root.dataset.bartender=data.npc.id;onBalance(data.balance);
  $('[data-bar-online]').textContent=data.onlineCount+' 人在座';$('[data-bar-menu]').disabled=false;$('[data-bar-npc]').textContent=data.npc.image?data.npc.name:'今晚营业中';const portrait=$('.bar-npc');portrait.hidden=!data.npc.image;if(data.npc.image)portrait.src=data.npc.image;$('[data-bar-balance]').textContent=money(data.balance);
  if(initial||!paginationStarted&&nextBefore===null){nextBefore=data.nextBefore;$('[data-bar-more]').hidden=!nextBefore;}
  if(dayChanged){layout='';if(data.npc.image)bubble('新的一天开始了。今天想喝点什么？');}
  paintGlasses();paintMessages(data.items,{initial});paintCheers();animateCheers(data.cheers,{initial});
 }
 function renderMenu(){
  $('[data-bar-menu-grid]').innerHTML=drinks.map((drink,index)=>`<button type="button" class="bar-menu-item" data-menu-number="${String(index+1).padStart(2,'0')}" data-drink="${esc(drink.id)}" aria-pressed="false"><img src="${esc(drink.image)}" loading="lazy" alt=""><span>${esc(drink.name)}</span><small>${esc(money(drink.price))}</small></button>`).join('');
 }
 function selectDrink(drink){selection=drink;if(pendingOrder?.drinkId!==drink.id)pendingOrder=null;$('[data-bar-confirm]').hidden=false;for(const button of root.querySelectorAll('[data-drink]'))button.setAttribute('aria-pressed',String(button.dataset.drink===drink.id));$('[data-bar-order-text]').textContent=drink.name+' · '+money(drink.price)+(snapshot?.myDrink?' · 替换当前酒杯':'');$('[data-bar-buy]').textContent='确认点单 · '+money(drink.price);}
 async function enter({fromRoute=false}={}){
  if(open||!getUser())return;identity.value=stored('aved_bar_identity_'+getUser().id,'anonymous')==='real'?'real':'anonymous';open=true;const visit=++version;if(!fromRoute){returnHash=location.hash||'#/profile';history.pushState({...history.state,avedBar:true},'','#/bar');window.dispatchEvent(new Event('aved-bar-change'));}else returnHash='#/profile';
  root.hidden=false;document.body.classList.add('bar-room-open');document.documentElement.classList.add('bar-room-root-open');document.querySelector('#inner-app-view').inert=true;root.querySelector('[data-bar-exit]').focus();
  messageStore.clear();messages.dataset.key='';nextBefore=null;paginationStarted=false;layout='';snapshot=null;tell('');$('[data-bar-menu]').disabled=true;paintMusic();
  try{
   const data=await api('/api/player/bar');if(!open||version!==visit)return;drinks=data.menu;renderMenu();receive(data,{initial:true});if(!muted)music.play().catch(()=>{muted=true;paintMusic();});
   source=new EventSource('/api/player/bar/events');source.addEventListener('bar',event=>{if(!open||version!==visit)return;try{receive(JSON.parse(event.data));}catch{}});source.onerror=()=>{if(version===visit){tell('连接中断，正在重试。');$('[data-bar-online]').textContent='— 人在座';api('/api/me',{retries:0}).catch(error=>{if(error.status===401&&version===visit){leave();window.AVEDFeedback.alert('接入已失效，请重新登录。');}});}};
   if(data.npc.image)welcomeTimer=setTimeout(()=>{if(open&&version===visit)bubble(data.npc.welcome,1800);},250);
   chatterTimer=setInterval(()=>{if(open&&!document.hidden&&!menu.open&&snapshot?.npc.image)bubble(snapshot.npc.lines[Math.floor(Math.random()*snapshot.npc.lines.length)]);},120000);
  }catch(error){if(version!==visit)return;tell(error.message);$('[data-bar-online]').textContent='— 人在座';}
 }
 function leave({navigation=true}={}){
  if(!open)return;open=false;version++;source?.close();source=null;clearTimeout(welcomeTimer);clearTimeout(bubbleTimer);clearTimeout(cheersTimer);clearInterval(chatterTimer);music.stop();if(menu.open)menu.close();root.hidden=true;document.body.classList.remove('bar-room-open');document.documentElement.classList.remove('bar-room-root-open');document.querySelector('#inner-app-view').inert=false;
  if(navigation&&location.hash==='#/bar')history.replaceState(history.state,'',returnHash);if(navigation)onExit?.();window.dispatchEvent(new Event('aved-bar-change'));nav.focus();
 }
 let asking=false;nav.onclick=async()=>{if(!getUser()||asking)return;asking=true;try{if(await window.AVEDFeedback.confirm('进去坐坐？',{title:'Sloper',tone:'info',confirmLabel:'进入酒吧',cancelLabel:'取消'}))enter();}finally{asking=false;}};
 $('[data-bar-exit]').onclick=()=>leave();
 $('[data-bar-glasses]').onclick=async event=>{
  const button=event.target.closest('[data-cheers-target]');if(!button||cheersBusy||cheersAsking||!snapshot?.myDrink)return;
  const guest=snapshot.guests.find(item=>item.employeeId===Number(button.dataset.cheersTarget));if(!guest)return;
  const visit=version;cheersAsking=true;
  try{
   if(!await AVEDFeedback.confirm('和'+guest.alias+'碰一杯？',{title:'碰杯',confirmLabel:'邀请碰杯',cancelLabel:'取消'}))return;
   if(!open||visit!==version)return;cheersBusy=true;paintCheers();
   await api('/api/player/bar/cheers',{method:'POST',body:{targetId:guest.employeeId,identityMode:identity.value,requestId:crypto.randomUUID()}});if(open&&visit===version)tell('');
  }catch(error){if(open&&visit===version)tell(error.message);}finally{cheersBusy=false;cheersAsking=false;if(open&&visit===version)paintCheers();}
 };
 $('[data-bar-cheers]').onclick=async event=>{
  const button=event.target.closest('[data-cheers-reply]'),id=button?.closest('[data-cheers-id]')?.dataset.cheersId,invite=snapshot?.cheersInvites?.find(item=>item.id===id);if(!button||!invite||cheersBusy)return;
  const visit=version;cheersBusy=true;paintCheers();
  try{await api('/api/player/bar/cheers/'+invite.id,{method:'POST',body:{decision:button.dataset.cheersReply,identityMode:identity.value}});if(open&&visit===version)tell('');}
  catch(error){if(open&&visit===version)tell(error.message);}finally{cheersBusy=false;if(open&&visit===version)paintCheers();}
 };
 $('[data-bar-music]').onclick=()=>{muted=!muted;try{localStorage.setItem('aved_bar_music_muted',String(muted));}catch{}paintMusic();if(muted)music.stop();else music.play().catch(()=>{muted=true;paintMusic();tell('音乐暂时无法播放。');});};
 $('[data-bar-menu]').onclick=()=>{if(!snapshot)return;menu.showModal();};$('[data-bar-menu-close]').onclick=()=>{if(!buying)menu.close();};
 $('[data-bar-order-cancel]').onclick=()=>{if(!buying){selection=null;pendingOrder=null;$('[data-bar-confirm]').hidden=true;for(const button of root.querySelectorAll('[data-drink]'))button.setAttribute('aria-pressed','false');}};
 $('[data-bar-menu-grid]').onclick=e=>{const button=e.target.closest('[data-drink]');if(button&&!buying)selectDrink(drinks.find(x=>x.id===button.dataset.drink));};
 $('[data-bar-buy]').onclick=async()=>{
  if(!selection||buying)return;const visit=version;buying=true;pendingOrder??={drinkId:selection.id,requestId:crypto.randomUUID()};$('[data-bar-buy]').disabled=true;$('[data-bar-menu-close]').disabled=true;
  try{const data=await api('/api/player/bar/orders',{method:'POST',body:pendingOrder});pendingOrder=null;if(!open||visit!==version)return;snapshot.myDrink=data.myDrink;snapshot.balance=data.balance;onBalance(data.balance);paintGlasses();$('[data-bar-balance]').textContent=money(data.balance);menu.close();tell('');}
  catch(error){if(visit!==version)return;$('[data-bar-order-text]').textContent=error.message+(['NETWORK','TIMEOUT','INVALID_RESPONSE'].includes(error.code)?' 可点击重试，使用同一凭据不会重复扣款。':'');if(!['NETWORK','TIMEOUT','INVALID_RESPONSE'].includes(error.code))pendingOrder=null;}
  finally{buying=false;$('[data-bar-buy]').disabled=false;$('[data-bar-menu-close]').disabled=false;}
 };
 $('.bar-chat-form').onsubmit=async e=>{e.preventDefault();if(chatBusy||!snapshot)return;const field=e.currentTarget.elements.message,body=field.value.trim();if(!body)return;const identityMode=identity.value;chatBusy=true;const visit=version,button=e.currentTarget.querySelector('button');button.disabled=true;
  try{await api('/api/player/bar/messages',{method:'POST',body:{body,identityMode}});if(open&&version===visit){field.value='';tell('');log.scrollTop=log.scrollHeight;}}
  catch(error){if(version===visit)tell(error.message);}finally{chatBusy=false;button.disabled=false;}
 };
 $('[data-bar-more]').onclick=async()=>{if(olderBusy||!nextBefore)return;olderBusy=true;const button=$('[data-bar-more]'),visit=version;button.disabled=true;try{const data=await api('/api/player/bar/messages?before='+nextBefore);if(open&&visit===version){paginationStarted=true;paintMessages(data.items,{older:true});nextBefore=data.nextBefore;button.hidden=!nextBefore;}}catch(error){if(visit===version)tell(error.message);}finally{olderBusy=false;button.disabled=false;}};
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.open){e.preventDefault();leave();}});menu.addEventListener('cancel',e=>{if(buying)e.preventDefault();e.stopPropagation();});
 window.addEventListener('resize',()=>{if(open)paintGlasses();});window.addEventListener('pagehide',()=>leave({navigation:false}));
 return {enter,leave,isOpen:()=>open};
};
