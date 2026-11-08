/* One small room-directory request, shared by the lounge and the card-table entry. */
window.AVEDCardRoomLobby=function({api,esc,getUser,cardTable,openTable}){
 const Stakes=window.AVEDCardStakes;
 const casino=document.getElementById('view-casino'),home=document.getElementById('game-panel-home'),table=document.getElementById('game-panel-doudizhu');
 const roots=[home,table].map(parent=>{
  const root=document.createElement('section');root.className='card-room-lobby';root.setAttribute('aria-label','智斗太姥联机牌室');
  root.innerHTML='<header><h3>联机牌室</h3><small data-room-reserve>入座余额 ≥ 10,000</small><div class="card-room-controls"><select data-room-base aria-label="开桌底注"><option value="1000">底注 1,000</option><option value="10000">底注 10,000</option><option value="50000">底注 50,000</option><option value="custom">自定义底注</option></select><input data-room-custom-base type="number" min="100" max="1000000" step="1" inputmode="numeric" value="1000" aria-label="自定义开桌底注" hidden><button type="button" data-room-size="3">开三人桌</button><button type="button" data-room-size="4">开四人桌</button><button type="button" data-room-action="refresh" aria-label="刷新牌桌">刷新</button></div></header><div data-room-current hidden></div><p data-room-status role="status">正在读取牌室…</p><div class="card-room-list" data-room-list></div>';
  if(parent===home)document.getElementById('daily-allocation').after(root);else parent.prepend(root);
  return root;
 });
 let current=null,items=[],busy=false,inflight=null,owner=null,lastFetch=0;
 const visible=()=>!!getUser()&&!document.hidden&&!casino.classList.contains('hidden')&&(!home.classList.contains('hidden')||!table.classList.contains('hidden')&&table.dataset.cardPhase==='idle');
 function status(text){for(const root of roots){const el=root.querySelector('[data-room-status]');el.textContent=text;el.hidden=!text;}}
 function render(){for(const root of roots){
  root.querySelectorAll('[data-room-size]').forEach(el=>el.disabled=busy||!!current);
  root.querySelector('[data-room-action="refresh"]').disabled=!!inflight||busy;
  const active=root.querySelector('[data-room-current]');active.hidden=!current;
  active.innerHTML=current?'<span>你已在'+(current.mode==='solo'?'电脑对局桌':esc(current.hostName||'员工')+'的牌桌')+'</span><button type="button" data-room-action="resume">回到牌桌 →</button>':'';
  root.querySelector('[data-room-list]').innerHTML=items.map(room=>{
   const own=current?.id===room.id,phase=room.canJoin?'等待入座':room.phase==='waiting'||room.phase==='ended'?'已坐满':'对局中';
   return '<article><div><strong>'+esc(room.hostName)+'的牌桌</strong><small>'+room.size+' 人桌 · 底注 '+(room.base||100)+' · '+phase+'</small></div><span>'+room.players+' / '+room.size+'</span><button type="button" data-room-id="'+esc(room.id)+'" '+(!own&&(busy||current||!room.canJoin)?'disabled':'')+'>'+(own?'返回':'入座')+'</button><button type="button" data-room-watch="'+esc(room.id)+'" '+(current||busy?'disabled':'')+'>旁观</button></article>';
  }).join('')||'<p class="card-room-empty">暂无员工牌桌，开一桌等同事入座。</p>';
 }}
 async function refresh(force=false){
  if(!visible())return;if(inflight)return inflight;if(!force&&Date.now()-lastFetch<15000&&owner===getUser().id)return;
  const id=getUser().id;owner=id;
  inflight=(async()=>{try{const data=await api('/api/player/card-table/rooms');if(getUser()?.id!==id)return;current=data.currentRoom;items=data.items;lastFetch=Date.now();status('');}catch(error){status(error.message);}finally{inflight=null;render();}})();render();return inflight;
 }
 async function enter(action,extra){
  if(busy)return;busy=true;render();status('正在入座…');
  try{if(await cardTable.enter(action,extra)){openTable();status('');}}
  catch(error){status(error.message);}
  finally{busy=false;render();}
 }
 for(const root of roots){
  const draft=()=>{const select=root.querySelector('[data-room-base]'),input=root.querySelector('[data-room-custom-base]');input.hidden=select.value!=='custom';try{root.querySelector('[data-room-reserve]').textContent='入座余额 ≥ '+Stakes.reserve(Stakes.read(select.value,input.value)).toLocaleString();}catch{root.querySelector('[data-room-reserve]').textContent='请输入有效底注';}};
  root.querySelector('[data-room-base]').onchange=draft;root.querySelector('[data-room-custom-base]').oninput=draft;
  root.onclick=e=>{const button=e.target.closest('button');if(!button||button.disabled)return;
   if(button.dataset.roomWatch)enter('watch',{roomId:button.dataset.roomWatch});
   if(button.dataset.roomSize){try{enter('create',{size:Number(button.dataset.roomSize),base:Stakes.read(root.querySelector('[data-room-base]').value,root.querySelector('[data-room-custom-base]').value)});}catch(error){status(error.message);}}
   if(button.dataset.roomId){if(current?.id===button.dataset.roomId)openTable();else enter('join',{roomId:button.dataset.roomId});}
   if(button.dataset.roomAction==='resume')openTable();
   if(button.dataset.roomAction==='refresh')refresh(true);
  };
 }
 function ensure(){roots[1].hidden=table.dataset.cardPhase!=='idle';if(visible())refresh();}
 const observer=new MutationObserver(ensure);
 for(const element of [casino,home,table])observer.observe(element,{attributes:true,attributeFilter:['class','data-card-phase']});
 document.addEventListener('aved-card-room-change',()=>{lastFetch=0;if(visible())refresh(true);});
 document.addEventListener('visibilitychange',ensure);setInterval(ensure,15000);ensure();
 return {refresh};
};
