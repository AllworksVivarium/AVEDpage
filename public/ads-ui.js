/* Daily auctions share the wallet; browsing activity stays local to avoid polling. */
window.AVEDAdIdle=(last,now)=>!Number.isFinite(last)||last<=0||last>now||now-last>=30*60000;
window.AVEDAds=function({api,esc,getUser,onBalance}){
 const money=n=>Number(n).toLocaleString()+' ¤',date=n=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(n));
 const make=(cls,title)=>{const d=document.createElement('dialog');d.className=cls;d.setAttribute('aria-label',title);document.body.append(d);return d;};
 const marketDialog=make('ad-market-dialog','广告事务'),preview=make('ad-preview-dialog','广告预览'),popup=make('ad-popup-dialog','今日广告');
 marketDialog.innerHTML='<header class="ad-window-heading"><h2>广告事务</h2><button type="button" data-ad-close aria-label="关闭广告事务">×</button></header><nav class="ad-tabs"><button type="button" data-ad-tab="auction">明日竞拍</button><button type="button" data-ad-tab="mine">我的广告</button><button type="button" data-ad-tab="protection">广告保护</button></nav><div class="ad-market-content"></div><p class="ad-market-status" role="status"></p>';
 const content=marketDialog.querySelector('.ad-market-content'),status=marketDialog.querySelector('[role=status]');
 const entry=document.createElement('section');entry.className='ad-exchange-entry';entry.innerHTML='<div><small>AD EXCHANGE</small><h3>明日广告位</h3></div><p>公司需要你的支持，同事需要你的消息！</p><button type="button" class="community-button">进入竞拍 ↗</button>';
 document.querySelector('#game-panel-home .company-ranking-panel').after(entry);entry.querySelector('button').onclick=()=>openMarket();
 const shortcut=document.createElement('button');shortcut.type='button';shortcut.textContent='广告竞拍';shortcut.onclick=()=>openMarket();document.querySelector('#game-panel-home .casino-home-shortcuts').append(shortcut);
 const strips=['forum','casino'].map(slot=>{const el=document.createElement('aside');el.className='ad-text-strip';el.hidden=true;el.dataset.adSlot=slot;el.setAttribute('aria-label',slot==='forum'?'论坛广告':'游戏厅广告');if(slot==='casino')document.querySelector('#game-panel-home .welfare-dashboard').before(el);else (document.querySelector('#forum-list-subview [aria-label="帖子底部翻页"]')||document.getElementById('forum-threads-list-container')).after(el);return el;});
 let owner=null,state=null,tab='auction',slotId='popup',busy=false,image='',imageBusy=false,imageVersion=0,editId=null,request=null,protectionRequest=null,visitBusy=false,visitAgain=false,version=0,countTimer=null,expiryTimer=null,display=null,delta=0,localLast=0,storedAt=0,entryTimer=null,pendingPopup=null,lastAttempt=0,previewVersion=0;
 const examples=[
  {label:'文字示例',title:'欢迎来到万业携生员工内网！',body:'我能吞下玻璃而不伤身体\n滚滚长江东逝水\n衣带渐宽终不悔，为伊消得人憔悴。\n\n汉体书写信息标准基础相容档案下载使用界面简单志愿服务升级方案。',signature:'万业携生网络工程部'},
  {label:'图文示例',title:'下班来坐一会儿',body:'忙完了就来 Sloper 坐坐。\n喝点东西，听首歌，碰见同事就聊两句。',signature:'Sloper',imageUrl:'/assets/ad-examples/sloper.webp'},
  {label:'图片示例',imageUrl:'/assets/ad-examples/company.webp'}
 ];
 const now=()=>Date.now()+delta;
 const activityKey=()=> 'aved-ad-activity:'+getUser()?.id;
 const readActivity=()=>{try{const n=Number(localStorage.getItem(activityKey()));return Number.isFinite(n)&&n<=Date.now()?n:0;}catch{return localLast;}};
 function touch(force=false){localLast=Date.now();if(force||localLast-storedAt>10000){storedAt=localLast;try{localStorage.setItem(activityKey(),String(localLast));}catch{}}}
 function art(item){return `<article class="ad-creative ${item.imageUrl||item.image?'ad-with-image':''}" data-type-ignore data-keep-original>${item.imageUrl||item.image?`<img src="${esc(item.imageUrl||item.image)}" alt="广告配图">`:''}${item.title?`<h3 class="ad-creative-title">${esc(item.title)}</h3>`:''}${item.body?`<p class="ad-copy">${esc(item.body)}</p>`:''}${item.signature?`<footer><span class="ad-signature">${esc(item.signature)}</span></footer>`:''}</article>`;}
 const stripExamples=new Map();
 function showStripExample(slot){
  const target=strips.find(el=>el.dataset.adSlot===slot);if(!target)return;
  let example=stripExamples.get(slot);
  if(!example){example=document.createElement('aside');example.className='ad-text-strip ad-text-example';example.setAttribute('aria-label',slot==='forum'?'论坛广告示例':'游戏厅广告示例');target.before(example);stripExamples.set(slot,example);}
  example.hidden=false;
  example.innerHTML='<small>广告示例</small>'+art({title:'欢迎来到万业携生员工内网！',body:'我能吞下玻璃而不伤身体\n滚滚长江东逝水',signature:'万业携生网络工程部'})+'<button type="button" data-ad-hide-example>收起示例</button>';
  example.querySelector('button').onclick=()=>{example.hidden=true;};
  marketDialog.close();if(slot==='forum')document.querySelector('[data-nav="forum"]').click();else document.querySelector('[data-nav="casino"]').click();
  requestAnimationFrame(()=>example.scrollIntoView({block:'center'}));
 }
 async function showPreview(item,label='广告预览'){
  const token=++previewVersion,actor=getUser()?.id;
  if(item.imageUrl||item.image){const img=new Image();img.src=item.imageUrl||item.image;try{await img.decode();}catch{feedback('配图读取失败，请重新选择。');return;}}
  if(token!==previewVersion||getUser()?.id!==actor||!marketDialog.open)return;
  preview.innerHTML='<div class="ad-popup-label">'+esc(label)+'<span>点击任意处关闭</span></div>'+art(item);if(!preview.open)preview.showModal();
 }
 function paintTabs(){marketDialog.querySelectorAll('[data-ad-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adTab===tab)));}
 function clearCount(){clearInterval(countTimer);countTimer=null;}
 function countdown(){const el=content.querySelector('[data-ad-countdown]');if(!el||!state)return;const seconds=Math.max(0,Math.ceil((state.endsAt-now())/1000));el.textContent=Math.floor(seconds/3600).toString().padStart(2,'0')+':'+Math.floor(seconds/60%60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');if(!seconds&&!busy){clearCount();refreshMarket().catch(e=>status.textContent=e.message);}}
 function render(){
  clearCount();paintTabs();if(!state){content.textContent='读取广告位…';return;}status.textContent='';
  if(tab==='auction'){
   const s=state.slots.find(x=>x.id===slotId)||state.slots[0];slotId=s.id;
   content.innerHTML=`<section class="ad-example-previews" aria-label="广告示例"><span>看看广告效果</span><div>${s.image?examples.map((item,index)=>`<button type="button" data-ad-example="${index}">${esc(item.label)}</button>`).join(''):`<button type="button" data-ad-strip-example="${s.id}">${esc(s.name)}示例</button>`}</div></section><div class="ad-auction-meta"><span>明日投放</span><span>每日 04:00 截止</span><span>距截止 <b data-ad-countdown></b></span><button type="button" data-ad-refresh>刷新报价</button></div><div class="ad-slot-grid">${state.slots.map(x=>`<button type="button" data-ad-pick="${x.id}" aria-pressed="${x.id===s.id}"><span>${esc(x.name)}</span><strong>${money(x.amount||x.base)}</strong><small>${x.amount?(x.mine?'你正在领先':'当前最高价'):'起拍价'} · ${x.image?'图文':'文字'}</small></button>`).join('')}</div><form class="ad-editor"><h3>${editId?'修改待投放广告':esc(s.name)}</h3><label>标题<input name="title" maxlength="20" required aria-describedby="ad-title-format" placeholder="20 字以内"><small id="ad-title-format" class="ad-short-note">单行标题</small></label><label>正文<textarea name="body" maxlength="${s.image?320:120}" rows="4" aria-describedby="ad-body-format" placeholder="${s.image?'160 字以内，可手动换行。':'60 字以内，可手动换行一次。'}"></textarea><small id="ad-body-format" class="ad-format-note"><span>最多手动换行 ${s.image?5:1} 次</span><span data-ad-body-count>0 / ${s.image?160:60}</span></small></label>${s.image?'<label class="ad-file-label">配图<input name="file" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="ad-image-summary" hidden><img alt="已选配图"><button type="button" data-ad-clear-image>移除图片</button></div>':''}<label>署名<input name="signature" maxlength="20" placeholder="选填，20 字以内 · 展示在右下方"></label>${editId?'':`<label>出价<input name="amount" type="number" min="${s.minimum}" max="${s.maximum}" step="${s.step}" value="${s.minimum}" aria-describedby="ad-amount-range" ${s.minimum>s.maximum?'disabled':''} required></label><p class="ad-short-note" id="ad-amount-range">${s.minimum>s.maximum?'报价已达上限。':s.amount?'本次出价：'+money(s.minimum)+'。每次仅加价 '+money(s.step)+'。':'出价范围：'+money(s.minimum)+' 至 '+money(s.maximum)+'，按 '+money(s.step)+' 递增。'}领先时预扣，被超过全额退回。</p>`}<div class="ad-editor-actions"><button type="button" data-ad-preview>预览</button><button type="submit">${editId?'保存广告':'确认出价'}</button></div><p class="ad-editor-feedback" role="status"></p></form>`;
   countdown();countTimer=setInterval(()=>{if(!marketDialog.open){clearCount();return;}countdown();},1000);
   content.querySelector('[data-ad-refresh]').onclick=()=>refreshMarket().catch(e=>status.textContent=e.message);
   content.querySelectorAll('[data-ad-pick]').forEach(b=>b.onclick=()=>{if(busy)return;slotId=b.dataset.adPick;editId=null;image='';imageBusy=false;imageVersion++;request=null;render();});
   content.querySelectorAll('[data-ad-example]').forEach(button=>button.onclick=()=>{const item=examples[Number(button.dataset.adExample)];if(item)void showPreview(item,'广告预览 · '+item.label);});
   content.querySelector('[data-ad-strip-example]')?.addEventListener('click',()=>showStripExample(s.id));
   bindEditor(s);
  }else if(tab==='mine'){
   const labels={leading:'正在领先',outbid:'已超价 · 款项已退',won:'已得标',removed:'已撤下 · 款项已退'};
   content.innerHTML='<div class="ad-history">'+(state.mine.map(x=>`<article><header><b>${esc(state.slots.find(s=>s.id===x.slot)?.name||'广告位')}</b><span>${x.day===state.tomorrow?'明天':AVEDTime.relative(x.day)}</span></header><div class="ad-history-state"><strong>${money(x.amount)}</strong><small>${labels[x.status]}</small></div>${art(x)}${x.removedReason?`<p>${esc(x.removedReason)}</p>`:''}${x.status==='leading'&&x.day===state.tomorrow?`<button type="button" data-ad-edit="${x.id}">修改广告</button>`:''}</article>`).join('')||'<p class="ad-empty">还没有竞拍记录。</p>')+'</div>';
   content.querySelectorAll('[data-ad-edit]').forEach(b=>b.onclick=()=>loadEdit(Number(b.dataset.adEdit)));
  }else{
   content.innerHTML=`<section class="ad-protection"><small>QUIET TERMINAL</small><h3>广告保护</h3><p>屏蔽全站弹窗与文字广告。续费累加时长。</p><strong>${state.protectionUntil>now()?'有效至 '+date(state.protectionUntil):'尚未开启'}</strong><div class="ad-plan-grid">${state.plans.map(p=>`<button type="button" data-ad-plan="${p.days}"><b>${p.days} 天</b><span>${money(p.price)}</span></button>`).join('')}</div><form class="ad-protect-confirm" hidden><p></p><button type="submit">确认购买</button><button type="button" data-ad-cancel-plan>取消</button></form></section>`;
   const form=content.querySelector('form');let chosen=null;
   content.querySelectorAll('[data-ad-plan]').forEach(b=>b.onclick=()=>{if(busy)return;chosen=state.plans.find(p=>p.days===Number(b.dataset.adPlan));protectionRequest=null;form.hidden=false;form.querySelector('p').textContent=(state.protectionUntil>now()?'续费':'购买')+' '+chosen.days+' 天 · '+money(chosen.price);});
   form.querySelector('[data-ad-cancel-plan]').onclick=()=>{if(!busy)form.hidden=true;};
   form.onsubmit=async e=>{e.preventDefault();if(!chosen||busy)return;protectionRequest??=crypto.randomUUID();await mutate('/api/player/ads/protection',{days:chosen.days,confirmed:true,requestId:protectionRequest},'POST',()=>{popup.close();pendingPopup=null;for(const el of strips)el.hidden=true;try{localStorage.setItem('aved-ad-protection:'+owner,String(Date.now()));}catch{}void visit(false);});};
  }
 }
 function values(){const form=content.querySelector('.ad-editor');return {title:form.elements.title.value,body:form.elements.body.value,signature:form.elements.signature.value,image};}
 function feedback(message){const el=content.querySelector('.ad-editor-feedback');if(el)el.textContent=message;else status.textContent=message;}
 function updateImage(){const box=content.querySelector('.ad-image-summary');if(box){box.hidden=!image;box.querySelector('img').src=image||'';}}
 function bindEditor(s){
  const form=content.querySelector('.ad-editor');
  const bodyLimit=s.image?160:60,breakLimit=s.image?5:1;
  function validate(){const v=values(),length=Array.from(v.body).length;form.querySelector('[data-ad-body-count]').textContent=length+' / '+bodyLimit;form.elements.title.setCustomValidity(!v.title.trim()?'请填写广告标题。':/[\r\n\t]/.test(v.title)?'标题请使用单行文字。':'');form.elements.body.setCustomValidity(length>bodyLimit?'正文最多 '+bodyLimit+' 字。':(v.body.match(/\n/g)||[]).length>breakLimit?'正文最多手动换行 '+breakLimit+' 次。':'');return form.reportValidity();}
  form.addEventListener('input',()=>{request=null;const length=Array.from(form.elements.body.value).length;form.querySelector('[data-ad-body-count]').textContent=length+' / '+bodyLimit;form.elements.body.setCustomValidity('');form.elements.title.setCustomValidity('');});
  if(s.image){form.elements.file.onchange=async()=>{const token=++imageVersion,actor=owner;imageBusy=true;form.querySelector('[type=submit]').disabled=true;form.querySelector('[data-ad-preview]').disabled=true;try{const value=await AVEDImageUpload.read(form.elements.file.files[0]);if(token===imageVersion&&actor===owner&&form.isConnected){image=value;request=null;updateImage();feedback('');}}catch(e){if(token===imageVersion)feedback(e.message);}finally{if(token===imageVersion){imageBusy=false;if(form.isConnected){form.querySelector('[type=submit]').disabled=false;form.querySelector('[data-ad-preview]').disabled=false;}}}};
   form.querySelector('[data-ad-clear-image]').onclick=()=>{imageVersion++;imageBusy=false;image='';request=null;form.elements.file.value='';form.querySelector('[type=submit]').disabled=false;form.querySelector('[data-ad-preview]').disabled=false;updateImage();};}
  form.querySelector('[data-ad-preview]').onclick=()=>{if(imageBusy||!validate())return;const v=values();if(!v.body.trim()&&!v.image){feedback('请填写广告文字或选择图片。');return;}void showPreview(v);};
  form.onsubmit=async e=>{e.preventDefault();if(busy||imageBusy||!validate())return;const data=values();if(!data.body.trim()&&!data.image){feedback('请填写广告文字或选择图片。');return;}const actor=owner;
   if(editId){await mutate('/api/player/ads/bids/'+editId,data,'PUT',()=>{editId=null;tab='mine';});return;}
   request??=crypto.randomUUID();await mutate('/api/player/ads/bids',{...data,slot:s.id,day:state.tomorrow,amount:Number(form.elements.amount.value),confirmed:true,requestId:request},'POST',()=>{if(owner===actor){request=null;tab='mine';image='';}});
  };
 }
 async function loadEdit(id){
  if(busy)return;const row=state.mine.find(x=>x.id===id);if(!row)return;busy=true;const actor=owner;status.textContent='读取广告…';
  try{let value='';if(row.imageUrl){const res=await fetch(row.imageUrl,{credentials:'same-origin',cache:'no-store'});if(!res.ok)throw Error('配图读取失败。');value=await new Promise((resolve,reject)=>{res.blob().then(blob=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('配图读取失败。'));reader.readAsDataURL(blob);}).catch(reject);});}
   if(owner!==actor||!marketDialog.open)return;image=value;imageBusy=false;editId=id;slotId=row.slot;tab='auction';render();const f=content.querySelector('form');for(const k of ['title','body','signature'])f.elements[k].value=row[k]||'';f.querySelector('[data-ad-body-count]').textContent=Array.from(row.body||'').length+' / '+(slotId==='popup'?160:60);updateImage();
  }catch(e){status.textContent=e.message;}finally{if(owner===actor)busy=false;}
 }
 function locks(value){marketDialog.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=value);}
 async function mutate(path,body,method,done){
  if(busy)return;busy=true;locks(true);const actor=owner;feedback('');status.textContent='提交中…';
  try{const d=await api(path,{method,body});if(owner!==actor||getUser()?.id!==actor)return;state=d;delta=d.serverTime-Date.now();onBalance(d.balance);done?.();if(marketDialog.open){render();status.textContent=method==='PUT'?'广告已保存。':'操作成功。';}}
  catch(e){if(owner===actor){status.textContent=e.message;feedback(e.message);}}
  finally{if(owner===actor){busy=false;locks(false);}}
 }
 async function refreshMarket(){const actor=owner;const d=await api('/api/player/ads/market');if(owner!==actor||getUser()?.id!==actor||!marketDialog.open)return;state=d;delta=d.serverTime-Date.now();editId=null;image='';imageBusy=false;imageVersion++;render();}
 async function openMarket(initial='auction'){
  if(!getUser())return;owner=getUser().id;tab=initial;editId=null;image='';imageBusy=false;imageVersion++;request=null;state=null;render();if(!marketDialog.open)marketDialog.showModal();try{await refreshMarket();}catch(e){status.textContent=e.message;}
 }
 marketDialog.querySelector('[data-ad-close]').onclick=()=>{if(!busy)marketDialog.close();};
 marketDialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 marketDialog.addEventListener('close',()=>{clearCount();previewVersion++;imageVersion++;imageBusy=false;request=null;tryPopup();});
 marketDialog.querySelectorAll('[data-ad-tab]').forEach(b=>b.onclick=()=>{if(busy)return;tab=b.dataset.adTab;editId=null;image='';imageBusy=false;imageVersion++;request=null;render();});
 for(const el of [preview,popup]){el.onclick=()=>{el.close();touch(true);};el.addEventListener('cancel',()=>touch(true));}
 function paintStrips(){for(const el of strips){const item=display?.items.find(x=>x.slot===el.dataset.adSlot);el.hidden=!item||display.endsAt<=now()||display.protectionUntil>now();el.innerHTML=item?'<small>广告</small>'+art(item)+'<button type="button" data-ad-open>投放 ↗</button>':'';el.querySelector('button')?.addEventListener('click',()=>openMarket());}}
 function tryPopup(){if(!pendingPopup||!getUser()||document.hidden||document.querySelector('dialog[open]')||document.documentElement.dataset.entryState!=='ready')return;const item=pendingPopup;pendingPopup=null;if(!display||display.endsAt<=now()||display.protectionUntil>now())return;popup.innerHTML='<div class="ad-popup-label">广告 <span>点击任意处关闭</span></div>'+art(item);popup.showModal();}
 async function visit(wantPopup){
  if(!getUser()||document.hidden)return;if(visitBusy){visitAgain ||= wantPopup;return;}visitBusy=true;lastAttempt=Date.now();const actor=getUser().id,v=version;
  try{const d=await api('/api/player/ads/visit',{method:'POST',body:{popup:wantPopup}});if(v!==version||getUser()?.id!==actor)return;display=d;delta=d.serverTime-Date.now();paintStrips();clearTimeout(expiryTimer);const expires=d.protectionUntil>now()?Math.min(d.endsAt,d.protectionUntil):d.endsAt;expiryTimer=setTimeout(()=>{for(const el of strips)el.hidden=true;popup.close();pendingPopup=null;display=null;void visit(false);},Math.max(1,expires-now()));
   if(d.popup){if(d.popup.imageUrl){const img=new Image();img.src=d.popup.imageUrl;try{await img.decode();}catch{}if(v!==version||getUser()?.id!==actor)return;}pendingPopup=d.popup;tryPopup();}
  }catch{/* Advertising never blocks navigation or login. */}finally{if(v===version){visitBusy=false;if(visitAgain){visitAgain=false;void visit(true);}}}
 }
 function activity(){if(!getUser()||document.hidden)return;const last=Math.max(localLast,readActivity()),idle=!!last&&window.AVEDAdIdle(last,Date.now());touch();if(idle||((!display||display.endsAt<=now())&&Date.now()-lastAttempt>30000)){void visit(idle);}tryPopup();}
 for(const name of ['pointerdown','keydown','scroll'])document.addEventListener(name,activity,{passive:true,capture:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(getUser())touch(true);}else activity();});
 window.addEventListener('focus',()=>activity());window.addEventListener('pagehide',()=>{if(getUser())touch(true);});
 window.addEventListener('storage',e=>{if(e.key==='aved-ad-protection:'+getUser()?.id){popup.close();pendingPopup=null;for(const el of strips)el.hidden=true;void visit(false);}});
 document.addEventListener('close',tryPopup,true);
 function reset(){for(const example of stripExamples.values())example.hidden=true;version++;previewVersion++;owner=null;state=null;display=null;pendingPopup=null;busy=false;visitBusy=false;visitAgain=false;imageVersion++;imageBusy=false;image='';localLast=0;clearCount();clearTimeout(entryTimer);clearTimeout(expiryTimer);for(const d of [marketDialog,preview,popup])d.close();for(const el of strips)el.hidden=true;}
 function enter(){reset();owner=getUser()?.id;if(!owner)return;const want=window.AVEDAdIdle(readActivity(),Date.now());touch(true);entryTimer=setTimeout(()=>{void visit(want);},500);}
 return {enter,reset,open:openMarket};
};
