import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {EventEmitter} from 'node:events';
import {installBar} from '../server-bar.mjs';
import {barDrinks} from '../server-bar-catalog.mjs';
function fixture(t){
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER,display_name TEXT);INSERT INTO employees VALUES(1,100000,'甲'),(2,100000,'乙');CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT);INSERT INTO profiles VALUES(1,'匿名甲'),(2,'匿名乙');CREATE TABLE balance_ledger(employee_id INTEGER,delta INTEGER,reason TEXT);`);
 let now=Date.parse('2026-11-18T10:00:00Z');const balanceFor=id=>db.prepare('SELECT balance+COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=?),0) n FROM employees WHERE id=?').get(id,id).n;
 const options={db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:req=>({id:req.actor}),sessionEmployee:req=>({id:req.actor}),balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger VALUES(?,?,?)').run(id,delta,reason),clock:()=>now};
 let service=installBar(options);t.after(()=>{service.close();db.close();});
 const req=async(actor,path='/api/player/bar',body)=>{const res=new EventEmitter();res.writeHead=()=>{};res.write=()=>{};res.end=()=>res.emit('close');await service.handle({actor,method:body?'POST':'GET',body},res,new URL('http://localhost'+path));return res;};
 return {db,req,balanceFor,advance:ms=>now+=ms,restart(){service.close();service=installBar(options);}};
}
const prefs=(f,id,glassId)=>f.req(id,'/api/player/bar/preferences',{glassId});
const order=(f,id,drinkId,key='glassware-order-0001')=>f.req(id,'/api/player/bar/orders',{drinkId,requestId:key});
const pour=(f,id,orderId,requestId='glassware-pour-0001',extra={})=>f.req(id,'/api/player/bar/pour',{orderId,requestId,...extra});
const sip=(f,id,orderId,key)=>f.req(id,'/api/player/bar/sip',{orderId,requestId:'glassware-sip-'+key});

test('free empty glasses are visible to other guests and can clink without buying a drink',async t=>{
 const f=fixture(t);assert.equal((await prefs(f,1,'highball')).status,200);assert.equal((await prefs(f,2,'beer-mug')).status,200);
 assert.equal(f.balanceFor(1),100000);assert.equal((await f.req(1)).data.myDrink,null);assert.ok((await prefs(f,1,'highball')).data.bartenderLine);
 const one=await f.req(1,'/api/player/bar/events'),two=await f.req(2,'/api/player/bar/events');
 const state=(await f.req(1)).data;assert.equal(state.glassware.length,2);assert.equal(state.guests.find(g=>g.employeeId===2).glassId,'beer-mug');
 const invite=await f.req(1,'/api/player/bar/cheers',{targetId:2,requestId:'glassware-cheers-0001'});assert.equal(invite.status,200);
 assert.equal((await f.req(2,'/api/player/bar/cheers/'+invite.data.id,{decision:'accepted'})).status,200);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_orders').get().n,0);one.end();two.end();
});

test('water pours conserve volume, use server capacities, survive restart and never repeat on retry',async t=>{
 const f=fixture(t);await prefs(f,1,'highball');const bought=await order(f,1,'mineral-water'),id=bought.data.myDrink.id;
 const filled=await pour(f,1,id,'glassware-pour-water1',{amountMl:999999,capacityMl:999999});assert.equal(filled.status,200);
 assert.deepEqual([filled.data.myDrink.remainingMl,filled.data.myDrink.glassMl,filled.data.myDrink.bottleMl],[500,500,0]);
 assert.equal((await pour(f,1,id,'glassware-pour-water1')).data.myDrink.glassMl,500);assert.equal((await pour(f,2,id)).status,400);
 assert.equal((await pour(f,1,id,'glassware-pour-full01')).status,400);assert.equal((await prefs(f,1,'beer-mug')).status,400);assert.equal((await prefs(f,1,null)).status,400);
 const first=await sip(f,1,id,'water01');assert.equal(first.data.receipt.amountMl,125);assert.deepEqual([first.data.myDrink.remainingMl,first.data.myDrink.glassMl,first.data.myDrink.bottleMl],[375,375,0]);
 assert.equal((await sip(f,1,id,'water01')).data.myDrink.remainingMl,375);assert.equal((await sip(f,1,id,'water02')).data.myDrink.glassMl,250);
 f.restart();assert.equal((await f.req(1)).data.myDrink.bottleMl,0);assert.equal((await f.req(1)).data.myDrink.glassMl,250);
 let steps=0,state=(await f.req(1)).data;
 while(state.myDrink.remainingMl>0&&steps++<12){if(state.myDrink.glassMl===0)state=(await pour(f,1,id,'glassware-refill-'+steps)).data;state=(await sip(f,1,id,'finish'+steps)).data;}
 assert.equal(state.myDrink.remainingMl,0);assert.equal(state.myDrink.glassMl,0);assert.equal(state.myDrink.bottleMl,0);assert.equal(state.drinking.totalMl,0);assert.equal(f.balanceFor(1),100000);
 assert.equal(f.db.prepare('SELECT SUM(amount_ml) n FROM bar_sips').get().n,500);
});

test('switching between cup and bottle preserves separate amounts, alcohol metrics and transaction rollback',async t=>{
 const f=fixture(t);await prefs(f,1,'highball');const bought=await order(f,1,'amber-brew'),id=bought.data.myDrink.id,balance=bought.data.balance;
 // Earlier partially poured orders retain separate sources after the capacity upgrade.
 f.db.prepare("UPDATE bar_servings SET glass_ml=200,drink_from='glass' WHERE order_id=?").run(id);f.restart();let state=(await pour(f,1,id,'glassware-source-0001',{action:'source',source:'bottle'})).data;
 assert.deepEqual([state.myDrink.remainingMl,state.myDrink.glassMl,state.myDrink.bottleMl],[330,200,130]);
 state=(await sip(f,1,id,'bottle01')).data;assert.deepEqual([state.myDrink.remainingMl,state.myDrink.glassMl,state.myDrink.bottleMl],[220,200,20]);assert.equal(state.drinking.totalMl,110);
 await pour(f,1,id,'glassware-source-0002',{action:'source',source:'glass'});state=(await sip(f,1,id,'cup0001')).data;
 assert.deepEqual([state.myDrink.remainingMl,state.myDrink.glassMl,state.myDrink.bottleMl],[110,90,20]);assert.equal(state.drinking.totalMl,220);assert.equal(f.balanceFor(1),balance);
 f.db.exec("CREATE TRIGGER reject_pour BEFORE INSERT ON bar_pours BEGIN SELECT RAISE(ABORT,'fixture rollback'); END;");
 assert.equal((await pour(f,1,id,'glassware-rollback01')).status,400);state=(await f.req(1)).data;assert.deepEqual([state.myDrink.remainingMl,state.myDrink.glassMl,state.myDrink.bottleMl],[110,90,20]);
 f.db.exec('DROP TRIGGER reject_pour');state=(await pour(f,1,id,'glassware-rollback01')).data;assert.equal(state.myDrink.glassMl,110);assert.equal(state.myDrink.remainingMl,110);
 assert.equal((await pour(f,1,id,'glassware-source-0001',{action:'source',source:'glass'})).status,400);
});

test('lemon cocktail and all shots retain their original glass; advance glass selection still works for other drinks',async t=>{
 const f=fixture(t);await prefs(f,1,'beer-mug');
 for(const drink of barDrinks.filter(d=>d.id==='lemon-cocktail'||d.id.endsWith('-shot')&&d.orderable!==false)){
  f.advance(61000);const bought=await order(f,1,drink.id,'fixed-glass-order-'+drink.id),current=bought.data.myDrink;
  assert.equal(current.canPour,false);assert.equal(current.glassMl,0);assert.equal((await prefs(f,1,'highball')).status,200,'choosing a spare glass remains allowed');
  assert.equal((await pour(f,1,current.id,'fixed-glass-pour-'+drink.id)).status,400);
  assert.equal((await pour(f,1,current.id,'fixed-glass-source-'+drink.id,{action:'source',source:'glass'})).status,400);
  const state=(await f.req(1)).data;assert.equal(state.myDrink.remainingMl,current.volumeMl);assert.equal(state.myDrink.glassMl,0);assert.equal(state.myDrink.drinkFrom,'bottle');
  assert.equal((await sip(f,1,current.id,'original-'+drink.id)).status,200);
 }
 f.advance(61000);const bought=await order(f,1,'amber-brew','fixed-glass-following-beer');assert.equal(bought.data.myDrink.canPour,true);
 const poured=await pour(f,1,bought.data.myDrink.id,'fixed-glass-following-pour');assert.equal(poured.status,200);assert.equal(poured.data.myDrink.glassMl,330);
});

test('the earlier preview tumbler and poured cocktail migrate without changing remaining volume',async t=>{
 const f=fixture(t);await prefs(f,1,'highball');const bought=await order(f,1,'lemon-cocktail'),id=bought.data.myDrink.id;
 f.db.prepare("UPDATE bar_preferences SET glass_id='rocks' WHERE employee_id=1").run();
 f.db.prepare("UPDATE bar_servings SET remaining_ml=150,glass_ml=100,drink_from='glass' WHERE order_id=?").run(id);f.restart();
 const state=(await f.req(1)).data;assert.equal(state.barPreferences.glassId,'beer-mug');assert.equal(state.myDrink.remainingMl,150);assert.equal(state.myDrink.bottleMl,150);assert.equal(state.myDrink.glassMl,0);assert.equal(state.myDrink.drinkFrom,'bottle');
});

test('every current bottle fits either empty glass in a single pour without creating liquid',async t=>{
 const f=fixture(t);
 for(const glassId of ['highball','beer-mug']){
  f.db.exec('UPDATE bar_servings SET glass_ml=0');f.restart();await prefs(f,1,glassId);
  for(const drink of barDrinks.filter(d=>d.orderable!==false&&d.id!=='lemon-cocktail'&&!d.id.endsWith('-shot'))){
   f.advance(61000);const bought=await order(f,1,drink.id,'whole-bottle-'+glassId+'-'+drink.id),current=bought.data.myDrink;
   const filled=await pour(f,1,current.id,'whole-pour-'+glassId+'-'+drink.id);assert.equal(filled.status,200);assert.equal(filled.data.myDrink.bottleMl,0);assert.equal(filled.data.myDrink.glassMl,current.volumeMl);assert.equal(filled.data.myDrink.remainingMl,current.volumeMl);
  }
 }
});


test('reentry clears selected cups together with drinks at the existing thirty-minute boundary',async t=>{
 const f=fixture(t);assert.equal((await f.req(1)).data.barPreferences.glassId,null);
 await f.req(1,'/api/player/bar/preferences',{toleranceId:'high'});await prefs(f,1,'highball');
 const bought=await order(f,1,'mineral-water');const id=bought.data.myDrink.id;
 const poured=await pour(f,1,id);assert.equal(poured.data.myDrink.glassMl,500);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_sips').get().n,0,'pouring alone does not drink');
 const balance=f.balanceFor(1),ledger=f.db.prepare('SELECT * FROM balance_ledger').all();
 await f.req(1);f.advance(30*60000-1);let state=(await f.req(1)).data;
 assert.equal(state.barPreferences.glassId,'highball');assert.equal(state.myDrink.id,id);
 f.advance(30*60000);state=(await f.req(1)).data;
 assert.equal(state.myDrink,null);assert.equal(state.barPreferences.glassId,null);assert.equal(state.barPreferences.toleranceId,'high');
 assert.equal(f.balanceFor(1),balance);assert.deepEqual(f.db.prepare('SELECT * FROM balance_ledger').all(),ledger);
 assert.equal(f.db.prepare('SELECT glass_ml FROM bar_servings WHERE order_id=?').get(id).glass_ml,500,'cleanup does not rewrite historical consumption');
 f.restart();state=(await f.req(1)).data;assert.equal(state.myDrink,null);assert.equal(state.barPreferences.glassId,null);
});

test('an empty selected cup is also removed after thirty minutes away',async t=>{
 const f=fixture(t);await f.req(1);await prefs(f,1,'beer-mug');
 f.advance(30*60000);const state=(await f.req(1)).data;
 assert.equal(state.myDrink,null);assert.equal(state.barPreferences.glassId,null);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM bar_orders').get().n,0);assert.equal(f.balanceFor(1),100000);
});
