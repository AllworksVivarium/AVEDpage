import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installStockUnlocks} from '../server-stock-unlocks.mjs';
import {requireStockLeverage} from '../stock-risk.mjs';

function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY);INSERT INTO employees VALUES(1),(2);
 CREATE TABLE personal_metrics(employee_id INTEGER PRIMARY KEY,balance INTEGER,peak INTEGER);
 INSERT INTO personal_metrics VALUES(1,1000000,1000000),(2,0,0);
 CREATE TABLE stock_trades(employee_id INTEGER,leverage INTEGER);
 CREATE TABLE stock_prices(code TEXT PRIMARY KEY,price INTEGER);INSERT INTO stock_prices VALUES('TEST',100);
 CREATE TABLE stock_lots(employee_id INTEGER,code TEXT,quantity INTEGER,margin_used INTEGER,position_notional INTEGER);
 CREATE TABLE stock_lot_migrations(name TEXT PRIMARY KEY);INSERT INTO stock_lot_migrations VALUES('lots-v1');`);
 return db;
}

test('strict asset milestones persist after spending, clearing cash and restarting',t=>{
 const db=fixture(t);let service=installStockUnlocks(db);
 assert.deepEqual(service.status(1).unlockedLeverages,[1]);
 db.exec('UPDATE personal_metrics SET balance=1000001,peak=1000001 WHERE employee_id=1');service.capture([1]);
 db.exec('UPDATE personal_metrics SET balance=0,peak=0 WHERE employee_id=1');service=installStockUnlocks(db);
 assert.deepEqual(service.status(1).unlockedLeverages,[1,3]);
 assert.doesNotThrow(()=>requireStockLeverage(service.status(1),3));
 assert.throws(()=>requireStockLeverage(service.status(1),10),{code:'LEVERAGE_LOCKED'});
 assert.deepEqual(service.status(2).unlockedLeverages,[1]);
});

test('quote capture counts margin and unrealized PnL, retaining 10x after a drawdown',t=>{
 const db=fixture(t),service=installStockUnlocks(db);
 db.exec("UPDATE personal_metrics SET balance=2300000,peak=2300000 WHERE employee_id=1;INSERT INTO stock_lots VALUES(1,'TEST',30000,2500000,3000000)");
 service.capture();assert.deepEqual(service.status(1).unlockedLeverages,[1,3]);
 db.exec("UPDATE stock_prices SET price=110 WHERE code='TEST'");service.capture();
 db.exec("UPDATE stock_prices SET price=60 WHERE code='TEST';UPDATE personal_metrics SET balance=0,peak=0 WHERE employee_id=1");
 assert.deepEqual(installStockUnlocks(db).status(1).unlockedLeverages,[1,3,10]);
 assert.doesNotThrow(()=>requireStockLeverage(service.status(1),10));
});

test('historical cash peaks and completed leveraged trades restore qualifications separately',t=>{
 const db=fixture(t);
 db.exec('UPDATE personal_metrics SET balance=0,peak=5000000 WHERE employee_id=1;INSERT INTO stock_trades VALUES(2,10)');
 const service=installStockUnlocks(db);service.capture();
 assert.deepEqual(service.status(1).unlockedLeverages,[1,3]);
 assert.deepEqual(service.status(2).unlockedLeverages,[1,3,10]);
 db.exec('UPDATE personal_metrics SET peak=5000001 WHERE employee_id=1');service.capture([1]);
 db.exec('UPDATE personal_metrics SET peak=0 WHERE employee_id=1');
 assert.deepEqual(service.status(1).unlockedLeverages,[1,3,10]);
});
