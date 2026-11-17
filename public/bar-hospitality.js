window.AVEDBarHospitality=function({root,api,esc,getSnapshot,getIdentity,apply,openMenu,onCheers,onError}){
 const dialog=document.createElement('dialog');dialog.className='bar-menu-dialog bar-hospitality-dialog';dialog.setAttribute('aria-label','请客');
 dialog.innerHTML='<header><h2 data-host-title>请客</h2><button type="button" data-host-close aria-label="关闭请客">×</button></header><div class="bar-host-body"><section data-host-guest hidden><p data-host-guest-name></p><div class="bar-host-actions"><button type="button" data-host-cheers>碰杯</button><button type="button" data-host-gift>请一杯</button></div></section><section data-host-main><div class="bar-host-invites" data-host-invites></div><label class="bar-host-pick">请一位客人喝酒<select data-host-guests aria-label="选择请客对象"></select></label><button type="button" data-host-choose>选一杯请对方</button><hr><div data-host-round></div><form data-host-form><h3>全场我买单 · 一小时</h3><label>总预算<input type="number" min="1" max="1000000000" step="1" value="100000" inputmode="numeric" required aria-label="全场买单总预算"></label><p class="bar-host-note">按实际点单扣款，预算或余额不足即结束。离开酒吧后仍有效，可随时结束。</p><button type="submit">开始请全场</button></form><p class="bar-host-note" data-host-last hidden></p></section><p class="bar-host-error" role="alert" hidden></p></div>';
 root.append(dialog);
 const entry=document.createElement('button');entry.type='button';entry.textContent='请客';entry.dataset.barHospitality='';root.querySelector('.bar-menu-tools').prepend(entry);
 const notice=document.createElement('button');notice.type='button';notice.className='bar-host-notice';notice.hidden=true;root.querySelector('.bar-chat-header').append(notice);
 const money=n=>'¤ '+Number(n||0).toLocaleString(),$=s=>dialog.querySelector(s);
 let busy=false,generation=0,guest=null,pendingRound=null,receivedAt=0,budgetInitialized=false;
 const error=message=>{$('.bar-host-error').textContent=message;$('.bar-host-error').hidden=!message;};
 function show(selected=null){guest=selected;for(const other of root.querySelectorAll('dialog[open]'))other.close();error('');paint();dialog.showModal();}
 function paint(){
  const data=getSnapshot();if(!data)return;
  if(!budgetInitialized){$('input').value=String(Math.max(1,Math.min(100000,data.balance)));budgetInitialized=true;}
  const now=data.serverTime+Math.max(0,Date.now()-receivedAt),r=data.hostedRound&&data.hostedRound.endsAt>now?data.hostedRound:null;
  const gifts=(data.hospitality?.gifts||[]).filter(x=>x.expiresAt>now),incoming=gifts.filter(x=>x.recipientId===data.selfId);
  notice.hidden=!r&&!incoming.length;notice.textContent=[r?`${r.alias} 请全场 · ${Math.max(1,Math.ceil((r.endsAt-now)/60000))} 分钟`:'',incoming.length?`${incoming.length} 份请客邀请`:''].filter(Boolean).join(' · ');
  entry.textContent=incoming.length?'请客 · '+incoming.length:'请客';
  if(!dialog.open&&!guest)return;
  $('[data-host-title]').textContent=guest?guest.alias:'请客';$('[data-host-main]').hidden=!!guest;$('[data-host-guest]').hidden=!guest;
  if(guest){$('[data-host-guest-name]').textContent=guest.alias;$('[data-host-cheers]').disabled=busy||!(data.myDrink?.remainingMl>0&&guest.drink?.remainingMl>0);$('[data-host-gift]').disabled=busy;return;}
  const select=$('[data-host-guests]'),selected=select.value,people=data.guests.filter(x=>x.employeeId!==data.selfId),peopleKey=JSON.stringify(people.map(x=>[x.employeeId,x.alias]));
  if(select.dataset.key!==peopleKey){select.dataset.key=peopleKey;select.innerHTML=people.length?people.map(x=>`<option value="${x.employeeId}">${esc(x.alias)}</option>`).join(''):'<option value="">暂无其他客人</option>';if(people.some(x=>String(x.employeeId)===selected))select.value=selected;}
  $('[data-host-choose]').disabled=busy||!people.length;
  const list=$('[data-host-invites]'),listKey=JSON.stringify([gifts,data.myDrink?.id]);
  if(list.dataset.key!==listKey){list.dataset.key=listKey;list.innerHTML=gifts.map(g=>{const incoming=g.recipientId===data.selfId,drink=data.menu.find(x=>x.id===g.drinkId);return `<article><p>${esc(incoming?g.senderName+' 请你喝': '你请 '+g.recipientName+' 喝')} ${esc(drink?.name||'一杯')} · ${money(g.price)}</p>${incoming&&data.myDrink?'<small>接受后替换桌上饮品</small>':''}<div>${incoming?`<button type="button" data-gift-id="${g.id}" data-gift-reply="accepted">接受</button><button type="button" data-gift-id="${g.id}" data-gift-reply="declined">婉拒</button>`:`<span>等待对方接受后扣款</span><button type="button" data-gift-id="${g.id}" data-gift-reply="cancelled">取消</button>`}</div></article>`;}).join('');}
  $('[data-host-round]').innerHTML=r?`<h3>${esc(r.alias)} 正在请全场</h3><p>已买单 ${money(r.spent)} / ${money(r.budget)}</p>${r.employeeId===data.selfId?`<button type="button" data-host-end="${r.id}">结束本轮请客</button>`:''}`:'';
  $('[data-host-form]').hidden=!!r;
  const last=data.hospitality?.lastRound;$('[data-host-last]').hidden=!last||last.id===r?.id;$('[data-host-last]').textContent=last?`上一轮已买单 ${money(last.spent)} · ${{expired:'已满一小时',budget:'预算用尽',balance:'余额不足',cancelled:'已结束',active:'已结束'}[last.status]||'已结束'}`:'';
  for(const button of dialog.querySelectorAll('[data-gift-reply],[data-host-end],[type=submit],[data-host-close]'))button.disabled=busy;
 }
 async function mutate(path,body,after){if(busy)return;busy=true;error('');const visit=generation;paint();try{const data=await api(path,{method:'POST',body});if(visit!==generation)return;apply(data);after?.();}catch(problem){if(visit===generation)error(problem.message);}finally{if(visit===generation){busy=false;paint();}}}
 entry.onclick=()=>{show();paint();};notice.onclick=entry.onclick;
 $('[data-host-close]').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{e.stopPropagation();if(busy)e.preventDefault();});
 $('[data-host-choose]').onclick=()=>{const person=getSnapshot()?.guests.find(x=>String(x.employeeId)===$('[data-host-guests]').value);if(person){dialog.close();openMenu(person);}};
 $('[data-host-gift]').onclick=()=>{dialog.close();openMenu(guest);};$('[data-host-cheers]').onclick=()=>{dialog.close();onCheers(guest);};
 $('[data-host-form]').onsubmit=event=>{event.preventDefault();const budget=Number($('input').value);if(!Number.isSafeInteger(budget)||budget<1||budget>1000000000){error('请填写有效的整数预算。');return;}if(!pendingRound||pendingRound.budget!==budget)pendingRound={budget,requestId:crypto.randomUUID(),identityMode:getIdentity()};mutate('/api/player/bar/rounds',pendingRound,()=>{pendingRound=null;});};
 dialog.addEventListener('click',event=>{const gift=event.target.closest('[data-gift-reply]'),end=event.target.closest('[data-host-end]');if(gift)mutate('/api/player/bar/gifts/'+gift.dataset.giftId,{decision:gift.dataset.giftReply},()=>onError(''));if(end)mutate('/api/player/bar/rounds/'+end.dataset.hostEnd,{decision:'cancelled'});});
 return {openGuest(person){show(person);},receive(){receivedAt=Date.now();paint();},close(){generation++;busy=false;guest=null;pendingRound=null;budgetInitialized=false;dialog.close();notice.hidden=true;}};
};
