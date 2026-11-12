import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEconomy,expectedReturn,returnRatePool,validateEconomy} from '../server-economy.mjs';

test('percentage input produces normalized scratch pools at the requested return rate',()=>{
 for(const percent of [0,.0001,.01,1,50,82.5,95,100,102,110,120,130,150]){
  const pool=returnRatePool(percent);assert.equal(pool.reduce((sum,x)=>sum+x.weight,0),100000000);
  assert.ok(pool.every(x=>Number.isInteger(x.weight)&&x.weight>=0));
  assert.ok(Math.abs(expectedReturn(pool)-percent/100)<0.0001);
 }
 for(const value of [-1,151,NaN,Infinity])assert.throws(()=>returnRatePool(value),/返还率/);
 const config=defaultEconomy();config.scratch.forEach(t=>t.returnPercent=82.5);validateEconomy(config);
 assert.ok(config.scratch.every(x=>x.name==='刮刮乐'));
 assert.ok(Object.values(config.scratch[0].variants).every(p=>Math.abs(expectedReturn(p)-.825)<.0001));
 for(const lossFraction of [0,.5])assert.throws(()=>validateEconomy({...defaultEconomy(),sky:{...defaultEconomy().sky,lossFraction}}),/全部本金/);
});

test('all tiers share identical probabilities and capped jackpots',()=>{
 const maxima=[100,100,100,100,100,100];
 for(const [i,tier] of defaultEconomy().scratch.entries()){
  for(const percent of [0,.01,1,65,82.5,100,102,110,120,130,150]){
   const pool=returnRatePool(percent,tier.id);
   assert.equal(Math.max(...pool.map(x=>x.multiplier)),maxima[i]);
   assert.equal(pool.reduce((s,x)=>s+x.weight,0),100000000);
   assert.ok(pool.every(x=>Number.isSafeInteger(x.weight)&&x.weight>=0));
   assert.ok(Math.abs(expectedReturn(pool)-percent/100)<.00000001);
   if(percent===120){assert.equal(pool.filter(x=>x.penaltyMultiplier).reduce((s,x)=>s+x.weight,0)/1e8,.02);assert.equal(pool.filter(x=>x.multiplier>=10).reduce((s,x)=>s+x.weight,0)/1e8,.009);}

   if(percent>=1&&percent<=120){const upper=pool.filter(x=>x.multiplier>0).slice(-3);assert.ok(upper[0].weight>upper[1].weight&&upper[1].weight>upper[2].weight);assert.ok(upper[2].weight>0);}
  }
 }
});

test('legacy admin payloads cannot bypass tier caps by omitting returnPercent',()=>{
 const config=defaultEconomy();
 for(const tier of config.scratch){delete tier.returnPercent;for(const key of Object.keys(tier.variants))tier.variants[key]=[{multiplier:0,weight:99935},{multiplier:1000,weight:65}];}
 validateEconomy(config);
 assert.equal(Math.max(...config.scratch[5].variants.three_match.map(x=>x.multiplier)),100);
 assert.ok(Math.abs(expectedReturn(config.scratch[5].variants.three_match)-.65)<1e-8);
});

test("tier odds cannot diverge",()=>{const c=defaultEconomy();for(const t of c.scratch)assert.deepEqual(t.variants,c.scratch[0].variants);const p=c.scratch[0].variants.three_match;const profit=p.filter(x=>x.multiplier>1).reduce((s,x)=>s+x.weight,0)/1e8;assert.ok(profit>=.60&&profit<.61);c.scratch[1].returnPercent=95;assert.throws(()=>validateEconomy(c),/同一返还率/);});

test('fine prizes survive while medium wins become more frequent without inflating the jackpot tail',()=>{const pool=returnRatePool(120);for(const amount of [30,50,80,260])assert.ok(pool.some(x=>Math.floor(x.multiplier*1000)===amount&&x.weight>0));const medium=pool.find(x=>x.multiplier===5).weight/1e8;assert.ok(medium>.089&&medium<.090);assert.equal(pool.filter(x=>x.multiplier>=10).reduce((s,x)=>s+x.weight,0)/1e8,.009);});
