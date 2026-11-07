(function(){
  // A nonprinting tombstone keeps source positions stable for server overlays and undo.
  const deletedText='\u2063';
  function syncDeleted(root){
    if(!root)return;const scan=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),parents=new Set();
    if(root.nodeType===3&&root.textContent.includes(deletedText))parents.add(root.parentElement);
    while(scan.nextNode())if(scan.currentNode.textContent.includes(deletedText))parents.add(scan.currentNode.parentElement);
    for(let el of parents){if(el?.matches('[data-type-run]'))el=el.parentElement;if(el&&!el.closest('script,style,textarea,input')&&el.textContent.trim()===deletedText)el.dataset.textDeleted='';}
  }
  syncDeleted(document.body);
  new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')syncDeleted(r.target);else for(const n of r.addedNodes)syncDeleted(n);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
  const design=window.AVEDPlayerDesign;if(!design?.local)return;
  const undoKey='aved_text_editor_undo';let picking=false,target=null,original='',matches=[],undoRecord=null,requestId=0,saving=false;
  const launcher=document.createElement('button');launcher.id='text-edit-launcher';launcher.type='button';launcher.dataset.typeIgnore='';launcher.textContent='✎ 文本编辑';launcher.setAttribute('aria-haspopup','dialog');
  const panel=document.createElement('dialog');panel.id='text-edit-panel';panel.dataset.typeIgnore='';panel.dataset.keepOriginal='';panel.setAttribute('aria-labelledby','text-edit-title');
  panel.innerHTML=`<header><h2 id="text-edit-title">文本编辑</h2><button type="button" data-close aria-label="关闭文本编辑">×</button></header>
    <p>点选页面文案，保存后立即应用。</p>
    <button type="button" id="text-edit-pick">点选页面文字</button>
    <div id="text-edit-fields" hidden><label for="text-edit-value">修改文案</label><textarea id="text-edit-value" rows="5" maxlength="4000"></textarea>
    <div id="text-edit-locations" hidden><label for="text-edit-source">这句文案有多个来源，请选定要修改的位置</label><select id="text-edit-source"></select></div>
    <details id="text-edit-source-detail"><summary>查看源码位置</summary><p id="text-edit-path"></p><pre id="text-edit-context"></pre></details>
    <p>保存会更新这处界面文案；复用它的位置也会一起更新。</p></div>
    <p id="text-edit-status" role="status" aria-live="polite">开启后点选文字即可。</p>
    <footer><button type="button" id="text-edit-undo" hidden>撤销本次保存</button><button type="button" id="text-edit-refresh" hidden>刷新查看</button><button type="button" id="text-edit-delete" hidden disabled>删除这一段</button><button type="button" id="text-edit-save" disabled>保存修改</button></footer>`;
  document.body.append(launcher,panel);
  const $=id=>panel.querySelector('#text-edit-'+id),tell=text=>$('status').textContent=text;
  try{const saved=JSON.parse(sessionStorage.getItem(undoKey)||'null');if(saved&&/^[a-f0-9]{32}$/.test(saved.id)){undoRecord=saved;$('undo').hidden=false;$('refresh').hidden=false;}}catch{}
  const api=(path,body)=>design.text(path,body);
  function errorText(e){return ['TypeError','TimeoutError'].includes(e.name)?(design.local?'本地编辑服务未连接，请启动本地编辑服务。':'服务器连接失败，请稍后重试。'):e.message;}
  function clearOutline(){document.querySelectorAll('[data-text-edit-target]').forEach(el=>el.removeAttribute('data-text-edit-target'));}
  function stopPick(){picking=false;clearOutline();delete document.documentElement.dataset.textEditing;launcher.textContent='✎ 文本编辑';}
  function activate(){document.dispatchEvent(new CustomEvent('aved-edit-mode',{detail:'text'}));}
  function open(){activate();stopPick();if(!panel.open)panel.showModal();}
  function startPick(){activate();picking=true;panel.close();document.documentElement.dataset.textEditing='true';launcher.textContent='点选文字 · Esc 取消';}
  const readText=el=>[...el.childNodes].map(n=>n.nodeType===3?n.textContent:n instanceof Element&&n.matches('[data-type-run]')?n.textContent:'').join('').trim();
  function writeText(el,text){const previous=readText(el),nodes=[...el.childNodes].filter(n=>n.nodeType===3||n instanceof Element&&n.matches('[data-type-run]'));if(!nodes.length)return;nodes[0].textContent=text;nodes.slice(1).forEach(n=>n.remove());if(text===deletedText)el.dataset.textDeleted='';else delete el.dataset.textDeleted;const control=el.closest('button,a');if(control?.getAttribute('aria-label')===previous)control.setAttribute('aria-label',text);}
  const ignored='#text-edit-panel,#text-edit-launcher,#type-study-panel,#type-study-launcher,input,textarea,select,option,script,style';
  const dynamic='.notice-body,.forum-post-content,.life-record,.hub-alias,.hub-welcome h1,#hub-balance,#personal-finance-summary,.stock-quote-price,[data-type-role="number"],#signal-log-lines,#system-realtime-clock';
  function textTarget(el){
    if(el instanceof Element&&el.matches('input,select,textarea'))el=el.closest('label')||el;
    if(!(el instanceof Element)||el.closest(ignored))return null;
    // Preserve small English wrapper spans created by the typography studio.
    if(el.matches('[data-type-run]')&&el.parentElement.children.length===1)el=el.parentElement;
    if(el.matches('svg *:not(text):not(tspan)'))return null;
    if(!readText(el)){const children=[...el.children].filter(child=>!child.matches('svg,input,select,textarea')&&child.textContent.trim());return children.length===1?textTarget(children[0]):null;}
    if(readText(el).length>4000)return null;
    if([...el.children].some(child=>!child.matches('[data-type-run],svg,br,input,textarea,select')))return null;
    return el;
  }
  function selectSource(){const index=$('source').value;const c=index===''?null:matches[Number(index)];$('save').disabled=!c;$('delete').hidden=!target||!!target.closest('button,a,label,summary,svg,[role="button"]')||!!target.querySelector('input,select,textarea,button,a');$('delete').disabled=!c;$('path').textContent=c?c.file+':'+c.line:'';$('context').textContent=c?.context||'';}
  async function inspect(el){
    target=el;original=readText(el);matches=[];const current=++requestId;
    $('fields').hidden=true;$('save').disabled=true;$('delete').hidden=true;open();
    if(el.closest(dynamic)){tell('这块文字来自动态数据或运行状态，请通过对应业务功能修改。这里仅编辑玩家页面的界面文案。');return;}
    tell('正在定位文案来源…');
    try{const data=await api('/resolve',{text:original});
      if(!data.matches.length&&window.AVEDTerminology?.transform){
        const all=await api('/labels',{}),norm=s=>s.replace(/\s+/gu,' ').trim();
        const sources=all.labels.filter(text=>norm(window.AVEDTerminology.transform(text))===norm(original));
        for(const text of sources)data.matches.push(...(await api('/resolve',{text})).matches);
      }
      if(current!==requestId)return;matches=data.matches;
      if(!matches.length){tell('未找到可安全修改的独立文案。这段文字可能包含动态数据，或由多个片段拼接而成。');return;}
      $('value').value=original;$('fields').hidden=false;$('locations').hidden=matches.length===1;$('source').replaceChildren();
      if(matches.length>1){const blank=document.createElement('option');blank.value='';blank.textContent='请选择来源';$('source').append(blank);}
      matches.forEach((c,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=c.file.replace('public/','')+':'+c.line+' — '+c.context.slice(0,75);$('source').append(option);});
      if(matches.length===1)$('source').value='0';selectSource();tell(matches.length===1?'已定位。修改后点击「保存修改」。':'找到 '+matches.length+' 处相同文案，请先选择来源。');$('value').focus();
    }catch(e){if(current===requestId)tell(errorText(e));}
  }
  launcher.addEventListener('click',open);$('pick').addEventListener('click',startPick);
  panel.querySelector('[data-close]').addEventListener('click',()=>panel.close());$('source').addEventListener('change',selectSource);
  panel.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  document.addEventListener('aved-edit-mode',e=>{if(e.detail!=='text'){stopPick();panel.close();requestId++;}});
  document.addEventListener('pointerover',e=>{if(!picking)return;clearOutline();const el=textTarget(e.target);if(el)el.dataset.textEditTarget='true';},true);
  window.addEventListener('pointerdown',e=>{if(picking&&!e.target.closest('#text-edit-launcher,#type-study-launcher')){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('click',e=>{if(!picking||e.target.closest('#text-edit-launcher,#type-study-launcher'))return;e.preventDefault();e.stopImmediatePropagation();const el=textTarget(e.target);if(el)inspect(el);},true);
  document.addEventListener('keydown',e=>{if(picking&&e.key==='Escape'){stopPick();e.preventDefault();}});
  async function saveText(deleting=false){
    const c=matches[Number($('source').value)];if(!c||$('source').value==='')return;
    if(saving)return;
    const editTarget=target,before=original;saving=true;panel.querySelector('[data-close]').disabled=true;$('save').disabled=true;$('delete').disabled=true;$('pick').disabled=true;$('source').disabled=true;$('undo').disabled=true;tell(design.local?'正在写入本地源码…':'正在保存到服务器…');
    try{const value=deleting?deletedText:$('value').value;const result=await api('/save',{...c,text:value});undoRecord={id:result.undoId,target:editTarget,before,after:result.text};
      try{sessionStorage.setItem(undoKey,JSON.stringify({id:result.undoId,before,after:result.text}));}catch{}
      if(editTarget?.isConnected){writeText(editTarget,result.text);target=null;}
      matches=[];$('undo').hidden=false;$('refresh').hidden=false;$('fields').hidden=true;$('delete').hidden=true;tell((deleting?'已删除这一段，可点击「撤销本次保存」恢复。':'已保存修改。')+' '+result.file+':'+result.line+'，刷新后仍然生效。');
    }catch(e){tell(errorText(e));$('save').disabled=false;$('delete').disabled=false;}finally{saving=false;panel.querySelector('[data-close]').disabled=false;$('pick').disabled=false;$('source').disabled=false;$('undo').disabled=false;}
  }
  $('save').addEventListener('click',()=>saveText());
  $('delete').addEventListener('click',()=>saveText(true));
  $('undo').addEventListener('click',async()=>{if(!undoRecord)return;$('undo').disabled=true;try{await api('/undo',{undoId:undoRecord.id});const connected=undoRecord.target?.isConnected;if(connected&&readText(undoRecord.target)===undoRecord.after)writeText(undoRecord.target,undoRecord.before);undoRecord=null;try{sessionStorage.removeItem(undoKey);}catch{}$('undo').hidden=true;tell('已撤销本次源码保存。');if(!connected)location.reload();}catch(e){tell(errorText(e));}finally{$('undo').disabled=false;}});
  $('refresh').addEventListener('click',()=>location.reload());
})();
