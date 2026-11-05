(function(root){
  const number=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
  function render(container,candles,{isIndex=false}={}) {
    const rows=candles.filter(c=>['open','high','low','close','volume'].every(k=>Number.isFinite(c[k])));
    if(!rows.length){container.innerHTML='<p class="market-empty">等待首笔行情。</p>';return;}
    const width=Math.max(320,Math.min(960,Math.round(container.getBoundingClientRect().width||960))),height=360,left=74,right=18,top=20,bottom=246,volumeTop=275,volumeBottom=325;
    const highest=Math.max(...rows.map(c=>c.high)),lowest=Math.min(...rows.map(c=>c.low));
    const padding=Math.max((highest-lowest)*.12,highest*.001,1),upper=highest+padding,lower=lowest-padding;
    const y=price=>top+(upper-price)/(upper-lower)*(bottom-top),step=(width-left-right)/Math.max(rows.length,24);
    const candleWidth=Math.max(2,Math.min(18,step*.65)),maxVolume=Math.max(1,...rows.map(c=>c.volume));
    const price=value=>number(isIndex?value/100:value);
    const details=c=>root.document.getElementById('market-candle-details').textContent=
      root.AVEDTime.clock(c.bucket)+'　开 '+price(c.open)+'　高 '+price(c.high)+'　低 '+price(c.low)+'　收 '+price(c.close)+'　量 '+number(c.volume);
    let svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="行情 K 线与成交量，红涨绿跌">';
    for(let i=0;i<5;i++){
      const py=top+(bottom-top)*i/4;
      svg+='<line x1="'+left+'" y1="'+py+'" x2="'+(width-right)+'" y2="'+py+'" class="market-grid"/>';
      svg+='<text x="'+(left-9)+'" y="'+(py+4)+'" text-anchor="end" class="market-axis">'+price(upper-(upper-lower)*i/4)+'</text>';
    }
    rows.forEach((c,i)=>{
      const x=left+step*(i+.5),color=c.close>=c.open?'var(--market-up)':'var(--market-down)';
      const bodyY=Math.min(y(c.open),y(c.close)),bodyHeight=Math.max(2,Math.abs(y(c.open)-y(c.close)));
      const volumeHeight=(volumeBottom-volumeTop)*c.volume/maxVolume;
      const label=root.AVEDTime.clock(c.bucket)+' 开 '+price(c.open)+' 高 '+price(c.high)+' 低 '+price(c.low)+' 收 '+price(c.close)+' 成交量 '+number(c.volume);
      svg+='<g data-candle-index="'+i+'" tabindex="0" role="button" aria-label="'+label+'"><title>'+label+'</title>';
      svg+='<rect x="'+(x-step/2)+'" y="'+top+'" width="'+step+'" height="'+(volumeBottom-top)+'" fill="transparent"/>';
      svg+='<line x1="'+x+'" y1="'+y(c.high)+'" x2="'+x+'" y2="'+y(c.low)+'" stroke="'+color+'" stroke-width="1.5"/>';
      svg+='<rect x="'+(x-candleWidth/2)+'" y="'+bodyY+'" width="'+candleWidth+'" height="'+bodyHeight+'" fill="'+color+'"/>';
      svg+='<rect x="'+(x-candleWidth/2)+'" y="'+(volumeBottom-volumeHeight)+'" width="'+candleWidth+'" height="'+Math.max(1,volumeHeight)+'" fill="'+color+'" opacity=".65"/></g>';
      if(i%Math.max(1,Math.ceil(rows.length/6))===0)svg+='<text x="'+x+'" y="348" text-anchor="middle" class="market-axis">'+root.AVEDTime.clock(c.bucket)+'</text>';
    });
    svg+='<text x="'+left+'" y="267" class="market-axis">成交量</text></svg>';
    container.innerHTML=svg;details(rows.at(-1));
    const select=event=>{const el=event.target.closest('[data-candle-index]');if(el)details(rows[Number(el.dataset.candleIndex)]);};
    container.onpointermove=select;container.onfocusin=select;container.onclick=select;
    container.onpointerleave=()=>details(rows.at(-1));
    container._chartRender={candles,options:{isIndex},width};
    if(!container._chartObserver&&root.ResizeObserver){
      container._chartObserver=new ResizeObserver(()=>{
        const nextWidth=Math.max(320,Math.min(960,Math.round(container.getBoundingClientRect().width||960)));
        const previous=container._chartRender;
        if(previous&&nextWidth!==previous.width)render(container,previous.candles,previous.options);
      });
      container._chartObserver.observe(container);
    }
  }
  root.AVEDMarketChart={render};
})(globalThis);
