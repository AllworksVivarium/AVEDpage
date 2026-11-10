// Admin-only button dialogs. Moving nodes preserves form state and event handlers.
(function(){
 let serial=0;
 function upgrade(){
  const content=document.getElementById('panel');if(content){for(const title of content.querySelectorAll(':scope > h3,:scope > .section-heading'))title.remove();}
  for(const details of document.querySelectorAll('#dashboard details')){
   if(!details.isConnected||details.hasAttribute('data-dossier-section'))continue;
   const summary=details.querySelector(':scope > summary');if(!summary)continue;
   const wrapper=document.createElement('section');
   for(const attr of details.attributes)if(attr.name!=='open')wrapper.setAttribute(attr.name,attr.value);
   wrapper.classList.add('admin-button-panel');
   const button=document.createElement('button');button.type='button';button.className='small-action admin-open-dialog';button.textContent=summary.textContent;button.id='admin-dialog-label-'+(++serial);button.setAttribute('aria-haspopup','dialog');
   const dialog=document.createElement('dialog');dialog.className='admin-dialog';dialog.setAttribute('aria-labelledby',button.id);
   const header=document.createElement('header'),title=document.createElement('h3'),close=document.createElement('button');
   title.textContent=summary.textContent;close.type='button';close.className='small-action';close.textContent='×';close.setAttribute('aria-label','关闭'+summary.textContent);header.append(title,close);
   const body=document.createElement('div');body.className='admin-dialog-body';
   for(const node of [...details.childNodes])if(node!==summary)body.append(node);
   dialog.append(header,body);wrapper.append(button,dialog);details.replaceWith(wrapper);
   button.onclick=()=>dialog.showModal();close.onclick=()=>dialog.close();
   dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  }
  for(const button of document.querySelectorAll('[data-content-delete],[data-speech-remove],[data-rule-remove],[data-delete-employee-id],[data-delete-type],[data-pool-remove],[data-range-remove]'))button.classList.add('small-action','danger');
 }
 const panel=document.getElementById('dashboard');if(!panel)return;
 new MutationObserver(upgrade).observe(panel,{childList:true,subtree:true});upgrade();
 // Persistent deletes already confirm in their handlers; draft removals confirm here.
 const confirmedDraftRemovals=new WeakSet(),pendingDraftRemovals=new WeakSet();
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-pool-remove],[data-range-remove]');
  if(!button)return;
  if(confirmedDraftRemovals.delete(button))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(pendingDraftRemovals.has(button))return;
  pendingDraftRemovals.add(button);
  try{
   if(await window.AVEDFeedback.confirm('确认删除这一项配置？保存后生效。')){
    if(button.isConnected&&!button.disabled){confirmedDraftRemovals.add(button);button.click();}
   }
  }finally{pendingDraftRemovals.delete(button);}
 },true);
})();
