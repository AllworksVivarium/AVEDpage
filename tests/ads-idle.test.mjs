import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../public/ads-ui.js',import.meta.url),'utf8'),{window});
test('initial arrival and exactly thirty idle minutes allow a popup; continuous navigation defers it',()=>{
 const mayShow=window.AVEDAdIdle,start=1800000000000;assert.equal(mayShow(0,start),true);assert.equal(mayShow(start,start+15*60000),false);assert.equal(mayShow(start,start+30*60000-1),false);assert.equal(mayShow(start,start+30*60000),true);
 let last=start;for(let minute=1;minute<=120;minute++){const now=start+minute*60000;assert.equal(mayShow(last,now),false);last=now;}assert.equal(mayShow(last,last+30*60000),true);
 assert.equal(mayShow(NaN,start),true);assert.equal(mayShow(start+1,start),true);
});
