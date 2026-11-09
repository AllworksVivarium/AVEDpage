import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installMarketBulletins} from '../server-market-bulletins.mjs';
import {installMarket} from '../server-market.mjs';
function fixture(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE stock_prices(code TEXT PRIMARY KEY,name TEXT,price INTEGER,change REAL,tick INTEGER);INSERT INTO stock_prices VALUES('AVED.MEM','后勤部',2000,0,0);`);return db;}
test('shared bulletins persist across restart, decay, cap, expire, and expose no truth flags',()=>{
 const db=fixture(),news=installMarketBulletins(db,{random:()=>0}),at=1800000000000;news.advance(at);
 assert.ok(news.drift('AVED.MEM',at)>0);assert.equal(news.drift('AVED.VIV',at),0);
 assert.ok(news.drift('AVED.MEM',at+300000)<news.drift('AVED.MEM',at));
 assert.deepEqual(Object.keys(news.recent()[0]).sort(),['code','headline','id','publishedAt']);
 const restarted=installMarketBulletins(db,{random:()=>0});restarted.advance(at+1);assert.equal(restarted.recent().length,1);
 for(let i=1;i<6;i++)news.advance(at+i*120000);
 assert.ok(news.drift('AVED.MEM',at+600000)<=.0005);assert.equal(news.drift('AVED.MEM',at+1300000),0);
 db.close();
});
test('identical positive headlines can have zero influence and missed periods do not burst',()=>{
 const db=fixture();let i=0;const news=installMarketBulletins(db,{random:()=>[0,0,.99,0][i++%4]});const at=1800000000000;
 news.advance(at);assert.match(news.recent()[0].headline,/恢复/);assert.equal(news.drift('AVED.MEM',at),0);
 news.advance(at+86400000);assert.equal(news.recent().length,2);db.close();
});
test('wire sends one update every five minutes and avoids recently used copy',()=>{
 const db=fixture();let n=0;const news=installMarketBulletins(db,{random:()=>[0,0,.99][n++%3]}),at=1800000000000;
 news.advance(at);const first=news.recent()[0].headline;
 news.advance(at+299999);assert.equal(news.recent().length,1);
 news.advance(at+300000);assert.equal(news.recent().length,2);
 assert.notEqual(news.recent()[0].headline,first);
 assert.equal(db.prepare('SELECT next_at FROM market_bulletin_clock WHERE id=1').get().next_at,at+600000);
 db.prepare('UPDATE market_bulletin_clock SET next_at=? WHERE id=1').run(at+420000);
 const migrated=installMarketBulletins(db,{random:()=>0});
 assert.equal(db.prepare('SELECT next_at FROM market_bulletin_clock WHERE id=1').get().next_at,at+600000);
 migrated.advance(at+599999);assert.equal(migrated.recent().length,2);
 db.close();
});
test('trade markers are filtered by owner, symbol and visible time window',()=>{
 const db=fixture(),at=1800000000000;db.exec(`CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER,cost_basis INTEGER);CREATE TABLE stock_trades(id INTEGER PRIMARY KEY,employee_id INTEGER,code TEXT,action TEXT,quantity INTEGER,price INTEGER,holding_before INTEGER,holding_after INTEGER,created_at TEXT);`);
 const insert=db.prepare("INSERT INTO stock_trades VALUES(?,?,?,'buy',10,2000,0,10,datetime(?/1000,'unixepoch'))");
 insert.run(1,1,'AVED.MEM',at);insert.run(2,2,'AVED.MEM',at);insert.run(3,1,'KARMA',at);insert.run(4,1,'AVED.MEM',at-86400000);
 const market=installMarket(db,{clock:()=>at,automatic:false});assert.deepEqual(market.history('AVED.MEM',1,1).trades.map(t=>t.id),[1]);assert.equal(market.history('AVED.MEM',1).trades.length,0);market.close();db.close();
});
