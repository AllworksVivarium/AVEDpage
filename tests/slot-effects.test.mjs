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
