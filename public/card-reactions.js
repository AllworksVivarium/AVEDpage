/* Small, non-blocking overlay; game moves and reaction requests are independent. */
window.AVEDCardReactionsUI=function({panel,api,esc,portrait,getState}){
 const rules=window.AVEDCardReactionRules,items=new Map(rules.items.map(x=>[x.id,x]));
 const felt=panel.querySelector('.ddz-felt'),layer=document.createElement('div'),bar=document.createElement('div');
 layer.className='ddz-reaction-layer';layer.setAttribute('aria-hidden','true');felt.append(layer);
 bar.className='ddz-reaction-bar';bar.hidden=true;
 bar.innerHTML=`<div role="group" aria-label="牌桌快捷表情">${rules.quick.map(x=>`<button type="button" data-card-reaction="${x.id}" aria-label="${esc(x.label)}" title="${esc(x.label)}">${x.emoji}</button>`).join('')}</div><span class="ddz-reaction-status" role="status" aria-live="polite"></span>`;
 panel.querySelector('[data-ddz-actions]').after(bar);
 const status=bar.querySelector('[role=status]'),seen=new Set(),bubbles=new Map(),expiries=new Set();let roomId=null,pending=false,lastSent=-Infinity,cooldownTimer,statusTimer;
 function buttonState(){for(const b of bar.querySelectorAll('button'))b.disabled=pending||performance.now()-lastSent<850;}
 function clear(){layer.replaceChildren();seen.clear();bubbles.clear();for(const timer of expiries)clearTimeout(timer);expiries.clear();clearTimeout(cooldownTimer);clearTimeout(statusTimer);status.textContent='';}
 function seatNode(state,seat){
  if(!state.spectating&&seat===state.seat)return panel.querySelector('[data-ddz-self]');
  const positions=state.size===4||state.spectating?['right','top','left']:['right','left'];
  const n=state.spectating?seat:(seat-state.seat-1+state.size)%state.size;
  return state.spectating&&seat===3?panel.querySelector('[data-ddz-self]'):panel.querySelector(`[data-seat="${positions[n]}"]`);
 }
 function place(node,state,seat){
  const box=felt.getBoundingClientRect(),anchor=seatNode(state,seat)?.getBoundingClientRect();if(!anchor)return;
  const x=anchor.left-box.left+anchor.width*.85,y=anchor.top-box.top-12;
  const half=28;
  node.style.left=Math.max(half,Math.min(felt.clientWidth-half,x))+'px';node.style.top=Math.max(34,Math.min(felt.clientHeight-24,y))+'px';
 }
 function scatter(id){let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);n=Math.imul(n^(n>>>16),0x7feb352d);return (n^(n>>>15))>>>0;}
 function show(event,state,age){
  const item=items.get(event.emoji),person=state.seats[event.seat];if(!item||!person)return;
  const node=document.createElement('span');node.className=event.replyTo||event.context?'ddz-reaction-bubble':'ddz-reaction-flight';node.dataset.reactionId=event.id;
  if(event.replyTo||event.context){
   bubbles.get(event.seat)?.node.remove();bubbles.set(event.seat,{node,event});
   node.textContent=item.emoji;
   node.style.animationDelay=-age+'ms';place(node,state,event.seat);
  }else{
   const seed=scatter(event.id);
   node.innerHTML=`<span class="ddz-reaction-glyph">${item.emoji}</span>${portrait(person)}`;
   node.style.left=(12+seed%77)+'%';node.style.top='calc(100% - 18px)';
   node.style.setProperty('--reaction-rise',-(95+(seed>>>8)%50)+'px');
   node.style.setProperty('--reaction-drift',((seed&1)?1:-1)*(14+(seed>>>16)%20)+'px');node.style.animationDelay=-age+'ms';
  }
  layer.append(node);
  // A fallback also clears nodes when animations are disabled or a tab is hidden.
  const remove=()=>{node.remove();expiries.delete(expiry);if(bubbles.get(event.seat)?.node===node)bubbles.delete(event.seat);};
  const expiry=setTimeout(remove,Math.max(0,rules.lifetime-age));expiries.add(expiry);
  node.addEventListener('animationend',()=>{clearTimeout(expiry);remove();},{once:true});
  for(const img of node.querySelectorAll('img'))img.onerror=()=>img.replaceWith(document.createTextNode('·'));
 }
 function render(state){
  if(state?.id!==roomId){clear();roomId=state?.id||null;lastSent=-Infinity;}
  bar.hidden=!state||state.spectating;buttonState();if(!state)return;
  layer.dataset.motion=window.AVEDEffectsEnabled?.()===false?'off':'on';
  const now=Number.isFinite(state.serverTime)?state.serverTime:Date.now();
  for(const event of state.reactions||[]){if(seen.has(event.id))continue;seen.add(event.id);const age=Math.max(0,now-event.at);if(age<rules.lifetime&&!document.hidden&&!panel.classList.contains('hidden'))show(event,state,age);}
  if(seen.size>128){const keep=[...seen].slice(-64);seen.clear();keep.forEach(id=>seen.add(id));}
  for(const {node,event} of bubbles.values())place(node,state,event.seat);
 }
 bar.addEventListener('click',async e=>{
  const button=e.target.closest('[data-card-reaction]'),state=getState();if(!button||button.disabled||!state||state.spectating||pending)return;
  pending=true;lastSent=performance.now();buttonState();status.textContent='';const sentRoom=state.id;
  try{const data=await api('/api/player/card-table',{method:'POST',retries:0,body:{action:'reaction',room:sentRoom,emoji:button.dataset.cardReaction,requestId:crypto.randomUUID()}});receive(data);}
  catch(error){if(getState()?.id===sentRoom){status.textContent=error.message||'表情发送失败';clearTimeout(statusTimer);statusTimer=setTimeout(()=>status.textContent='',3000);}}
  finally{pending=false;buttonState();clearTimeout(cooldownTimer);cooldownTimer=setTimeout(buttonState,Math.max(0,850-(performance.now()-lastSent)));}
 });
 window.addEventListener('resize',()=>{const state=getState();if(state)for(const {node,event} of bubbles.values())place(node,state,event.seat);});
 function receive(data){const state=getState();if(state&&state.id===data.roomId)render({...state,reactions:data.reactions,serverTime:data.serverTime});}
 return {render,receive};
};
