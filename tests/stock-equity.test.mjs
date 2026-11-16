import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stockEquityByEmployee} from '../server-stock-equity.mjs';

test('stock equity values long and short lots, retains negative equity and uses legacy holdings once',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  assert.equal(stockEquityByEmployee(db).size,0);
  db.exec(`CREATE TABLE stock_prices(code TEXT PRIMARY KEY,price INTEGER);
   INSERT INTO stock_prices VALUES('A',120);
   CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER,margin_used INTEGER,cost_basis INTEGER,position_notional INTEGER,leverage INTEGER);
   INSERT INTO stock_holdings VALUES(1,'A',10,0,1000,0,1);
   CREATE TABLE stock_lots(employee_id INTEGER,code TEXT,quantity INTEGER,margin_used INTEGER,position_notional INTEGER);
   CREATE TABLE stock_lot_migrations(name TEXT PRIMARY KEY);`);
  assert.deepEqual(stockEquityByEmployee(db).get(1),{margin:1000,unrealizedPnl:200,equity:1200});
  db.exec(`INSERT INTO stock_lot_migrations VALUES('lots-v1');
   INSERT INTO stock_lots VALUES(1,'A',10,1000,1000),(1,'A',-5,100,500),(2,'A',-10,100,1000),(3,'A',0,500,500);`);
  const rows=stockEquityByEmployee(db);
  assert.deepEqual(rows.get(1),{margin:1100,unrealizedPnl:100,equity:1200});
  assert.deepEqual(rows.get(2),{margin:100,unrealizedPnl:-200,equity:-100});
  assert.equal(rows.has(3),false);
  db.exec("UPDATE stock_prices SET price=80 WHERE code='A'");
  assert.deepEqual(stockEquityByEmployee(db).get(2),{margin:100,unrealizedPnl:200,equity:300});
 }finally{db.close();}
});
