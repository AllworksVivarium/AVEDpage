import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('ticker holds ten seconds, repeats no sooner than thirty, and requests only new records',async()=>{
 let now=Date.UTC(2026,10,7),message;const timers=new Map(),calls=[];
 const element=()=>({className:'',setAttribute(){},append(...children){if(this.className==='aved-jackpot-viewport')message=children[0];},classList:{remove(){},add(){}}});
 const document={hidden:false,querySelector:()=>({after(){}}),createElement:element,addEventListener(){}};
 const api=async url=>{calls.push(url);return {serverTime:now,items:calls.length===1?[{ticketId:1,alias:'甲',game:'scratch',cost:1000,prize:5000,createdAt:new Date(now).toISOString()},{ticketId:2,alias:'乙',game:'scratch',cost:1000,prize:10000,createdAt:new Date(now).toISOString()}]:[]};};
 class Clock extends Date{static now(){return now;}}
 const ctx={window:{},document,Date:Clock,setInterval:(fn,ms)=>timers.set(ms,fn),setTimeout:fn=>fn()};
 vm.runInNewContext(readFileSync(new URL('../public/jackpot-ticker.js',import.meta.url),'utf8'),ctx);
 ctx.window.AVEDCreateJackpotTicker({api});await new Promise(setImmediate);
 assert.match(message.textContent,/乙/);now+=9000;timers.get(1000)();assert.match(message.textContent,/乙/);
 now+=1000;timers.get(1000)();assert.match(message.textContent,/甲/);assert.match(message.textContent,/5 倍大奖/);
 now+=10000;timers.get(1000)();assert.match(message.textContent,/近 30 分钟/);
 now+=10000;timers.get(1000)();assert.match(message.textContent,/乙/);
 timers.get(30000)();await Promise.resolve();assert.equal(calls[1],'/api/player/game-highlights?after=2');
});
