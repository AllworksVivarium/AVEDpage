import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../public/sky-scene.js',import.meta.url),'utf8'),context);
const {passengerMotion,landingDelay,freefallMotion}=context.window.AVEDSkyScene;
const flight={phase:'DROPPING',departAt:100000,speed:35,landingMs:14000},person={depth:400,settledAt:108571};
test('opened canopies move down at one constant speed before and after the safety reveal',()=>{
 const origin=120,height=255,landing={...flight,phase:'LANDING',safetyLine:480,revealedAt:111000};
 assert.equal(passengerMotion(flight,person,person.settledAt,origin,height).y,origin);
 const at=t=>passengerMotion(t<landing.revealedAt?flight:landing,person,t,origin,height).y;
 const step=at(110500)-at(110000);assert.ok(step>0);
 for(const t of [109000,110500,111000,112000,115000])assert.ok(Math.abs((at(t+500)-at(t))-step)<1e-9);
 assert.equal(passengerMotion(flight,person,111000,origin,height).y,passengerMotion(landing,person,111000,origin,height).y);
});
test('opening remains continuous and reaches the ground without a final acceleration or hover',()=>{
 for(const settledAt of [100030,108571,120000]){
  const p={...person,settledAt},state={...flight,phase:'LANDING',revealedAt:Math.max(121000,settledAt),safetyLine:900};
  const end=passengerMotion(state,p,settledAt+10000,120,255);assert.equal(end.y,218);assert.equal(end.grounded,true);
  assert.equal(passengerMotion(state,p,settledAt+9999,120,255).grounded,false);
  const remaining=landingDelay(state,p);assert.ok(remaining>=0&&remaining<state.landingMs);
 }
});
test('only unopened passengers accelerate; even a near-immediate crash starts from the departure position',()=>{
 const y=t=>freefallMotion(flight,t,120,255).y;
 assert.equal(y(100030),120);assert.equal(y(101780),120);
 assert.ok(y(112000)-y(111000)>y(106000)-y(105000));
 assert.ok(y(130000)-y(129000)>y(112000)-y(111000));
 const opened=passengerMotion(flight,person,person.settledAt,120,255);assert.equal(opened.y,120);
});
