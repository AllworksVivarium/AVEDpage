window.AVEDEconomyUI=function({api,esc,byId,getUser,onBalance,showToast,stocks,refreshMarket}){
 function configure(){}
 const stocksPanel=byId('game-panel-stocks');
 const summary=document.createElement('section');
 summary.id='stock-funds-summary';
 summary.className='portfolio-summary';
 const nav=document.createElement('div');nav.className='portfolio-tabs';nav.innerHTML='<button type="button" class="community-button" data-portfolio-view="quotes" aria-pressed="true">证券行情</button><button type="button" class="community-button" data-portfolio-view="holdings" aria-pressed="false">我的持仓</button>';
 stocksPanel.prepend(summary);
 stocksPanel.prepend(nav);
 const holdings=document.createElement('section');holdings.id='stock-holdings-page';holdings.hidden=true;stocksPanel.append(holdings);
 let view='quotes';
 const closingCodes=new Set();
 const money=n=>'¤ '+Math.round(n||0).toLocaleString();
 const signed=n=>(n>=0?'+':'')+Math.round(n||0).toLocaleString();
 function renderSummary(){
  const list=stocks();
  const cash=getUser()?.balance||0;
  const cashClass=cash<0?'market-down':'';
  const marketValue=list.reduce((sum,s)=>sum+(s.marketValue??(s.price*s.holding)),0);
  const costBasis=list.reduce((sum,s)=>sum+(s.costBasis||0),0);
  const positionNotional=list.reduce((sum,s)=>sum+(s.positionNotional||0),0);
  const unrealized=list.reduce((sum,s)=>sum+(s.unrealizedPnl||0),0);
  const realized=list.reduce((sum,s)=>sum+(s.realizedPnl||0),0);
  summary.innerHTML='<p class="stock-risk-notice">虚拟投资游戏，现实投资需谨慎！</p><span class="section-kicker">FUNDS</span><h3>交易资金</h3><div class="portfolio-grid stock-funds-grid"><article class="stock-quote-card stock-funds-card"><h4>可用余额</h4><strong class="stock-quote-price stock-funds-value '+cashClass+'">'+money(cash)+'</strong><p>账户允许为负数</p></article><article class="stock-quote-card stock-funds-card"><h4>占用保证金</h4><strong class="stock-quote-price stock-funds-value">'+money(costBasis)+'</strong><p>当前持仓总保证金</p></article><article class="stock-quote-card stock-funds-card"><h4>名义仓位</h4><strong class="stock-quote-price stock-funds-value">'+money(positionNotional)+'</strong><p>市场敞口（非实际占款）</p></article><article class="stock-quote-card stock-funds-card"><h4>盈亏概览</h4><strong class="stock-quote-price stock-funds-value '+((unrealized+realized)>=0?'market-up':'market-down')+'">'+signed(unrealized+realized)+'</strong><p>浮动 '+signed(unrealized)+' ｜ 已实现 '+signed(realized)+'</p></article></div>';
 }
 function showView(next){view=next;for(const child of stocksPanel.children)if(child!==nav&&child!==summary)child.hidden=child===holdings?view!=='holdings':view==='holdings';nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.portfolioView===view)));renderHoldings();}
 nav.onclick=e=>{const b=e.target.closest('[data-portfolio-view]');if(!b)return;showView(b.dataset.portfolioView);refreshMarket().catch(err=>showToast(err.message));};
 function renderHoldings(){
  const owned=stocks().filter(s=>s.holding!==0),value=owned.reduce((sum,s)=>sum+(s.marketValue??(s.price*s.holding)),0),cost=owned.reduce((sum,s)=>sum+(s.costBasis||0),0);
  renderSummary();
  holdings.innerHTML='<header class="portfolio-summary"><span class="section-kicker">SECURITIES / POSITIONS</span><h3>我的持仓</h3><strong>'+money(value)+'</strong><p>持仓估值 '+owned.length+' 支证券 ｜ 保证金 '+money(cost)+'</p></header><div class="portfolio-grid">'+owned.map(s=>{const marketValue=s.marketValue??(s.price*s.holding),costBasis=s.costBasis||0,positionNotional=s.positionNotional||0,unrealized=s.unrealizedPnl??0,avgCost=Math.abs(s.holding)>0?(s.avgCost??(positionNotional/Math.abs(s.holding))):0,rate=positionNotional?unrealized/positionNotional*100:0,sideLabel=s.holding>0?'买涨':'买跌',closing=closingCodes.has(s.code),closeLabel=closing?'平仓中…':(s.holding>0?'卖出平仓':'买入平仓');return `<article class="stock-quote-card"><span class="section-kicker">${esc(s.code)}</span><h4>${esc(s.name)}</h4><dl><div><dt>方向</dt><dd>${sideLabel}</dd></div><div><dt>持有数量</dt><dd>${Math.abs(s.holding).toLocaleString()} 股</dd></div><div><dt>当前单价</dt><dd>${money(s.price)}</dd></div><div><dt>平均开仓价</dt><dd>${money(avgCost)}</dd></div><div><dt>占用保证金</dt><dd>${money(costBasis)}</dd></div><div><dt>名义仓位</dt><dd>${money(positionNotional)}</dd></div><div><dt>杠杆倍数</dt><dd>${s.effectiveLeverage?`${s.effectiveLeverage}x`:'—'}</dd></div><div><dt>持仓估值</dt><dd>${money(marketValue)}</dd></div><div><dt>浮动盈亏</dt><dd class="${unrealized>=0?'market-up':'market-down'}">${signed(unrealized)} (${rate>=0?'+':''}${rate.toFixed(2)}%)</dd></div><div><dt>已实现盈亏</dt><dd class="${(s.realizedPnl||0)>=0?'market-up':'market-down'}">${signed(s.realizedPnl||0)}</dd></div>${s.stopLoss?`<div><dt>止损</dt><dd>${money(s.stopLoss)}</dd></div>`:''}${s.takeProfit?`<div><dt>止盈</dt><dd>${money(s.takeProfit)}</dd></div>`:''}</dl><div class="stock-position-actions"><button type="button" class="community-button" data-close-position-code="${esc(s.code)}" ${closing?'disabled':''}>${closeLabel}</button><button type="button" class="community-button" data-position-code="${esc(s.code)}">前往交易 ↗</button></div></article>`;}).join('')+(owned.length?'':'<p class="portfolio-empty">暂无证券持仓。</p>')+'</div>';
 }
 holdings.onclick=async e=>{
  const close=e.target.closest('[data-close-position-code]');
  if(close){
   const code=close.dataset.closePositionCode;
   if(!code||closingCodes.has(code))return;
   const position=stocks().find(item=>item.code===code);
   const quantity=Math.abs(Math.round(position?.holding||0));
   if(!quantity){showToast('该仓位已为空。');renderHoldings();return;}
   closingCodes.add(code);
   renderHoldings();
   try{
    const action=position.holding>0?'sell':'buy';
    const payload=await api('/api/player/stocks',{method:'POST',body:{code,action,quantity,orderType:'market'}});
    if(Array.isArray(payload?.items)){
     const list=stocks();
     list.splice(0,list.length,...payload.items);
    }
    if(typeof payload?.balance==='number')onBalance(payload.balance);
    showToast('已平仓 '+code+' × '+quantity+'。');
    renderHoldings();
   }catch(err){
    showToast(err.message||'平仓失败。');
   }finally{
    closingCodes.delete(code);
    refreshMarket().catch(refreshErr=>showToast(refreshErr.message));
    renderHoldings();
   }
   return;
  }
  const b=e.target.closest('[data-position-code]');if(!b)return;showView('quotes');stocksPanel.querySelector('[data-stock-chart-code="'+b.dataset.positionCode+'"]')?.click();byId('stocks-table-body').scrollIntoView({behavior:'smooth',block:'nearest'});
 };
 return {configure,renderHoldings};
};
