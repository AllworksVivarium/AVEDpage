window.AVEDBeggingUI=function({api,esc,getUser,onBalance,showToast,host,onChanged=()=>{}}){
 const entry=document.createElement('button');entry.type='button';entry.className='community-button';entry.textContent='乞讨消息';host.append(entry);
 const dialog=document.createElement('dialog');dialog.className='community-dialog welfare-begging-dialog';dialog.setAttribute('aria-labelledby','begging-dialog-title');
 dialog.innerHTML='<header><h2 id="begging-dialog-title">乞讨消息</h2><button type="button" data-beg-close aria-label="关闭乞讨消息">×</button></header><div data-beg-list></div><p data-beg-status role="status"></p>';
 const app=document.getElementById('inner-app-view');app.append(dialog);
 const compose=document.createElement('dialog');compose.className='community-dialog welfare-begging-dialog';compose.setAttribute('aria-labelledby','begging-compose-title');
 compose.innerHTML='<header><h2 id="begging-compose-title">乞讨</h2><button type="button" aria-label="关闭乞讨窗口">×</button></header><div data-beg-list><form><p>向 <strong data-compose-name></strong> 乞讨</p><label><span>乞讨金额（最高 ¤ 1,000,000）</span><input name="amount" type="number" min="1" max="1000000" step="1" inputmode="numeric" required aria-label="乞讨金额"></label><div class="begging-actions"><button type="submit">发出请求</button></div><p data-beg-error role="status"></p></form></div>';app.append(compose);
 let target=null;
 compose.querySelector('header button').onclick=()=>{if(!busy&&!confirming)compose.close();};compose.addEventListener('cancel',event=>{if(busy||confirming)event.preventDefault();});
 let owner=null,items=[],rewards=[],seen=new Set(),shownRewards=new Set(),shownOwner=null,busy=false,pending=false,lastPoll=0,openRequested=false,promptTimer=0,confirming=false;
 const keys=new Map(),money=n=>'¤ '+Number(n).toLocaleString(),$=s=>dialog.querySelector(s);
 const noticeKeys=()=>[...items.map(item=>'request:'+item.id),...rewards.map(item=>'reward:'+item.id)];
 function markShown(){shownOwner=owner;for(const item of rewards)shownRewards.add(item.id);for(const key of noticeKeys())seen.add(key);}
 function reset(){const id=getUser()?.id||null;if(owner===id)return id;owner=id;target=null;compose.close();items=[];rewards=[];shownRewards.clear();shownOwner=null;seen.clear();keys.clear();lastPoll=0;openRequested=false;clearTimeout(promptTimer);dialog.close();paint();return id;}
 function paint(){const drafts=new Map([...dialog.querySelectorAll('form[data-beg-id]')].map(form=>[Number(form.dataset.begId),form.elements.amount.value]));const count=items.length+rewards.length;entry.textContent='乞讨消息'+(count?' ('+count+')':'');
  $('[data-beg-list]').innerHTML=(rewards.length?'<p class="begging-reward" role="status">恭喜您得到大结果！</p>':'')+items.map(item=>'<form data-beg-id="'+item.id+'"><p><strong>'+esc(item.senderName)+'</strong> 向你乞讨'+(item.requestedAmount?' '+money(item.requestedAmount):'')+'</p><label><span>给予金额（最高 '+money(1000000)+'）</span><input name="amount" type="number" min="1" max="1000000" step="1" inputmode="numeric" required value="'+esc(drafts.get(item.id)??item.requestedAmount??'')+'" aria-label="给予'+esc(item.senderName)+'的金额"></label><div class="begging-actions"><button type="button" data-beg-decline>轻松拒绝</button><button type="submit">狠心同意</button></div><p role="status" data-beg-error></p></form>').join('')||'<p>暂无待处理请求。</p>';
  if(dialog.open)markShown();
 }
 function show(){
  clearTimeout(promptTimer);if(!reset()||document.hidden)return;
  if(!openRequested&&!noticeKeys().some(key=>!seen.has(key)))return;
  if(busy){promptTimer=setTimeout(show,1000);return;}
  if(app.classList.contains('hidden')||document.querySelector('dialog[open]')){if(!dialog.open)promptTimer=setTimeout(show,1000);return;}
  markShown();openRequested=false;dialog.showModal();dialog.querySelector('header button').focus();
 }
 async function refresh(force=false){const id=reset();if(!id||document.hidden||pending||!force&&Date.now()-lastPoll<30000)return;pending=true;lastPoll=Date.now();try{
  const data=await api('/api/player/begging');if(getUser()?.id!==id)return;
  const changed=JSON.stringify([data.items,data.rewards])!==JSON.stringify([items,rewards]);items=data.items;rewards=data.rewards||[];
  if(changed&&!busy)paint();show();
 }catch(error){if(force&&getUser()?.id===id)showToast(error.message);}finally{pending=false;if(getUser()?.id!==id){lastPoll=0;void refresh(true);}}}
 entry.onclick=()=>{openRequested=true;paint();show();void refresh(true);};
 $('[data-beg-close]').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',async()=>{
  const id=shownOwner,ids=[...shownRewards];shownRewards.clear();shownOwner=null;
  if(!id||getUser()?.id!==id||!ids.length)return;
  const read=await Promise.all(ids.map(async noticeId=>{try{await api('/api/player/begging/'+noticeId+'/read',{method:'POST',body:{}});return noticeId;}catch{return null;}}));
  if(getUser()?.id!==id)return;rewards=rewards.filter(item=>!read.includes(item.id));paint();
 });
 async function respond(form,decision){
  if(busy||confirming)return;const id=owner,requestId=Number(form.dataset.begId),amount=decision==='accepted'?Number(form.elements.amount.value):0,errorBox=form.querySelector('[data-beg-error]');
  if(decision==='accepted'&&(!Number.isSafeInteger(amount)||amount<1||amount>1000000)){errorBox.textContent='请输入 1 至 1,000,000 的整数。';return;}
  if(decision==='accepted'){let confirmed;confirming=true;try{confirmed=await window.AVEDFeedback.confirm('确认从本人账户扣除 '+money(amount)+'，给予'+items.find(item=>item.id===requestId)?.senderName+'？',{title:'确认转账',confirmLabel:'狠心同意',cancelLabel:'取消'});}finally{confirming=false;}if(!confirmed)return;}
  if(getUser()?.id!==id||!form.isConnected)return;busy=true;for(const button of dialog.querySelectorAll('button'))button.disabled=true;errorBox.textContent='';
  try{const result=await api('/api/player/begging/'+requestId,{method:'POST',body:{decision,...(decision==='accepted'?{amount}:{} )}});if(getUser()?.id!==id)return;
   onBalance(result.balance);items=items.filter(item=>item.id!==requestId);paint();showToast(decision==='accepted'?'已给予 '+money(result.amount)+'。':'已拒绝这份请求。');onChanged();
   if(!items.length&&!rewards.length)dialog.close();
  }catch(error){if(getUser()?.id===id&&errorBox.isConnected)errorBox.textContent=error.message;}finally{busy=false;for(const button of dialog.querySelectorAll('button'))button.disabled=false;}
 }
 dialog.addEventListener('submit',event=>{const form=event.target.closest('[data-beg-id]');if(form){event.preventDefault();void respond(form,'accepted');}});
 dialog.addEventListener('click',event=>{const decline=event.target.closest('[data-beg-decline]');if(decline)void respond(decline.closest('form'),'declined');});
 function request(recipient){
  const id=reset();if(!id||busy||confirming||recipient.hasBegged||recipient.id===id)return;
  target=recipient;compose.querySelector('form').reset();compose.querySelector('[data-compose-name]').textContent=recipient.name;compose.querySelector('[data-beg-error]').textContent='';compose.showModal();compose.querySelector('input').focus();
 }
 compose.querySelector('form').onsubmit=async event=>{
  event.preventDefault();if(busy||confirming||!target)return;
  const id=owner,recipient=target,amount=Number(event.target.elements.amount.value),errorBox=compose.querySelector('[data-beg-error]');
  if(!Number.isSafeInteger(amount)||amount<1||amount>1000000){errorBox.textContent='请输入 1 至 1,000,000 的整数。';return;}
  let confirmed;confirming=true;try{confirmed=await window.AVEDFeedback.confirm('向'+recipient.name+'乞讨 '+money(amount)+'？',{title:'乞讨',confirmLabel:'发出请求',cancelLabel:'取消'});}finally{confirming=false;}
  if(!confirmed||getUser()?.id!==id||target!==recipient)return;busy=true;for(const button of compose.querySelectorAll('button'))button.disabled=true;errorBox.textContent='';
  const previous=keys.get(recipient.id),key=previous?.amount===amount?previous.key:crypto.randomUUID();keys.set(recipient.id,{amount,key});
  try{await api('/api/player/begging',{method:'POST',body:{recipientId:recipient.id,amount,requestId:key}});if(getUser()?.id!==id)return;keys.delete(recipient.id);compose.close();onChanged();showToast('请求已发送，等待对方回应。');}
  catch(error){if(getUser()?.id===id)errorBox.textContent=error.message;}finally{busy=false;for(const button of compose.querySelectorAll('button'))button.disabled=false;}
 };
 for(const type of ['visibilitychange','aved-session-change'])document.addEventListener(type,()=>{void refresh();});
 window.addEventListener('pageshow',()=>{void refresh();});new MutationObserver(()=>{if(!app.classList.contains('hidden'))void refresh();else reset();}).observe(app,{attributes:true,attributeFilter:['class']});
 setInterval(()=>{void refresh();},30000);void refresh();return {request,refresh};
};
