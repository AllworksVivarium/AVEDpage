window.AVEDVisualStyle=function({byId}){
 const sidebar=byId('left-sidebar');
 const editorToggle=document.createElement('label');editorToggle.className='editor-tools-toggle sidebar-expanded';
 editorToggle.innerHTML='<input type="checkbox" id="editor-tools-visible"> 编辑工具';sidebar.insertBefore(editorToggle,sidebar.querySelector('.terminal-audio'));
 const editorCheck=editorToggle.querySelector('input');let editorVisible=true;try{editorVisible=localStorage.getItem('aved_editor_tools_visible_v1')!=='off';}catch{}
 function applyEditorVisibility(){document.body.classList.toggle('editor-tools-hidden',!editorCheck.checked);if(!editorCheck.checked)for(const id of ['text-edit-panel','type-study-panel']){const panel=byId(id);if(panel?.open)panel.close();}}
 editorCheck.checked=editorVisible;applyEditorVisibility();editorCheck.addEventListener('change',()=>{applyEditorVisibility();try{localStorage.setItem('aved_editor_tools_visible_v1',editorCheck.checked?'on':'off');}catch{}});

 // Preserve the original bitmap grain; luminance masks remove its black canvas.
 const symbols={
  welcome:['personnel-moon-icon-v1.png','145% auto'],news:['broadcast-ui-v1.png','130% auto'],
  departments:['directory-disk-ui-v1.png','165% auto'],containment:['containment-folder-ui-v1.png','155% auto'],
  life:['life-newspaper-ui-v1.png','120% auto'],forum:['forum-computer-ui-v1.png','155% auto'],casino:['recreation-cards-ui-v1.png','145% auto']
 };
 function symbol(name){const [file,size]=symbols[name],el=document.createElement('span');el.className='sidebar-symbol';el.setAttribute('aria-hidden','true');el.style.setProperty('--symbol-image','url("/assets/'+file+'")');el.style.setProperty('--symbol-size',size);return el;}
 for(const [name] of Object.entries(symbols)){const button=sidebar.querySelector('[data-nav="'+name+'"]');if(button){button.firstElementChild.replaceWith(symbol(name));button.setAttribute('aria-label',button.querySelector('.sidebar-label').textContent.trim());}}
 const megaphone=document.querySelector('.notice-masthead>img');if(megaphone){const el=symbol('news');el.classList.add('notice-broadcast-symbol');el.removeAttribute('aria-hidden');el.setAttribute('role','img');el.setAttribute('aria-label','广播喇叭');megaphone.replaceWith(el);}
 document.body.insertAdjacentHTML('beforeend','<svg class="sidebar-type-definitions" aria-hidden="true" width="0" height="0"><defs><filter id="aved-sidebar-type" x="-4%" y="-12%" width="108%" height="124%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".012 .23" numOctaves="1" seed="21" result="noise"/><feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="bands"/><feDisplacementMap in="SourceGraphic" in2="bands" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>');
 const palettes={
  oxblood:{name:'黑金绛红',day:['#EDE9E2','#D3CFC7','#5E0205','#42464A'],night:['#000000','#E2D5BF','#5E0205','#BDB298']},
  darkroom:{name:'钴蓝静频',day:['#E8EDF1','#D4DEE6','#5279A4','#4E6F92'],night:['#090F23','#D4DBEF','#203DB5','#50638B']},
  mineral:{name:'矿物收藏',day:['#EDE9E2','#CDC7BE','#87583F','#777D7C'],night:['#151310','#EDE9E2','#C5926B','#A17E69']}
 };
 function applyPalette(value){
  const selected=Object.hasOwn(palettes,value)?value:'mineral';
  document.documentElement.dataset.palettePreview=selected;
  const night=document.documentElement.dataset.savedTheme==='night';document.body.classList.toggle('dark-mode',night);
  const button=byId('theme-toggle-btn');if(button){button.disabled=false;button.title=night?'切换为日间模式':'切换为夜间模式';button.setAttribute('aria-label',button.title);}
  window.AVEDSaveAppearance?.();document.dispatchEvent(new Event('aved-appearance-change'));
 }
 byId('theme-toggle-btn')?.addEventListener('click',()=>queueMicrotask(()=>applyPalette(document.documentElement.dataset.palettePreview)));
 applyPalette(document.documentElement.dataset.palettePreview);
 document.body.classList.add('signal-preview','red-topbar','crt-unified');document.body.classList.remove('paper-texture');
 try{localStorage.setItem('aved_visual_style_v1','signal');localStorage.removeItem('aved_paper_texture_v1');localStorage.setItem('aved_header_layout_v1','red');}catch{}
 try{localStorage.removeItem('aved_presentation_v1');}catch{}
 function applyPattern(value){const selected=['grid','dots','ascii','plain'].includes(value)?value:'grid';document.body.dataset.terminalPattern=selected;try{localStorage.setItem('aved_terminal_pattern_v1',selected);}catch{}}
 let savedPattern='grid';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v1')||'grid';}catch{}
 applyPattern(savedPattern);
 window.AVEDAppearance={palettes,setPalette:applyPalette,setPattern:applyPattern};
};
