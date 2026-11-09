import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('scratch feedback distinguishes profit, removes particles, and respects reduced motion',()=>{
 const sounds=[],timers=[],layers=[];const reduced={matches:false,addEventListener(){}};
 const element=()=>({dataset:{},children:[],style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},append(el){this.children.push(el);},remove(){this.removed=true;}});
 const document={hidden:false,addEventListener(){},createElement:element,body:{append(el){if(el.className.includes('scratch-electronic-confetti'))layers.push(el);}}};
 const ctx={window:{},document,matchMedia:()=>reduced,innerWidth:1200,innerHeight:800,clearTimeout(){},setTimeout:(f,ms)=>{if(ms===1950||ms===5400)timers.push(f);}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-feedback.js',import.meta.url),'utf8'),ctx);
 const fx=ctx.window.AVEDScratchFeedback({playSfx:s=>sounds.push(s)}),banner=element();
 fx.settle(banner,{cost:1000,prize:650},'all');assert.equal(ctx.window.AVEDScratchToast.label.textContent,'本局收入 ¤ 650');assert.equal(ctx.window.AVEDScratchToast.amount.hidden,true);assert.equal(banner.dataset.scratchFeedback,'return');assert.equal(sounds.length,0);assert.equal(layers.length,0);
 fx.settle(banner,{cost:1000,prize:1250},'all');assert.equal(sounds.at(-1),'scratch-win-all');assert.equal(layers.length,1);fx.settle(banner,{cost:1000,prize:20000},'all');assert.equal(layers.length,3);assert.ok(!layers[0].removed);timers[0]();assert.equal(layers[0].removed,true);assert.ok(!layers[1].removed);timers[1]();assert.ok(!layers[2].removed);assert.ok(layers[2].className.includes('scratch-rain'));timers[2]();assert.equal(layers[2].removed,true);
 reduced.matches=true;fx.settle(banner,{cost:1000,prize:1600},'manual');assert.equal(banner.dataset.scratchFeedback,'profit');assert.equal(sounds.at(-1),'scratch-win');assert.equal(layers.length,3);
 fx.settle(banner,{cost:1000,prize:0});assert.equal(sounds.at(-1),'scratch-zero');
 document.hidden=true;fx.settle(banner,{cost:1000,prize:30000});assert.equal(sounds.length,4);
});

test('red paper is palette-independent and higher awards produce more particles',()=>{
 const layers=[];const element=()=>({dataset:{},children:[],style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},append(el){this.children.push(el);},remove(){}});
 const ctx={window:{},document:{hidden:false,addEventListener(){},createElement:element,body:{append(el){if(el.className.includes('scratch-electronic-confetti'))layers.push(el);}}},matchMedia:()=>({matches:false,addEventListener(){}}),innerWidth:1200,innerHeight:800,clearTimeout(){},setTimeout(){}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-feedback.js',import.meta.url),'utf8'),ctx);
 const fx=ctx.window.AVEDScratchFeedback();let previous=0;
 for(const multiplier of [1.25,5,10,20,50,100]){const start=layers.length;fx.settle(element(),{cost:1000,prize:1000*multiplier});const current=layers.slice(start),count=current.reduce((n,l)=>n+l.children.length,0);assert.ok(count>previous);previous=count;for(const layer of current)assert.ok(layer.children.some(p=>p.style.cssText.includes('#d84b4b')));}
});

test('one shared toast replaces previous awards and uses tier-specific expiry',()=>{
 const nodes=[],timers=[],cancelled=[];const element=()=>({dataset:{},children:[],style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},append(el){this.children.push(el);},remove(){}});
 const document={hidden:false,addEventListener(){},createElement:element,body:{append(el){nodes.push(el);}}};
 const ctx={window:{AVEDEffectsEnabled:()=>false},document,matchMedia:()=>({matches:false,addEventListener(){}}),innerWidth:1200,innerHeight:800,clearTimeout:id=>cancelled.push(id),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-feedback.js',import.meta.url),'utf8'),ctx);
 const fx=ctx.window.AVEDScratchFeedback(),other=ctx.window.AVEDScratchFeedback(),banner=element();banner.textContent='本局获得';
 fx.settle(banner,{cost:1000,prize:1250});assert.equal(timers.at(-1).ms,1500);
 other.settle(banner,{cost:1000,prize:5000});assert.equal(ctx.window.AVEDScratchToast.label.textContent,'刮出大奖了！');assert.equal(ctx.window.AVEDScratchToast.amount.hidden,false);assert.equal(timers.at(-1).ms,2500);assert.ok(cancelled.includes(1));
 fx.settle(banner,{cost:1000,prize:20000});assert.equal(timers.at(-1).ms,4000);
 let forwarded;ctx.window.AVEDPersonalRecord={show:event=>{forwarded=event;}};
 const record={personalBest:1,ticketId:9};fx.settle(banner,{cost:1000,prize:30000,gameHighlight:record});assert.equal(timers.at(-1).ms,4000);assert.equal(forwarded,record);
 assert.equal(nodes.length,1);assert.equal(banner.textContent,'本局获得');assert.match(ctx.window.AVEDScratchToast.label.textContent,/大奖/);assert.match(ctx.window.AVEDScratchToast.amount.textContent,/30,000/);
 timers.at(-1).fn();assert.equal(ctx.window.AVEDScratchToast.el.hidden,true);
});


test('next ticket preserves running fireworks but clears the previous toast and bomb',()=>{
 const layers=[],timers=[];let bombClears=0;
 const element=()=>({dataset:{},children:[],style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},append(el){this.children.push(el);},remove(){this.removed=true;}});
 const ctx={window:{AVEDScratchBomb:{clear(){bombClears++;}}},document:{hidden:false,addEventListener(){},createElement:element,body:{append(el){if(el.className.includes('scratch-electronic-confetti'))layers.push(el);}}},matchMedia:()=>({matches:false,addEventListener(){}}),innerWidth:1200,innerHeight:800,clearTimeout(){},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-feedback.js',import.meta.url),'utf8'),ctx);
 const fx=ctx.window.AVEDScratchFeedback();fx.settle(element(),{cost:1000,prize:20000});
 assert.equal(layers.length,2);fx.nextTicket();assert.equal(bombClears,1);assert.equal(ctx.window.AVEDScratchToast.el.hidden,true);assert.ok(layers.every(l=>!l.removed));
 timers.find(t=>t.ms===1950).fn();assert.ok(layers[0].removed);assert.ok(!layers[1].removed);
 timers.find(t=>t.ms===5400).fn();assert.ok(layers[1].removed);
});

test('rapid mobile awards bound overlapping particles without clearing them on next ticket',()=>{
 const layers=[];const element=()=>({dataset:{},children:[],style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},append(el){this.children.push(el);},remove(){this.removed=true;}});
 const ctx={window:{},document:{hidden:false,addEventListener(){},createElement:element,body:{append(el){if(el.className.includes('scratch-electronic-confetti'))layers.push(el);}}},matchMedia:()=>({matches:false,addEventListener(){}}),innerWidth:390,innerHeight:844,clearTimeout(){},setTimeout(){}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-feedback.js',import.meta.url),'utf8'),ctx);const fx=ctx.window.AVEDScratchFeedback();
 for(let i=0;i<30;i++)fx.settle(element(),{cost:1000,prize:100000});
 const active=layers.filter(layer=>!layer.removed);assert.ok(active.length<=4);assert.ok(active.reduce((n,l)=>n+l.children.length,0)<=300);
 fx.nextTicket();assert.ok(active.every(layer=>!layer.removed));
});
