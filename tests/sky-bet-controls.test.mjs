import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../public/sky-ui.js',import.meta.url),'utf8'),context);
const scale=context.window.AVEDSkyUI.scaleBet;

test('both multipliers update valid draft amounts and enforce the server limit',()=>{
 assert.equal(scale('10000',2).value,20000);
 assert.equal(scale('10000',5).value,50000);
 assert.equal(scale('100',5).value,500);
 assert.equal(scale('100000',5).capped,false);
 assert.equal(scale('200000',5).capped,true);
 assert.equal(scale('600000',2).value,500000);
 assert.equal(scale('600000',2).capped,true);
 assert.equal(scale('1000000',5).value,500000);
});

test('empty, fractional and unsafe amounts cannot become a draft stake',()=>{
 for(const value of ['', 'text',99,-100,100.5,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>scale(value,2),/至少 100 的整数/);
 assert.throws(()=>scale(1000,3),/不支持/);
});
