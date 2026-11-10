import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../public/sky-scene.js',import.meta.url),'utf8'),context);
const {passengerMotion,landingDelay,freefallMotion,airMotion}=context.window.AVEDSkyScene;
const flight={phase:'DROPPING',departAt:100000,speed:35,landingMs:14000};
test('freefall camera holds passengers centrally while upward wind accelerates',()=>{
 for(const elapsed of [0,1000,8000,20000,60000])assert.equal(freefallMotion(flight,flight.departAt+elapsed,140,255).y,140);
 const a=t=>airMotion(flight,flight.departAt+t*1000);
 assert.ok(a(10).travel-a(9).travel>a(3).travel-a(2).travel);assert.ok(a(10).speed>a(3).speed);
 assert.ok(a(60).speed<=300,'bounded streak speed avoids aliasing in very deep flights');
});
test('opening is continuous, rises relative to freefall, and never lands before reveal',()=>{
 const p={settledAt:108000},at=t=>passengerMotion(flight,p,p.settledAt+t,140,255);
 assert.equal(at(0).y,140);assert.ok(Math.abs(at(1).y-140)<.001);assert.ok(at(1000).y<at(300).y);
 assert.ok(at(2000).y<at(1000).y);assert.equal(at(60000).y,-64);assert.equal(at(60000).grounded,false);
 assert.equal(passengerMotion({...flight,expectedSafety:2000},p,110000,140,255).y,at(2000).y);
});
test('early and last-moment canopies cross reveal continuously, then glide down from above',()=>{
 const state={...flight,phase:'LANDING',revealedAt:112000};
 for(const settledAt of [100030,108000,111999]){
  const p={settledAt},at=t=>passengerMotion(state,p,state.revealedAt+t,140,255);
  assert.equal(at(0).y,passengerMotion(flight,p,state.revealedAt,140,255).y);
  assert.ok(Math.abs(at(1).y-at(0).y)<.2);
  assert.equal(at(900).y,-64);assert.ok(at(1500).y>at(900).y);
  const step=at(2500).y-at(2000).y;
  for(const t of [3000,4500,6000])assert.ok(Math.abs(at(t+500).y-at(t).y-step)<1e-8);
  const end=landingDelay(state,p);assert.ok(end<state.landingMs);assert.equal(at(end-1).grounded,false);assert.equal(at(end).grounded,true);assert.equal(at(end).y,218);
 }
});
test('ground camera slows the wind without resetting its phase at reveal',()=>{
 const landing={...flight,phase:'LANDING',revealedAt:108000};
 assert.equal(airMotion(landing,108000).travel,airMotion(flight,108000).travel);
 assert.equal(airMotion(landing,108000).speed,airMotion(flight,108000).speed);
 assert.ok(airMotion(landing,108500).speed<airMotion(landing,108100).speed);
 assert.ok(airMotion(landing,110000).speed<1);
});

test('eight freefall avatars share a level, keep fixed lanes and draw the current player last',()=>{const people=Array.from({length:8},(_,i)=>({id:i+1}));const layout=context.window.AVEDSkyScene.fallLayout(people,3,420,300);assert.equal(new Set(layout.map(p=>p.startY)).size,1);assert.equal(new Set(layout.map(p=>p.x)).size,8);assert.equal(layout.at(-1).p.id,3);const crowded=context.window.AVEDSkyScene.fallLayout(Array.from({length:60},(_,i)=>({id:i+1})),59,420,300);assert.equal(crowded.length,24);assert.equal(crowded.at(-1).p.id,59);assert.equal(people.length,8);});
