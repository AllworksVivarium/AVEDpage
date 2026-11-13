(function(){
 const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
 const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 let appearance={};try{appearance=JSON.parse(read('aved_appearance_v2','{}'))||{};}catch{}
 const palettes=['oxblood','darkroom','mineral'];
 const systemTheme=window.matchMedia?.('(prefers-color-scheme: dark)');
 let themeMode=appearance.themeMode||read('aved_theme_mode_v1','system');if(!['system','day','night'].includes(themeMode))themeMode='system';
 const resolvedTheme=()=>themeMode==='system'?(systemTheme?.matches?'night':'day'):themeMode;
 const palette=palettes.includes(appearance.palette)?appearance.palette:read('aved_palette_preview_v1','oxblood');
 document.documentElement.dataset.savedTheme=resolvedTheme();document.documentElement.dataset.themeMode=themeMode;
 document.documentElement.dataset.palettePreview=palettes.includes(palette)?palette:'oxblood';
 window.AVEDSaveAppearance=()=>{
  const {savedTheme:theme,palettePreview:palette}=document.documentElement.dataset;
  save('aved_appearance_v2',JSON.stringify({theme,palette,themeMode}));save('aved_theme_mode_v1',themeMode);
  save('aved_theme_v1',theme);save('aved_palette_preview_v1',palette);
 };
 function applyTheme(){const theme=resolvedTheme();document.documentElement.dataset.savedTheme=theme;document.documentElement.dataset.themeMode=themeMode;document.documentElement.style.colorScheme=theme==='night'?'dark':'only light';document.body?.classList.toggle('dark-mode',theme==='night');document.dispatchEvent(new Event('aved-theme-change'));}
 window.AVEDTheme={get mode(){return themeMode;},setMode(value){if(!['system','day','night'].includes(value))return;themeMode=value;applyTheme();window.AVEDSaveAppearance();}};
 systemTheme?.addEventListener('change',()=>{if(themeMode==='system')applyTheme();});applyTheme();
 function apply(){
  applyTheme();
  document.body.classList.toggle('effects-off',read('aved_effects_v1','on')==='off');
  document.body.classList.add('terminal-next');
  try{localStorage.removeItem('aved_layout_v2');}catch{}
 }
 window.AVEDEffectsEnabled=()=>!document.body.classList.contains('effects-off');
 window.AVEDSetEffects=enabled=>{const off=!enabled;document.body.classList.toggle('effects-off',off);save('aved_effects_v1',off?'off':'on');window.AVEDSyncPreferences?.();document.dispatchEvent(new Event('aved-effects-change'));};
 window.AVEDSyncPreferences=()=>{document.querySelectorAll('[data-effects-toggle]').forEach(b=>{const on=window.AVEDEffectsEnabled();b.textContent=on?'特效：开启':'特效：关闭';b.setAttribute('aria-pressed',String(on));b.title=on?'关闭本机的动态、微光和文字撕裂':'恢复本机的动态、微光和文字撕裂';});const nav=document.querySelector('[data-nav="welcome"]'),label=nav?.querySelector('.sidebar-label');if(label){label.textContent='员工首页';nav.setAttribute('aria-label',label.textContent);}};
 document.addEventListener('DOMContentLoaded',()=>{apply();window.AVEDSyncPreferences();});
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-effects-toggle]'))window.AVEDSetEffects(!window.AVEDEffectsEnabled());
 });
})();
