/* Market help is deliberately scoped to this window. */
(()=>{
 const trigger=document.getElementById('stock-help-btn');if(!trigger)return;
 const dialog=document.createElement('dialog');dialog.className='stock-help-dialog';dialog.setAttribute('aria-labelledby','stock-help-title');
 dialog.innerHTML=`<header><h3 id="stock-help-title">股市怎么玩</h3><button type="button" aria-label="关闭玩法说明">×</button></header><div class="stock-help-body">
 <p class="stock-help-intro">这是使用站内金币的虚拟股市。第一次玩，建议选 1 倍、少量投入，先观察价格变化。</p>
 <section><h4>01 · 先选股票，再选方向</h4><p>点股票名称查看它的行情；KARMA 大盘反映各股票的整体走势，也可以交易。</p><p><b>做多开仓＝买涨：</b>100 买入，110 平仓，每股赚 10；跌到 90，每股亏 10。</p><p><b>做空开仓＝买跌：</b>100 开仓，90 平仓，每股赚 10；涨到 110，每股亏 10。</p><p><b>平仓＝结束持仓：</b>将当前盈亏结算，剩余保证金与盈亏一起计入余额。开仓后价格仍会变化，浮动盈利不等于已经到账。</p></section>
 <section><h4>02 · 数量、保证金和杠杆</h4><p>数量是你买涨或买跌的份数。成交额＝价格 × 数量；保证金是开仓时占用的金币。</p><p>例如价格 100、数量 10，成交额为 1,000。1 倍约需 1,000 保证金，3 倍约需 334，10 倍约需 100，具体看页面预计值。</p><p><b>杠杆不会让同一份持仓的涨跌变小。</b>上例每股反向变化 10，总共仍亏 100；对于 10 倍投入，这已经相当于最初保证金。杠杆越高，同样的本金能承担越大的盈亏。</p></section>
 <section><h4>03 · 止盈、止损是什么</h4><p>这两项可以留空。填写的是<b>股票价格</b>，不是想赚或愿意亏的金额。</p><p>买涨时，止盈价高于现价、止损价低于现价；买跌时正好相反。例：100 买涨，设止盈 110、止损 95。</p><p>达到条件后系统按当时行情自动平仓，实际成交价可能越过设定值。目前没有独立的爆仓强平机制，不要以为亏到保证金就一定会自动退出。</p></section>
 <section><h4>04 · 图表怎么看</h4><p><b>红涨绿跌。</b>一根 K 线显示所选 1、5 或 15 分钟内的开盘、最高、最低和收盘价。点选 K 线可看具体数字；成交量显示实际成交数量，没有成交时可以为 0。</p><p>MACD 看趋势变化，KDJ 看短期价格位置，都是历史价格计算的参考，不保证下一步涨跌。</p><p>列表涨跌幅以北京时间当天的首个行情价格为参考；本站全天运行，没有固定收盘时间。</p></section>
 <section><h4>05 · 第一次操作</h4><p>选股票 → 选少量数量和 1 倍 → 判断买涨或买跌 → 核对确认窗口 → 开仓后查看持仓 → 想结束时点“平仓”。</p><p>行情和成交以服务器为准。余额不足时不能开仓；持有同一股票时，先平仓再换方向。</p></section>
 </div>`;
 document.body.append(dialog);trigger.addEventListener('click',()=>dialog.showModal());dialog.querySelector('header button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
})();
