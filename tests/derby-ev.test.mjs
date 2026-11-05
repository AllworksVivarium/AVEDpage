import test from 'node:test';
import assert from 'node:assert/strict';
import { DERBY_ODDS, DERBY_WIN_PROBABILITIES } from '../player-service.mjs';

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

test('derby config has attractive odds but negative expected value on every lane',()=>{
  assert.equal(DERBY_ODDS.length,4);
  assert.equal(DERBY_WIN_PROBABILITIES.length,4);
  const probabilitySum=DERBY_WIN_PROBABILITIES.reduce((sum,p)=>sum+p,0);
  assert.ok(Math.abs(probabilitySum-1)<1e-9,'win probabilities must sum to 1');

  const evs=DERBY_ODDS.map((odds,i)=>DERBY_WIN_PROBABILITIES[i]*odds);
  for(const ev of evs){
    assert.ok(ev<1,`expected value must stay negative, got ${ev}`);
    assert.ok(ev>0.80,`expected value should still look attractive, got ${ev}`);
  }

  const bestEv=Math.max(...evs);
  assert.ok(bestEv<1,'best lane must still be negative expectation');
});

test('derby monte-carlo returns remain negative over many rounds',()=>{
  const rounds=200000;
  const bet=100000;
  const rng=xorshift32(0x51456451);

  const payouts=[0,0,0,0];
  for(let i=0;i<rounds;i++){
    const winner=winnerFromRandom(rng());
    for(let lane=0;lane<4;lane++){
      payouts[lane]+=winner===lane?Math.round(bet*DERBY_ODDS[lane]):0;
    }
  }

  const averageReturns=payouts.map(sum=>sum/(rounds*bet));
  for(const avg of averageReturns){
    assert.ok(avg<1,`simulated return must stay below 1, got ${avg}`);
  }
});
