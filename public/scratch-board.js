/* Keep the print and unopened cells in place; only changed cells are replaced. */
window.AVEDScratchBoard=function({host,cell,frame}){
 let key='',nodes=[],markup=[],price=null;
 const covers=new Map();
 function remember(ticket,html){html.forEach((value,i)=>{if(!ticket.cells[i].revealed)covers.set(key+':'+i+':'+value,nodes[i]);});if(covers.size>64)covers.clear();}
 return {render(ticket){
  const next=ticket.cells.map(c=>cell(c,ticket)),shape=ticket.gameType.type+':'+next.length;
  if(shape!==key||nodes.length!==next.length||nodes.some(node=>!node.isConnected)){
   host.innerHTML=frame(ticket,next);key=shape;
   nodes=[...host.querySelectorAll('[data-scratch-cell],[data-revealed-cell]')];
   price=host.querySelector('.sp-ticket-info>b');
  }else if(next.some((value,i)=>value!==markup[i])&&ticket.cells.every(c=>!c.revealed)&&nodes.every((node,i)=>node.parentElement?.replaceChildren&&covers.has(shape+':'+i+':'+next[i]))){
   const groups=new Map();nodes.forEach((node,i)=>{const parent=node.parentElement;if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(i);});
   if([...groups].every(([parent,indices])=>parent.children.length===indices.length)){
    for(const [parent,indices] of groups){const restored=indices.map(i=>covers.get(shape+':'+i+':'+next[i]));parent.replaceChildren(...restored);indices.forEach((i,n)=>nodes[i]=restored[n]);}
   }else restoreCells();
  }else restoreCells();
  function restoreCells(){for(let i=0;i<next.length;i++)if(next[i]!==markup[i]){
   const coverKey=shape+':'+i+':'+next[i];let node=!ticket.cells[i].revealed?covers.get(coverKey):null;
   if(!node){const template=document.createElement('template');template.innerHTML=next[i];node=template.content.firstElementChild;}
   nodes[i].replaceWith(node);nodes[i]=node;
  }
  }
  remember(ticket,next);markup=next;
  const text='票价 '+Number(ticket.cost||ticket.tier.cost).toLocaleString();
  if(price&&price.textContent!==text)price.textContent=text;
 }};
};
