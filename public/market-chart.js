(function(root){
  const number=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2});

  function render(container,candles,{isIndex=false}={}) {
    const rows=candles.filter(c=>['open','high','low','close','volume'].every(k=>Number.isFinite(c[k])));
    if(!rows.length){container.innerHTML='<p class="market-empty">等待首笔行情。</p>';return;}

    const width=Math.max(320,Math.min(960,Math.round(container.getBoundingClientRect().width||960)));
    const height=width<500?240:300,left=64,right=12,top=16,bottom=height-90,volumeTop=height-65,volumeBottom=height-30;
    const highest=Math.max(...rows.map(c=>c.high)),lowest=Math.min(...rows.map(c=>c.low));
    const padding=Math.max((highest-lowest)*.12,highest*.001,1),upper=highest+padding,lower=lowest-padding;
    const y=price=>top+(upper-price)/(upper-lower)*(bottom-top);
    const step=(width-left-right)/Math.max(rows.length,24);
    const candleWidth=Math.max(2,Math.min(18,step*.65)),maxVolume=Math.max(1,...rows.map(c=>c.volume));
    const xAt=index=>left+step*(index+.5);
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const price=value=>number(isIndex?value/100:value);

    const details=c=>{
      const target=root.document.getElementById('market-candle-details');
      if(target)target.textContent=root.AVEDTime.clock(c.bucket)+'　开 '+price(c.open)+'　高 '+price(c.high)+'　低 '+price(c.low)+'　收 '+price(c.close)+'　量 '+number(c.volume);
    };

    let svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="行情 K 线与成交量，红涨绿跌">';
    for(let i=0;i<5;i++){
      const py=top+(bottom-top)*i/4;
      svg+='<line x1="'+left+'" y1="'+py+'" x2="'+(width-right)+'" y2="'+py+'" class="market-grid"/>';
      svg+='<text x="'+(left-9)+'" y="'+(py+4)+'" text-anchor="end" class="market-axis">'+price(upper-(upper-lower)*i/4)+'</text>';
    }

    rows.forEach((c,i)=>{
      const x=xAt(i),color=c.close>=c.open?'var(--market-up)':'var(--market-down)';
      const bodyY=Math.min(y(c.open),y(c.close)),bodyHeight=Math.max(2,Math.abs(y(c.open)-y(c.close)));
      const volumeHeight=(volumeBottom-volumeTop)*c.volume/maxVolume;
      const label=root.AVEDTime.clock(c.bucket)+' 开 '+price(c.open)+' 高 '+price(c.high)+' 低 '+price(c.low)+' 收 '+price(c.close)+' 成交量 '+number(c.volume);
      svg+='<g data-candle-index="'+i+'" tabindex="0" role="button" aria-label="'+label+'"><title>'+label+'</title>';
      svg+='<rect x="'+(x-step/2)+'" y="'+top+'" width="'+step+'" height="'+(volumeBottom-top)+'" fill="transparent"/>';
      svg+='<line x1="'+x+'" y1="'+y(c.high)+'" x2="'+x+'" y2="'+y(c.low)+'" stroke="'+color+'" stroke-width="1.5"/>';
      svg+='<rect x="'+(x-candleWidth/2)+'" y="'+bodyY+'" width="'+candleWidth+'" height="'+bodyHeight+'" fill="'+color+'"/>';
      svg+='<rect x="'+(x-candleWidth/2)+'" y="'+(volumeBottom-volumeHeight)+'" width="'+candleWidth+'" height="'+Math.max(1,volumeHeight)+'" fill="'+color+'" opacity=".65"/></g>';
      if(i%Math.max(1,Math.ceil(rows.length/6))===0)svg+='<text x="'+x+'" y="'+(height-10)+'" text-anchor="middle" class="market-axis">'+root.AVEDTime.clock(c.bucket)+'</text>';
    });

    svg+='<text x="'+left+'" y="'+(volumeTop-8)+'" class="market-axis">成交量</text></svg>';
    container.innerHTML=svg;
    container.style.position='relative';
    details(rows.at(-1));

    const svgEl=container.querySelector('svg');
    const crossLayer=root.document.createElementNS('http://www.w3.org/2000/svg','g');
    crossLayer.setAttribute('class','market-crosshair-layer');

    const vLine=root.document.createElementNS('http://www.w3.org/2000/svg','line');
    vLine.setAttribute('class','market-crosshair-line market-crosshair-v');
    const hLine=root.document.createElementNS('http://www.w3.org/2000/svg','line');
    hLine.setAttribute('class','market-crosshair-line market-crosshair-h');

    crossLayer.append(vLine,hLine);
    svgEl.appendChild(crossLayer);

    const tooltip=root.document.createElement('div');
    tooltip.className='market-crosshair-tooltip';
    tooltip.hidden=true;
    container.appendChild(tooltip);

    const showCross=(index,localX,localY)=>{
      const safeIndex=clamp(index,0,rows.length-1);
      const candle=rows[safeIndex];
      const x=xAt(safeIndex);
      const yPointer=clamp(localY,top,bottom);
      const change=((candle.close-candle.open)/Math.max(1,Math.abs(candle.open))*100);
      details(candle);

      vLine.setAttribute('x1',x);vLine.setAttribute('x2',x);
      vLine.setAttribute('y1',top);vLine.setAttribute('y2',volumeBottom);
      hLine.setAttribute('x1',left);hLine.setAttribute('x2',width-right);
      hLine.setAttribute('y1',yPointer);hLine.setAttribute('y2',yPointer);
      crossLayer.style.display='block';

      tooltip.innerHTML=''+
        '<div class="market-crosshair-time">'+root.AVEDTime.clock(candle.bucket)+'</div>'+
        '<div>开 <strong>'+price(candle.open)+'</strong> ｜ 收 <strong>'+price(candle.close)+'</strong></div>'+
        '<div>高 '+price(candle.high)+' ｜ 低 '+price(candle.low)+'</div>'+
        '<div class="'+(change>=0?'market-up':'market-down')+'">变化 '+(change>=0?'+':'')+change.toFixed(2)+'%</div>'+
        '<div>成交量 '+number(candle.volume)+'</div>';

      tooltip.hidden=false;
      const placeTooltip=()=>{
        if(tooltip.hidden)return;
        const box=container.getBoundingClientRect(),px=localX/width*box.width,py=localY/height*box.height;
        const tooltipW=tooltip.offsetWidth||180,tooltipH=tooltip.offsetHeight||96;
        const tooltipX=px+14+tooltipW>box.width-4?px-tooltipW-14:px+14;
        const tooltipY=py+14+tooltipH>box.height-4?py-tooltipH-14:py+14;
        tooltip.style.left=clamp(tooltipX,4,Math.max(4,box.width-tooltipW-4))+'px';
        tooltip.style.top=clamp(tooltipY,4,Math.max(4,box.height-tooltipH-4))+'px';
      };
      placeTooltip();
      // Typography classification can change the size after the text is inserted.
      root.requestAnimationFrame(placeTooltip);
    };

    const hideCross=()=>{
      crossLayer.style.display='none';
      tooltip.hidden=true;
      details(rows.at(-1));
    };

    const pointerSelect=event=>{
      const rect=container.getBoundingClientRect();
      const localX=(event.clientX-rect.left)/Math.max(rect.width,1)*width;
      const localY=(event.clientY-rect.top)/Math.max(rect.height,1)*height;
      const index=Math.round((localX-left)/step-.5);
      showCross(index,localX,localY);
    };

    const focusSelect=event=>{
      const el=event.target.closest('[data-candle-index]');
      if(!el)return;
      const index=Number(el.dataset.candleIndex);
      if(!Number.isFinite(index))return;
      showCross(index,xAt(index),y(rows[index].close));
    };

    const clickSelect=event=>{
      const el=event.target.closest('[data-candle-index]');
      if(!el)return;
      const index=Number(el.dataset.candleIndex);
      if(!Number.isFinite(index))return;
      showCross(index,xAt(index),y(rows[index].close));
    };

    container.onpointermove=pointerSelect;
    container.onfocusin=focusSelect;
    container.onclick=clickSelect;
    container.onpointerleave=hideCross;
    container.onblur=hideCross;

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
