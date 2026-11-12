const avedSidebarSymbols={
  welcome:['personnel-moon-icon-v1.sidebar64.018c1a150129.webp','145% auto'],news:['broadcast-ui-v1.sidebar64.1bf524df26f2.webp','130% auto'],
  departments:['directory-disk-ui-v1.sidebar64.566c01d80579.webp','165% auto'],containment:['containment-folder-ui-v1.sidebar64.dfd0f5350cd7.webp','155% auto'],
  life:['life-newspaper-ui-v1.sidebar64.5e5be33c9061.webp','120% auto'],forum:['forum-computer-ui-v1.sidebar64.1da86dc6c596.webp','155% auto'],casino:['recreation-cards-ui-v1.sidebar64.876aec31d4a1.webp','145% auto'],
  bar:['bar-cocktail-ui-v1.sidebar64.22ba024e0c18.webp','110% auto']
};
window.AVEDCriticalArt=[...Object.values(avedSidebarSymbols).map(([file])=>'/assets/'+file),'/assets/sidebar-binder-clip-icon-v1.cfd1cd0715d2.webp','/assets/medical.ae5509bedeb3.webp','/assets/currency-coin.svg?v=pixel-a-2'];
window.AVEDVisualStyle=function({byId}){
 const sidebar=byId('left-sidebar');
 // Authoring launchers enforce their own localhost-only boundary.
 // Clear the old sidebar toggle's hidden state so local editing stays available.
 document.body.classList.remove('editor-tools-hidden');

 // Preserve the original bitmap grain; luminance masks remove its black canvas.
 const symbols=avedSidebarSymbols;
 function symbol(name){const [file,size]=symbols[name],el=document.createElement('span');el.className='sidebar-symbol';el.setAttribute('aria-hidden','true');el.style.setProperty('--symbol-image','url("/assets/'+file+'")');el.style.setProperty('--symbol-size',size);return el;}
 for(const [name] of Object.entries(symbols)){const button=sidebar.querySelector('[data-nav="'+name+'"]');if(button){button.firstElementChild.replaceWith(symbol(name));button.setAttribute('aria-label',button.querySelector('.sidebar-label').textContent.trim());}}
 const megaphone=document.querySelector('.notice-masthead>img');if(megaphone){const el=symbol('news');el.classList.add('notice-broadcast-symbol');el.removeAttribute('aria-hidden');el.setAttribute('role','img');el.setAttribute('aria-label','广播喇叭');megaphone.replaceWith(el);}
 document.body.insertAdjacentHTML('beforeend','<svg class="sidebar-type-definitions" aria-hidden="true" width="0" height="0"><defs><filter id="aved-sidebar-type" x="-4%" y="-12%" width="108%" height="124%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".012 .23" numOctaves="1" seed="21" result="noise"/><feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="bands"/><feDisplacementMap in="SourceGraphic" in2="bands" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>');
 const palettes={
  oxblood:{name:'黑金绛红',day:['#EDE9E2','#D3CFC7','#5E0205','#42464A'],night:['#000000','#E2D5BF','#5E0205','#BDB298']},
  darkroom:{name:'钴蓝静频',day:['#E8EDF1','#D4DEE6','#5279A4','#4E6F92'],night:['#090F23','#D4DBEF','#203DB5','#50638B']},
  mineral:{name:'矿物收藏',day:['#EDE9E2','#CDC7BE','#87583F','#777D7C'],night:['#151310','#EDE9E2','#C5926B','#A17E69']}
 };
 let entitlements=null;
 function applyPalette(value){
  const selected=Object.hasOwn(palettes,value)&&(!entitlements||entitlements.owned.includes(value))?value:'oxblood';
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
 function applyPattern(value){const selected=['halftone','fade','grain','plain'].includes(value)&&(!entitlements||value==='plain'||entitlements.patterns?.owned.includes(value))?value:'plain';document.body.dataset.terminalPattern=selected;try{localStorage.setItem('aved_terminal_pattern_v2',selected);}catch{}}
 let savedPattern='plain';try{savedPattern=localStorage.getItem('aved_terminal_pattern_v2')||'plain';}catch{}
 applyPattern(savedPattern);
 window.AVEDAppearance={palettes,setPalette:applyPalette,setPattern:applyPattern,get entitlements(){return entitlements;},setEntitlements(value){entitlements=value||{owned:['oxblood'],prices:{oxblood:0,mineral:20000,darkroom:20000}};applyPattern(document.body.dataset.terminalPattern);window.AVEDGateway?.setEntitlements(entitlements);applyPalette(document.documentElement.dataset.palettePreview);}};
};
