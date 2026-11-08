import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEconomy,expectedReturn,weighted} from '../server-economy.mjs';
import {applyScratchBomb,generateSealedTicket,settleGameTicket} from '../server-ticket.mjs';
import {scratchGameTypes} from '../server-content.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
const rng=()=>{let seed=1234567;return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};};
test('all tiers keep 0.2% bombs and 120% effective RTP including lucky seal deductions',()=>{
 for(const tier of defaultEconomy().scratch)for(const [type,pool] of Object.entries(tier.variants)){
  const total=pool.reduce((s,x)=>s+x.weight,0);assert.ok(pool.every(x=>x.weight>=0&&Number.isSafeInteger(x.weight)));
  assert.ok(Math.abs(expectedReturn(pool)-1.2)<1e-8);
  assert.equal(pool.filter(x=>x.penaltyMultiplier).reduce((s,x)=>s+x.weight,0)/total,.002);
  for(const [mult,chance] of [[1,.0019],[2,.00009],[4,.00001]])assert.ok(Math.abs(pool.filter(x=>x.penaltyMultiplier===mult).reduce((s,x)=>s+x.weight,0)/total-chance)<1e-12);
  if(type==='lucky_num')for(const [m,p] of [[1,.7],[2,.2],[3,.08],[5,.02]])assert.equal(pool.filter(x=>x.sealMultiplier===m).reduce((s,x)=>s+x.weight,0)/total,p);
  let cumulative=0;for(const item of pool){if(item.weight)assert.equal(weighted(pool,()=> (cumulative+item.weight/2)/total),item);cumulative+=item.weight;}
 }
});
test('all three ticket types display one bomb in an actionable cell, zero prize, and total loss capped at five stakes',()=>{
 for(const game of scratchGameTypes)for(const extra of [1,2,4]){
  const random=rng(),ticket=applyScratchBomb(generateSealedTicket({cost:1000},game,'test',random,0),extra,random);
  assert.equal(ticket.totalPayout,0);assert.equal(ticket.penalty,1000*extra);assert.equal(ticket.bomb.totalLossMultiplier,extra+1);
  const bombs=ticket.cells.filter(c=>c.isBomb);assert.equal(bombs.length,1);assert.ok(!['LUCKY','MULT','STEP_LEFT'].includes(bombs[0].role));
  assert.ok(ticket.cells.every(c=>!c.isWinPart&&!c.revealed));assert.ok(1000+ticket.penalty<=5000);
 }
 assert.throws(()=>applyScratchBomb({totalPayout:0},5,rng()));
});
test('bomb result names the tier and actual additional medical charge',()=>{
 const scope={};vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),scope);
 assert.equal(scope.AVEDGameResults.text({cost:1000,prize:0,penalty:4000}),'刮出超大炸弹了！\n本局扣除医疗费 ¤ 4,000');
});
test('bomb feedback replaces award toast, never celebrates, and degrades to static when effects are disabled',()=>{
 const calls=[],sounds=[],toast={el:{hidden:false,dataset:{},classList:{remove(){},add(){}}},label:{},amount:{},timer:1};const win={AVEDEffectsEnabled:()=>false,AVEDScratchToast:toast,AVEDScratchBomb:{show:o=>calls.push(o),clear(){}}};
 const document={hidden:false,addEventListener(){},getElementById:()=>({querySelector:()=>({getBoundingClientRect:()=>({left:80,top:300,width:24,height:24})})})};
 const ctx={window:win,document,matchMedia:()=>({matches:false,addEventListener(){}}),clearTimeout(){},setTimeout(){}};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-feedback.js',import.meta.url),'utf8'),ctx);
 const banner={dataset:{},setAttribute(){}};win.AVEDScratchFeedback({playSfx:s=>sounds.push(s)}).settle(banner,{cost:1000,prize:0,penalty:4000,cells:[{idx:7,isBomb:true}]});
 assert.equal(banner.dataset.scratchFeedback,'bomb');assert.equal(toast.el.hidden,false);assert.equal(toast.label.textContent,'刮出超大炸弹了！');assert.match(toast.amount.textContent,/本局扣除医疗费 ¤ 4,000/);assert.deepEqual(sounds,['scratch-bomb-5']);assert.equal(calls[0].animated,false);assert.equal(calls[0].origin.x,92);assert.equal(calls[0].origin.y,312);
});

test('bomb settlements permit debt, debit exactly once, and roll back ledger and balance if ticket persistence fails',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE balances(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO balances VALUES(1,1000);CREATE TABLE ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,amount INTEGER,reason TEXT);CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);CREATE UNIQUE INDEX scratch_once ON game_tickets(employee_id,json_extract(result_json,'$.requestKey')); ");
  const deps={db,transaction:fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},balanceFor:id=>db.prepare('SELECT balance FROM balances WHERE id=?').get(id).balance,recordLedger:(id,amount,reason)=>{db.prepare('UPDATE balances SET balance=balance+? WHERE id=?').run(amount,id);db.prepare('INSERT INTO ledger(employee_id,amount,reason) VALUES(?,?,?)').run(id,amount,reason);},award(){},getHighlights:()=>({event:()=>null})};
  const proof={seed:'unit',seedHash:'hash'};
  for(const extra of [1,2,4]){
   db.exec('UPDATE balances SET balance=1000');
   const result={penalty:extra*1000,requestKey:'bomb-test-'+extra};
   const response=settleGameTicket(deps,1,'scratch',1000,0,result,proof);
   assert.equal(response.balance,-extra*1000);assert.equal(response.penalty,extra*1000);
   const stored=db.prepare('SELECT * FROM game_tickets WHERE id=?').get(response.ticketId);assert.equal(JSON.parse(stored.result_json).penalty,response.penalty);assert.equal(stored.prize,0);
   // A duplicate unique request cannot leave another stake or penalty behind.
   db.exec('UPDATE balances SET balance=10000');const count=db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n;
   assert.throws(()=>settleGameTicket(deps,1,'scratch',1000,0,result,proof),/UNIQUE/);
   assert.equal(deps.balanceFor(1),10000);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,count);
  }
  db.exec('UPDATE balances SET balance=999');const count=db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n;
  assert.throws(()=>settleGameTicket(deps,1,'scratch',1000,0,{penalty:1000,requestKey:'too-poor'},proof),/余额不足/);
  assert.equal(deps.balanceFor(1),999);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,count);
  db.exec('UPDATE balances SET balance=1000');assert.throws(()=>settleGameTicket(deps,1,'scratch',1000,0,{penalty:5000},proof),/炸弹扣款无效/);assert.equal(deps.balanceFor(1),1000);
 }finally{db.close();}
});

test('inline demo tickets use the chosen game and tier without sharing or mutating account data',()=>{
 const scope={window:{}};vm.runInNewContext(readFileSync(new URL('../public/scratch-bomb-demo.js',import.meta.url),'utf8'),scope);
 for(const gameType of scratchGameTypes)for(const totalLoss of [2,3,5]){
  const tier={id:'t1',cost:1000},ticket=scope.window.AVEDScratchBombDemo.make({tier,gameType,totalLoss});
  assert.equal(ticket.demo,true);assert.equal(ticket.draft,false);assert.equal(ticket.settled,false);assert.equal(ticket.gameType,gameType);
  assert.equal(ticket.cells.length,gameType.cellsCount);assert.equal(ticket.penalty,(totalLoss-1)*1000);assert.equal(ticket.prize,0);
  assert.equal(ticket.cells.filter(c=>c.isBomb).length,1);assert.ok(ticket.cells.every(c=>!c.revealed));assert.notEqual(ticket.tier,tier);assert.deepEqual(tier,{id:'t1',cost:1000});
  assert.ok(!['LUCKY','MULT','STEP_LEFT'].includes(ticket.cells.find(c=>c.isBomb).role));
 }
});
