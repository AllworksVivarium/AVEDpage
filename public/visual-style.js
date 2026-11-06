window.AVEDVisualStyle=function({byId}){
 const section=document.createElement('details');section.className='visual-style-choice sidebar-expanded';section.innerHTML='<summary>显示设置</summary><div class="display-options"><label>界面风格<select data-window-style><option value="radix">窗口版</option><option value="previous">旧版</option></select></label><label>背景纹样<select id="terminal-background-pattern"><option value="grid">网格</option><option value="dots">点阵</option><option value="ascii">ASCII 瀑布</option><option value="plain">无纹样</option></select></label></div>';
 const sidebar=byId('left-sidebar');sidebar.insertBefore(section,sidebar.querySelector('.terminal-audio'));
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
  darkroom:{name:'暗房显影',day:['#F1EEE8','#D3CFC7','#98282C','#42464A'],night:['#151619','#F1EEE8','#98282C','#686D70']},
  mineral:{name:'矿物收藏',day:['#EDE9E2','#CDC7BE','#98282C','#777D7C'],night:['#151310','#EDE9E2','#98282C','#A17E69']}
 };
 const preview=document.createElement('section');preview.className='palette-preview sidebar-expanded';
 preview.innerHTML='<label for="terminal-palette-preview"><span>配色预览 <small lang="en">PALETTE STUDY</small></span><select id="terminal-palette-preview"><option value="oxblood">01 黑金绛红 · Oxblood</option><option value="darkroom">02 暗房显影 · Darkroom</option><option value="mineral">03 矿物收藏 · Mineral</option></select></label><p class="palette-mode-note" aria-live="polite"></p><div class="palette-swatches" aria-label="当前方案色板"></div>';
 sidebar.insertBefore(preview,section);
 const paletteSelect=preview.querySelector('select'),swatches=preview.querySelector('.palette-swatches');
 function applyPalette(value){
  const selected=Object.hasOwn(palettes,value)?value:'mineral',palette=palettes[selected];
  document.documentElement.dataset.palettePreview=selected;paletteSelect.value=selected;
  const night=document.documentElement.dataset.savedTheme==='night';
  document.body.classList.toggle('dark-mode',night);
  preview.querySelector('.palette-mode-note').textContent='日间 / 夜间 · DAY / NIGHT';
  const themeButton=byId('theme-toggle-btn');if(themeButton){themeButton.disabled=false;themeButton.textContent=night?'☀️ 日间模式':'🌙 夜间模式';themeButton.title='';}
  const colors=night?palette.night:palette.day;
  swatches.innerHTML=colors.map(color=>'<span title="'+color+'"><i style="--swatch:'+color+'" aria-hidden="true"></i><small>'+color.slice(1)+'</small></span>').join('');
  swatches.setAttribute('aria-label',palette.name+(night?'夜间':'日间')+'：'+colors.join('、'));
 }
 byId('theme-toggle-btn')?.addEventListener('click',()=>queueMicrotask(()=>applyPalette(paletteSelect.value)));
 applyPalette(document.documentElement.dataset.palettePreview);
 paletteSelect.addEventListener('change',()=>{applyPalette(paletteSelect.value);try{localStorage.setItem('aved_palette_preview_v1',paletteSelect.value);}catch{}});
 section.querySelector('[data-window-style]').value=document.documentElement.dataset.windowStyle||'radix';
 document.body.classList.add('signal-preview','red-topbar','crt-unified');document.body.classList.remove('paper-texture');
 try{localStorage.setItem('aved_visual_style_v1','signal');localStorage.removeItem('aved_paper_texture_v1');localStorage.setItem('aved_header_layout_v1','red');}catch{}
 try{localStorage.removeItem('aved_presentation_v1');}catch{}
 const pattern=byId('terminal-background-pattern');
 function applyPattern(value){const selected=['grid','dots','ascii','plain'].includes(value)?value:'grid';document.body.dataset.terminalPattern=selected;pattern.value=selected;}
 let savedPattern='grid';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v1')||'grid';}catch{}
 applyPattern(savedPattern);pattern.addEventListener('change',()=>{applyPattern(pattern.value);try{localStorage.setItem('aved_terminal_pattern_v1',pattern.value);}catch{}});
};
