import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultEconomy,installEconomy,expectedReturn,validateEconomy} from '../server-economy.mjs';
import {spinSlot,slotPartialReturns} from '../server-slot.mjs';
import {generateSealedTicket} from '../server-ticket.mjs';
import {scratchGameTypes} from '../server-content.mjs';
import {publicCards,newCards} from '../server-cards.mjs';

function rng(seed=0x89712345){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};}

test('fixed rules replace stale administrator configuration once and remain stable on restart',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE economy_config(id INTEGER PRIMARY KEY,revision INTEGER,config_json TEXT);CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);CREATE TABLE stock_prices(code TEXT,price INTEGER)');
  const before=defaultEconomy();before.scratch[0].cost=725;before.scratch[0].returnPercent=65;before.sky.speed=40;
  db.prepare('INSERT INTO economy_config VALUES(1,42,?)').run(JSON.stringify(before));
  const service=installEconomy({db}),after=service.get(),{revision,...rules}=after;
  assert.ok(revision>42);assert.deepEqual(rules,defaultEconomy());
  assert.ok(after.scratch.every(t=>Object.values(t.variants).every(p=>Math.abs(expectedReturn(p)-1.2)<1e-8)));
  assert.deepEqual(installEconomy({db}).get(),after);
  assert.equal(service.publicRules().tiers[0].topPrizes.three_match,100000);
 }finally{db.close();}
});

test('all scratch displays represent fine-grained server payouts exactly',()=>{
 for(const game of scratchGameTypes)for(const prize of [0,50,600,650,700,750,800,30000]){
  const ticket=generateSealedTicket({id:'t1',cost:1000},game,'test',rng(prize+7),prize);
  assert.equal(ticket.totalPayout,prize);assert.equal(ticket.cells.length,game.cellsCount);assert.equal(ticket.cells.filter(c=>c.revealed).length,0);
  const total=ticket.cells.filter(c=>c.isWinPart).reduce((sum,c)=>sum+Number(c.sub.match(/¤ ([\d,]+)/)[1].replaceAll(',','')),0);
  assert.equal(total,prize,game.type);
 }
});

test('slot partial returns do not fake winning lines; loss is bounded by the stake',()=>{
 // A fixed mixed board has no paying line or protocol.
 const board=[[0,2,3,4,5],[2,3,3,4,5],[4,5,2,3,4]],weights=[2,2,3,4,5,6];
 const values=board.flat().map(i=>(weights.slice(0,i).reduce((a,b)=>a+b,0)+.5)/22);
 for(let i=0;i<slotPartialReturns.length;i++){
  const draws=[...values,.5,(i+.5)/slotPartialReturns.length];const {prize,result}=spinSlot(1000,()=>draws.shift());
  assert.equal(prize,Math.floor(1000*slotPartialReturns[i]));assert.equal(result.partialReturn,prize);assert.deepEqual(result.winningCells,[]);assert.deepEqual(result.mechanisms,[]);
 }
 const draws=[...values,0];assert.equal(spinSlot(1000,()=>draws.shift()).prize,0);
 const random=rng();for(let i=0;i<10000;i++){const {prize}=spinSlot(101,random);assert.ok(Number.isSafeInteger(prize)&&prize>=0);assert.ok(prize-101>=-101);}
});

test('slot distribution stays near the intended return with real rare prizes and few zero payouts',()=>{
 const random=rng(),count=300000;let total=0,zero=0,loss=0,rare=0;
 for(let i=0;i<count;i++){const {prize}=spinSlot(1000,random);total+=prize;if(!prize)zero++;if(prize<1000)loss++;if(prize>=10000)rare++;}
 assert.ok(total/count/1000>1&&total/count/1000<1.05);assert.ok(zero/count>.02&&zero/count<.04);assert.ok(loss/count>.7&&loss/count<.8);assert.ok(rare/count>.003&&rare/count<.005);
});

test('main result shows actual total received, including principal, without claiming net profit',()=>{
 const scope={};vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),scope);
 const show=scope.AVEDGameResults.text;
 assert.equal(show({cost:1000,prize:1650}),'本局获得 ¤ 1,650');
 assert.equal(show({cost:1000,prize:650}),'本局获得 ¤ 650');
 assert.equal(show({cost:1000,prize:1000}),'本局获得 ¤ 1,000');
 assert.equal(show({cost:1000,prize:0}),'本局返还 ¤ 0');
 assert.equal(show({cost:1000,prize:1000,cancelled:true}),'撤班退回 ¤ 1,000');
 assert.equal(show({cost:1000,prize:undefined}),'正在确认结算');
 const cards=publicCards({...newCards(rng()),phase:'ended',winner:0},1);assert.equal(cards.cost,0);assert.equal(cards.prize,20000);
});
