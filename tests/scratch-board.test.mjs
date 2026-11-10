import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('scratch initialization runs before the later page helpers are initialized',()=>{
 const source=fs.readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
 const start=source.indexOf("      let lastScratchRules='';"),end=source.indexOf("      document.getElementById('scratch-reveal-all-cells-btn')",start);
 let listeners=0,boards=0;const host={addEventListener(type){assert.equal(type,'click');listeners++;}};
 vm.runInNewContext(source.slice(start,end)+'\nconst byId=()=>{throw Error("late helper invoked during setup")};',{document:{getElementById(id){assert.equal(id,'active-ticket-board-container');return host;}},AVEDScratchBoard({host:node}){assert.equal(node,host);boards++;return {};}});
 assert.equal(boards,1);assert.equal(listeners,1);
});

test('reveals and next tickets preserve the print and every unchanged cell',()=>{
 let replacements=0,mounts=0,parses=0,nodes=[];const price={textContent:'票价 1,000'};
 const make=html=>({html,isConnected:true,replaceWith(next){nodes[nodes.indexOf(this)]=next;this.isConnected=false;next.isConnected=true;replacements++;}});
 const host={set innerHTML(value){mounts++;nodes=[...value.matchAll(/<button[^>]+>[\s\S]*?<\/button>/g)].map(m=>make(m[0]));},querySelectorAll:()=>nodes,querySelector:()=>price};
 const document={createElement:()=>({content:{},set innerHTML(html){parses++;this.content.firstElementChild=make(html);}})},context={window:{},document};
 vm.runInNewContext(fs.readFileSync(new URL('../public/scratch-board.js',import.meta.url),'utf8'),context);
 const renderer=context.window.AVEDScratchBoard({host,cell:c=>`<button data-cell="${c.idx}">${c.revealed?'open':'covered'}</button>`,frame:(_,html)=>html.join('')});
 const ticket=()=>({gameType:{type:'lucky_num'},cost:1000,cells:Array.from({length:13},(_,idx)=>({idx,revealed:false}))});
 let t=ticket();renderer.render(t);const original=[...nodes];assert.equal(mounts,1);
 t.cells[3].revealed=true;renderer.render(t);assert.equal(replacements,1);assert.equal(nodes[2],original[2]);assert.equal(nodes[4],original[4]);
 renderer.render(t);assert.equal(replacements,1,'identical repaint does no cell DOM work');
 const parsedBeforeReset=parses;renderer.render(ticket());assert.equal(parses,parsedBeforeReset,'next ticket reuses the unopened cell without parsing HTML');assert.equal(nodes[3],original[3]);assert.equal(replacements,2);assert.equal(mounts,1,'next ticket reuses the complete print');
 t=ticket();t.cost=5000;renderer.render(t);assert.equal(price.textContent,'票价 5,000');assert.equal(mounts,1);
 t.gameType.type='three_match';renderer.render(t);assert.equal(mounts,2,'changing ticket shape mounts a new print');
});

test('next ticket remains a free local draft and never makes a speculative purchase',async()=>{
 const source=fs.readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
 const start=source.indexOf("if(id==='ticket-modal-confirm-btn'||id==='scratch-next-ticket'){");
 const end=source.indexOf("}else if(id==='slot5x3-spin-btn')",start),elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{dataset:{},classList:{add(){},remove(){}},removeAttribute(){}});return elements.get(id);};
 let purchases=0,renders=0;
 const context={id:'scratch-next-ticket',activeIssuedTicket:{gameType:{type:'lucky_num',cellsCount:13}},scratchActivating:false,scratchFeedback:{nextTicket(){}},selectedTier:{id:'t1',cost:1000},economyRevision:7,crypto:{randomUUID:()=> 'draft-key'},byId:get,renderActiveScratchTicketBoard(){renders++;},api(){purchases++;throw Error('unexpected purchase');}};
 await vm.runInNewContext('(async()=>{'+source.slice(start,end)+'}})()',context);
 assert.equal(purchases,0);assert.equal(renders,1);assert.equal(context.activeIssuedTicket.draft,true);assert.equal(context.activeIssuedTicket.cells.length,13);assert.equal(context.activeIssuedTicket.prize,undefined);
});
