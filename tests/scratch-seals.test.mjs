import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEconomy,returnRatePool,expectedReturn} from '../server-economy.mjs';
import {generateOutcomeTicket} from '../server-ticket.mjs';
import {scratchGameTypes} from '../server-content.mjs';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const game=scratchGameTypes.find(g=>g.type==='lucky_num');
function random(seed=8){return()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/2**32;}
test('every actual lucky outcome prints a base prize whose stamped value equals the credited amount',()=>{
 for(const tier of defaultEconomy().scratch){
  let payout=0,penalties=0,total=0;
  for(const outcome of tier.variants.lucky_num){
   const ticket=generateOutcomeTicket(tier,game,'proof',random(),outcome);
   const printed=ticket.cells.filter(c=>c.isWinPart).reduce((n,c)=>n+Number(c.sub.match(/¤ ([\d,]+)/)[1].replaceAll(',','')),0);
   assert.equal(printed*ticket.sealMultiplier,ticket.totalPayout);assert.equal(ticket.cells.find(c=>c.role==='MULT').label,'×'+outcome.sealMultiplier+' 倍');
   if(outcome.penaltyMultiplier){assert.equal(ticket.penalty,tier.cost*outcome.penaltyMultiplier*outcome.sealMultiplier);assert.equal(ticket.totalPayout,0);assert.equal(ticket.cells.filter(c=>c.isBomb).length,1);}
   payout+=ticket.totalPayout*outcome.weight;penalties+=(ticket.penalty||0)*outcome.weight;total+=outcome.weight;
  }
  assert.ok(Math.abs((payout-penalties)/(total*tier.cost)-1.2)<1e-8);
 }
});
test('rate configuration remains a valid bounded distribution including seal multiplication',()=>{
 for(const type of ['three_match','lucky_num','step_climb'])for(const percent of [0,5,65,100,110,120,135,150]){
  const pool=returnRatePool(percent,'t1',type);assert.ok(pool.every(x=>Number.isSafeInteger(x.weight)&&x.weight>=0));assert.ok(Math.abs(expectedReturn(pool)-percent/100)<1e-8);
 }
 assert.throws(()=>returnRatePool(151,'t1','lucky_num'));
});
test('winning and bomb readouts explain actual sealed amounts without multiplying the paid ticket price',()=>{
 const ctx={};vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),ctx);
 assert.match(ctx.AVEDGameResults.text({cost:1000,prize:2400,sealMultiplier:3,basePayout:800}),/800 × 3 = ¤ 2,400/);
 const text=ctx.AVEDGameResults.text({cost:1000,prize:0,penalty:3000,sealMultiplier:3});assert.match(text,/1,000 × 3 = ¤ 3,000/);assert.match(text,/总损失 ¤ 4,000/);
});
