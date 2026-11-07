import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../public/sky-scene.js',import.meta.url),'utf8'),context);
const {passengerMotion,landingDelay}=context.window.AVEDSkyScene;
const flight={phase:'DROPPING',departAt:100000,speed:25,landingMs:14000};
const early={depth:200,settledAt:104000},late={depth:550,settledAt:118000};

test('opening keeps its position continuous, then rises relative to freefall as depth separates',()=>{
 const origin=145,height=255;
 assert.equal(passengerMotion(flight,early,early.settledAt,origin,height).y,origin);
 assert.ok(Math.abs(passengerMotion(flight,early,early.settledAt+1,origin,height).y-origin)<.01);
 const short=passengerMotion(flight,early,106000,origin,height),long=passengerMotion(flight,early,120000,origin,height);
 assert.ok(short.y<origin);assert.ok(long.y<short.y);
 assert.ok(long.y<0,'an early canopy can leave the upper frame');
 assert.ok(passengerMotion(flight,late,120000,origin,height).y>long.y);
 assert.equal(long.grounded,false);
});

test('reveal does not snap a canopy; earlier opening lands later and every canopy finishes before next flight',()=>{
 const landing={...flight,phase:'LANDING',safetyLine:600,revealedAt:120000};
 assert.equal(passengerMotion(flight,early,120000,145,255).y,passengerMotion(landing,early,120000,145,255).y);
 assert.ok(landingDelay(landing,early)>landingDelay(landing,late));
 for(const p of [early,late]){
  const delay=landingDelay(landing,p);
  assert.ok(delay>650&&delay<landing.landingMs,'freefall impacts first');
  const end=passengerMotion(landing,p,landing.revealedAt+delay,145,255);
  assert.equal(end.grounded,true);assert.equal(end.y,255-37);
  assert.equal(passengerMotion(landing,p,landing.revealedAt+delay-1,145,255).grounded,false);
 }
});

test('final approach accelerates with depth instead of slowing before ground contact',()=>{
 const landing={...flight,phase:'LANDING',safetyLine:600,revealedAt:120000};
 const velocity=(p,fraction)=>{const at=landing.revealedAt+landingDelay(landing,p)*fraction;return passengerMotion(landing,p,at+1,145,255).y-passengerMotion(landing,p,at,145,255).y;};
 for(const p of [early,late]){
  assert.ok(velocity(p,.9)>velocity(p,.7));assert.ok(velocity(p,.7)>velocity(p,.5));
 }
 assert.ok(velocity(late,.99)>velocity(early,.99),'the deeper opening has the faster final approach');
});
