window.AVEDIntrusionUI=function({api,getUser,onBalance}){
 let owner=null,state=null,busy=false,reading=null,readAt=0,dialog=null;
 const mounts=new Set(),money=n=>Number(n).toLocaleString();
 const allowed=()=>getUser()?.identityKind==='player_containment';
 function paint(){
  for(const host of mounts){host.hidden=!allowed();if(host.hidden)continue;
   const button=host.querySelector('[data-intrusion]'),toggle=host.querySelector('[data-intrusion-auto]');
   button.disabled=busy||!state||state.claimed;button.textContent=state?.claimed?'今日已黑入':'黑入基金';
   toggle.checked=!!state?.automatic;toggle.disabled=busy||!state;
   const status=host.querySelector('[role=status]'),full=state?(state.claimed?'今日转入 '+money(state.amount)+' 04:00重置':'[基金链路开放] 每日一次'):'[正在接入基金链路]';
   status.textContent=host.classList.contains('hud-intrusion')?(state?(state.claimed?'+'+money(state.amount):'每日一次'):'连接中'):full;status.title=full;
  }
 }
 function current(id){return allowed()&&getUser()?.id===id;}
 async function refresh(){
  if(!allowed()){state=null;owner=null;paint();return;}
  const id=getUser().id;if(owner!==id){owner=id;state=null;readAt=0;reading=null;}
  if(busy||reading||state&&Date.now()-readAt<15000&&Date.now()<state.resetAt){paint();return reading;}
  const request=(async()=>{try{const d=await api('/api/player/intrusion');if(current(id)){state=d;readAt=Date.now();paint();}}catch{if(current(id)){for(const host of mounts)host.querySelector('[role=status]').textContent='[基金链路暂不可用]';}}finally{if(reading===request)reading=null;}})();
  reading=request;return request;
 }
 function panel(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.className='containment-intrusion-dialog';dialog.setAttribute('aria-labelledby','intrusion-dialog-title');
  dialog.innerHTML='<header><span>AVED / MUTUAL AID NODE</span><span data-intrusion-code>UNLISTED ACCESS</span></header><div class="intrusion-content"><p class="intrusion-kicker">[非标准接入]</p><h2 id="intrusion-dialog-title">基金链路接入中</h2><div class="intrusion-meter" role="progressbar" aria-label="链路接入进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="intrusion-log" role="status" aria-live="polite" aria-atomic="true"></div><p class="intrusion-receipt" data-intrusion-receipt hidden></p><button type="button" data-intrusion-close disabled>连接处理中</button></div>';
  document.body.append(dialog);dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.querySelector('[data-intrusion-close]').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('close',()=>{if(dialog._trigger?.isConnected)dialog._trigger.focus();});return dialog;
 }
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion:reduce)').matches?80:ms));
 function phase(title,lines,progress,mode){const d=panel();d.dataset.phase=mode;d.querySelector('h2').textContent=title;d.querySelector('.intrusion-log').replaceChildren(...lines.map(text=>{const line=document.createElement('p');line.textContent=text;return line;}));d.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(progress));d.querySelector('.intrusion-meter i').style.width=progress+'%';}
 async function execute(automatic,trigger){
  if(!allowed()||busy)return;
  const id=getUser().id;
  // Saving an already-used day's automatic setting needs no transfer sequence.
  if(automatic!==undefined&&(!automatic||state?.claimed)){
   busy=true;paint();try{const d=await api('/api/player/intrusion',{method:'PUT',body:{automatic}});if(current(id)){state=d;readAt=Date.now();}}catch(e){readAt=0;window.AVEDFeedback?.toast(e.message,'warn');}finally{busy=false;paint();if(!readAt)refresh();}return;
  }
  busy=true;paint();const d=panel();d._trigger=trigger||document.activeElement;d.querySelector('[data-intrusion-receipt]').hidden=true;const close=d.querySelector('[data-intrusion-close]');close.disabled=true;close.textContent='连接处理中';d.querySelector('[data-intrusion-code]').textContent='UNLISTED ACCESS';d.showModal();
  try{
   phase('基金链路接入中',['[正在检索访问凭据]','[当前连接未列入员工名册]'],18,'connecting');await pause(700);
   phase('访问凭据不匹配',['[收容记录仍然有效]','[收到未知来源的授权回执]','YOU WERE EXPECTED.'],53,'rewriting');await pause(950);
   phase('访问记录正在覆盖',['[资金出口已重定向]','[等待转入回执]'],86,'transfer');await pause(750);
   if(!current(id))throw Error('当前身份连接已结束。');
   // Credit only after the visible access sequence, using the server's daily quota.
   const result=await api('/api/player/intrusion',automatic===undefined?{method:'POST'}:{method:'PUT',body:{automatic}});
   if(!current(id))throw Error('当前身份连接已结束。');
   state=result;readAt=Date.now();phase(result.reward?'转入完成':'今日链路已使用',['[转入回执已接收]','[原始身份记录未变更]','[本日通道关闭；04:00重置]'],100,'complete');
   const receipt=d.querySelector('[data-intrusion-receipt]');receipt.textContent=(result.reward?'+ ':'今日已转入 ')+money(result.reward||result.amount)+' ¤';receipt.hidden=false;d.querySelector('[data-intrusion-code]').textContent='RECEIPT ACCEPTED';onBalance(result.balance);
  }catch(e){phase('连接中断',['[未取得有效转入回执]',e.message],0,'error');d.querySelector('[data-intrusion-code]').textContent='LINK INTERRUPTED';readAt=0;}
  finally{busy=false;paint();close.disabled=false;close.textContent='关闭连接';close.focus();if(!readAt)refresh();}
 }
 function mount(host){
  host.classList.add('containment-intrusion-controls');host.innerHTML='<div><button type="button" data-intrusion disabled>黑入基金</button><label title="开启后执行今日黑入；与手动黑入共用每日一次的机会。"><input type="checkbox" data-intrusion-auto>每日自动黑入</label></div><small role="status">[正在接入基金链路]</small>';
  mounts.add(host);host.querySelector('button').onclick=e=>execute(undefined,e.currentTarget);host.querySelector('input').onchange=e=>execute(e.target.checked,e.target);paint();refresh();
  return {refresh,destroy(){mounts.delete(host);}};
 }
 return {mount,refresh};
};
