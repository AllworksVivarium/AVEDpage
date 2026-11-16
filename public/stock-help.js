/* A small anchored reference window; no network or modal backdrop. */
(()=>{
 const trigger=document.getElementById('stock-help-btn');if(!trigger)return;
 const dialog=document.createElement('div');dialog.setAttribute('popover','manual');dialog.setAttribute('role','dialog');dialog.id='stock-help-window';dialog.className='stock-help-dialog';dialog.setAttribute('aria-labelledby','stock-help-title');
 dialog.innerHTML=`<header><h3 id="stock-help-title">股市玩法说明</h3><button type="button" aria-label="关闭玩法说明">×</button></header><div class="stock-help-body">
 <p class="stock-help-intro">选证券 → 填数量与杠杆 → 做多或做空 → 在“我的持仓”平仓。</p>
 <section><h4>行情</h4><p>点击证券切换行情，选择 1、5、15 分钟 K 线。红涨绿跌；点选 K 线查看价格与成交量。</p></section>
 <section><h4>开仓与平仓</h4><p>做多买涨，做空买跌。在“我的持仓”选择仓位平仓；快捷平仓按先开先平执行。</p></section>
 <section><h4>保证金与杠杆</h4><p>保证金约为成交额 ÷ 杠杆倍数。资产曾超过 100 万永久解锁 3 倍，超过 500 万永久解锁 10 倍。</p><p>总资产 = 可用余额 + 持仓保证金 + 浮动盈亏。</p></section>
 <section><h4>止盈与止损</h4><p>买涨：止盈高于现价，止损低于现价；买跌反之。在下单区或持仓中设置。</p></section>
 <section><h4>补保证金与强平</h4><p>剩余权益 = 保证金 + 浮动盈亏。杠杆多仓及所有空仓：权益降至 60% 时提醒，40% 时标记高风险，20% 时强平。</p><p>在“我的持仓”追加保证金；开启自动补保证金后，触线时使用余额补至约 40%，离线生效。</p></section>
 <section><h4>手续费</h4><p>开仓、平仓各收成交额的 0.1%，每笔最低 1。历史盈亏与胜率均按扣费后计算。</p></section>
 <section><h4>技术指标</h4><p>MACD 看趋势变化；KDJ 看价格在近期高低区间中的位置。结合 K 线与成交量查看。</p></section>
 <section><h4>公司内线</h4><p>每 3 分钟更新一则快讯。点击“刷新行情”查看最新报价。</p></section></div>`;
 document.body.append(dialog);trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('aria-expanded','false');
 const isOpen=()=>dialog.matches(':popover-open');const close=()=>{if(isOpen())dialog.hidePopover();trigger.setAttribute('aria-expanded','false');};
 trigger.addEventListener('click',()=>{if(isOpen())return close();dialog.showPopover();trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect();dialog.style.left=Math.max(16,Math.min(r.right-dialog.offsetWidth,innerWidth-dialog.offsetWidth-16))+'px';dialog.style.top=Math.max(16,Math.min(r.bottom+7,innerHeight-dialog.offsetHeight-16))+'px';});
 dialog.querySelector('header button').addEventListener('click',close);dialog.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(isOpen())));
 document.addEventListener('pointerdown',e=>{if(isOpen()&&!dialog.contains(e.target)&&!trigger.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){close();trigger.focus();}});addEventListener('resize',()=>{if(isOpen())close();});
})();
