import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAuto} from '../server-card-ai.mjs';
import {botTurn,dealTable} from '../server-card-table.mjs';
const R=globalThis.AVEDDdzRules;
const cards=values=>values.map((val,id)=>({val,id}));
test('smart autoplay preserves bombs, cooperates, finishes, and blocks an imminent single',()=>{
 const hand=cards([3,3,3,3,4,5,6,7,8,9,14]);
 const move=chooseAuto(hand,null,3);assert.equal(move.type,'straight');assert.ok(move.cards.every(c=>c.val!==3));
 const previous={type:'single',mainRank:4,count:1};
 assert.equal(chooseAuto(hand,previous,3,{teammate:true}),null);
 const block=chooseAuto(hand,previous,3,{danger:true});assert.equal(block.mainRank,14);
 const finish=chooseAuto(cards([8,8]),{type:'pair',mainRank:7,count:2},3);assert.equal(finish.count,2);
});
test('all difficulties return legal moves and never inspect opponent faces',()=>{
 for(const level of ['easy','standard','smart'])for(const size of [3,4]){
  const g=dealTable(size);g.phase='playing';g.landlord=0;
  g.hands=g.hands.map((h,i)=>i===0?h:new Proxy([],{get:(_,key)=>{if(key==='length')return 8;throw Error('Opponent face read: '+String(key));}}));
  const move=botTurn(g,level);assert.equal(move.action,'play');
  const chosen=move.cards.map(id=>g.hands[0].find(c=>c.id===id));assert.ok(R.classify(chosen,size));
 }
});
