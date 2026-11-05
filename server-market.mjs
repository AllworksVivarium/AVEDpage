import { randomBytes, createHmac } from 'node:crypto';

// Every candle is built from recorded server quotes; the browser never invents OHLC data.
export function installMarket(db, {clock=()=>Date.now(), automatic=true}={}) {
  db.exec(`CREATE TABLE IF NOT EXISTS stock_candles(
    code TEXT NOT NULL,bucket INTEGER NOT NULL,open INTEGER NOT NULL,high INTEGER NOT NULL,
    low INTEGER NOT NULL,close INTEGER NOT NULL,volume INTEGER NOT NULL DEFAULT 0,
    turnover INTEGER NOT NULL DEFAULT 0,quote_seed TEXT NOT NULL DEFAULT '',PRIMARY KEY(code,bucket));
    CREATE TABLE IF NOT EXISTS stock_market_bases(code TEXT PRIMARY KEY,price INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_quote_clock(id INTEGER PRIMARY KEY CHECK(id=1),quoted_at INTEGER NOT NULL);
    INSERT OR IGNORE INTO stock_quote_clock VALUES(1,0);
    INSERT OR IGNORE INTO stock_market_bases SELECT code,price FROM stock_prices;`);
  const upsert=db.prepare(`INSERT INTO stock_candles(code,bucket,open,high,low,close,quote_seed) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(code,bucket) DO UPDATE SET high=MAX(high,excluded.high),low=MIN(low,excluded.low),close=excluded.close,quote_seed=excluded.quote_seed`);
  const bucketFor=t=>Math.floor(t/60000)*60000;
  function candle(code,open,close,seed,at) {
    upsert.run(code,bucketFor(at),open,Math.max(open,close),Math.min(open,close),close,seed);
  }
  function indexValue() {
    const list=db.prepare('SELECT s.price,b.price AS base FROM stock_prices s JOIN stock_market_bases b ON b.code=s.code').all();
    return list.length?Math.round(list.reduce((sum,s)=>sum+s.price/s.base,0)/list.length*1000000):1000000;
  }
  function advance(at=clock()) {
    if(at-db.prepare('SELECT quoted_at FROM stock_quote_clock WHERE id=1').get().quoted_at<5000)return;
    const owned=!db.isTransaction;
    if(owned)db.exec('BEGIN IMMEDIATE');
    try {
      const before=indexValue(),seed=randomBytes(32).toString('hex');
      for(const s of db.prepare('SELECT code,price FROM stock_prices').all()) {
        const roll=createHmac('sha256',Buffer.from(seed,'hex')).update(s.code).digest().readUInt32BE(0)/4294967296;
        const price=Math.max(300,Math.round(s.price*(1+(roll-.5)*.0036)));
        candle(s.code,s.price,price,seed,at);
        db.prepare('UPDATE stock_prices SET price=?,tick=? WHERE code=?').run(price,Math.floor(at/60000),s.code);
      }
      candle('KARMA',before,indexValue(),seed,at);
      db.prepare('UPDATE stock_quote_clock SET quoted_at=? WHERE id=1').run(at);
      if(owned)db.exec('COMMIT');
    } catch(error) {if(owned)db.exec('ROLLBACK');throw error;}
  }
  function quote(code) {
    const price=code==='KARMA'?indexValue():db.prepare('SELECT price FROM stock_prices WHERE code=?').get(code)?.price;
    if(price==null)throw new Error('证券代码不存在。');
    const start=Math.floor((clock()+28800000)/86400000)*86400000-28800000;
    const opening=db.prepare('SELECT open FROM stock_candles WHERE code=? AND bucket>=? ORDER BY bucket LIMIT 1').get(code,start)?.open||price;
    return {code,price,change:opening?Math.round((price/opening-1)*10000)/100:0};
  }
  function items(id) {
    advance();
    return db.prepare('SELECT s.code,s.name,s.price,COALESCE(h.quantity,0) AS holding FROM stock_prices s LEFT JOIN stock_holdings h ON h.code=s.code AND h.employee_id=?').all(id)
      .map(s=>({...s,change:quote(s.code).change}));
  }
  function history(code='KARMA',period=1) {
    if(![1,5,15].includes(period))throw new Error('行情周期无效。');
    advance();const q=quote(code),width=period*60000;
    const rows=db.prepare('SELECT bucket,open,high,low,close,volume,turnover FROM stock_candles WHERE code=? ORDER BY bucket DESC LIMIT ?').all(code,period*120).reverse();
    const grouped=[];
    for(const row of rows) {
      const bucket=Math.floor(row.bucket/width)*width,last=grouped.at(-1);
      if(last&&last.bucket===bucket){last.high=Math.max(last.high,row.high);last.low=Math.min(last.low,row.low);last.close=row.close;last.volume+=row.volume;last.turnover+=row.turnover;}
      else grouped.push({...row,bucket});
    }
    return {code,period,index:quote('KARMA'),quote:q,candles:grouped.slice(-60)};
  }
  function trade(code,quantity,price) {
    const volume=Math.abs(quantity),bucket=bucketFor(clock());
    candle(code,price,price,'',clock());candle('KARMA',indexValue(),indexValue(),'',clock());
    db.prepare('UPDATE stock_candles SET volume=volume+?,turnover=turnover+? WHERE code IN (?,?) AND bucket=?').run(volume,volume*price,code,'KARMA',bucket);
  }
  advance();
  const timer=automatic?setInterval(()=>{try{advance();}catch(error){console.error('Market quote failed:',error.message);}},5000):null;
  timer?.unref();
  return {advance,items,history,trade,close(){if(timer)clearInterval(timer);}};
}
