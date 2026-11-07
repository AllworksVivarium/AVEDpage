import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(count){
 let now=Date.UTC(2026,10,7),strip;const timers=new Map(),calls=[],nodes=[];
 const element=()=>{const e={className:'',hidden:false,dataset:{},style:{setProperty(k,v){this[k]=v;}},scrollWidth:600,clientWidth:180,children:[],setAttribute(){},append(...c){this.children.push(...c);},remove(){this.removed=true;},classList:{remove(){},add(){},toggle(){}}};nodes.push(e);return e;};
 const document={hidden:false,querySelector:()=>({after(el){strip=el;}}),createElement:element,addEventListener(){}};
 const api=async url=>{calls.push(url);return {serverTime:now,items:calls.length===1?Array.from({length:count},(_,i)=>({ticketId:i+1,alias:'员工'+(i+1),game:'scratch',cost:1000,prize:i===1?0:5000,penalty:i===1?2000:0,createdAt:new Date(now).toISOString()})):[]};};
 class Clock extends Date{static now(){return now;}}
 const ctx={window:{},document,Date:Clock,setInterval:(fn,ms)=>timers.set(ms,fn),setTimeout:fn=>fn()};
 vm.runInNewContext(readFileSync(new URL('../public/jackpot-ticker.js',import.meta.url),'utf8'),ctx);ctx.window.AVEDCreateJackpotTicker({api});
 return {ready:()=>new Promise(setImmediate),tick:ms=>{now+=ms;timers.get(250)();},refresh:()=>timers.get(30000)(),calls,get strip(){return strip;},get text(){return nodes.find(x=>x.className==='aved-jackpot-text');}};
}
test('every record count loops awards, bombs and the notice in six-second slots',async()=>{
 for(const count of [1,2,3,4,5]){
  const h=setup(count);await h.ready();
  for(let round=0;round<2;round++){
   for(let i=0;i<count;i++){
    assert.match(h.text.textContent,new RegExp('员工'+(i+1)));
    if(i===1){assert.match(h.text.textContent,/刮出大炸弹了/);assert.match(h.text.textContent,/医疗费 ¤ 2,000/);assert.equal(h.strip.dataset.outcome,'bomb');}
    else assert.equal(h.strip.dataset.outcome,'award');
    const before=h.text.textContent;h.tick(5999);assert.equal(h.text.textContent,before);h.tick(1);
   }
   assert.match(h.text.textContent,/近 30 分钟的大奖与炸弹消息/);assert.equal(h.strip.hidden,false);h.tick(6000);
  }
  assert.match(h.text.textContent,/员工1/);assert.equal(h.text.style['--ticker-start'],'-420px');
 }
});
test('the persistent notice is the only entry when empty or expired; polling remains incremental',async()=>{
 const h=setup(2);await h.ready();h.tick(1800001);assert.equal(h.strip.hidden,false);assert.match(h.text.textContent,/近 30 分钟的大奖与炸弹消息/);
 h.tick(6000);assert.match(h.text.textContent,/近 30 分钟/);h.refresh();await h.ready();assert.equal(h.calls[1],'/api/player/game-highlights?after=2');
 const empty=setup(0);await empty.ready();const note=empty.text.textContent;assert.match(note,/近 30 分钟/);empty.tick(12000);assert.equal(empty.strip.hidden,false);assert.equal(empty.text.textContent,note);
});
