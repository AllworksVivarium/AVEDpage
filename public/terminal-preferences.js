(function(){
 const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
 const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 let appearance={};try{appearance=JSON.parse(read('aved_appearance_v2','{}'))||{};}catch{}
 const palettes=['oxblood','darkroom','mineral'];
 const theme=['day','night'].includes(appearance.theme)?appearance.theme:read('aved_theme_v1','day');
 const palette=palettes.includes(appearance.palette)?appearance.palette:read('aved_palette_preview_v1','mineral');
 document.documentElement.dataset.savedTheme=theme==='night'?'night':'day';
 document.documentElement.dataset.palettePreview=palettes.includes(palette)?palette:'mineral';
 window.AVEDSaveAppearance=()=>{
  const {savedTheme:theme,palettePreview:palette}=document.documentElement.dataset;
  save('aved_appearance_v2',JSON.stringify({theme,palette}));
  save('aved_theme_v1',theme);save('aved_palette_preview_v1',palette);
 };
 function apply(){
  document.body.classList.toggle('dark-mode',document.documentElement.dataset.savedTheme==='night');
  document.body.classList.toggle('effects-off',read('aved_effects_v1','on')==='off');
  document.body.classList.add('terminal-next');
  try{localStorage.removeItem('aved_layout_v2');}catch{}
 }
 window.AVEDEffectsEnabled=()=>!document.body.classList.contains('effects-off');
 window.AVEDSyncPreferences=()=>{document.querySelectorAll('[data-effects-toggle]').forEach(b=>{const on=window.AVEDEffectsEnabled();b.textContent=on?'特效：开启':'特效：关闭';b.setAttribute('aria-pressed',String(on));b.title=on?'关闭本机的动态、微光和文字撕裂':'恢复本机的动态、微光和文字撕裂';});const nav=document.querySelector('[data-nav="welcome"]'),label=nav?.querySelector('.sidebar-label');if(label){label.textContent='员工首页';nav.setAttribute('aria-label',label.textContent);}};
 document.addEventListener('DOMContentLoaded',()=>{apply();window.AVEDSyncPreferences();});
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-effects-toggle]')){const off=!document.body.classList.contains('effects-off');document.body.classList.toggle('effects-off',off);save('aved_effects_v1',off?'off':'on');window.AVEDSyncPreferences();document.dispatchEvent(new Event('aved-effects-change'));}
 });
})();
