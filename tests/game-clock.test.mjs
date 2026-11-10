import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={};vm.runInNewContext(readFileSync(new URL('../public/game-clock.js',import.meta.url),'utf8'),context);
test('request timing includes downlink latency; SSE arrival cannot reset the calibrated clock backwards',()=>{
 let at=1000;const c=context.AVEDGameClock.create({now:()=>at});c.snapshot(10000);at=1160;c.measure(10080,1000);assert.equal(c.now(),10160);
 at=1500;c.snapshot(10100);assert.equal(c.now(),10500);assert.equal(c.now(10400),10400,'extrapolation can be capped at a stale-snapshot boundary');
});
test('queueing spikes are rejected, a changed network can recalibrate, and time never reverses',()=>{
 let at=1000;const c=context.AVEDGameClock.create({now:()=>at});c.measure(10950,900);const first=c.now();at+=2000;c.measure(999999,at-2000);assert.equal(c.now(),first+2000);
 at+=120001;c.measure(200000,at-400);assert.equal(c.now(),200200);c.measure(199000,at-100);assert.equal(c.now(),200200,'a new estimate cannot move the game backwards');c.reset();assert.equal(c.ready(),false);
});
