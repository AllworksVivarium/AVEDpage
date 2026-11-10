import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installStockLots} from '../server-stock-lots.mjs';
import {installStockMargin} from '../server-stock-margin.mjs';

function fixture(t,cash=5000){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,${cash}),(2,5000);
 CREATE TABLE ledger(employee_id INTEGER,delta INTEGER,reason TEXT);
 CREATE TABLE stock_prices(code TEXT PRIMARY KEY,name TEXT,price INTEGER);INSERT INTO stock_prices VALUES('TEST','测试',92);
 CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER,cost_basis INTEGER,position_notional INTEGER,margin_used INTEGER,realized_pnl INTEGER,leverage REAL,stop_loss INTEGER,take_profit INTEGER);
 CREATE TABLE stock_trades(id INTEGER PRIMARY KEY,employee_id INTEGER,code TEXT,holding_before INTEGER,holding_after INTEGER,action TEXT,quantity INTEGER,price INTEGER,leverage INTEGER,realized_pnl_change INTEGER,created_at TEXT);`);
 const lots=installStockLots(db);lots.migrate();
 const open=id=>{const p=lots.plan(id,'TEST',100,100,10);lots.apply(id,'TEST',100,10,null,null,p);db.prepare("INSERT INTO stock_holdings VALUES(?,'TEST',100,1000,10000,1000,0,10,NULL,NULL)").run(id);};open(1);open(2);
 const balanceFor=id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance;
 const margin=installStockMargin({db,lots,balanceFor,recordLedger:(id,delta,reason)=>{db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(delta,id);db.prepare('INSERT INTO ledger VALUES(?,?,?)').run(id,delta,reason);}});
 const tx=fn=>{db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 return {db,lots,margin,balanceFor,tx};
}

test('default-off preferences are strict booleans and do not spend any other account balance',t=>{
 const {db,margin,balanceFor,tx}=fixture(t);assert.equal(margin.preferences(1).autoMargin,false);tx(()=>margin.autoTopUp());assert.equal(balanceFor(1),5000);
 assert.throws(()=>margin.setPreferences(1,'true'));margin.setPreferences(1,true);tx(()=>margin.autoTopUp());
 assert.equal(balanceFor(1),4666);assert.equal(balanceFor(2),5000);assert.equal(db.prepare('SELECT COUNT(*) n FROM stock_margin_topups').get().n,1);
});

test('auto rescue precedes liquidation, restores about 40% and does not change PnL or quantity',t=>{
 const {db,lots,margin,balanceFor,tx}=fixture(t);margin.setPreferences(1,true);tx(()=>margin.autoTopUp());
 const [lot]=lots.list(1);assert.equal(lot.marginUsed,1334);assert.equal(lot.positionEquity,534);assert.equal(lot.unrealizedPnl,-800);assert.equal(lot.holding,100);assert.equal(lot.avgCost,100);assert.equal(lot.shouldLiquidate,false);
 assert.equal(db.prepare('SELECT automatic FROM stock_margin_topups').get().automatic,1);tx(()=>margin.autoTopUp());assert.equal(balanceFor(1),4666,'same quote cannot debit again');
 margin.setPreferences(1,false);db.exec("UPDATE stock_prices SET price=88");tx(()=>margin.autoTopUp());assert.equal(balanceFor(1),4666,'disabled means no further spending');
});

test('insufficient balance is used without overdraft; deep gaps remain liquidatable',t=>{
 const {db,lots,margin,balanceFor,tx}=fixture(t,50);margin.setPreferences(1,true);db.exec("UPDATE stock_prices SET price=90");tx(()=>margin.autoTopUp(1));
 assert.equal(balanceFor(1),0);const [lot]=lots.list(1);assert.equal(lot.marginUsed,1050);assert.equal(lot.positionEquity,50);assert.equal(lot.shouldLiquidate,true);tx(()=>margin.autoTopUp(1));assert.equal(balanceFor(1),0);
});

test('rescue ledger, margin and receipt roll back together on persistence failure',t=>{
 const {db,lots,margin,balanceFor,tx}=fixture(t);margin.setPreferences(1,true);db.exec("CREATE TRIGGER reject_topup BEFORE INSERT ON stock_margin_topups BEGIN SELECT RAISE(ABORT,'test failure');END;");
 assert.throws(()=>tx(()=>margin.autoTopUp()));assert.equal(balanceFor(1),5000);assert.equal(lots.list(1)[0].marginUsed,1000);assert.equal(db.prepare('SELECT COUNT(*) n FROM ledger').get().n,0);
});

test('simultaneous calls share limited cash in lot-id order without double allocation',t=>{
 const {db,lots,margin,balanceFor,tx}=fixture(t,250),open=lots.plan(1,'TEST',100,100,10);lots.apply(1,'TEST',100,10,null,null,open);
 db.exec("UPDATE stock_holdings SET quantity=200,cost_basis=2000,position_notional=20000,margin_used=2000 WHERE employee_id=1");
 margin.setPreferences(1,true);tx(()=>margin.autoTopUp());const positions=lots.list(1).sort((a,b)=>a.id-b.id);
 assert.equal(balanceFor(1),0);assert.equal(positions[0].marginUsed,1250);assert.equal(positions[1].marginUsed,1000);assert.equal(positions[1].shouldLiquidate,true);
 assert.equal(db.prepare('SELECT margin_used FROM stock_holdings WHERE employee_id=1').get().margin_used,2250);
});
