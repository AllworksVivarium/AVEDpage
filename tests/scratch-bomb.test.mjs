import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEconomy,expectedReturn,weighted} from '../server-economy.mjs';
import {applyScratchBomb,generateSealedTicket,generateOutcomeTicket,settleGameTicket} from '../server-ticket.mjs';
import {installDebtRelief} from '../server-debt-relief.mjs';
import {scratchGameTypes} from '../server-content.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
const rng=()=>{let seed=1234567;return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};};
test('all tiers have 2% bombs and 120% effective RTP including lucky seal deductions',()=>{
 for(const tier of defaultEconomy().scratch)for(const [type,pool] of Object.entries(tier.variants)){
  const total=pool.reduce((s,x)=>s+x.weight,0);assert.ok(pool.every(x=>x.weight>=0&&Number.isSafeInteger(x.weight)));
  assert.ok(Math.abs(expectedReturn(pool)-1.2)<1e-8);
  assert.equal(pool.filter(x=>x.penaltyMultiplier).reduce((s,x)=>s+x.weight,0)/total,.02);
  for(const [mult,chance] of [[2,.012],[10,.006],[100,.002]])assert.ok(Math.abs(pool.filter(x=>x.penaltyMultiplier===mult).reduce((s,x)=>s+x.weight,0)/total-chance)<1e-12);
  if(type==='lucky_num')for(const [m,p] of [[1,.7],[2,.2],[3,.08],[5,.02]])assert.equal(pool.filter(x=>x.sealMultiplier===m).reduce((s,x)=>s+x.weight,0)/total,p);
  let cumulative=0;for(const item of pool){if(item.weight)assert.equal(weighted(pool,()=> (cumulative+item.weight/2)/total),item);cumulative+=item.weight;}
 }
});
test('all three ticket types display one bomb in an actionable cell with the new maximum deduction',()=>{
 for(const game of scratchGameTypes)for(const extra of [2,10,100]){
  const random=rng(),ticket=applyScratchBomb(generateSealedTicket({cost:1000},game,'test',random,0),extra,random);
  assert.equal(ticket.totalPayout,0);assert.equal(ticket.penalty,1000*extra);assert.equal(ticket.bomb.totalLossMultiplier,extra+1);
  const bombs=ticket.cells.filter(c=>c.isBomb);assert.equal(bombs.length,1);assert.ok(!['LUCKY','MULT','STEP_LEFT'].includes(bombs[0].role));
  assert.ok(ticket.cells.every(c=>!c.isWinPart&&!c.revealed));assert.ok(1000+ticket.penalty<=101000);
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
  for(const extra of [2,10,100]){
   db.exec('UPDATE balances SET balance=1000');
   const result={penalty:extra*1000,requestKey:'bomb-test-'+extra};
   const response=settleGameTicket(deps,1,'scratch',1000,0,result,proof);
   assert.equal(response.balance,-extra*1000);assert.equal(response.penalty,extra*1000);
   const stored=db.prepare('SELECT * FROM game_tickets WHERE id=?').get(response.ticketId);assert.equal(JSON.parse(stored.result_json).penalty,response.penalty);assert.equal(stored.prize,0);
   // A duplicate unique request cannot leave another stake or penalty behind.
   db.exec('UPDATE balances SET balance=1000000');const count=db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n;
   assert.throws(()=>settleGameTicket(deps,1,'scratch',1000,0,result,proof),/UNIQUE/);
   assert.equal(deps.balanceFor(1),1000000);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,count);
  }
  db.exec('UPDATE balances SET balance=999');const count=db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n;
  assert.throws(()=>settleGameTicket(deps,1,'scratch',1000,0,{penalty:1000,requestKey:'too-poor'},proof),/余额不足/);
  assert.equal(deps.balanceFor(1),999);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,count);
  db.exec('UPDATE balances SET balance=1000');assert.throws(()=>settleGameTicket(deps,1,'scratch',1000,0,{penalty:5000},proof),/炸弹扣款无效/);assert.equal(deps.balanceFor(1),1000);
 }finally{db.close();}
});

test('inline demo tickets use the chosen game and tier without sharing or mutating account data',()=>{
 const scope={window:{}};vm.runInNewContext(readFileSync(new URL('../public/scratch-bomb-demo.js',import.meta.url),'utf8'),scope);
 for(const gameType of scratchGameTypes)for(const totalLoss of [3,11,101]){
  const tier={id:'t1',cost:1000},ticket=scope.window.AVEDScratchBombDemo.make({tier,gameType,totalLoss});
  assert.equal(ticket.demo,true);assert.equal(ticket.draft,false);assert.equal(ticket.settled,false);assert.equal(ticket.gameType,gameType);
  assert.equal(ticket.cells.length,gameType.cellsCount);assert.equal(ticket.penalty,(totalLoss-1)*1000);assert.equal(ticket.prize,0);
  assert.equal(ticket.cells.filter(c=>c.isBomb).length,1);assert.ok(ticket.cells.every(c=>!c.revealed));assert.notEqual(ticket.tier,tier);assert.deepEqual(tier,{id:'t1',cost:1000});
  assert.ok(!['LUCKY','MULT','STEP_LEFT'].includes(ticket.cells.find(c=>c.isBomb).role));
 }
});

test('a funded player can enter debt without an all-in stake; resetting only bills the deficit to the fund',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,reason TEXT);
  CREATE TABLE company_fund(id INTEGER PRIMARY KEY,employee_id INTEGER,amount INTEGER,kind TEXT,source_ledger_id INTEGER UNIQUE);
  CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
  installDebtRelief(db);
  const balanceFor=id=>db.prepare('SELECT COALESCE(SUM(delta),0) balance FROM balance_ledger WHERE employee_id=?').get(id).balance;
  const recordLedger=(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason);
  const transaction=fn=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  const deps={db,balanceFor,recordLedger,transaction,award(){},getHighlights:()=>({event:()=>null})};
  for(const [id,type,seal,opening,closing] of [[1,'three_match',1,7000000,-3100000],[2,'lucky_num',5,30000000,-20100000]]){
   recordLedger(id,opening,'fixture');
   const tier={id:'t6',cost:100000},game=scratchGameTypes.find(g=>g.type===type);
   const ticket=generateOutcomeTicket(tier,game,'fixture',rng(),{multiplier:0,penaltyMultiplier:100,sealMultiplier:seal});
   const response=settleGameTicket(deps,id,'scratch',tier.cost,0,ticket,{seed:'fixture',seedHash:'fixture-'+id});
   assert.equal(response.balance,closing);assert.ok(opening>tier.cost*50);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM company_fund').get().n,id-1,'the loss is not automatically erased');
   assert.throws(()=>settleGameTicket(deps,id,'scratch',tier.cost,0,ticket,{seed:'again',seedHash:'again'}),/余额不足/);
   const reset=()=>transaction(()=>{const b=balanceFor(id);if(b)recordLedger(id,-b,'主动归零');});reset();reset();
   assert.equal(balanceFor(id),0);const covered=db.prepare('SELECT * FROM company_fund WHERE employee_id=?').get(id);
   assert.equal(covered.amount,closing);assert.equal(covered.kind,'debt_relief');
   assert.equal(db.prepare('SELECT COUNT(*) n FROM company_fund WHERE employee_id=?').get(id).n,1);
  }
  const invalid={penalty:20000000,bomb:{baseMultiplier:100},sealMultiplier:1,gameType:{type:'three_match'}};
  recordLedger(3,7000000,'fixture');assert.throws(()=>settleGameTicket(deps,3,'scratch',100000,0,invalid,{seed:'bad',seedHash:'bad'}),/扣款无效/);assert.equal(balanceFor(3),7000000);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 }finally{db.close();}
});

test('large monetary penalties reuse the bounded blast instead of scaling particles by the fee',()=>{
 const created=[];
 const element=()=>({style:{setProperty(){}},dataset:{},children:[],append(child){this.children.push(child);},setAttribute(){},remove(){}});
 const document={createElement:()=>{const el=element();created.push(el);return el;},body:element(),addEventListener(){}};
 const scope={window:{},document,innerWidth:390,innerHeight:844,setTimeout:()=>1,clearTimeout(){},matchMedia:()=>({addEventListener(){}})};
 vm.runInNewContext(readFileSync(new URL('../public/scratch-bomb.js',import.meta.url),'utf8'),scope);
 scope.window.AVEDScratchBomb.show({cost:100000,penalty:50000000,animated:true});
 assert.equal(created[0].dataset.level,5);assert.equal(created[0].children.length,147);
});
