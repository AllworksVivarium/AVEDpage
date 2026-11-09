import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/ddz-ui.js',import.meta.url),'utf8');

function harness(initial=[]){
 const handlers=new Map();let selected=new Set(initial),allowed=true,captured=false,sounds=0;
 const cards=Array.from({length:7},(_,i)=>({dataset:{card:String(i)},closest:()=>cards[i]}));
 const hand={contains:card=>cards.includes(card),querySelectorAll:()=>cards,addEventListener:(type,fn)=>handlers.set(type,fn),setPointerCapture:()=>{captured=true;},hasPointerCapture:()=>captured,releasePointerCapture:()=>{captured=false;handlers.get('lostpointercapture')?.({});}};
 const ctx={document:{elementFromPoint:(x,y)=>y<0?null:cards[Math.floor(x/20)]}};
 vm.runInNewContext(source.slice(source.indexOf(' function bindHandSelection('),source.indexOf(' const canSelectHand=')),ctx);
 const api=ctx.bindHandSelection(hand,{canSelect:()=>allowed,getSelection:()=>selected,setSelection:next=>{selected=next;},onStart:()=>sounds++});
 const send=(type,index,extra={})=>{const event={target:cards[index],button:0,isPrimary:true,pointerId:1,clientX:index*20+1,clientY:10,detail:1,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};handlers.get(type)?.(event);return event;};
 return{send,api,selection:()=>[...selected].sort((a,b)=>a-b),allow:v=>{allowed=v;},sounds:()=>sounds,captured:()=>captured};
}

test('fast forward/reverse drags select a complete range and keep pre-existing selections',()=>{
 const h=harness([6]);h.send('pointerdown',0);h.send('pointermove',4);
 assert.deepEqual(h.selection(),[0,1,2,3,4,6]);
 h.send('pointermove',2);assert.deepEqual(h.selection(),[0,1,2,6]);
 h.send('pointerup',2);assert.equal(h.captured(),false);assert.equal(h.sounds(),1);
 const click=h.send('click',2);assert.equal(click.stopped,true);assert.deepEqual(h.selection(),[0,1,2,6],'compatibility click does not toggle twice');
});

test('starting on a selected card deselects the range; cancellation restores the snapshot',()=>{
 const h=harness([0,1,2,3,6]);h.send('pointerdown',3);h.send('pointermove',1);
 assert.deepEqual(h.selection(),[0,6]);h.send('pointercancel',1);assert.deepEqual(h.selection(),[0,1,2,3,6]);
 h.send('pointerdown',3);h.send('pointerup',0);assert.deepEqual(h.selection(),[6],'pointerup uses the final hit even without a move event');
});

test('secondary pointers, blocked hands, interrupted captures and keyboard clicks are safe',()=>{
 const h=harness([6]);h.send('pointerdown',0,{isPrimary:false});h.send('pointerdown',0,{button:2});assert.deepEqual(h.selection(),[6]);
 h.allow(false);h.send('pointerdown',0);assert.deepEqual(h.selection(),[6]);
 h.allow(true);h.send('pointerdown',0);h.send('pointermove',3,{pointerId:2});assert.deepEqual(h.selection(),[0,6]);
 h.allow(false);h.send('pointerup',3);assert.deepEqual(h.selection(),[6]);
 h.allow(true);h.send('pointerdown',2);h.api.cancel();assert.deepEqual(h.selection(),[6]);
 assert.equal(h.send('click',0,{detail:0}).stopped,undefined,'keyboard activation remains available');
});

test('the persistent owner follows the played cards, including after another seat passes',()=>{
 const owner={dataset:{},hidden:true,innerHTML:''},trick={innerHTML:''};
 const ctx={state:{id:'room',size:3,seat:0,landlord:1,phase:'playing',seats:[{name:'你'},{name:'夜航员'},{name:'同事'}],last:{seat:1,cards:[{id:7}]} ,event:{seat:2,type:'pass'}},$:selector=>selector==='[data-ddz-owner]'?owner:trick,portrait:()=>'',card:()=>'<card>',esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;')};
 vm.runInNewContext(source.slice(source.indexOf(' function seatDirection('),source.indexOf(" panel.addEventListener('error'")),ctx);
 ctx.renderLastPlay();assert.match(owner.innerHTML,/右侧出牌 · 太姥/);assert.match(owner.innerHTML,/夜航员/);assert.equal(owner.dataset.position,'right');
 ctx.state.last={seat:2,cards:[{id:8}]};ctx.state.seats[2].name='<unsafe>';ctx.renderLastPlay();
 assert.match(owner.innerHTML,/左侧出牌 · 少姥/);assert.match(owner.innerHTML,/&lt;unsafe&gt;/);assert.ok(!owner.innerHTML.includes('<unsafe>'));
 ctx.state.size=4;ctx.state.seat=0;assert.equal(ctx.seatDirection(2).label,'上方');assert.equal(ctx.seatDirection(0).label,'你');
 ctx.state.last=null;ctx.renderLastPlay();assert.equal(owner.hidden,true);assert.equal(trick.innerHTML,'');
});
