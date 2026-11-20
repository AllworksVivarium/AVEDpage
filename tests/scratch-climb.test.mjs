import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultEconomy,returnRatePool,expectedReturn} from '../server-economy.mjs';
import {scratchGameTypes,scratchClimbMultipliers} from '../server-content.mjs';
import {generateOutcomeTicket,generateSealedTicket} from '../server-ticket.mjs';

const game=scratchGameTypes.find(g=>g.type==='step_climb');
const rng=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/2**32;
function verify(ticket){
 assert.equal(ticket.cells.length,12);
 let floor=0;
 ticket.cells.forEach((cell,index)=>{
  assert.equal(cell.idx,index);assert.equal(cell.step,index+1);assert.equal(cell.role,'STEP_RIGHT');
  assert.ok(Number.isInteger(cell.stepDelta)&&cell.stepDelta>=-2&&cell.stepDelta<=2);
  floor+=cell.stepDelta;assert.equal(cell.stepFloor,floor);
  assert.ok(floor>=0&&floor<=ticket.climb.topFloor);
  if(cell.isBomb)assert.equal(cell.stepDelta,0);
 });
 assert.equal(floor,ticket.climb.finishFloor);
 assert.equal(ticket.climb.levels[floor],ticket.totalPayout);
 assert.equal(ticket.climb.levels.length,ticket.climb.topFloor+1);
 const amount=ticket.cells.filter(c=>c.isWinPart).reduce((sum,c)=>sum+Number(c.sub.match(/¤ ([\d,]+)/)[1].replaceAll(',','')),0);
 assert.equal(amount,ticket.totalPayout);
}
test('twelve moves reach exactly the paid floor for every configured prize, tier and bomb',()=>{
 for(const tier of defaultEconomy().scratch)for(const outcome of tier.variants.step_climb)for(let seed=1;seed<=64;seed++){
  const ticket=generateOutcomeTicket(tier,game,'proof',rng(seed*7919),outcome);verify(ticket);
  assert.equal(ticket.totalPayout,Math.floor(tier.cost*outcome.multiplier+1e-7));
  const expected=scratchClimbMultipliers.map(x=>Math.floor(tier.cost*x+1e-7));if(outcome.superJackpot)expected[12]=tier.cost*2000;
  assert.deepEqual(ticket.climb.levels,expected);assert.equal(ticket.climb.topFloor,12);
  assert.equal(ticket.penalty||0,tier.cost*(outcome.penaltyMultiplier||0));
  assert.equal(ticket.cells.filter(c=>c.isBomb).length,outcome.penaltyMultiplier?1:0);
 }
});
test('the same award has varied routes with rises, falls and pauses',()=>{
 const routes=new Set(),moves=new Set();
 for(let seed=1;seed<=256;seed++){
  const t=generateSealedTicket({cost:1000},game,'proof',rng(seed*3571),1200);verify(t);
  routes.add(t.cells.map(c=>c.stepDelta).join(','));t.cells.forEach(c=>moves.add(c.stepDelta));
 }
 assert.ok(routes.size>100);assert.ok([...moves].some(x=>x<0));assert.ok(moves.has(0));assert.ok(moves.has(2));
 assert.deepEqual(generateSealedTicket({cost:1000},game,'same',rng(12),5000),generateSealedTicket({cost:1000},game,'same',rng(12),5000));
});
test('rounding, zero returns and constant random sources cannot create an impossible route',()=>{
 for(const cost of [100,101,1000,100000])for(const payout of [0,1,2,650,750,5000,200000000])for(const random of [()=>0,()=>.5,()=>.999999]){
  verify(generateSealedTicket({cost},game,'edge',random,payout));
 }
});
function client(){
 const ctx={window:{AVEDPixelIcons:{render:()=>'<svg></svg>'}}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-climb.js',import.meta.url),'utf8'),ctx);
 return ctx.window.AVEDScratchClimb;
}
test('manual reveals hide later floors until the route connects; reveal-all exposes the complete route',()=>{
 const ui=client(),t=generateSealedTicket({cost:1000},game,'proof',rng(945),5000);
 assert.equal(ui.state(t).known,0);assert.match(ui.cell(t.cells[0],t),/data-scratch-cell="0"/);
 t.cells[4].revealed=true;
 assert.equal(ui.state(t).known,0);assert.match(ui.cell(t.cells[4],t),/待连通/);
 assert.doesNotMatch(ui.ladder(t,ui.state(t)),/is-current/);
 t.cells[0].revealed=true;assert.equal(ui.state(t).known,1);
 t.cells.forEach(c=>c.revealed=true);
 assert.equal(ui.state(t).done,true);assert.equal(ui.state(t).floor,t.climb.finishFloor);
 assert.equal((ui.ladder(t,ui.state(t)).match(/data-climb-level=/g)||[]).length,12);
 const position={},graph={},end={classList:{toggle(){}}},host={querySelector:s=>s==='[data-climb-position]'?position:s==='[data-climb-end]'?end:graph};ui.update(host,t);
 assert.equal(position.textContent,'终点 第8层');
 assert.match(ui.prizeTable(scratchClimbMultipliers,1000),/12层/);
 assert.match(ui.prizeTable(scratchClimbMultipliers,1000),/2,000,000/);
 t.cells.forEach(c=>c.revealed=false);ui.update(host,t);
 assert.equal(position.textContent,'已刮 0/12');
});
test('final result identifies the reached floor once and keeps bomb fees separate',()=>{
 const ctx={};vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),ctx);
 const normal={cost:1000,prize:5000,climb:{finishFloor:3,topFloor:5}};
 assert.match(ctx.AVEDGameResults.text(normal),/^终点第3层 本局获得 ¤ 5,000/);
 assert.match(ctx.AVEDGameResults.text({...normal,prize:2000000,superJackpot:true,climb:{finishFloor:5,topFloor:5}}),/^登顶第5层 超级大奖/);
 assert.doesNotMatch(ctx.AVEDGameResults.text({...normal,prize:0,penalty:2000}),/终点|登顶/);
});
test('twelve-floor odds keep total probability, configured return and rare-award odds',()=>{
 for(const percent of [0,.000001,.00001,.001,.01,.1,1,5,65,100,110,120,135,150]){
  const pool=returnRatePool(percent,'t1','step_climb');
  assert.equal(pool.reduce((sum,x)=>sum+x.weight,0),100000000);
  assert.ok(pool.every(x=>Number.isSafeInteger(x.weight)&&x.weight>=0));
  assert.ok(Math.abs(expectedReturn(pool)-percent/100)<1e-8);
  assert.ok(pool.filter(x=>!x.penaltyMultiplier&&!x.superJackpot).every(x=>scratchClimbMultipliers.includes(x.multiplier)));
 }
 const p=defaultEconomy().scratch[0].variants.step_climb;
 assert.equal(p.filter(x=>x.penaltyMultiplier).reduce((sum,x)=>sum+x.weight,0)/1e8,.015);
 assert.equal(p.find(x=>x.superJackpot).weight/1e8,1/12500000);
});


test('all twelve prize floors have distinct increasing awards and nonzero default odds',()=>{
 assert.equal(scratchClimbMultipliers.length,13);
 const pool=defaultEconomy().scratch[0].variants.step_climb;
 for(let floor=1;floor<=12;floor++){assert.ok(scratchClimbMultipliers[floor]>scratchClimbMultipliers[floor-1]);assert.ok(pool.some(x=>!x.superJackpot&&x.multiplier===scratchClimbMultipliers[floor]&&x.weight>0));}
 const ui=client();assert.equal((ui.mini().match(/sp-covered/g)||[]).length,12);
 const legacy={cost:1000,cells:Array.from({length:5},(_,idx)=>({stepDelta:idx===0?1:0,revealed:true})),climb:{topFloor:5,levels:[0,500,1200,5000,20000,100000]}};
 assert.equal(ui.state(legacy).done,true);assert.equal((ui.ladder(legacy,ui.state(legacy)).match(/data-climb-level=/g)||[]).length,5);
});


test('client ticket description and draft shape match twelve-station server rules',()=>{
 const source=readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
 const start=source.indexOf('const scratchGameTypes = [')+'const scratchGameTypes = '.length,end=source.indexOf('      ];',start)+7;
 const types=vm.runInNewContext(source.slice(start,end));const actual=types.find(x=>x.type==='step_climb');
 assert.equal(actual.cellsCount,game.cellsCount);assert.equal(actual.sub,game.sub);assert.equal(actual.tagline,game.tagline);assert.deepEqual(Array.from(actual.rules),game.rules);
});


test('marker follows only connected reveals, preserves pauses, caps reveal-all motion and obeys effects settings',()=>{
 const animations=[];let effects=true,reduced=false;
 const animate=(frames,options)=>{animations.push({frames,options});return {cancel(){}};};
 const token={style:{},animate,firstElementChild:{animate}},position={},levels={querySelector:()=>token},end={classList:{toggle(){}}};
 const host={querySelector:s=>s==='[data-climb-position]'?position:s==='[data-climb-end]'?end:levels};
 const context={window:{AVEDEffectsEnabled:()=>effects},document:{hidden:false,body:{classList:{contains:()=>false}}},matchMedia:()=>({matches:reduced})};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-climb.js',import.meta.url),'utf8'),context);
 const ui=context.window.AVEDScratchClimb;let floor=0;
 const t={cost:1000,climb:{topFloor:12},cells:[2,0,-1,1,2,-1,0,2,-2,1,-2,-2].map((stepDelta,idx)=>({idx,stepDelta,stepFloor:floor+=stepDelta,revealed:false}))};
 t.cells[4].revealed=true;ui.update(host,t);assert.equal(animations.length,0);
 t.cells[0].revealed=true;ui.update(host,t);assert.equal(animations.length,2);assert.notEqual(animations[0].frames[0].top,animations[0].frames[1].top);
 t.cells[1].revealed=true;ui.update(host,t);assert.equal(animations.at(-2).frames[0].top,animations.at(-2).frames[1].top);
 t.cells.forEach(c=>c.revealed=true);ui.update(host,t);assert.ok(animations.at(-2).options.duration<=1200);assert.equal(position.textContent,'终点 第0层');
 const count=animations.length;effects=false;t.cells.forEach(c=>c.revealed=false);ui.update(host,t);t.cells[0].revealed=true;ui.update(host,t);assert.equal(animations.length,count);
 effects=true;reduced=true;t.cells[1].revealed=true;ui.update(host,t);assert.equal(animations.length,count);
});
