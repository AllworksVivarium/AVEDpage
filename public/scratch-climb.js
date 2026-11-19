/* Twelve moves, twelve prize floors, with the same foil as the other tickets. */
window.AVEDScratchClimb=(()=>{
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>'¤ '+Number(n).toLocaleString('en-US');
 const normal=[0,.2,.5,.8,1,1.2,2,3,5,10,20,50,100];
 function state(ticket){
  const cells=ticket.cells||[];let known=0,floor=0;
  for(const cell of cells){if(!cell.revealed||!Number.isInteger(cell.stepDelta))break;floor+=cell.stepDelta;known++;}
  return {known,floor,done:cells.length>0&&known===cells.length,revealed:cells.filter(c=>c.revealed).length};
 }
 function cell(c,ticket){
  const station='第'+(c.idx+1)+'站';
  if(!c.revealed)return '<button type="button" data-scratch-cell="'+c.idx+'" aria-label="'+station+'，刮开" class="scratch-cell-foil sp-cell sp-covered"><span class="sp-coat">'+window.AVEDPixelIcons.render('eye')+'<b>刮开好运</b></span></button>';
  const current=state(ticket),known=c.idx<current.known;
  const mark=c.isBomb?window.AVEDPixelIcons.render('bomb','scratch-printed-mark'):esc(c.label);
  const status=c.isBomb?'追加 '+money(ticket.penalty):station+' '+(known?'第'+c.stepFloor+'层':'待连通');
  return '<div data-revealed-cell="'+c.idx+'" class="scratch-revealed-cell sp-cell'+(c.isWinPart?' is-winning':'')+(c.isBomb?' is-bomb':'')+'"><div>'+mark+'</div><div>'+esc(status)+'</div></div>';
 }
 function frame(cells){
  return '<section class="sp-climb-route" aria-label="层级津贴"><div class="sp-climb-route-heading"><span>0层出发</span><strong data-climb-position>待刮开</strong></div><div data-climb-levels></div></section><div class="sp-stamps sp-climb-grid">'+cells.join('')+'</div><div class="sp-cell sp-climb-destination" data-climb-end><div>终点</div><div>?</div></div>';
 }
 function ladder(ticket,current){
  const cost=ticket.cost||ticket.tier.cost;
  const defaults=ticket.climb?.topFloor===5?[0,.5,1.2,5,20,100]:normal;
  const levels=current.done&&ticket.climb?.levels?ticket.climb.levels:defaults.map(x=>Math.floor(cost*x+1e-7));
  return Array.from({length:ticket.climb?.topFloor??normal.length-1},(_,index)=>(ticket.climb?.topFloor??normal.length-1)-index).map(floor=>'<div class="sp-climb-level'+(current.known&&current.floor===floor?' is-current':'')+(current.done&&current.floor===floor?' is-final':'')+'" data-climb-level="'+floor+'"><span>'+floor+'层</span><small>×'+Number((levels[floor]/cost).toFixed(3))+'</small><b>'+money(levels[floor])+'</b></div>').join('');
 }
 function update(host,ticket){
  const current=state(ticket),position=host.querySelector('[data-climb-position]'),levels=host.querySelector('[data-climb-levels]'),end=host.querySelector('[data-climb-end]');
  if(position)position.textContent=current.done?(current.floor===(ticket.climb?.topFloor??normal.length-1)?'登顶 ':'终点 ')+'第'+current.floor+'层':current.known?'第'+current.floor+'层 '+current.revealed+'/'+ticket.cells.length:'已刮 '+current.revealed+'/'+ticket.cells.length;
  if(levels)levels.innerHTML=ladder(ticket,current);
  if(end){end.innerHTML=current.done?'<div>第'+current.floor+'层</div><div>'+money(ticket.totalPayout??ticket.prize??0)+'</div>':'<div>终点</div><div>?</div>';end.classList.toggle('is-winning',current.done&&current.floor>0);}
 }
 function prizeTable(multipliers,cost){
  if(!multipliers?.length)return '';
  return '<div class="scratch-climb-prizes" aria-label="层数对应津贴">'+multipliers.slice(1).map((multiplier,index)=>'<span><small>'+(index+1)+'层 ×'+multiplier+'</small><b>'+money(Math.floor(cost*multiplier+1e-7))+'</b></span>').join('')+'<span><small>12层超级大奖 ×2,000</small><b>'+money(cost*2000)+'</b></span></div>';
 }
 function mini(){
  const foil='<span class="sp-coat">'+window.AVEDPixelIcons.render('eye','pixel-icon')+'<b>刮开好运</b></span>';
  return '<div class="sp-stamps">'+Array.from({length:12},()=>'<span class="sp-cell sp-covered">'+foil+'</span>').join('')+'</div>';
 }
 return {cell,frame,update,ladder,state,prizeTable,mini};
})();
