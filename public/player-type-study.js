(function(){
  const design=window.AVEDPlayerDesign;if(!design){window.AVEDResolveTypography?.();return;}
  const C=window.AVEDTypeCatalog;if(!C){window.AVEDResolveTypography?.();return;}
  const stateKey='aved_type_design_v2',roles=new Map(C.roles.map(r=>[r.id,r]));
  const ranges={zh:'U+2E80-9FFF,U+F900-FAFF,U+FF00-FFEF,U+20000-2FA1F',en:'U+0000-024F,U+1E00-1EFF,U+2000-206F',he:'U+0590-05FF,U+FB1D-FB4F'};
  let library=[...C.fonts],settings=C.defaults(),db=null,selected='meta',picking=false,revision=0,storageMessage='',serverRevision='';
  const loaded=new Map(),faceObjects=new Map(),pending=new Set();
  const style=document.createElement('style');style.id='aved-type-design-rules';document.head.append(style);
  const launcher=document.createElement('button');launcher.id='type-study-launcher';launcher.type='button';launcher.textContent='Aa 字体设计';launcher.setAttribute('aria-haspopup','dialog');
  const panel=document.createElement('dialog');panel.id='type-study-panel';panel.setAttribute('aria-labelledby','type-study-title');
  panel.innerHTML=`<header><div><p>AVED TYPOGRAPHY STUDIO</p><h2 id="type-study-title">字体设计台</h2></div><button type="button" data-close aria-label="关闭字体设计台">关闭</button></header>
    <p>所有文字归入明确类别。同一类别按同一套中／英／希伯来文字体、字号和行高显示，手机与桌面各用固定字号。</p>
    <div class="type-toolbar"><button type="button" data-pick>点选页面文字</button><button type="button" data-highlight aria-pressed="false">标出当前类别</button></div>
    <p id="type-coverage" aria-live="polite"></p>
    <details class="type-catalog"><summary>查看全部类别与用途</summary><div class="type-catalog-list"></div></details>
    <h3><label for="type-role">正在设计的类别</label></h3><select id="type-role"></select><p id="type-role-description"></p>
    <div class="type-font-grid"><label>中文字体<select id="type-font-zh"></select></label><label>英文字体<select id="type-font-en"></select></label><label>希伯来文字体<select id="type-font-he"></select></label></div>
    <div class="type-number-grid"><label>桌面字号 px<input id="type-desktop" type="number" min="8" max="80" step="1"></label><label>手机字号 px<input id="type-mobile" type="number" min="8" max="80" step="1"></label><label>行高倍数<input id="type-line" type="number" min="1" max="2.5" step="0.05"></label><label>字距 em<input id="type-spacing" type="number" min="-0.05" max="0.3" step="0.01"></label><label>字重<select id="type-weight"><option value="400">常规 400</option><option value="500">中等 500</option><option value="600">半粗 600</option><option value="700">粗体 700</option></select></label><label class="type-checkbox"><input id="type-en-italic" type="checkbox">英文使用斜体</label></div>
    <div class="type-study-sample"><span data-sample="zh">音乐音量 · 万业携生 · 档案说明</span><span data-sample="en" lang="en">A.V.E.D. / PERSONNEL TERMINAL</span><bdi data-sample="he" lang="he" dir="rtl">מסוף עובדים</bdi><span data-sample="mixed">员工记录 RECORD 01 / 12:30</span></div>
    <p>示例与页面同步生效。中文字体缺字时自动回退；英文字体独立选择。图片内嵌文字不属于网页字体。</p>
    <section class="type-import"><h3>字体库</h3><p>选择 TTF、OTF、WOFF 或 WOFF2。导入后先预览，点击保存时一并保存正在使用的字体文件。</p><label>导入后用于<select id="type-import-language"><option value="zh">当前类别的中文</option><option value="en">当前类别的英文</option><option value="he">当前类别的希伯来文</option></select></label><label class="type-file-label" for="type-file">选择本地字体文件<input id="type-file" type="file" accept=".ttf,.otf,.woff,.woff2" multiple></label><ul id="type-user-fonts"></ul></section>
    <p id="type-study-status" role="status" aria-live="polite"></p>
    <footer><button type="button" data-save-design>保存设计</button><button type="button" data-reset-role>还原当前类别</button><button type="button" data-reset-all>还原全部类别</button><button type="button" data-close>查看页面</button></footer>`;
  document.body.append(launcher,panel);
  const $=id=>panel.querySelector('#'+id),status=$('type-study-status');
  function tell(text){status.textContent=text;}
  function save(){try{localStorage.setItem(stateKey,JSON.stringify(settings));return true;}catch{storageMessage='浏览器未允许保存设置，本次修改仅在当前页面有效。';tell(storageMessage);return false;}}
  function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open('aved-local-fonts',1);request.onupgradeneeded=()=>request.result.createObjectStore('fonts',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  function readFonts(){return new Promise((resolve,reject)=>{const request=db.transaction('fonts').objectStore('fonts').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  function storeFont(font){return new Promise((resolve,reject)=>{const tx=db.transaction('fonts','readwrite');tx.objectStore('fonts').put(font);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('字体未保存'));});}
  function fontFamily(id,lang){const font=library.find(f=>f.id===id)||C.fonts.find(f=>f.languages.includes(lang));return font.family||'AVEDDesign_'+font.id+'_'+lang;}
  async function loadFont(id,lang){
    const key=id+':'+lang;if(loaded.has(key))return loaded.get(key);
    const font=library.find(f=>f.id===id);if(!font)return;
    if(font.family){return document.fonts.load('16px "'+font.family+'"',lang==='zh'?'文字':'ABC');}
    const promise=(async()=>{const face=new FontFace(fontFamily(id,lang),font.bytes||'url("'+font.url+'")',{unicodeRange:ranges[lang],display:'swap',...(font.adjust&&lang==='zh'?{sizeAdjust:font.adjust}:{})});await face.load();document.fonts.add(face);faceObjects.set(key,face);})();
    loaded.set(key,promise);try{await promise;}catch(e){loaded.delete(key);throw e;}
  }
  function cssFamily(s){return [fontFamily(s.en,'en'),fontFamily(s.he,'he'),fontFamily(s.zh,'zh'),'Noto Serif SC'].map(f=>'"'+f.replace(/["\\]/g,'')+'"').join(',')+',serif';}
  function applyRules(){
    const css=C.roles.map(({id})=>{const s=settings[id],q='[data-type-role="'+id+'"]';return q+'{font-family:'+cssFamily(s)+' !important;font-size:'+s.desktop+'px !important;line-height:'+s.line+' !important;font-weight:'+s.weight+' !important;letter-spacing:'+s.spacing+'em !important;font-style:normal !important;}'+q+'[data-type-run="en"]{font-style:'+(s.enItalic?'italic':'normal')+' !important;}'+q+'[data-type-run="he"]{direction:rtl;unicode-bidi:isolate;font-style:normal !important;}';}).join('');
    const mobile=C.roles.map(({id})=>'[data-type-role="'+id+'"]{font-size:'+settings[id].mobile+'px !important}').join('');
    style.textContent='@layer aved-type-system{'+css+'@media(max-width:767px){'+mobile+'}html[data-type-highlight] [data-type-highlighted="true"]{outline:1px dashed #dc7373 !important;outline-offset:2px !important}}';
    panel.querySelectorAll('[data-sample]').forEach(el=>{el.dataset.typeRole=selected;el.dataset.typeRun=el.dataset.sample;});
  }
  function isExcluded(el){return el.matches('script,style,noscript,template,svg defs,svg path,svg rect,svg line,svg circle,svg polygon,svg title')||el.closest('#type-study-panel,#type-study-launcher,[data-type-ignore]');}
  function roleFor(el,inherited){
    if(el.dataset.typeRun)return inherited;
    for(const id of C.priority){const role=roles.get(id);if(role.selector&&el.matches(role.selector))return id;}
    if((!inherited||inherited==='body')&&[...el.classList].some(c=>/^text-(?:xs|\[(?:[89]|1[012])px\])$/.test(c)))return 'meta';
    return inherited||'body';
  }
  function classify(el,inherited){
    if(!(el instanceof Element)||isExcluded(el))return;
    const role=roleFor(el,inherited),s=settings[role];el.dataset.typeRole=role;
    if(s.enItalic&&!el.matches('textarea,option,svg *,[data-type-run]')){
      for(const node of [...el.childNodes]){if(node.nodeType!==3||!/[A-Za-z]/.test(node.textContent))continue;
        const fragment=document.createDocumentFragment();node.textContent.split(/([\x20-\x7E]+)/).filter(Boolean).forEach(text=>{if(!/[A-Za-z]/.test(text)){fragment.append(document.createTextNode(text));return;}const span=document.createElement('span');span.dataset.typeRun='en';span.lang='en';span.textContent=text;fragment.append(span);});node.replaceWith(fragment);
      }
    }
    const text=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(text||el.matches('input,textarea,select'))el.dataset.typeText='true';else delete el.dataset.typeText;
    // Classify text surfaces, not whole cards. A rich-text paragraph is filtered
    // once; its inline children must never accumulate another displacement.
    const printable=roles.get(role).render==='print'
      && (text||el.matches('p,h1,h2,h3,h4,h5,h6,li,blockquote')&&el.textContent.trim())
      && [...el.children].every(child=>child.matches('span,b,strong,i,em,u,s,a,br,code,small,bdi,bdo,sub,sup,mark'))
      && !el.closest('button,summary,label,input,textarea,select,[role="button"],[contenteditable="true"],svg,canvas,#slot5x3-grid,#active-ticket-board-container,#ddz-table,.flight-scene,.derby-stage,.market-chart,.hub-signal')
      && !el.parentElement?.closest('[data-type-render="print"]');
    if(printable)el.dataset.typeRender='print';else delete el.dataset.typeRender;
    for(const child of el.children)classify(child,role);
  }
  function classifyPage(){classify(document.body,'body');updateCoverage();highlight();}
  function updateCoverage(){const all=document.querySelectorAll('[data-type-text="true"]:not(#type-study-panel *)');$('type-coverage').textContent='已归类 '+all.length+' 个文字对象 · '+C.roles.length+' 类（含暂未展开的内容）';const count=[...all].filter(el=>el.dataset.typeRole===selected).length;$('type-role-description').textContent=roles.get(selected).description+' · 当前 '+count+' 个文字对象'+(roles.get(selected).render==='print'?' · 轻微撕裂（随本机特效开关）':' · 清晰渲染');}
  function highlight(){document.querySelectorAll('[data-type-highlighted]').forEach(el=>delete el.dataset.typeHighlighted);if(document.documentElement.dataset.typeHighlight)document.querySelectorAll('[data-type-role="'+selected+'"][data-type-text="true"]').forEach(el=>{if(!el.closest('#type-study-panel'))el.dataset.typeHighlighted='true';});}
  function renderFonts(){for(const lang of ['zh','en','he']){const select=$('type-font-'+lang);select.replaceChildren();for(const f of library.filter(f=>f.languages.includes(lang))){const option=document.createElement('option');option.value=f.id;option.textContent=f.name;select.append(option);}select.value=settings[selected][lang];}}
  function renderCatalog(){panel.querySelectorAll('[data-choose-role]').forEach(button=>{const r=roles.get(button.dataset.chooseRole),s=settings[r.id];button.textContent=r.name+' · 桌面 '+s.desktop+' / 手机 '+s.mobile+' px · 行高 '+s.line+' — '+r.description;});}
  function renderEditor(){renderFonts();renderCatalog();$('type-role').value=selected;for(const key of ['desktop','mobile','line','spacing','weight'])$('type-'+key).value=settings[selected][key];$('type-en-italic').checked=settings[selected].enItalic;applyRules();updateCoverage();highlight();}
  async function applyEdit(){
    const draft={...settings[selected]};for(const lang of ['zh','en','he'])draft[lang]=$('type-font-'+lang).value;
    for(const key of ['desktop','mobile','line','spacing','weight']){const input=$('type-'+key);if(input.value===''||!input.checkValidity()){tell('请填写有效的字号、行高和字距。');return;}draft[key]=Number(input.value);}
    draft.enItalic=$('type-en-italic').checked;settings=C.sanitize({...settings,[selected]:draft},library);applyRules();renderCatalog();classifyPage();save();
    const current=++revision;tell('正在应用字体…');try{await Promise.all(['zh','en','he'].map(lang=>loadFont(draft[lang],lang)));if(current===revision)tell(storageMessage||'预览已应用；点击保存设计后正式生效。');}catch{if(current===revision)tell('部分字体加载失败，已使用后备字体；可重新选择或重新导入。');}
  }
  function renderLibrary(){const list=$('type-user-fonts');list.replaceChildren();for(const f of library.filter(f=>f.id.startsWith('user_'))){const li=document.createElement('li');li.textContent=f.name+(f.bytes?' · '+(f.bytes.byteLength/1024/1024).toFixed(1)+' MB':' · 已保存');list.append(li);}}
  async function saveDesign(){
    const button=panel.querySelector('[data-save-design]');button.disabled=true;tell('正在保存设计和字体文件…');
    try{const snapshot=structuredClone(settings),used=new Set(Object.values(snapshot).flatMap(s=>[s.zh,s.en,s.he])),fonts=[];
      for(const font of library.filter(f=>f.id.startsWith('user_')&&used.has(f.id))){const item={id:font.id,name:font.name};if(font.bytes)item.base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(new Blob([font.bytes]));});fonts.push(item);}
      const result=await design.saveType({settings:snapshot,fonts,revision:serverRevision});serverRevision=result.revision;
      tell(design.local?'已保存到项目；字体和排版会随下次部署发布。':'已保存到服务器，当前设计已正式生效。');
    }catch(e){tell(e.message||'保存失败，请稍后重试。');}finally{button.disabled=false;}
  }
  async function importFiles(){
    const files=[...$('type-file').files],target=selected,lang=$('type-import-language').value;let count=0;const failures=[];
    $('type-file').disabled=true;
    for(const file of files){
      try{if(!/\.(ttf|otf|woff2?)$/i.test(file.name))throw Error('请选择字体格式');if(file.size>64*1024*1024)throw Error('字体超过 64 MB');if(!db)throw Error('浏览器本地字体库不可用');
        tell('正在导入 '+file.name+'…');const bytes=await file.arrayBuffer(),font={id:'user_'+crypto.randomUUID().replaceAll('-',''),name:file.name,bytes,languages:['zh','en','he']};
        library.push(font);try{await loadFont(font.id,lang);await storeFont(font);}catch(e){library=library.filter(f=>f.id!==font.id);const face=faceObjects.get(font.id+':'+lang);if(face)document.fonts.delete(face);throw e;}
        settings[target][lang]=font.id;count++;
      }catch(e){failures.push(file.name+'：'+(e.message||'字体无法读取'));}
    }
    $('type-file').disabled=false;$('type-file').value='';save();renderEditor();renderLibrary();classifyPage();tell((count?'已导入 '+count+' 款，应用到「'+roles.get(target).name+'」的'+{zh:'中文',en:'英文',he:'希伯来文'}[lang]+'。':'')+(failures.length?' '+failures.join('；'):''));
  }
  function stopPick(){picking=false;launcher.textContent='Aa 字体设计';}
  function initUI(){
    for(const r of C.roles){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;$('type-role').append(o);const button=document.createElement('button');button.type='button';button.dataset.chooseRole=r.id;button.textContent=r.name+' — '+r.description;panel.querySelector('.type-catalog-list').append(button);}
    panel.addEventListener('click',e=>{const pick=e.target.closest('[data-choose-role]');if(pick){selected=pick.dataset.chooseRole;renderEditor();}});
    launcher.addEventListener('click',()=>{document.dispatchEvent(new CustomEvent('aved-edit-mode',{detail:'type'}));stopPick();renderEditor();panel.showModal();});
    document.addEventListener('aved-edit-mode',e=>{if(e.detail!=='type'){stopPick();panel.close();}});
    panel.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>panel.close()));
    panel.addEventListener('close',()=>{if(!picking)launcher.focus();});
    $('type-role').addEventListener('change',()=>{selected=$('type-role').value;renderEditor();});
    for(const id of ['font-zh','font-en','font-he','desktop','mobile','line','spacing','weight','en-italic'])$('type-'+id).addEventListener('change',applyEdit);
    $('type-file').addEventListener('change',importFiles);
    panel.querySelector('[data-save-design]').textContent=design.local?'保存到项目':'保存到服务器';
    panel.querySelector('[data-save-design]').addEventListener('click',saveDesign);
    panel.querySelector('[data-reset-role]').addEventListener('click',()=>{settings[selected]={...roles.get(selected).defaults};save();renderEditor();classifyPage();tell('已还原当前类别。');});
    panel.querySelector('[data-reset-all]').addEventListener('click',()=>{settings=C.defaults();save();renderEditor();classifyPage();tell('全部类别已还原；导入的字体仍保留在本地库。');});
    panel.querySelector('[data-highlight]').addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));if(on)document.documentElement.dataset.typeHighlight=selected;else delete document.documentElement.dataset.typeHighlight;highlight();});
    panel.querySelector('[data-pick]').addEventListener('click',()=>{document.dispatchEvent(new CustomEvent('aved-edit-mode',{detail:'type'}));picking=true;panel.close();launcher.textContent='点选文字 · Esc 取消';});
    window.addEventListener('pointerdown',e=>{if(picking&&!e.target.closest('#type-study-panel,#type-study-launcher,#text-edit-panel,#text-edit-launcher')){e.preventDefault();e.stopImmediatePropagation();}},true);
    window.addEventListener('click',e=>{if(!picking||e.target.closest('#type-study-panel,#type-study-launcher,#text-edit-panel,#text-edit-launcher'))return;const target=e.target.closest('[data-type-role]');if(!target)return;e.preventDefault();e.stopImmediatePropagation();selected=target.dataset.typeRole;stopPick();renderEditor();panel.showModal();},true);
    document.addEventListener('keydown',e=>{if(picking&&e.key==='Escape'){stopPick();e.preventDefault();}});
  }
  async function init(){
    const shared=await design.ready;serverRevision=shared.revision||'';
    let saved=shared.settings;if(design.local)try{saved=JSON.parse(localStorage.getItem(stateKey)||'null')||saved;}catch{}
    library.push(...shared.fonts||[]);
    try{db=await openDatabase();const local=await readFonts();for(const font of local){library=library.filter(f=>f.id!==font.id);library.push(font);}}catch{storageMessage='本地字体库不可用；内置字体仍可调整。';}
    settings=C.sanitize(saved,library);
    if(!saved){try{const old=localStorage.getItem('aved_note_font_v1');if(library.some(f=>f.id===old)){settings.meta.zh=old;settings.meta.desktop=settings.meta.mobile=16;}}catch{}}
    const jobs=new Set();for(const s of Object.values(settings))for(const lang of ['zh','en','he'])jobs.add(s[lang]+':'+lang);
    const results=await Promise.allSettled([...jobs].map(job=>{const [id,lang]=job.split(':');return loadFont(id,lang);}));
    delete document.documentElement.dataset.noteFont;initUI();renderEditor();renderLibrary();classifyPage();
    window.AVEDPrepareTypography=node=>classify(node,node.parentElement?.dataset.typeRole||'body');
    let scheduled=false;
    const observer=new MutationObserver(records=>{
      for(const r of records){
        const parent=r.type==='characterData'?r.target.parentElement:r.target;
        if(!(parent instanceof Element)||parent.closest('#type-study-panel,#type-study-launcher,head'))continue;
        if(r.type==='characterData')pending.add(parent);
        else for(const node of r.addedNodes)pending.add(node instanceof Element?node:parent);
      }
      if(!pending.size||scheduled)return;scheduled=true;
      queueMicrotask(()=>{scheduled=false;observer.disconnect();
        for(const el of pending)if(el.isConnected&&![...pending].some(other=>other!==el&&other.contains(el)))classify(el,el.parentElement?.dataset.typeRole||'body');
        pending.clear();if(panel.open)updateCoverage();if(document.documentElement.dataset.typeHighlight)highlight();
        observer.observe(document.body,{childList:true,subtree:true,characterData:true});
      });
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});

    tell(storageMessage||(results.some(r=>r.status==='rejected')?'部分字体暂未加载，当前使用后备字体。':'设计台已就绪；调整后请点击保存设计。'));
    document.addEventListener('aved-player-design',async e=>{
      if(design.local||!e.detail.settings||e.detail.revision===serverRevision)return;
      if(panel.open||picking){tell('服务器设计已更新；请刷新后重新调整，避免覆盖他人的修改。');return;}
      for(const font of e.detail.fonts||[])if(!library.some(f=>f.id===font.id))library.push(font);
      const nextSettings=C.sanitize(e.detail.settings,library);
      await Promise.allSettled(Object.values(nextSettings).flatMap(s=>['zh','en','he'].map(lang=>loadFont(s[lang],lang))));
      settings=nextSettings;serverRevision=e.detail.revision;applyRules();classifyPage();
    });
  }
  const initialization=init().catch(error=>{applyRules();classifyPage();console.warn('字体初始化使用后备配置。',error);});
  initialization.finally(()=>window.AVEDResolveTypography?.());
  window.AVEDTypographyReady=initialization;
})();
