window.AVEDEconomyUI=function({api,esc,byId,getUser,onBalance,showToast,stocks,refreshMarket}){
 function configure(){}
 const stocksPanel=byId('game-panel-stocks');
 const nav=document.createElement('div');nav.className='portfolio-tabs';nav.innerHTML='<button type="button" class="community-button" data-portfolio-view="quotes" aria-pressed="true">证券行情</button><button type="button" class="community-button" data-portfolio-view="holdings" aria-pressed="false">我的持仓</button>';stocksPanel.prepend(nav);
 const holdings=document.createElement('section');holdings.id='stock-holdings-page';holdings.hidden=true;stocksPanel.append(holdings);
 let view='quotes';
 function showView(next){view=next;for(const child of stocksPanel.children)if(child!==nav)child.hidden=child===holdings?view!=='holdings':view==='holdings';nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.portfolioView===view)));renderHoldings();}
 nav.onclick=e=>{const b=e.target.closest('[data-portfolio-view]');if(!b)return;showView(b.dataset.portfolioView);refreshMarket().catch(err=>showToast(err.message));};
 function renderHoldings(){const owned=stocks().filter(s=>s.holding>0),value=owned.reduce((sum,s)=>sum+s.price*s.holding,0);holdings.innerHTML='<header class="portfolio-summary"><span class="section-kicker">SECURITIES / POSITIONS</span><h3>我的持仓</h3><strong>¤ '+value.toLocaleString()+'</strong><p>持仓市值 · '+owned.length+' 支证券</p></header><div class="portfolio-grid">'+owned.map(s=>`<article class="stock-quote-card"><span class="section-kicker">${esc(s.code)}</span><h4>${esc(s.name)}</h4><dl><div><dt>持有数量</dt><dd>${s.holding.toLocaleString()} 股</dd></div><div><dt>当前单价</dt><dd>¤ ${s.price.toLocaleString()}</dd></div><div><dt>持仓市值</dt><dd>¤ ${(s.price*s.holding).toLocaleString()}</dd></div></dl><button type="button" class="community-button" data-position-code="${esc(s.code)}">前往交易 ↗</button></article>`).join('')+(owned.length?'':'<p class="portfolio-empty">暂无证券持仓。</p>')+'</div>';}
 holdings.onclick=e=>{const b=e.target.closest('[data-position-code]');if(!b)return;showView('quotes');stocksPanel.querySelector('[data-stock-chart-code="'+b.dataset.positionCode+'"]')?.click();byId('stocks-table-body').scrollIntoView({behavior:'smooth',block:'nearest'});};
 return {configure,renderHoldings};
};
