/* Market help is deliberately scoped to this window. */
(()=>{
 const trigger=document.getElementById('stock-help-btn');if(!trigger)return;
 const dialog=document.createElement('dialog');dialog.className='stock-help-dialog';dialog.setAttribute('aria-labelledby','stock-help-title');
 dialog.innerHTML=`<header><h3 id="stock-help-title">股市怎么玩</h3><button type="button" aria-label="关闭玩法说明">×</button></header><div class="stock-help-body">
 <p class="stock-help-intro">这是使用站内金币的虚拟股市。第一次玩，建议选 1 倍、少量投入，先观察价格变化。</p>
 <section><h4>01 · 买涨、买跌与平仓</h4><p>先选股票或 KARMA 大盘，再选方向。</p><p><b>做多开仓（买涨）：</b>价格上涨时盈利，下跌时亏损。<br><b>做空开仓（买跌）：</b>价格下跌时盈利，上涨时亏损。</p><p><b>平仓：</b>结束持仓，将盈亏计入余额。想结束交易时，在持仓列表点“平仓”。</p></section>
 <section><h4>02 · 选择数量与杠杆</h4><p>填入数量，选择杠杆，核对预计占用的保证金后开仓。保证金是本次交易占用的金币。</p><p>新手建议从 1 倍、少量投入开始。杠杆越高，同样本金承担的盈亏越大。</p><p>余额不足时不能开仓；同一股票需先平仓，才能更换买涨或买跌的方向。</p></section>
 <section><h4>03 · 止盈与止损</h4><p>可以留空，也可以填入希望自动平仓的<b>股票价格</b>。</p><p>买涨：止盈价高于现价，止损价低于现价；买跌则相反。</p><p>触及设定价后自动平仓，实际成交价可能有偏差。亏损不会在耗尽保证金时自动停止，请留意持仓。</p></section>
 <section><h4>04 · 查看行情</h4><p><b>红涨绿跌。</b>切换周期查看走势，点选 K 线查看该时段价格。</p><p>成交量查看交易活跃度；MACD、KDJ 辅助观察趋势，不保证后续涨跌。</p><p>全天开放交易，没有固定收盘时间。</p></section>
 </div>`;
 document.body.append(dialog);trigger.addEventListener('click',()=>dialog.showModal());dialog.querySelector('header button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
})();
