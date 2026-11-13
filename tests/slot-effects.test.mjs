import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('hidden slot cleanup does not retrigger its class observer indefinitely',()=>{
 const observers=[];let mutations=0;
 const classes=new Set(['hidden','slot-power-up']);
 const panel={classList:{contains:c=>classes.has(c),remove(...names){mutations++;names.forEach(c=>classes.delete(c));}}};
 const ctx={window:{},document:{hidden:false,getElementById:()=>({classList:{contains:()=>false}}),addEventListener(){}},matchMedia:()=>({matches:false,addEventListener(){}}),clearTimeout(){},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}};
 vm.runInNewContext(readFileSync(new URL('../public/slot-effects.js',import.meta.url),'utf8'),ctx);
 ctx.window.AVEDSlotEffects({panel,grid:{}});
 observers[0]();assert.equal(mutations,1);
 observers[0]();observers[1]();assert.equal(mutations,1);
});

test('repeated awards replace one overlay inside the reels and can be dismissed',()=>{
 const children=[],buttons=[];const classes=new Set();
 const panel={classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:(...names)=>names.forEach(c=>classes.delete(c))}};
 const grid={append(node){children.push(node);}};
 const context={window:{},Number,document:{hidden:false,getElementById:()=>({classList:{contains:()=>false}}),addEventListener(){},createElement(){const button={};buttons.push(button);return {dataset:{},setAttribute(){},querySelector:()=>button,remove(){children.splice(children.indexOf(this),1);}};}},matchMedia:()=>({matches:true,addEventListener(){}}),setTimeout:()=>1,clearTimeout(){},MutationObserver:class{observe(){}}};
 vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),context);context.window.AVEDGameResults=context.AVEDGameResults;
 vm.runInNewContext(readFileSync(new URL('../public/slot-effects.js',import.meta.url),'utf8'),context);
 const effects=context.window.AVEDSlotEffects({panel,grid});
 effects.show({cost:1000,prize:100000,tax:2970});assert.equal(children.length,1);assert.equal(children[0].className,'slot-award-layer');assert.match(children[0].innerHTML,/100,000/);assert.doesNotMatch(children[0].innerHTML,/97,030/);assert.match(children[0].innerHTML,/<small class="game-tax-note">已扣税 ¤ 2,970<\/small>/);
 effects.show({cost:1000,prize:2000,penalty:100});assert.equal(children.length,1);assert.match(children[0].innerHTML,/额外维修费/);
 buttons.at(-1).onclick();assert.equal(children.length,0);
});
