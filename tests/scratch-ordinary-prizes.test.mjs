import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEconomy,expectedReturn,weighted,returnRatePool} from '../server-economy.mjs';
import {scratchSuperJackpot} from '../server-content.mjs';

const previous={
 three_match:{ordinary:.87036963,large:.09859047,zero:.0110399},
 lucky_num:{ordinary:.5598190852,large:.1130576548,zero:.30712326},
 step_climb:{ordinary:.68658019,large:.14437994,zero:.14903987}
};
test('ordinary wins replace large prizes and bombs without adding blanks in any scratch game',()=>{
 for(const tier of defaultEconomy().scratch){
  assert.equal(tier.returnPercent,115);
  for(const [type,pool] of Object.entries(tier.variants)){
   const total=pool.reduce((sum,x)=>sum+x.weight,0),prob=f=>pool.filter(f).reduce((sum,x)=>sum+x.weight,0)/total;
   assert.ok(Math.abs(expectedReturn(pool)-1.15)<1e-8);
   assert.ok(pool.every(x=>Number.isSafeInteger(x.weight)&&x.weight>=0));
   assert.ok(prob(x=>x.multiplier>0&&x.multiplier<5)>previous[type].ordinary+.025);
   const large=prob(x=>x.multiplier>=5);
   assert.ok(large>previous[type].large*.7&&large<previous[type].large*.83);
   assert.ok(prob(x=>!x.multiplier&&!x.penaltyMultiplier)<previous[type].zero);
   assert.equal(prob(x=>x.penaltyMultiplier),.015);
   for(const [fee,chance] of [[2,.009],[10,.0045],[100,.0015]])assert.equal(prob(x=>x.penaltyMultiplier===fee),chance);
   assert.equal(prob(x=>x.superJackpot),1/12500000);
   assert.equal(scratchSuperJackpot.multiplier,2000);
   assert.ok(pool.some(x=>x.multiplier>=100&&x.weight>0));
   let start=0;for(const outcome of pool){if(outcome.weight){assert.equal(weighted(pool,()=> (start+.5)/total),outcome);assert.equal(weighted(pool,()=> (start+outcome.weight-.5)/total),outcome);}start+=outcome.weight;}
  }
 }
});
test('new prize shaping stays normalized for every supported percentage step',()=>{
 for(const type of ['three_match','lucky_num','step_climb'])for(let p=0;p<=1500;p++){
  const percent=p/10,pool=returnRatePool(percent,'t1',type),total=pool.reduce((s,x)=>s+x.weight,0);
  assert.equal(total,type==='lucky_num'?10000000000:100000000);
  assert.ok(pool.every(x=>Number.isSafeInteger(x.weight)&&x.weight>=0));
  assert.ok(Math.abs(expectedReturn(pool)-percent/100)<1e-8);
 }
});
