/* Compact navigation links for the routed game pages. */
window.AVEDCreateCasinoSwitcher=function({games,tabs,gameHeader,getUser,selectGame}){
 const old=tabs.parentElement;old.classList.add('casino-legacy-tabs');
 const bar=document.createElement('div');bar.className='casino-compact-bar';
 bar.innerHTML='<div class="casino-compact-balance"><small>账户余额</small><strong data-casino-balance>—</strong></div><h2 data-casino-title>公司大厅</h2><button type="button" class="casino-switch-toggle" aria-expanded="false" aria-controls="casino-switch-window" aria-haspopup="dialog"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 2h6v6H2zm10 0h6v6h-6zM2 12h6v6H2zm10 0h6v6h-6z" fill="currentColor"/></svg><span>玩法</span></button>';
 const panel=document.createElement('section');panel.id='casino-switch-window';panel.className='casino-switch-window';panel.setAttribute('popover','auto');panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','casino-switch-title');
 panel.innerHTML='<header><div><small>A.V.E.D. / GAME SELECT</small><h3 id="casino-switch-title">切换玩法</h3></div><button type="button" aria-label="关闭玩法选择">×</button></header>';
 const home=tabs.querySelector('[data-game="home"]');
 home.classList.add('casino-lobby-link');home.dataset.typeIgnore='';home.setAttribute('aria-label','公司大厅');home.title='返回公司大厅';home.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 9 10 2l8 7M5 8v10h4v-6h3v6h4V8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';const quick=document.createElement('div');quick.className='casino-quick-actions';bar.append(quick);quick.append(home,bar.querySelector('.casino-switch-toggle'));home.onclick=e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();selectGame('home');sync();close();};
 panel.append(tabs);old.hidden=true;gameHeader.prepend(bar);games.append(panel);games.classList.add('casino-compact-demo');
 const toggle=bar.querySelector('.casino-switch-toggle'),title=bar.querySelector('h2');
 function close(){if(panel.matches(':popover-open'))panel.hidePopover();}
 function position(){
  const pane=games.closest('.terminal-content-pane')?.getBoundingClientRect();
  const left=Math.max(0,pane?.left||0),right=Math.min(innerWidth,pane?.right||innerWidth);
  const width=Math.max(0,right-left),height=innerHeight;
  const anchor=toggle.getBoundingClientRect();
  const top=Math.max(12,Math.min(anchor.bottom+8,height-92));
  panel.style.setProperty('--casino-window-width',Math.min(304,Math.max(0,width-24))+'px');
  const panelWidth=Math.min(304,Math.max(0,width-24));
  panel.style.left=Math.round(left+(width-panelWidth)/2)+'px';panel.style.top=Math.round(top)+'px';panel.style.right='auto';panel.style.transform='none';
  panel.style.setProperty('--casino-window-height',Math.max(80,height-top-12)+'px');
 }

 toggle.onclick=()=>{if(panel.matches(':popover-open')){close();return;}panel.showPopover();position();tabs.querySelector('[aria-pressed="true"]')?.focus();};
 panel.querySelector('header button').onclick=close;
 panel.addEventListener('toggle',()=>toggle.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
 const lines={skydive:['高空','速降'],slots:['异常','回路'],scratch:['刮刮','彩票'],derby:['下班','竞速'],doudizhu:['斗','太姥'],stocks:['KARMA','指数']};
 tabs.querySelectorAll('[data-game]').forEach(button=>{const text=button.dataset.game==='scratch'?'刮刮彩票':button.textContent.trim();button.setAttribute('aria-label',text);button.dataset.typeIgnore='';button.replaceChildren(...(lines[button.dataset.game]||[text]).map(line=>{const span=document.createElement('span');span.textContent=line;return span;}));});

 function sync(){home.classList.add('casino-lobby-link');const selected=tabs.querySelector('[aria-pressed="true"]')||(home.getAttribute('aria-pressed')==='true'?home:null);if(selected)title.textContent=selected===home?'公司大厅':selected.getAttribute('aria-label')||selected.textContent.trim();home.hidden=selected===home;const balance=getUser()?.balance;bar.querySelector('[data-casino-balance]').textContent=Number.isFinite(balance)?'¤ '+Number(balance).toLocaleString():'—';}
 tabs.addEventListener('click',e=>{if(!e.defaultPrevented||!e.target.closest('[data-game]'))return;sync();close();toggle.focus();});
 const observer=new MutationObserver(sync);observer.observe(tabs,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});observer.observe(home,{attributes:true,attributeFilter:['aria-pressed']});
 window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
 window.addEventListener('scroll',()=>{if(panel.matches(':popover-open'))position();},{passive:true,capture:true});
 const rail=document.getElementById('left-sidebar');if(rail)new ResizeObserver(()=>{if(panel.matches(':popover-open'))position();}).observe(rail);
 function mountHome(head){if(!head)return;head.classList.add('casino-masthead-controls');if(home.parentElement!==head)head.append(home);}
 sync();return {sync,close,mountHome};
};
