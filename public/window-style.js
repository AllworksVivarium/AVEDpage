(function () {
  const key='aved_window_style_v1';
  const read=()=>{try{return localStorage.getItem(key)||'radix';}catch{return 'radix';}};
  document.documentElement.dataset.windowStyle=read();
  function apply(value) {
    const selected=value==='previous'?'previous':'radix';
    document.documentElement.dataset.windowStyle=selected;
    document.body.classList.toggle('radix-terminal',selected==='radix');
    document.querySelectorAll('[data-window-style]').forEach(select=>select.value=selected);
    document.dispatchEvent(new Event('aved-window-style-change'));
  }
  document.addEventListener('DOMContentLoaded',()=>{
    apply(read());
    const sidebar=document.querySelector('#sidebar');
    if(sidebar){
      const settings=document.createElement('details');settings.className='visual-style-choice';
      settings.innerHTML='<summary>显示设置</summary><div class="display-options"><label>界面风格<select data-window-style><option value="radix">窗口版</option><option value="previous">旧版</option></select></label></div>';
      sidebar.append(settings);apply(read());
    }
  });
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-window-style]'))return;
    const value=event.target.value;try{localStorage.setItem(key,value);}catch{}
    apply(value);
  });
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-display-settings]'))return;
    const settings=document.querySelector('#left-sidebar .visual-style-choice');
    if(!settings)return;
    if(document.getElementById('left-sidebar').classList.contains('w-16'))document.getElementById('sidebar-toggle-btn').click();
    settings.open=true;settings.scrollIntoView({block:'nearest'});settings.querySelector('select')?.focus();
  });
  // Enable :active feedback on touch browsers without cancelling native scrolling.
  document.addEventListener('touchstart',()=>{}, {passive:true});
})();
