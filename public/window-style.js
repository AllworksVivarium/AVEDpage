(function () {
  // One restored player interface. Keep the class used by the approved chrome
  // and neutral CRT particles; the former global flattening rules are gone.
  document.documentElement.dataset.windowStyle='unified';
  try{localStorage.removeItem('aved_window_style_v1');}catch{}
  document.addEventListener('DOMContentLoaded',()=>{
    document.body.classList.add('radix-terminal');
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
