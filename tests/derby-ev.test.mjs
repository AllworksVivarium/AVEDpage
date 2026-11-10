import test from 'node:test';
import assert from 'node:assert/strict';
import {animalRules,animalReturn} from '../server-animal-race.mjs';
test('all five first/last choices have 125% expected return and no consolation payout',()=>{
 const order=[0,1,2,3,4];assert.equal(animalRules.runners.length,5);assert.equal(animalRules.returnPercent,125);
 for(const market of ['first','last'])for(let runner=0;runner<5;runner++){
  let total=0;for(let winner=0;winner<5;winner++){const other=order.filter(x=>x!==winner),result=market==='first'?[winner,...other]:[...other,winner];total+=animalReturn(100000,runner,market,result);}
  assert.equal(total/5/100000,1.25);
 }
 assert.equal(animalReturn(1000,1,'first',order),0);assert.equal(animalReturn(1000,0,'first',order),6250);
});
