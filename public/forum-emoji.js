/* One lazy-loaded picker shared by forum composition and replies. */
(function(){
 const forum=document.getElementById('view-forum');if(!forum)return;
 const assets={picker:'/vendor/emoji-picker-element-1.29.1/picker.1e4899dd5c69.js',i18n:'/vendor/emoji-picker-element-1.29.1/zh_CN.15f3bdc51156.js',data:'/vendor/emoji-picker-element-1.29.1/emoji-zh.6d91e2604add.json'};
 let dialog,picker,loading,target=null,range=null;
 function close(){if(dialog?.open)dialog.close();target=null;range=null;}
 function shell(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.className='forum-emoji-dialog';dialog.id='forum-emoji-dialog';dialog.setAttribute('aria-labelledby','forum-emoji-title');
  dialog.innerHTML='<header><h3 id="forum-emoji-title">快捷表情</h3><button type="button" data-emoji-close aria-label="关闭表情窗口">×</button></header><div class="forum-emoji-content"><p data-emoji-status role="status">正在加载表情…</p><button type="button" data-emoji-retry hidden>重新加载</button><div data-emoji-picker></div></div>';
  forum.append(dialog);dialog.querySelector('[data-emoji-close]').onclick=close;dialog.querySelector('[data-emoji-retry]').onclick=load;
  dialog.addEventListener('close',()=>{target=null;range=null;});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
 }
 async function load(){
  if(picker)return;if(loading)return loading;
  const status=dialog.querySelector('[data-emoji-status]'),retry=dialog.querySelector('[data-emoji-retry]');status.hidden=false;status.textContent='正在加载表情…';retry.hidden=true;
  loading=(async()=>{
   const [{default:Picker},{default:i18n}]=await Promise.all([import(assets.picker),import(assets.i18n)]);
   picker=new Picker({locale:'zh',i18n,dataSource:assets.data});
   // The pinned library exposes an open shadow root for these local UI overrides.
   const style=document.createElement('style');style.textContent='.search-row,.pad-top{display:none!important}.emoji,button.emoji{border-radius:0!important}.category{font-family:var(--terminal-copy,serif);font-size:12px}.picker{border:0}';picker.shadowRoot.append(style);
   picker.addEventListener('emoji-click',event=>{
    const field=target,selection=range,unicode=event.detail.unicode;if(!field?.isConnected||field.disabled||field.readOnly||!unicode)return;
    const max=field.maxLength>0?field.maxLength:2000,start=Math.min(selection.start,field.value.length),end=Math.min(selection.end,field.value.length);
    if(field.value.length-(end-start)+unicode.length>max){status.hidden=false;status.textContent='内容已到字数上限，请先删减一些文字。';return;}
    field.setRangeText(unicode,start,end,'end');field.dispatchEvent(new Event('input',{bubbles:true}));close();field.focus({preventScroll:true});
   });
   dialog.querySelector('[data-emoji-picker]').append(picker);status.hidden=true;
  })().catch(error=>{picker?.remove();picker=null;status.hidden=false;status.textContent='表情未能加载，请重试。';retry.hidden=false;}).finally(()=>{loading=null;});
  return loading;
 }
 forum.addEventListener('click',e=>{
  const button=e.target.closest('[data-forum-emoji-target]');if(!button)return;
  const field=document.getElementById(button.dataset.forumEmojiTarget);if(!field||field.disabled||field.readOnly)return;
  shell();target=field;range={start:field.selectionStart??field.value.length,end:field.selectionEnd??field.value.length};dialog.showModal();load();
 });
 new MutationObserver(()=>{if(forum.classList.contains('hidden'))close();}).observe(forum,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
})();
