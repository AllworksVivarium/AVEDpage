(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AVEDAttributeRadar=api;})(globalThis,function(){
 const labels=['力量','意志','洞察','敏捷','智力','体质'],vertices=[[70,18],[115,44],[115,96],[70,122],[25,96],[25,44]];
 function points(values){return values.map((value,i)=>{const ratio=Math.min(100,Math.max(0,value))/100;return [70+(vertices[i][0]-70)*ratio,70+(vertices[i][1]-70)*ratio];});}
 function render(values){
  const valid=Array.isArray(values)&&values.length===6&&values.every(v=>Number.isSafeInteger(v)&&v>=0),dots=valid?points(values):null;
  const shape=dots?'<polygon class="hud-radar-values" points="'+dots.map(p=>p.join(',')).join(' ')+'"/>'+dots.map(([x,y],i)=>'<g><title>'+labels[i]+' '+values[i]+'</title><circle class="hud-radar-point" cx="'+x+'" cy="'+y+'" r="2"/>'+(values[i]>100?'<circle class="hud-radar-over-limit" cx="'+x+'" cy="'+y+'" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>':'')+'</g>').join(''):'';
  const aria=valid?'六维属性：'+values.map((v,i)=>labels[i]+' '+v).join('，'):'六维档案未录入';
  const grid=[1,.66,.33].map(s=>'<polygon points="'+vertices.map(([x,y])=>[70+(x-70)*s,70+(y-70)*s].join(',')).join(' ')+'"/>').join('');
  const svg='<svg viewBox="0 0 140 140" role="img" aria-label="'+aria+'"><g fill="none" stroke="currentColor" stroke-width=".65">'+grid+'<path d="M70 18v104M25 44l90 52M25 96l90-52"/></g>'+shape+'<circle cx="70" cy="70" r="2" fill="currentColor"/><g fill="currentColor" font-size="10" text-anchor="middle">'+[[70,11],[124,43],[124,101],[70,135],[16,101],[16,43]].map(([x,y],i)=>'<text x="'+x+'" y="'+y+'">'+labels[i]+'</text>').join('')+'</g></svg>';
  const overflow=valid?values.flatMap((v,i)=>v>100?['<span>'+labels[i]+' <b>'+v+'</b> ↑</span>']:[]):[];
  return svg+(overflow.length?'<div class="hud-radar-overflow" aria-label="超出 100 基准的属性">'+overflow.join('')+'</div>':'');
 }
 return {points,render};
});
