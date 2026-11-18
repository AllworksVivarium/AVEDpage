import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {defaultEconomy,expectedReturn,weighted} from '../server-economy.mjs';
import {scratchGameTypes,scratchSuperJackpot} from '../server-content.mjs';
import {generateOutcomeTicket,settleGameTicket} from '../server-ticket.mjs';
import {installGameTax,gameTaxAmount} from '../server-game-tax.mjs';

const rng=()=>{let seed=1234567;return()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/2**32;};
test('each tier and game has one 2000x award at exactly one in 12.5 million without changing return, bomb or seal odds',()=>{
 for(const tier of defaultEconomy().scratch)for(const [type,pool] of Object.entries(tier.variants)){
  const total=pool.reduce((sum,x)=>sum+x.weight,0),awards=pool.filter(x=>x.superJackpot);assert.equal(awards.length,1);
  const award=awards[0];assert.equal(award.multiplier,2000);assert.equal(award.sealMultiplier,1);assert.equal(award.weight/total,1/12500000);
  assert.equal(Math.max(...pool.filter(x=>x.weight>0).map(x=>x.multiplier)),2000);
  assert.ok(Math.abs(expectedReturn(pool)-1.15)<1e-8);assert.equal(pool.filter(x=>x.penaltyMultiplier).reduce((sum,x)=>sum+x.weight,0)/total,.015);
  const ordinary=pool.filter(x=>!x.superJackpot);assert.equal(Math.max(...ordinary.map(x=>x.multiplier)),type==='lucky_num'?500:100);
  // Force the actual weighted draw's rare interval, avoiding millions of random trials.
  const start=pool.slice(0,pool.indexOf(award)).reduce((sum,x)=>sum+x.weight,0);
  assert.equal(weighted(pool,()=> (start+award.weight/2)/total),award);
  assert.notEqual(weighted(pool,()=> (start-.5)/total),award);
  const game=scratchGameTypes.find(x=>x.type===type),ticket=generateOutcomeTicket(tier,game,'rare-proof',rng(),award);
  assert.equal(ticket.totalPayout,tier.cost*2000);assert.equal(ticket.basePayout,ticket.totalPayout);assert.equal(ticket.sealMultiplier,1);assert.equal(ticket.superJackpot,true);assert.ok(!ticket.penalty);
  const printed=ticket.cells.filter(x=>x.isWinPart).reduce((sum,x)=>sum+Number(x.sub.match(/¤ ([\d,]+)/)[1].replaceAll(',','')),0);
  assert.equal(printed,ticket.totalPayout);
  if(type==='lucky_num')assert.equal(ticket.cells.find(x=>x.role==='MULT').label,'×1 倍');
  assert.equal(generateOutcomeTicket(tier,game,'rare-proof',rng(),{...award,sealMultiplier:5}).totalPayout,tier.cost*2000);
 }
 assert.equal(scratchSuperJackpot.chance,1/12500000);
});

test('largest super jackpot settles with existing tax and immutable ticket storage; duplicate persistence rolls back',t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec('CREATE TABLE employees(id INTEGER PRIMARY KEY);INSERT INTO employees VALUES(1);CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,reason TEXT);CREATE TABLE company_fund(id INTEGER PRIMARY KEY,employee_id INTEGER,amount INTEGER,kind TEXT,source_ledger_id INTEGER UNIQUE,request_key TEXT UNIQUE);CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);CREATE UNIQUE INDEX request_once ON game_tickets(employee_id,json_extract(result_json,\'$.requestKey\'));');
 const balanceFor=id=>db.prepare('SELECT coalesce(sum(delta),0) AS balance FROM balance_ledger WHERE employee_id=?').get(id).balance;
 const recordLedger=(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 recordLedger(1,100000,'fixture');const gameTax=installGameTax({db,recordLedger}),tier=defaultEconomy().scratch.at(-1),outcome=tier.variants.lucky_num.find(x=>x.superJackpot);
 const ticket=generateOutcomeTicket(tier,scratchGameTypes.find(x=>x.type==='lucky_num'),'seed',rng(),outcome);ticket.requestKey='super-jackpot-test-retry';
 const deps={db,balanceFor,recordLedger,transaction,gameTax,award(){},getHighlights:()=>({event:()=>null})},proof={seed:'seed',seedHash:'proof'};
 const result=settleGameTicket(deps,1,'scratch',tier.cost,ticket.totalPayout,ticket,proof),tax=gameTaxAmount(tier.cost,200000000);
 assert.equal(result.prize,200000000);assert.equal(result.tax,tax);assert.equal(result.balance,200000000-tax);
 const stored=db.prepare('SELECT * FROM game_tickets').get();assert.equal(JSON.parse(stored.result_json).superJackpot,true);assert.equal(JSON.parse(stored.result_json).sealMultiplier,1);
 const ledger=db.prepare('SELECT * FROM balance_ledger').all();assert.throws(()=>settleGameTicket(deps,1,'scratch',tier.cost,ticket.totalPayout,ticket,proof),/UNIQUE/);
 assert.deepEqual(db.prepare('SELECT * FROM balance_ledger').all(),ledger);assert.equal(db.prepare('SELECT count(*) n FROM game_tickets').get().n,1);
});

test('super jackpot notification has no expiry and survives ordinary awards, navigation and idle until manually closed',()=>{
 const documentEvents=new Map(),timers=[];
 const element=()=>({dataset:{},children:[],events:new Map(),style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(name,fn){this.events.set(name,fn);},append(el){this.children.push(el);},remove(){}});
 const document={hidden:false,addEventListener:(name,fn)=>documentEvents.set(name,fn),createElement:element,body:{append(){}}};
 const ctx={window:{AVEDEffectsEnabled:()=>false},document,matchMedia:()=>({matches:false,addEventListener(){}}),innerWidth:390,innerHeight:844,clearTimeout(){},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-feedback.js',import.meta.url),'utf8'),ctx);
 const fx=ctx.window.AVEDScratchFeedback(),banner=element();fx.settle(banner,{cost:1000,prize:5000});const staleTimer=timers.at(-1);
 fx.settle(banner,{cost:1000,prize:2000000,superJackpot:true});const toast=ctx.window.AVEDScratchToast;
 assert.equal(toast.pinned,true);assert.equal(toast.timer,null);assert.equal(timers.length,1);assert.equal(toast.label.textContent,'超级大奖 · 2,000 倍');assert.match(toast.amount.textContent,/2,000,000/);
 staleTimer.fn();fx.nextTicket();fx.settle(banner,{cost:1000,prize:50000});documentEvents.get('click')({target:{closest:()=>({})}});document.hidden=true;documentEvents.get('visibilitychange')();
 assert.equal(toast.el.hidden,false);assert.equal(toast.label.textContent,'超级大奖 · 2,000 倍');
 toast.close.events.get('click')();assert.equal(toast.el.hidden,true);assert.equal(toast.pinned,false);
 document.hidden=false;fx.settle(banner,{cost:1000,prize:2000000,superJackpot:true});documentEvents.get('keydown')({key:'Escape'});assert.equal(toast.el.hidden,true);
 const copy={};vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),copy);
 assert.match(copy.AVEDGameResults.text({cost:1000,prize:2000000,superJackpot:true}),/超级大奖 · 2,000 倍/);
});
