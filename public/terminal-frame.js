(function () {
  const app=document.getElementById('inner-app-view');
  if(!app)return;
  const header=app.querySelector(':scope > header'),bar=header.firstElementChild;
  header.classList.add('compact-terminal-header');bar.classList.add('terminal-topbar');
  bar.children[0].classList.add('terminal-brand');bar.children[1].classList.add('terminal-identities');bar.children[2].classList.add('terminal-actions');
  app.querySelector(':scope > div > div:last-child').classList.add('terminal-content-pane');
  const brand=bar.children[0].firstElementChild.firstElementChild;
  brand.classList.add('terminal-brand-mark');
  brand.dataset.typeIgnore='';
  brand.innerHTML='<span class="terminal-brand-name" lang="zh-Hant">萬業攜生</span><span class="terminal-brand-code" lang="en">A.V.E.D.<small>ALLWORKS VIVARIUM</small></span>';
  header.classList.add('minimal-terminal-header');
  bar.children[1].classList.add('header-hidden');bar.children[1].setAttribute('aria-hidden','true');
  document.getElementById('logout-btn').textContent='登出';
  for(const el of [document.getElementById('welcome-employee-banner').parentElement,document.getElementById('top-balance-val').parentElement,document.getElementById('system-realtime-clock').parentElement]){
    el.classList.add('header-hidden');el.setAttribute('aria-hidden','true');
  }
  const theme=document.getElementById('theme-toggle-btn');
  const modes={system:'跟随系统',day:'日间',night:'夜间'};
  for(const id of ['intranet-role','theme-toggle-btn','logout-btn'])document.getElementById(id).classList.add('terminal-header-control');
  function themeIcon(){
    const dark=window.AVEDTheme.mode==='day';
    theme.innerHTML=dark?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20.4 15.2A9 9 0 0 1 8.8 3.6a9 9 0 1 0 11.6 11.6Z"/></svg>';
    if(window.AVEDTheme.mode==='system')theme.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8m-4-4v4"/></svg>';
    theme.setAttribute('aria-label','日夜模式：'+modes[window.AVEDTheme.mode]);theme.title='日夜模式：'+modes[window.AVEDTheme.mode];
  }
  themeIcon();new MutationObserver(themeIcon).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('aved-theme-change',themeIcon);
})();
