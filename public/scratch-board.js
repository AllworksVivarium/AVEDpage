/* Keep the print and unopened cells in place; only changed cells are replaced. */
window.AVEDScratchBoard=function({host,cell,frame}){
 let key='',nodes=[],markup=[],price=null;
 return {render(ticket){
  const next=ticket.cells.map(c=>cell(c,ticket)),shape=ticket.gameType.type+':'+next.length;
  if(shape!==key||nodes.length!==next.length||nodes.some(node=>!node.isConnected)){
   host.innerHTML=frame(ticket,next);key=shape;
   nodes=[...host.querySelectorAll('[data-scratch-cell],[data-revealed-cell]')];
   price=host.querySelector('.sp-ticket-info>b');
  }else for(let i=0;i<next.length;i++)if(next[i]!==markup[i]){
   const template=document.createElement('template');template.innerHTML=next[i];
   const node=template.content.firstElementChild;nodes[i].replaceWith(node);nodes[i]=node;
  }
  markup=next;
  const text='票价 '+Number(ticket.cost||ticket.tier.cost).toLocaleString();
  if(price&&price.textContent!==text)price.textContent=text;
 }};
};
