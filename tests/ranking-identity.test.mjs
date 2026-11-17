import test from 'node:test';
import assert from 'node:assert/strict';
import {rankingIdentityMapper,mapRankingIdentities} from '../server-ranking-identity.mjs';

test('every ranking uses server identity, keeps employee aliases plain and hides containment real names',()=>{
 const aliases=new Map([[2,'匿名员工-收容甲'],[3,'收容乙代号']]);
 const map=rankingIdentityMapper({isContainment:id=>[2,3].includes(id),aliasFor:id=>aliases.get(id)});
 const normal={employeeId:1,name:'匿名员工-普通甲',wins:3,rank:1},first={employeeId:2,name:'收容甲的实名',wins:2,rank:2},second={employeeId:3,name:'旧的实名',value:100,rank:3};
 for(const key of ['landlord','farmers','skySafe','skyDepth','derby']){
  const original={since:100,[key]:[normal,first,second]},result=mapRankingIdentities(original,map);
  assert.equal(result.since,100);assert.equal(result[key][0].name,normal.name);assert.equal(result[key][0].isContainment,false);
  assert.equal(result[key][1].name,'匿名员工-收容甲');assert.equal(result[key][1].isContainment,true);
  assert.equal(result[key][2].name,'收容乙代号');assert.equal(result[key][2].isContainment,true);
  assert.ok(!JSON.stringify(result).includes('实名'));assert.equal(original[key][1].name,'收容甲的实名');
 }
 aliases.set(2,'更改后的代号');assert.equal(map(first).name,'更改后的代号','cached results use the current public alias');
});
