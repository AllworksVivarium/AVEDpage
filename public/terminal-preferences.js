(function(){
 const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
 const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 document.documentElement.dataset.savedTheme=read('aved_theme_v1','day');
 function apply(){
  document.body.classList.toggle('dark-mode',document.documentElement.dataset.savedTheme==='night');
  document.body.classList.toggle('effects-off',read('aved_effects_v1','on')==='off');
  document.body.classList.toggle('terminal-next',read('aved_layout_v2','next')==='next');
 }
 window.AVEDEffectsEnabled=()=>!document.body.classList.contains('effects-off');
 window.AVEDSyncPreferences=()=>{document.querySelectorAll('[data-effects-toggle]').forEach(b=>{const on=window.AVEDEffectsEnabled();b.textContent=on?'特效：开启':'特效：关闭';b.setAttribute('aria-pressed',String(on));});const nav=document.querySelector('[data-nav="welcome"]'),label=nav?.querySelector('.sidebar-label');if(label){label.textContent=document.body.classList.contains('terminal-next')?'员工首页':'接入首页';nav.setAttribute('aria-label',label.textContent);}};
 document.addEventListener('DOMContentLoaded',()=>{apply();window.AVEDSyncPreferences();});
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-effects-toggle]')){const off=!document.body.classList.contains('effects-off');document.body.classList.toggle('effects-off',off);save('aved_effects_v1',off?'off':'on');window.AVEDSyncPreferences();document.dispatchEvent(new Event('aved-effects-change'));}
  const layout=e.target.closest('[data-terminal-layout]');if(layout){const next=layout.dataset.terminalLayout==='next';document.body.classList.toggle('terminal-next',next);save('aved_layout_v2',next?'next':'previous');window.AVEDRefreshPersonal?.();window.AVEDSyncPreferences();}
 });
})();
