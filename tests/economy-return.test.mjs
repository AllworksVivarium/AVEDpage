import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEconomy,expectedReturn,returnRatePool,validateEconomy} from '../server-economy.mjs';

test('percentage input produces normalized scratch pools at the requested return rate',()=>{
 for(const percent of [0,1,50,82.5,95,100]){
  const pool=returnRatePool(percent);assert.equal(pool.reduce((sum,x)=>sum+x.weight,0),100000000);
  assert.ok(pool.every(x=>Number.isInteger(x.weight)&&x.weight>=0));
  assert.ok(Math.abs(expectedReturn(pool)-percent/100)<0.0001);
 }
 for(const value of [-1,101,NaN,Infinity])assert.throws(()=>returnRatePool(value),/返还率/);
 const config=defaultEconomy();config.scratch[0].returnPercent=82.5;validateEconomy(config);
 assert.ok(config.scratch.every(x=>x.name==='刮刮乐'));
 assert.ok(Object.values(config.scratch[0].variants).every(p=>Math.abs(expectedReturn(p)-.825)<.0001));
 for(const lossFraction of [0,.5])assert.throws(()=>validateEconomy({...defaultEconomy(),sky:{...defaultEconomy().sky,lossFraction}}),/全部本金/);
});

test('each tier has distinct capped jackpots and increasingly rare upper awards',()=>{
 const maxima=[30,25,20,12,8,5];
 for(const [i,tier] of defaultEconomy().scratch.entries()){
  for(const percent of [0,.01,1,65,82.5,100]){
   const pool=returnRatePool(percent,tier.id);
   assert.equal(Math.max(...pool.map(x=>x.multiplier)),maxima[i]);
   assert.equal(pool.reduce((s,x)=>s+x.weight,0),100000000);
   assert.ok(pool.every(x=>Number.isSafeInteger(x.weight)&&x.weight>=0));
   assert.ok(Math.abs(expectedReturn(pool)-percent/100)<.00000001);
   if(percent===65){assert.ok(pool.at(-1).weight/100000000>.00045);assert.ok(pool[0].weight/100000000>.4);assert.ok(pool.find(x=>x.multiplier===.5).weight>0);}
   if(percent>=1){const upper=pool.slice(-3);assert.ok(upper[0].weight>upper[1].weight&&upper[1].weight>upper[2].weight);assert.ok(upper[2].weight>0&&upper[2].weight/100000000<.001);}
  }
 }
});

test('legacy admin payloads cannot bypass tier caps by omitting returnPercent',()=>{
 const config=defaultEconomy();
 for(const tier of config.scratch){delete tier.returnPercent;for(const key of Object.keys(tier.variants))tier.variants[key]=[{multiplier:0,weight:99935},{multiplier:1000,weight:65}];}
 validateEconomy(config);
 assert.equal(Math.max(...config.scratch[5].variants.three_match.map(x=>x.multiplier)),5);
 assert.ok(Math.abs(expectedReturn(config.scratch[5].variants.three_match)-.65)<1e-8);
});
