/* A small anchored reference window; no network or modal backdrop. */
(()=>{
 const trigger=document.getElementById('stock-help-btn');if(!trigger)return;
 const dialog=document.createElement('div');dialog.setAttribute('popover','manual');dialog.setAttribute('role','dialog');dialog.id='stock-help-window';dialog.className='stock-help-dialog';dialog.setAttribute('aria-labelledby','stock-help-title');
 dialog.innerHTML=`<header><h3 id="stock-help-title">股市玩法说明</h3><button type="button" aria-label="关闭玩法说明">×</button></header><div class="stock-help-body">
 <p class="stock-help-intro">先选证券，观察行情，再用少量数量和 1 倍练习。价格会持续变化，盈亏在平仓时结算。</p>
 <section><h4>01 · 指数和股票</h4><p>列表中的部门股票各有价格与涨跌幅。KARMA 指数反映全部部门股票的整体涨跌，也能像股票一样交易。红色表示上涨，绿色表示下跌；涨跌幅以当天的参考价比较。</p><p>点击列表可切换证券。图表右上角可选择每根 K 线代表 1、5 或 15 分钟。</p></section>
 <section><h4>02 · 买涨、买跌、平仓</h4><p><b>做多开仓</b>是买涨：100 开仓，110 平仓，每股赚 10；跌到 90 则每股亏 10。<b>做空开仓</b>是买跌，价格下跌时盈利，价格上涨时亏损。</p><p><b>平仓</b>是结束持仓，把当时的盈亏计入余额。持仓中的浮动盈亏仍会变动。每次开仓独立保留价格、杠杆和止盈止损，可在“我的持仓”单独平仓；快捷交易的平仓按先开先平执行。同一证券可以同时持有多仓和空仓，两边分别占用保证金、独立计算盈亏；开反向仓不会替你平掉原仓。同时持有两个方向时，请在“我的持仓”选择具体仓位平仓。</p></section>
 <section><h4>03 · 数量、保证金和杠杆</h4><p>数量是交易份数，成交额约等于价格乘数量。开仓会占用保证金。1 倍没有借力；3 倍、10 倍所需保证金较少，但同一笔价格变化相对于投入会更大。</p><p>例如价格 100、数量 10，成交额为 1,000。1 倍大约占用 1,000，10 倍大约占用 100；如果每股反向变化 10，总亏损仍是 100。先看交易区显示的预计保证金，余额不足时无法开仓。账户可用余额需超过 100 万才能开 3 倍，超过 500 万才能开 10 倍；限价单提交和成交时均检查。已有持仓可以正常平仓。</p></section>
 <section><h4>04 · 止盈、止损</h4><p>两项都可留空，填写的是<b>证券价格</b>，不是想赚或愿意亏的金币。买涨时，止盈高于现价、止损低于现价；买跌时相反。</p><p>例如 100 买涨，可以设止盈 110、止损 95。达到条件后会自动平仓，实际成交价可能越过所填价格。</p></section>
 <section><h4>保证金、剩余权益和 20% 强平线</h4><p><b>保证金</b>是这笔仓位占用的本金；<b>剩余权益 = 保证金 + 浮动盈亏</b>，是按当前行情平仓时剩下的仓位资金，尚未扣平仓手续费。亏损时，保证金账面数不会自动缩小，但剩余权益会减少。</p><p>每笔杠杆多仓及所有空仓独立风控：<b>剩余权益 ≤ 这笔仓位当前保证金的 20%</b>，系统整笔强制平仓。20% 不是股价跌幅，也不是必须亏光才处理。不计取整和手续费，10 倍多仓反向波动约 8% 就会触线；3 倍多仓约为 26.7%。普通 1 倍现金多仓不适用此强平线。</p><p>例如保证金 1,000，浮亏 600，剩余权益为 400（40%），尚未触及 200 的强平线；浮亏达到 800，权益剩 200，就会触发强平。正常触线平仓后，剩余资金扣除平仓手续费后退回余额。</p><p>服务器约每 5 秒更新报价，并检查强平与止盈止损，离线同样执行。按实际服务器报价成交；跳跃报价可能越过预计强平价，实际亏损可能超过保证金，差额仍按实际损益结算。这里的 20% 是本游戏的逐仓参数，不是现实股票市场的统一规则；玩法更接近逐笔保证金交易的股票 / 指数差价合约。</p></section>
 <section><h4>提前提醒与手动补保证金</h4><p>权益不高于保证金的 <b>60%</b> 时提醒，不高于 <b>40%</b> 时标为高风险，<b>20%</b> 时强平。侧栏会出现持仓风险点，股市内显示提醒；其他页面约每 30 秒随现有消息刷新同步，股市页面随行情刷新。提醒不保证早于突发行情。</p><p>在“我的持仓”点击<b>补保证金</b>，把可用余额转入指定仓位，无手续费、不改变数量或开仓价，系统不会自动扣其他余额救仓。已经强平的仓位不能再补。</p><p>沿用上例：保证金 1,000、浮亏 600、权益 400。再补 500 后，保证金变 1,500，浮亏仍是 600，权益变 900（60%），新强平线为 300。可承受的累计浮亏由 800 增至 1,200。追加资金也会承担亏损；部分平仓后，按剩余保证金重新计算。</p></section>
 <section><h4>交易手续费与统计</h4><p>每次实际成交收取<b>成交额的 0.1%，向上取整，最低 1 金币</b>，按完整成交额计算，不是按保证金计算。开仓、手动平仓、止盈止损、强平和限价成交都收费；未成交挂单、撤单、补保证金不收费。</p><p>例如 10,000 的仓位，开仓费 10；若原价平仓，另收平仓费 10，这次净亏 20。历史盈亏扣除所有已发生的手续费；每次平仓的净盈亏会分摊相应开仓费，交易胜率也按扣费后的净盈亏计算。旧成交不补扣手续费。</p></section>
 <section><h4>05 · K 线与成交量</h4><p>一根 K 线记录一个周期的开盘、最高、最低和收盘价。实体表示开盘到收盘的距离，上下细线表示该周期的最高与最低。点选图中的 K 线可查看具体数字。</p><p>下方的成交量记录这一周期实际交易的份数。成交量大，表示交投更活跃；它本身不说明价格下一步会涨还是跌。</p></section>
 <section><h4>06 · MACD 怎么看</h4><p>MACD 用两条快慢不同的均线观察趋势。DIF 与 DEA 两线靠近或交叉，表示短期走势正在变化；柱状图表示两线之间的差。柱子放大说明差距扩大，缩小说明差距收窄。</p><p>它根据已经发生的价格计算，会慢于突发变化。交叉只能作参考，不能当作必涨或必跌的信号。</p></section>
 <section><h4>07 · KDJ 怎么看</h4><p>KDJ 用最近一段价格的高低范围，观察当前价格靠近区间的哪一侧。K、D 是较平滑的两条线，J 更敏感，起伏通常更大。</p><p>接近高位或低位时，可以留意走势是否转弱或反弹；强势行情中也可能长期停留在高位或低位。结合 K 线与成交量看，别只凭一个指标下单。</p></section>
 <section><h4>08 · 公司内线与刷新</h4><p>公司内线每 3 分钟从全公司文案池随机发布一则快讯，有些消息会短暂影响相关部门的行情，也有些只是普通消息。页面不标明哪条会产生影响。</p><p>“刷新行情”会立即更新屏幕上的报价，不会让市场价格提前跳到下一刻。首次操作可按“选证券 → 选方向、数量、1 倍 → 核对开仓 → 查看持仓 → 平仓”的顺序尝试。</p></section></div>`;
 document.body.append(dialog);trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('aria-expanded','false');
 const isOpen=()=>dialog.matches(':popover-open');const close=()=>{if(isOpen())dialog.hidePopover();trigger.setAttribute('aria-expanded','false');};
 trigger.addEventListener('click',()=>{if(isOpen())return close();dialog.showPopover();trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect();dialog.style.left=Math.max(16,Math.min(r.right-dialog.offsetWidth,innerWidth-dialog.offsetWidth-16))+'px';dialog.style.top=Math.max(16,Math.min(r.bottom+7,innerHeight-dialog.offsetHeight-16))+'px';});
 dialog.querySelector('header button').addEventListener('click',close);dialog.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(isOpen())));
 document.addEventListener('pointerdown',e=>{if(isOpen()&&!dialog.contains(e.target)&&!trigger.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){close();trigger.focus();}});addEventListener('resize',()=>{if(isOpen())close();});
})();
