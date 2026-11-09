(()=>{
 const lines={
  'KARMA':['全公司正在重新估计自己的价值。','意见尚未统一，报价已经更新。','今日共识：请以最新的共识为准。'],
  'AVED.VIV':['资产状态：暂时可控。','估值上涨，封条数量保持不变。','本部门不保证资产留在原地。'],
  'AVED.ANC':['装备可以补发，预算另行申请。','每一次突破，都需要后勤签字。','价格防线不在本部职责范围内。'],
  'AVED.MEM':['万物皆有库存，除了预算。','咖啡供应与员工信心同步观察。','本次上涨不构成加餐承诺。'],
  'AVED.RES':['结果令人振奋，复现还需时间。','已排除多数不可能，剩下的正在报销。','估值已通过初步想象。'],
  'AVED.MED':['行情仅供观察，不作为诊断依据。','建议保持呼吸，尤其在看盘时。','急救箱不含回本药物。']
 };
 function render(view,stocks){
  const code=view.quote.code,choices=lines[code]||['预算仍在流转，报价已经先行。','本部门对明日保持审慎的想象。'];
  document.getElementById('market-department-line').textContent=choices[Math.floor(Date.now()/180000)%choices.length];
  let panel=document.getElementById('market-bulletins');
  if(!panel){panel=document.createElement('details');panel.id='market-bulletins';panel.open=true;panel.innerHTML='<summary>公司内线 <small lang="en">INTERNAL WIRE</small></summary><div class="market-wire-items"></div>';(document.getElementById('market-trade-readout')||document.getElementById('stock-candles')).after(panel);}
  const rows=panel.querySelector('.market-wire-items'),stamp=(view.bulletins||[]).map(b=>b.id).join(',');if(panel.dataset.stamp===stamp)return;panel.dataset.stamp=stamp;rows.replaceChildren();
  for(const item of view.bulletins||[]){const article=document.createElement('article'),time=document.createElement('time'),text=document.createElement('p'),tag=document.createElement('b');time.dateTime=new Date(item.publishedAt).toISOString();time.textContent=AVEDTime.clock(item.publishedAt);tag.textContent=stocks.find(s=>s.code===item.code)?.name||item.code;text.textContent=item.headline;article.append(time,tag,text);rows.append(article);}
  if(!rows.childElementCount)rows.textContent='内线静默，等待下一份简报。';
 }
 window.AVEDMarketAtmosphere={render};
})();
