import test from 'node:test';
import assert from 'node:assert/strict';
import { DERBY_ODDS, DERBY_WIN_PROBABILITIES } from '../player-service.mjs';
import {derbyReturn,runners} from '../server-derby.mjs';

function xorshift32(seed=0x9e3779b9){
  let x=seed>>>0;
  return ()=>{
    x^=x<<13; x>>>=0;
    x^=x>>>17; x>>>=0;
    x^=x<<5; x>>>=0;
    return (x>>>0)/4294967296;
  };
}

function winnerFromRandom(r){
  let cumulative=0;
  for(let i=0;i<DERBY_WIN_PROBABILITIES.length;i++){
    cumulative+=DERBY_WIN_PROBABILITIES[i];
    if(r<cumulative)return i;
  }
  return DERBY_WIN_PROBABILITIES.length-1;
}

test('every new derby lane has approximately 102% expected return including partial returns',()=>{
  assert.equal(DERBY_ODDS.length,4);
  assert.equal(DERBY_WIN_PROBABILITIES.length,4);
  const probabilitySum=DERBY_WIN_PROBABILITIES.reduce((sum,p)=>sum+p,0);
  assert.ok(Math.abs(probabilitySum-1)<1e-9,'win probabilities must sum to 1');

  const evs=DERBY_ODDS.map((odds,i)=>DERBY_WIN_PROBABILITIES[i]*odds+(1-DERBY_WIN_PROBABILITIES[i])*.95*.1);
  for(const ev of evs){
    assert.ok(ev>1.015&&ev<1.025,`expected return should be near 102%, got ${ev}`);
  }

  assert.equal(derbyReturn(1000,0,1,()=>0),0);
  assert.equal(derbyReturn(1000,0,1,()=>.2),50);
  assert.equal(derbyReturn(1000,0,1,()=>.5),100);
  assert.equal(derbyReturn(1000,0,1,()=>.9),150);
  assert.equal(derbyReturn(1000,0,1,()=>.9,{runners,partialReturns:false}),0);
});

test('derby simulation remains near the requested slight positive long-run return',()=>{
  const rounds=200000;
  const bet=100000;
  const rng=xorshift32(0x51456451);

  const payouts=[0,0,0,0];
  for(let i=0;i<rounds;i++){
    const winner=winnerFromRandom(rng());
    for(let lane=0;lane<4;lane++){
      payouts[lane]+=derbyReturn(bet,lane,winner,rng);
    }
  }

  const averageReturns=payouts.map(sum=>sum/(rounds*bet));
  for(const avg of averageReturns){
    assert.ok(avg>1&&avg<1.04,`simulated return should be near 102%, got ${avg}`);
  }
});
