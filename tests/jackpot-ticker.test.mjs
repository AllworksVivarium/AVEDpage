import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(count,entries=null){
 let now=Date.UTC(2026,10,7),strip;const timers=new Map(),calls=[],nodes=[];
 const element=()=>{const e={className:'',hidden:false,dataset:{},style:{setProperty(k,v){this[k]=v;},getPropertyValue(k){return this[k];}},scrollWidth:600,clientWidth:180,children:[],setAttribute(){},append(...c){this.children.push(...c);},remove(){this.removed=true;},classList:{remove(){},add(){},toggle(){}}};nodes.push(e);return e;};
 const document={hidden:false,querySelector:()=>({after(el){strip=el;}}),createElement:element,addEventListener(){}};
 const api=async url=>{calls.push(url);return {serverTime:now,items:calls.length===1?(entries?entries.map(x=>({alias:'员工',createdAt:new Date(now).toISOString(),...x})):Array.from({length:count},(_,i)=>({ticketId:i+1,alias:'员工'+(i+1),game:'scratch',cost:1000,prize:i===1?0:5000,penalty:i===1?2000:0,createdAt:new Date(now).toISOString()}))):[]};};
 class Clock extends Date{static now(){return now;}}
 const ctx={window:{},document,Date:Clock,setInterval:(fn,ms)=>timers.set(ms,fn),setTimeout:fn=>fn()};
 vm.runInNewContext(readFileSync(new URL('../public/jackpot-ticker.js',import.meta.url),'utf8'),ctx);ctx.window.AVEDCreateJackpotTicker({api});
 return {ready:()=>new Promise(setImmediate),tick:ms=>{now+=ms;timers.get(250)();},refresh:()=>timers.get(30000)(),calls,get strip(){return strip;},get text(){return nodes.find(x=>x.className==='aved-jackpot-text');},timing:ctx.window.AVEDJackpotTiming};
}
test('records begin with the player ID and finish the adaptive scroll before switching',async()=>{
 for(const count of [1,2,3,4,5]){
  const h=setup(count);await h.ready();
  for(let round=0;round<2;round++){
   for(let i=0;i<count;i++){
    assert.match(h.text.textContent,new RegExp('员工'+(i+1)));
    if(i===1){assert.equal(h.text.textContent,'员工2 · 刮刮乐 · 开出炸弹 · −¤ 2,000');assert.equal(h.strip.dataset.outcome,'bomb');}
    else {assert.equal(h.strip.dataset.outcome,'award');assert.equal(h.text.textContent,`员工${i+1} · 刮刮乐 · 5倍大奖 · +¤ 5,000`);}
    const before=h.text.textContent,duration=parseInt(h.text.style['--ticker-duration']);assert.ok(duration>=5000&&duration<=8000);h.tick(duration-1);assert.equal(h.text.textContent,before);h.tick(1);
   }
   assert.match(h.text.textContent,/^员工1/);assert.equal(h.strip.hidden,false);
  }
  assert.match(h.text.textContent,/员工1/);assert.equal(h.text.style['--ticker-end'],'-428px');
 }
});

test('only five-times awards and scratch bombs appear; repair fees are never bombs',async()=>{
 const h=setup(0,[
  {ticketId:1,game:'scratch',cost:100,prize:499},
  {ticketId:2,game:'cards',cost:0,prize:10000},
  {ticketId:3,game:'slot',cost:100,prize:200,penalty:400},
  {ticketId:4,game:'slot',cost:100,prize:500,penalty:400},
  {ticketId:5,game:'derby',cost:100,prize:625},
  {ticketId:6,game:'sky',cost:100,prize:625},
  {ticketId:7,game:'scratch',cost:100,prize:0,penalty:200}
 ]);await h.ready();
 assert.equal(h.strip.dataset.outcome,'award');assert.match(h.text.textContent,/异常回路 · 5倍大奖/);
 h.tick(8000);assert.match(h.text.textContent,/高空速降 · 6.25倍大奖/);
 h.tick(8000);assert.equal(h.strip.dataset.outcome,'bomb');assert.match(h.text.textContent,/刮刮乐 · 开出炸弹/);
 h.tick(8000);assert.match(h.text.textContent,/异常回路 · 5倍大奖/);
});

test('short text stays put; mobile overflow always travels far enough to reveal the final amount',()=>{
 const h=setup(0);const short=h.timing(100,180),long=h.timing(1000,140);
 assert.equal(short.distance,0);assert.equal(short.durationMs,5000);assert.equal(long.distance,868);assert.equal(long.durationMs,8000);
 assert.equal(1000-long.distance,140-8);
});
test('the persistent notice is the only entry when empty or expired; polling remains incremental',async()=>{
 const h=setup(2);await h.ready();h.tick(1800001);assert.equal(h.strip.hidden,false);assert.match(h.text.textContent,/暂无好彩消息/);
 h.tick(6000);assert.match(h.text.textContent,/暂无好彩消息/);h.refresh();await h.ready();assert.equal(h.calls[1],'/api/player/game-highlights?after=2');
 const empty=setup(0);await empty.ready();const note=empty.text.textContent;assert.match(note,/暂无好彩消息/);empty.tick(12000);assert.equal(empty.strip.hidden,false);assert.equal(empty.text.textContent,note);
});
