import test from 'node:test';
import assert from 'node:assert/strict';
import {dealTable,tableAction,tableView,botTurn} from '../server-card-table.mjs';
const R=globalThis.AVEDDdzRules,cards=values=>values.map((val,i)=>({id:i+1,val}));
test('all ordinary combinations, ambiguous airplane wings and invalid runs',()=>{
 const cases=[[[3],'single'],[[3,3],'pair'],[[3,3,3],'triple'],[[3,3,3,4],'triple_one'],[[3,3,3,4,4],'triple_two'],[[3,4,5,6,7],'straight'],[[3,3,4,4,5,5],'double_straight'],[[3,3,3,4,4,4],'plane'],[[3,3,3,4,4,4,6,6],'plane_single'],[[3,3,3,4,4,4,6,6,7,7],'plane_pair'],[[3,3,3,3,4,4],'four_two'],[[3,3,3,3,4,4,5,5],'four_two_pair'],[[3,3,3,3],'bomb'],[[16,17],'rocket']];
 for(const [v,type]of cases)assert.equal(R.classify(cards(v))?.type,type,v.join(','));
 for(const v of [[3,4,5,6],[11,12,13,14,15],[3,3,4,4],[3,3,3,4,4,4,4,6],[3,3,3,5,5,5]])assert.equal(R.classify(cards(v)),null);
});
test('four-player bombs compare length first; only all four jokers form the rocket',()=>{
 const p=v=>R.classify(cards(v),4);assert.equal(p([16,17]),null);assert.equal(p([16,16]).type,'pair');assert.equal(p([16,16,17,17]).type,'rocket');
 assert.equal(R.beats(p([3,3,3,3,3]),p([15,15,15,15])),true);assert.equal(R.beats(p([15,15,15,15]),p([3,3,3,3,3])),false);
 assert.equal(R.beats(p([15,15,15,15,15,15,15,15]),p([16,16,17,17])),false);assert.equal(R.beats(p([16,16,17,17]),p([16,16,17,17])),false);
 assert.equal(R.beats(p([4,5,6,7,8,9]),p([3,4,5,6,7])),false);
});
test('deals, authority checks, round reset, and public views keep private hands private',()=>{
 for(const size of [3,4]){const s=dealTable(size);assert.equal(new Set([...s.hands.flat(),...s.bottom].map(c=>c.id)).size,size===3?54:108);assert.ok(s.hands.every(h=>h.length===(size===3?17:25)));
  assert.throws(()=>tableAction(s,1,'bid',{bid:3}));tableAction(s,0,'bid',{bid:3});assert.equal(s.hands[0].length,size===3?20:33);
  const before=JSON.stringify(s);assert.throws(()=>tableAction(s,0,'play',{cards:[9999]}));assert.throws(()=>tableAction(s,0,'pass'));assert.equal(JSON.stringify(s),before);
  tableAction(s,0,'play',{cards:[s.hands[0][0].id]});for(let i=1;i<size;i++)tableAction(s,i,'pass');assert.equal(s.turn,0);assert.equal(s.last,null);
  const room={id:'TEST',size,revision:1,seats:s.hands.map((h,i)=>({id:i+10,name:'Employee '+i})),game:s};const v=tableView(room,10);assert.equal(v.hand.length,s.hands[0].length);assert.ok(!('hands'in v));assert.ok(v.seats.every(p=>!('hand'in p)));assert.throws(()=>tableView(room,99));
 }
});
test('bots finish three- and four-seat games without illegal moves or peeking',()=>{
 for(const size of [3,4])for(let run=0;run<5;run++){const s=dealTable(size);let turns=0;while(s.phase!=='ended'&&turns<900){const m=botTurn(s);tableAction(s,s.turn,m.action,m);turns++;}assert.equal(s.phase,'ended',`size ${size} stalled at ${turns}`);assert.ok(['landlord','farmers'].includes(s.winner));}
});
