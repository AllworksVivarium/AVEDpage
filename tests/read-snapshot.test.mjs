import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installMarket} from '../server-market.mjs';

export function marketFixture(install=installMarket){
 const raw=new DatabaseSync(':memory:');raw.exec(`CREATE TABLE stock_prices(code TEXT PRIMARY KEY,name TEXT,price INTEGER,change REAL,tick INTEGER);
 CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER,cost_basis INTEGER DEFAULT 0,position_notional INTEGER DEFAULT 0,margin_used INTEGER DEFAULT 0,realized_pnl INTEGER DEFAULT 0,stop_loss INTEGER,take_profit INTEGER);
 INSERT INTO stock_prices VALUES('TEST.A','甲',2000,0,0),('TEST.B','乙',4000,0,0);`);
 const calls=[];const db=new Proxy(raw,{get(target,key){if(key==='prepare')return sql=>{const statement=target.prepare(sql);return new Proxy(statement,{get(st,k){const member=Reflect.get(st,k,st);return typeof member==='function'?(...args)=>{calls.push({sql,method:k});return member.apply(st,args);}:member;}});};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 let at=Date.parse('2026-11-04T12:00:00Z');const market=install(db,{clock:()=>at,automatic:false});
 return {raw,calls,market,tick(ms=5000){at+=ms;},close(){market.close();raw.close();}};
}
test('sixty market readers share public candles without quote writes; returned data is isolated',()=>{
 const f=marketFixture();try{const before=f.market.history('TEST.A');f.calls.length=0;
 for(let i=0;i<60;i++){const value=f.market.history('TEST.A');assert.deepEqual(value,before);value.candles[0].close=-1;value.quote.price=-1;}
 assert.equal(f.calls.filter(c=>/stock_candles|stock_prices/.test(c.sql)).length,0);assert.equal(f.calls.filter(c=>c.method==='run').length,0);
 f.tick();f.market.advance();assert.notDeepEqual(f.market.history('TEST.A').candles,before.candles);
 }finally{f.close();}
});
test('trade volume, direct edits and rollback invalidate public snapshots without leaking uncommitted state',()=>{
 const f=marketFixture();try{const before=f.market.history('TEST.A'),price=before.quote.price;f.market.trade('TEST.A',3,price);assert.equal(f.market.history('TEST.A').candles.at(-1).volume,3);
 f.raw.prepare("UPDATE stock_prices SET price=price+100 WHERE code='TEST.A'").run();assert.equal(f.market.history('TEST.A').quote.price,price+100);
 const saved=f.market.history('TEST.A');f.raw.exec('BEGIN');f.market.trade('TEST.A',8,price);assert.equal(f.market.history('TEST.A').candles.at(-1).volume,11);f.raw.exec('ROLLBACK');assert.deepEqual(f.market.history('TEST.A'),saved);
 f.raw.exec('BEGIN');f.tick();f.market.advance();f.raw.exec('ROLLBACK');f.market.advance();assert.equal(f.raw.prepare('SELECT quoted_at FROM stock_quote_clock').get().quoted_at,Date.parse('2026-11-04T12:00:05Z'));
 }finally{f.close();}
});
