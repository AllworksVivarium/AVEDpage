window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('details');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<summary>显示设置</summary><div class="display-options"><label>背景纹样<select id="terminal-background-pattern"><option value="grid">网格</option><option value="dots">点阵</option><option value="ascii">ASCII 瀑布</option><option value="plain">无纹样</option></select></label></div>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
 const editorToggle=document.createElement('label');editorToggle.className='editor-tools-toggle sidebar-expanded';
 editorToggle.innerHTML='<input type="checkbox" id="editor-tools-visible"> 编辑工具';sidebar.insertBefore(editorToggle,section);
 const editorCheck=editorToggle.querySelector('input');let editorVisible=true;try{editorVisible=localStorage.getItem('aved_editor_tools_visible_v1')!=='off';}catch{}
 function applyEditorVisibility(){document.body.classList.toggle('editor-tools-hidden',!editorCheck.checked);if(!editorCheck.checked)for(const id of ['text-edit-panel','type-study-panel']){const panel=byId(id);if(panel?.open)panel.close();}}
 editorCheck.checked=editorVisible;applyEditorVisibility();editorCheck.addEventListener('change',()=>{applyEditorVisibility();try{localStorage.setItem('aved_editor_tools_visible_v1',editorCheck.checked?'on':'off');}catch{}});

 const effects=document.createElement('section');effects.className='effects-control sidebar-expanded';
 effects.innerHTML="<button type=\"button\" data-effects-toggle aria-describedby=\"effects-device-note\">特效：开启</button><p id=\"effects-device-note\" data-type-role=\"meta\">⁣</p>";
 sidebar.insertBefore(effects,section);window.AVEDSyncPreferences?.();
 // Preserve the original bitmap grain; luminance masks remove its black canvas.
 const symbols={
  welcome:['personnel-moon.png','145% auto'],news:['broadcast.jpg','130% auto'],
  departments:['directory-disk.png','165% auto'],containment:['containment-folder.png','155% auto'],
  life:['life-newspaper.png','120% auto'],forum:['forum-computer.jpeg','155% auto'],casino:['recreation-cards.jpeg','145% auto']
 };
 function symbol(name){const [file,size]=symbols[name],el=document.createElement('span');el.className='sidebar-symbol';el.setAttribute('aria-hidden','true');el.style.setProperty('--symbol-image','url("/assets/'+file+'")');el.style.setProperty('--symbol-size',size);return el;}
 for(const [name] of Object.entries(symbols)){const button=sidebar.querySelector('[data-nav="'+name+'"]');if(button){button.firstElementChild.replaceWith(symbol(name));button.setAttribute('aria-label',button.querySelector('.sidebar-label').textContent.trim());}}
 const megaphone=document.querySelector('.notice-masthead>img');if(megaphone){const el=symbol('news');el.classList.add('notice-broadcast-symbol');el.removeAttribute('aria-hidden');el.setAttribute('role','img');el.setAttribute('aria-label','广播喇叭');megaphone.replaceWith(el);}
 document.body.insertAdjacentHTML('beforeend','<svg class="sidebar-type-definitions" aria-hidden="true" width="0" height="0"><defs><filter id="aved-sidebar-type" x="-4%" y="-12%" width="108%" height="124%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".012 .23" numOctaves="1" seed="21" result="noise"/><feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="bands"/><feDisplacementMap in="SourceGraphic" in2="bands" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>');
 const palettes={
  oxblood:{name:'黑金绛红',day:['#EDE9E2','#D3CFC7','#5E0205','#42464A'],night:['#000000','#E2D5BF','#5E0205','#BDB298']},
  darkroom:{name:'深蓝电讯',day:['#EFF4FA','#DCE8F5','#0841C9','#032C7D'],night:['#020D2F','#B5CDE9','#1D97F1','#29B4D1']},
  mineral:{name:'矿物收藏',day:['#EDE9E2','#CDC7BE','#87583F','#777D7C'],night:['#151310','#EDE9E2','#C5926B','#A17E69']}
 };
 const preview=document.createElement('section');preview.className='palette-preview sidebar-expanded';
 preview.innerHTML='<label for="terminal-palette-preview"><span>配色预览 <small lang="en">PALETTE STUDY</small></span><select id="terminal-palette-preview"><option value="oxblood">01 黑金绛红 · Oxblood</option><option value="darkroom">02 深蓝电讯 · Blue Signal</option><option value="mineral">03 矿物收藏 · Mineral</option></select></label><p class="palette-mode-note" aria-live="polite"></p><div class="palette-swatches" aria-label="当前方案色板"></div>';
 sidebar.insertBefore(preview,section);
 const paletteSelect=preview.querySelector('select'),swatches=preview.querySelector('.palette-swatches');
 function applyPalette(value){
  const selected=Object.hasOwn(palettes,value)?value:'mineral',palette=palettes[selected];
  document.documentElement.dataset.palettePreview=selected;paletteSelect.value=selected;
  const night=document.documentElement.dataset.savedTheme==='night';
  document.body.classList.toggle('dark-mode',night);
  preview.querySelector('.palette-mode-note').textContent="⁣";
  const themeButton=byId('theme-toggle-btn');if(themeButton){themeButton.disabled=false;if(!themeButton.querySelector('svg'))themeButton.textContent=night?'☀️ 日间模式':'🌙 夜间模式';themeButton.title=night?'切换为日间模式':'切换为夜间模式';themeButton.setAttribute('aria-label',themeButton.title);}
  const colors=night?palette.night:palette.day;
  if(!swatches.children.length)swatches.innerHTML=colors.map(()=>'<span><i aria-hidden="true"></i><small></small></span>').join('');
  colors.forEach((color,index)=>{const chip=swatches.children[index];chip.title=color;chip.querySelector('i').style.setProperty('--swatch',color);chip.querySelector('small').textContent=color.slice(1);});
  swatches.setAttribute('aria-label',palette.name+(night?'夜间':'日间')+'：'+colors.join('、'));
  window.AVEDSaveAppearance?.();
 }
 byId('theme-toggle-btn')?.addEventListener('click',()=>queueMicrotask(()=>applyPalette(paletteSelect.value)));
 applyPalette(document.documentElement.dataset.palettePreview);
 paletteSelect.addEventListener('change',()=>{applyPalette(paletteSelect.value);try{localStorage.setItem('aved_palette_preview_v1',paletteSelect.value);}catch{}});
 document.body.classList.add('signal-preview','red-topbar','crt-unified');document.body.classList.remove('paper-texture');
 try{localStorage.setItem('aved_visual_style_v1','signal');localStorage.removeItem('aved_paper_texture_v1');localStorage.setItem('aved_header_layout_v1','red');}catch{}
 try{localStorage.removeItem('aved_presentation_v1');}catch{}
 const pattern=byId('terminal-background-pattern');
 function applyPattern(value){const selected=['grid','dots','ascii','plain'].includes(value)?value:'grid';document.body.dataset.terminalPattern=selected;pattern.value=selected;}
 let savedPattern='grid';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v1')||'grid';}catch{}
 applyPattern(savedPattern);pattern.addEventListener('change',()=>{applyPattern(pattern.value);try{localStorage.setItem('aved_terminal_pattern_v1',pattern.value);}catch{}});
};
