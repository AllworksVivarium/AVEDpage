/* A small anchored reference window; no network or modal backdrop. */
(()=>{
 const trigger=document.getElementById('stock-help-btn');if(!trigger)return;
 const dialog=document.createElement('div');dialog.setAttribute('popover','manual');dialog.setAttribute('role','dialog');dialog.id='stock-help-window';dialog.className='stock-help-dialog';dialog.setAttribute('aria-labelledby','stock-help-title');
 dialog.innerHTML=`<header><h3 id="stock-help-title">股市与 KARMA 指数</h3><button type="button" aria-label="关闭玩法说明">×</button></header><div class="stock-help-body">
 <section><h4>大盘指数是什么？</h4><p>KARMA 跟踪全部股票的等权涨跌，不按股价高低加权。它也可作为一只证券买涨或买跌，不是固定收益。</p></section>
 <section><h4>买涨、买跌与平仓</h4><p>买涨在价格上涨时盈利；买跌在价格下跌时盈利。反向变化会亏损。平仓结束持仓，将盈亏计入余额。</p></section>
 <section><h4>数量与杠杆</h4><p>开仓会占用金币作为保证金，杠杆会放大盈亏。同一证券更换方向前需先平仓；亏损不会在保证金耗尽时自动停止。</p></section>
 <section><h4>止盈与止损</h4><p>填写希望自动平仓的股票价格，也可以留空。买涨：止盈高于现价、止损低于现价；买跌相反。实际成交价可能有偏差。</p></section>
 <section><h4>行情</h4><p>红涨绿跌，全天交易。点选 K 线看价格；MACD、KDJ 仅辅助观察走势。</p></section></div>`;
 document.body.append(dialog);trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('aria-expanded','false');
 const isOpen=()=>dialog.matches(':popover-open');const close=()=>{if(isOpen())dialog.hidePopover();trigger.setAttribute('aria-expanded','false');};
 trigger.addEventListener('click',()=>{if(isOpen())return close();dialog.showPopover();trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect();dialog.style.left=Math.max(16,Math.min(r.right-dialog.offsetWidth,innerWidth-dialog.offsetWidth-16))+'px';dialog.style.top=Math.max(16,Math.min(r.bottom+7,innerHeight-dialog.offsetHeight-16))+'px';});
 dialog.querySelector('header button').addEventListener('click',close);dialog.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(isOpen())));
 document.addEventListener('pointerdown',e=>{if(isOpen()&&!dialog.contains(e.target)&&!trigger.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){close();trigger.focus();}});addEventListener('resize',()=>{if(isOpen())close();});
})();
