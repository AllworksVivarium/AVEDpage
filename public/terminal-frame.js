(function () {
  const app=document.getElementById('inner-app-view');
  if(!app)return;
  const header=app.querySelector(':scope > header'),bar=header.firstElementChild;
  header.classList.add('compact-terminal-header');bar.classList.add('terminal-topbar');
  bar.children[0].classList.add('terminal-brand');bar.children[1].classList.add('terminal-identities');bar.children[2].classList.add('terminal-actions');
  app.querySelector(':scope > div > div:last-child').classList.add('terminal-content-pane');
  const brand=bar.children[0].firstElementChild.firstElementChild;
  brand.innerHTML='<span>万业携生</span><span class="terminal-brand-code"> // A.V.E.D.</span>';
  const profile=document.getElementById('cloud-profile-open');
  profile.innerHTML='<span class="profile-desktop-label">个人主页</span><span class="profile-mobile-label" aria-hidden="true">主页</span>';
  profile.setAttribute('aria-label','个人主页');
  document.getElementById('logout-btn').textContent='登出';
  for(const el of [document.getElementById('welcome-employee-banner').parentElement,document.getElementById('top-balance-val').parentElement,document.getElementById('system-realtime-clock').parentElement]){
    el.classList.add('header-hidden');el.setAttribute('aria-hidden','true');
  }
  const theme=document.getElementById('theme-toggle-btn');
  for(const id of ['intranet-role','theme-toggle-btn','cloud-profile-open','logout-btn'])document.getElementById(id).classList.add('terminal-header-control');
  function themeIcon(){
    const dark=document.body.classList.contains('dark-mode');
    theme.innerHTML=dark?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20.4 15.2A9 9 0 0 1 8.8 3.6a9 9 0 1 0 11.6 11.6Z"/></svg>';
    theme.setAttribute('aria-label',dark?'切换为日间模式':'切换为夜间模式');theme.title=dark?'切换为日间模式':'切换为夜间模式';
  }
  themeIcon();new MutationObserver(themeIcon).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
