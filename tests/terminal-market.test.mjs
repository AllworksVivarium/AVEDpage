import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { installMarket } from '../server-market.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const timeContext={Intl,Date};
vm.runInNewContext(readFileSync(join(root,'public/terminal-time.js'),'utf8'),timeContext);
const time=timeContext.AVEDTime;

test('relative labels cross Shanghai midnight rather than waiting 24 hours',()=>{
  assert.equal(time.relative('2026-11-04 15:59:00',Date.parse('2026-11-04T16:01:00Z')),'昨天');
  assert.equal(time.relative('2026-11-04T16:00:00Z',Date.parse('2026-11-04T16:01:00Z')),'今天');
  assert.equal(time.relative('2026-11-02T16:00:00Z',Date.parse('2026-11-04T16:01:00Z')),'前天');
  assert.equal(time.relative('2026-11-04T23:00:00+08:00',Date.parse('2026-11-04T16:01:00Z')),'昨天');
  assert.equal(time.clock('2026-11-04 16:01:00'),'00:01');
  assert.equal(time.relative('not a date'),'记录待核');
});

test('audit snapshots display relative labels without altering ordinary text',()=>{
  const value=time.sanitize({created_at:'2026-11-04 15:59:00',body:'archive note'});
  assert.doesNotMatch(value.created_at,/\d{4}-\d{2}-\d{2}/);
  assert.equal(value.body,'archive note');
});

test('candles preserve OHLC, aggregate periods and survive reinstallation',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE stock_prices(code TEXT PRIMARY KEY,name TEXT,price INTEGER,change REAL,tick INTEGER);
    CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER,cost_basis INTEGER DEFAULT 0,position_notional INTEGER DEFAULT 0,margin_used INTEGER DEFAULT 0,realized_pnl INTEGER DEFAULT 0,stop_loss INTEGER,take_profit INTEGER);
    INSERT INTO stock_prices VALUES('TEST.A','甲',2000,0,0),('TEST.B','乙',4000,0,0);`);
  let at=Date.parse('2026-11-04T12:00:00Z');
  const market=installMarket(db,{clock:()=>at,automatic:false});
  assert.equal(market.history('TEST.A').candles.length,1,'do not fabricate a past chart');
  const before=db.prepare('SELECT * FROM stock_candles ORDER BY code,bucket').all();
  market.items(1);market.history('TEST.A');
  assert.deepEqual(db.prepare('SELECT * FROM stock_candles ORDER BY code,bucket').all(),before,'reads within a quote interval cannot reroll prices');
  for(let i=0;i<25;i++){at+=5000;market.advance();}
  const bars=market.history('TEST.A').candles;
  assert.equal(bars.length,3);
  for(const c of bars){assert.ok(c.high>=Math.max(c.open,c.close));assert.ok(c.low<=Math.min(c.open,c.close));}
  market.trade('TEST.A',3,bars.at(-1).close);
  const grouped=market.history('TEST.A',5).candles[0];
  assert.equal(grouped.open,bars[0].open);
  assert.equal(grouped.close,bars.at(-1).close);
  assert.equal(grouped.high,Math.max(...bars.map(c=>c.high)));
  assert.equal(grouped.low,Math.min(...bars.map(c=>c.low)));
  assert.equal(grouped.volume,3);
  const stored=market.history('TEST.A');market.close();
  const reopened=installMarket(db,{clock:()=>at,automatic:false});
  assert.deepEqual(reopened.history('TEST.A'),stored);
  assert.throws(()=>reopened.history('TEST.A',7),/周期/);
  reopened.close();db.close();
});

test('items fallback to latest open-trade leverage when legacy holdings lack leverage fields',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE stock_prices(code TEXT PRIMARY KEY,name TEXT,price INTEGER,change REAL,tick INTEGER);
    CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER,cost_basis INTEGER DEFAULT 0,position_notional INTEGER DEFAULT 0,margin_used INTEGER DEFAULT 0,realized_pnl INTEGER DEFAULT 0,stop_loss INTEGER,take_profit INTEGER);
    CREATE TABLE stock_trades(id INTEGER PRIMARY KEY,employee_id INTEGER,code TEXT,action TEXT,quantity INTEGER,price INTEGER,amount INTEGER,leverage INTEGER,holding_before INTEGER,holding_after INTEGER,cost_before INTEGER,cost_after INTEGER,realized_pnl_change INTEGER,balance_after INTEGER,created_at TEXT);
    INSERT INTO stock_prices VALUES('TEST.A','甲',497,0,0);
    INSERT INTO stock_holdings(employee_id,code,quantity,cost_basis,position_notional,margin_used,realized_pnl) VALUES(1,'TEST.A',10,4990,0,0,0);
    INSERT INTO stock_trades(employee_id,code,action,quantity,price,amount,leverage,holding_before,holding_after,cost_before,cost_after,realized_pnl_change,balance_after,created_at)
    VALUES(1,'TEST.A','buy',10,499,4990,10,0,10,0,4990,0,0,CURRENT_TIMESTAMP);`);
  const market=installMarket(db,{automatic:false,clock:()=>Date.parse('2026-11-04T12:00:00Z')});
  const row=market.items(1).find(item=>item.code==='TEST.A');
  assert.ok(row);
  assert.equal(row.holding,10);
  assert.equal(row.effectiveLeverage,10);
  market.close();
  db.close();
});

test('sidebar control is above directory, footer removed, credential storage is browser managed',()=>{
  const html=readFileSync(join(root,'public/player-terminal.html'),'utf8');
  const js=readFileSync(join(root,'public/player.js'),'utf8');
  const sidebar=html.slice(html.indexOf('<aside id="left-sidebar"'),html.indexOf('</aside>')+8);
  assert.ok(sidebar.indexOf('id="sidebar-toggle-btn"')>=0);
  assert.ok(sidebar.indexOf('id="sidebar-toggle-btn"')<sidebar.indexOf('TERMINAL DIRECTORY'));
  assert.equal((html.match(/id="sidebar-toggle-btn"/g)||[]).length,1);
  assert.doesNotMatch(html,/sidebar-collapse-footer-btn|医疗部已实装|点击查阅红头全文|参考宣发/);
  assert.match(js,/navigator\.credentials\.store/);
  assert.doesNotMatch(js,/localStorage\.setItem\([^\n]*(?:password|aved_remembered_cred)/);
  assert.ok(js.indexOf("signalPhase('欢迎回到公司',12")<js.indexOf('const authenticated=await apiLogin'));
});

test('containment glitch masks part of a name and restores it quickly',()=>{
  const source=readFileSync(join(root,'public/player.js'),'utf8');
  const start=source.indexOf('      function triggerScpTitleRedactionGlitch() {');
  const end=source.indexOf('      function renderScpArchives()',start);
  const attributes={'data-orig-title':'WY-001 · 咖啡机','data-scp-name':'咖啡机'};
  const element={textContent:'WY-001 · 咖啡机',getAttribute:k=>attributes[k],setAttribute:(k,v)=>{attributes[k]=v;}};
  let restore,delay;
  const context={prefersReducedMotion:false,Math,document:{body:{classList:{contains:()=>false}},querySelectorAll:()=>[element]},clearTimeout(){},setTimeout(fn,ms){restore=fn;delay=ms;return 1;}};
  const module={exports:{}};vm.runInNewContext(readFileSync(join(root,'public/archive-board.js'),'utf8'),{module});
  context.AVEDArchiveBoard={glitch:options=>module.exports.glitch({...options,random:()=>0,setTimer:context.setTimeout,clearTimer:context.clearTimeout})};
  vm.runInNewContext(source.slice(start,end)+'triggerScpTitleRedactionGlitch();',context);
  assert.match(element.textContent,/^WY-001 · /);
  assert.match(element.textContent,/■/);
  assert.notEqual(element.textContent,'WY-001 · ■■■');
  assert.ok(delay<=100);
  restore();assert.equal(element.textContent,'WY-001 · 咖啡机');
  context.document.body.classList.contains=()=>true;
  vm.runInNewContext('triggerScpTitleRedactionGlitch();',context);
  assert.equal(element.textContent,'WY-001 · 咖啡机');
});

test('live API uses database login, server-priced trades and persistent quantities',async t=>{
  const folder=mkdtempSync(join(tmpdir(),'aved-verify-'));
  const port=await new Promise(resolve=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});});
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',COOKIE_SECURE:'false',SESSION_SECRET:'test-only-session-secret-not-for-production',BOOTSTRAP_ADMIN_USERNAME:'review-admin',BOOTSTRAP_ADMIN_NAME:'核验员',BOOTSTRAP_ADMIN_PASSWORD:'review-password-123'},stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',data=>{errors+=data;});child.stdout.resume();
  t.after(async()=>{const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));rmSync(folder,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+port;let ready=false;
  for(let i=0;i<80;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,errors);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'review-admin',password:'review-password-123'})});
  assert.equal(login.status,200);assert.equal((await login.json()).employee.displayName,'核验员');
  const cookie=login.headers.get('set-cookie').split(';')[0];
  async function api(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
  assert.equal((await fetch(base+'/api/player/state')).status,401);
  const added=await api('/api/admin/employees',{username:'review-player',displayName:'档案员',password:'player123',initialBalance:10000000});assert.equal(added.status,201);
  const employeeLogin=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'档案员',password:'player123'})});
  assert.equal(employeeLogin.status,200);const playerCookie=employeeLogin.headers.get('set-cookie').split(';')[0];
  async function player(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie:playerCookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
  const notice=await api('/api/admin/announcements',{title:'署名核验',body:'公告正文。',issuer:'收容部',drafter:'值班员',issuedOn:'2026-11-07',pinned:true});
  assert.equal(notice.status,201);
  const noticeState=(await player('/api/player/state')).data.announcements.find(n=>n.id===notice.data.id);
  assert.equal(noticeState.issuer,'收容部');assert.equal(noticeState.drafter,'值班员');assert.equal(noticeState.issuedOn,'2026-11-07');assert.equal(noticeState.postCount,0);
  assert.equal((await player('/api/posts',{announcementId:notice.data.id,body:'核验留言'})).status,201);
  const noticeComments=(await player('/api/posts?announcementId='+notice.data.id)).data.items;
  const noticeCount=(await player('/api/player/state')).data.announcements.find(n=>n.id===notice.data.id).postCount;
  assert.equal(noticeCount,noticeComments.length);assert.equal(noticeCount,1);
  assert.equal((await api('/api/admin/announcements',{title:'日期核验',body:'正文',issuer:'收容部',issuedOn:'2026-02-30'})).status,400);
  const state=(await player('/api/player/state')).data;assert.ok(state.serverTime);assert.ok(state.market.candles.length);
  const index=state.stocks.find(s=>s.code==='KARMA');assert.ok(index);
  assert.equal(index.price,Math.round(state.market.index.price/100));
  const indexBuy=await player('/api/player/stocks',{code:'KARMA',intent:'open',side:'long',quantity:2,leverage:3,price:1});
  assert.equal(indexBuy.status,200);assert.equal(indexBuy.data.items.find(s=>s.code==='KARMA').holding,2);
  assert.equal(indexBuy.data.market.candles.at(-1).volume,2);
  assert.ok(indexBuy.data.market.candles.at(-1).close>100000,'index candles retain their quote units');
  const hedge=await player('/api/player/stocks',{code:'KARMA',intent:'open',side:'short',quantity:2,leverage:10});
  assert.equal(hedge.status,200);const both=hedge.data.items.find(s=>s.code==='KARMA');
  assert.equal(both.holding,0);assert.equal(both.longHolding,2);assert.equal(both.shortHolding,2);assert.equal(both.side,'hedged');
  assert.equal(both.lots.length,2);assert.equal(both.marginUsed,both.lots.reduce((n,l)=>n+l.marginUsed,0));
  assert.equal(both.unrealizedPnl,both.lots.reduce((n,l)=>n+l.unrealizedPnl,0));
  assert.equal((await player('/api/player/stocks',{code:'KARMA',intent:'close',quantity:1})).status,400,'ambiguous hedge closure must select a lot');
  const shortLot=both.lots.find(l=>l.holding<0);
  const shortExit=await player('/api/player/stocks',{code:'KARMA',intent:'close',quantity:2,lotId:shortLot.id});
  assert.equal(shortExit.status,200);assert.equal(shortExit.data.items.find(s=>s.code==='KARMA').holding,2);
  const stats=(await player('/api/player/stocks/history')).data;
  assert.equal(stats.summary.closedCount,1);assert.equal(stats.items[0].closing,1);assert.equal(stats.items[0].positionSide,'short');
  assert.equal(stats.items.find(t=>t.id===stats.items[0].id-1).closing,0,'opening a hedge is an opening trade');
  assert.equal((await player('/api/player/stocks',{code:'KARMA',intent:'close',quantity:3})).status,400);
  const indexClose=await player('/api/player/stocks',{code:'KARMA',intent:'close',side:'long',quantity:2,stopLoss:1});
  assert.equal(indexClose.status,200);assert.equal(indexClose.data.items.find(s=>s.code==='KARMA').holding,0);
  assert.equal(indexClose.data.balance,10000000,'closing uses server position direction and releases margin');
  for(const side of ['long','short']){
    const before=(await player('/api/me')).data.balance;
    const opened=await player('/api/player/stocks',{code:'KARMA',intent:'open',side,quantity:2,leverage:1,price:1});
    assert.equal(opened.status,200);
    const position=opened.data.items.find(s=>s.code==='KARMA');
    assert.equal(position.holding,side==='long'?2:-2);
    assert.equal(position.marginUsed,position.positionNotional,'1x reserves the full server-priced notional');
    assert.equal(position.effectiveLeverage,1);
    assert.equal(opened.data.balance,before-position.marginUsed);
    const closed=await player('/api/player/stocks',{code:'KARMA',intent:'close',quantity:2,leverage:1});
    assert.equal(closed.status,200);
    const exit=closed.data.items.find(s=>s.code==='KARMA');
    const pnl=(side==='long'?1:-1)*(exit.price*2-position.positionNotional);
    assert.equal(closed.data.balance,before+pnl,'1x returns all margin and settles the actual long/short PnL');
    assert.equal(exit.holding,0);assert.equal(exit.marginUsed,0);
  }
  const unsupported=await player('/api/player/stocks',{code:'KARMA',intent:'open',side:'long',quantity:1,leverage:2});
  assert.equal(unsupported.status,400);
  const code=state.stocks[0].code;
  const buy=await player('/api/player/stocks?code='+code,{code,action:'buy',quantity:3,leverage:10,price:1,seed:'client-injected'});
  assert.equal(buy.status,200);const stock=buy.data.items.find(s=>s.code===code);
  const expectedNotional=stock.price*3;
  const expectedMargin=Math.ceil(expectedNotional/10);
  assert.equal(stock.holding,3);
  assert.equal(buy.data.balance,10000000-expectedMargin);
  assert.equal(stock.positionNotional,expectedNotional);
  assert.equal(stock.costBasis,expectedMargin);
  assert.equal(stock.marginUsed,expectedMargin);
  assert.ok(stock.effectiveLeverage>=9&&stock.effectiveLeverage<=10);
  assert.equal(stock.avgCost,stock.price);
  assert.equal(buy.data.market.candles.at(-1).volume,3);
  const rejected=await player('/api/player/stocks',{code,action:'buy',quantity:-2});assert.equal(rejected.status,400);
  assert.equal((await player('/api/me')).data.balance,buy.data.balance);
  const sell=await player('/api/player/stocks?code='+code,{code,action:'sell',quantity:2});assert.equal(sell.status,200);
  const held=sell.data.items.find(s=>s.code===code);assert.equal(held.holding,1);
  assert.equal(held.positionNotional,Math.round(expectedNotional/3));
  assert.equal(held.costBasis,Math.round(expectedMargin/3));
  assert.equal(held.marginUsed,Math.round(expectedMargin/3));
  assert.ok(Number.isInteger(held.realizedPnl));
  assert.ok(Number.isInteger(sell.data.balance));
  const snapshot=new DatabaseSync(join(folder,'wanyehui.db'),{readOnly:true});
  const position=snapshot.prepare('SELECT quantity,cost_basis AS costBasis,position_notional AS positionNotional,margin_used AS marginUsed,realized_pnl AS realizedPnl FROM stock_holdings WHERE code=?').get(code);
  assert.equal(position.quantity,1);
  assert.equal(position.costBasis,held.costBasis);
  assert.equal(position.positionNotional,held.positionNotional);
  assert.equal(position.marginUsed,held.marginUsed);
  assert.equal(position.realizedPnl,held.realizedPnl);
  assert.equal(snapshot.prepare('SELECT COUNT(*) AS n FROM stock_trades WHERE code=?').get(code).n,2);
  const trades=snapshot.prepare('SELECT action,quantity,leverage,holding_before AS before,holding_after AS after FROM stock_trades WHERE code=? ORDER BY id').all(code);
  assert.deepEqual(trades.map(t=>({action:t.action,quantity:t.quantity,leverage:t.leverage})),[
    {action:'buy',quantity:3,leverage:10},
    {action:'sell',quantity:2,leverage:10}
  ]);
  assert.equal(trades[0].before,0);
  assert.equal(trades[0].after,3);
  assert.equal(trades[1].before,3);
  assert.equal(trades[1].after,1);
  assert.ok(snapshot.prepare('SELECT COUNT(*) AS n FROM stock_candles').get().n>=4);snapshot.close();
  const funded=await api('/api/admin/employees',{username:'large-order-player',displayName:'大额委托核验',password:'player123',initialBalance:100000000});assert.equal(funded.status,201);
  const fundedLogin=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'large-order-player',password:'player123'})});const fundedCookie=fundedLogin.headers.get('set-cookie').split(';')[0];
  async function large(body){const r=await fetch(base+'/api/player/stocks',{method:'POST',headers:{cookie:fundedCookie,origin:base,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
  const cheap=[...state.stocks].filter(s=>s.code!=='KARMA').sort((a,b)=>a.price-b.price)[0].code;
  const openedLarge=await large({code:cheap,intent:'open',side:'long',quantity:1000001,leverage:10});assert.equal(openedLarge.status,200,JSON.stringify(openedLarge.data));assert.equal(openedLarge.data.items.find(s=>s.code===cheap).holding,1000001);
  const closedLarge=await large({code:cheap,intent:'close',quantity:1000001});assert.equal(closedLarge.status,200);assert.equal(closedLarge.data.items.find(s=>s.code===cheap).holding,0);
  assert.equal((await large({code:cheap,quantity:1.5})).status,400);
  assert.equal((await large({code:cheap,quantity:Number.MAX_SAFE_INTEGER})).status,400);
  const pendingLarge=await large({code:cheap,orderType:'limit',side:'long',quantity:10001,limitPrice:1});assert.equal(pendingLarge.status,200);assert.ok(pendingLarge.data.orders.some(o=>o.quantity===10001));
  // Controlled quotes in this disposable test database exercise independent fill settlement.
  const quotes=new DatabaseSync(join(folder,'wanyehui.db'));
  const price=n=>{quotes.prepare('UPDATE stock_prices SET price=? WHERE code=?').run(n,cheap);quotes.prepare('UPDATE stock_quote_clock SET quoted_at=? WHERE id=1').run(Date.now()+60000);};
  price(100);
  const one=await large({code:cheap,intent:'open',side:'long',quantity:10,leverage:1});assert.equal(one.status,200);
  const first=one.data.items.find(s=>s.code===cheap).lots[0];
  price(150);
  const ten=await large({code:cheap,intent:'open',side:'long',quantity:10,leverage:10});assert.equal(ten.status,200);
  const lots=ten.data.items.find(s=>s.code===cheap).lots;assert.equal(lots.length,2);
  const second=lots.find(l=>l.id!==first.id);assert.equal(second.leverage,10);assert.equal(second.avgCost,150);assert.equal(first.avgCost,100);
  assert.equal((await player('/api/player/stocks',{code:cheap,intent:'close',lotId:second.id,quantity:1})).status,400,'foreign lot cannot be closed');
  price(160);
  const closedSecond=await large({code:cheap,intent:'close',lotId:second.id,quantity:10});assert.equal(closedSecond.status,200);
  assert.equal(closedSecond.data.balance,ten.data.balance+150+100);
  assert.equal(closedSecond.data.items.find(s=>s.code===cheap).lots[0].id,first.id);
  assert.equal((await large({code:cheap,intent:'close',lotId:second.id,quantity:10})).status,400,'repeat closing cannot release money twice');
  price(150);
  const stopped=await large({code:cheap,intent:'open',side:'long',quantity:10,leverage:10,stopLoss:140});assert.equal(stopped.status,200);
  price(130);
  const stopResult=await large({action:'cancelOrder',orderId:pendingLarge.data.orders[0].id});assert.equal(stopResult.status,200);
  const afterStop=stopResult.data.items.find(s=>s.code===cheap).lots;assert.equal(afterStop.length,1);assert.equal(afterStop[0].id,first.id);
  assert.equal(stopResult.data.balance,stopped.data.balance+150-200,'only triggered lot releases its margin and loss');
  const records=await fetch(base+'/api/player/stocks/history',{headers:{cookie:fundedCookie}});assert.equal(records.status,200);const history=await records.json();
  assert.ok(history.items.some(t=>t.closing&&t.leverage===10&&t.pnl===-200));assert.ok(history.items.some(t=>t.closing&&t.leverage===10&&t.pnl===100));
  assert.ok(history.summary.closedCount>=3);assert.ok(history.summary.wins>=1);
  price(130);
  const hedgeOrder=await large({code:cheap,orderType:'limit',side:'short',quantity:10,leverage:10,limitPrice:120,stopLoss:145});assert.equal(hedgeOrder.status,200);
  const hedged=hedgeOrder.data.items.find(s=>s.code===cheap);assert.equal(hedged.longHolding,10);assert.equal(hedged.shortHolding,10);assert.equal(hedged.holding,0);assert.equal(hedged.lots.length,2);assert.equal(hedged.marginUsed,1130);assert.equal(hedged.unrealizedPnl,300);
  price(150);
  const hedgeResponse=await fetch(base+'/api/player/stocks',{headers:{cookie:fundedCookie}});assert.equal(hedgeResponse.status,200);const hedgeStopped=await hedgeResponse.json();
  const remainingHedge=hedgeStopped.items.find(s=>s.code===cheap);assert.equal(remainingHedge.lots.length,1);assert.equal(remainingHedge.lots[0].id,first.id);assert.equal(remainingHedge.marginUsed,1000);assert.equal(remainingHedge.unrealizedPnl,500);
  assert.equal(hedgeStopped.balance,hedgeOrder.data.balance+130-200,'short stop closes only its own leg even when net holding was zero');
  // Qualification is checked server-side and cannot be supplied by the client.
  const gated=await api('/api/admin/employees',{username:'gate-player',displayName:'门槛测试',password:'player123',initialBalance:1000000});assert.equal(gated.status,201);
  const gateLogin=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'gate-player',password:'player123'})});const gateCookie=gateLogin.headers.get('set-cookie').split(';')[0];
  const rejectedLeverage=await fetch(base+'/api/player/stocks',{method:'POST',headers:{cookie:gateCookie,origin:base,'content-type':'application/json'},body:JSON.stringify({code:cheap,intent:'open',side:'long',quantity:1,leverage:3,balance:99999999})});assert.equal(rejectedLeverage.status,400);
  const rejectedLimit=await fetch(base+'/api/player/stocks',{method:'POST',headers:{cookie:gateCookie,origin:base,'content-type':'application/json'},body:JSON.stringify({code:cheap,orderType:'limit',side:'long',quantity:1,leverage:10,limitPrice:1})});assert.equal(rejectedLimit.status,400);
  // No player requests are made after the adverse quote: the existing market tick liquidates offline positions.
  price(150);const exposed=await large({code:cheap,intent:'open',side:'long',quantity:10,leverage:10});assert.equal(exposed.status,200);const exposedLot=exposed.data.items.find(s=>s.code===cheap).lots.find(l=>l.leverage===10);
  assert.equal(exposedLot.liquidationPrice,138);assert.equal(exposedLot.positionEquity,150);
  const liquidationAfter=quotes.prepare('SELECT MAX(id) id FROM stock_trades').get().id;
  price(136);quotes.prepare('UPDATE stock_quote_clock SET quoted_at=0').run();
  let liquidation;for(let n=0;n<120;n++){liquidation=quotes.prepare("SELECT price,realized_pnl_change AS pnl,balance_after AS balance FROM stock_trades WHERE employee_id=? AND code=? AND close_reason='强制平仓' AND id>? ORDER BY id DESC LIMIT 1").get(funded.data.id,cheap,liquidationAfter);if(liquidation)break;await new Promise(r=>setTimeout(r,50));}
  assert.ok(liquidation,'offline leveraged position must be forcibly settled on the server quote timer');
  assert.equal(liquidation.pnl,10*liquidation.price-1500);assert.equal(liquidation.balance,exposed.data.balance+150+liquidation.pnl);
  assert.equal(quotes.prepare('SELECT quantity FROM stock_lots WHERE id=?').get(exposedLot.id).quantity,0);
  assert.equal(quotes.prepare("SELECT COUNT(*) n FROM stock_trades WHERE employee_id=? AND close_reason='强制平仓' AND id>?").get(funded.data.id,liquidationAfter).n,1);
  assert.ok(quotes.prepare('SELECT quantity FROM stock_lots WHERE id=?').get(first.id).quantity>0,'cash long remains open');
  // A pending leveraged order loses eligibility if available balance falls before fill; old holdings remain closable.
  price(136);const pendingGate=await large({code:cheap,orderType:'limit',side:'long',quantity:1,leverage:10,limitPrice:130});assert.equal(pendingGate.status,200);
  const gateOrder=pendingGate.data.orders.find(o=>o.limitPrice===130);assert.ok(gateOrder);
  assert.equal((await api('/api/admin/employees/'+funded.data.id+'/balance',{balance:5000000,expectedBalance:pendingGate.data.balance,reason:'测试成交门槛'})).status,200);
  price(120);const pendingCheck=await fetch(base+'/api/player/stocks',{headers:{cookie:fundedCookie}});assert.equal(pendingCheck.status,200);const gateChecked=await pendingCheck.json();
  assert.equal(gateChecked.orders.some(o=>o.id===gateOrder.id),false);assert.equal(quotes.prepare('SELECT status FROM stock_orders WHERE id=?').get(gateOrder.id).status,'cancelled');
  assert.equal(gateChecked.balance,5000000);
  assert.equal((await api('/api/admin/employees/'+funded.data.id+'/balance',{balance:1000000,expectedBalance:5000000,reason:'测试旧仓平仓'})).status,200);
  const belowGateClose=await large({code:cheap,intent:'close',lotId:first.id,quantity:10,leverage:10});assert.equal(belowGateClose.status,200,'closing an existing lot never requires leverage qualification');
  assert.equal(belowGateClose.data.balance,1000000+1000+200);
  quotes.close();


});

test('index mirrors equally weighted constituent returns and accepts future listings without self-weighting',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE stock_prices(code TEXT PRIMARY KEY,name TEXT,price INTEGER,change REAL,tick INTEGER);
 CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER,cost_basis INTEGER DEFAULT 0,realized_pnl INTEGER DEFAULT 0);
 INSERT INTO stock_prices VALUES('A','甲',1000,0,0),('B','乙',2000,0,0);`);
 let at=Date.parse('2026-11-07T12:00:00Z');const market=installMarket(db,{clock:()=>at,automatic:false});
 db.exec("UPDATE stock_market_bases SET price=1000 WHERE code='A';UPDATE stock_market_bases SET price=2000 WHERE code='B';UPDATE stock_prices SET price=1200 WHERE code='A';UPDATE stock_prices SET price=1800 WHERE code='B';UPDATE stock_prices SET price=1 WHERE code='KARMA'");
 assert.equal(market.history().index.price,1050000,'20% and -10% produce an equally weighted +5%');
 db.exec("INSERT INTO stock_prices VALUES('NEW','新增',3000,0,0)");at+=5000;market.advance();
 assert.ok(db.prepare("SELECT price FROM stock_market_bases WHERE code='NEW'").get());
 const rows=db.prepare("SELECT s.price,b.price AS base FROM stock_prices s JOIN stock_market_bases b ON b.code=s.code WHERE s.code<>'KARMA'").all();
 const expected=Math.round(rows.reduce((sum,s)=>sum+s.price/s.base,0)/rows.length*1000000);
 assert.equal(market.history().index.price,expected);
 assert.equal(db.prepare("SELECT price FROM stock_prices WHERE code='KARMA'").get().price,Math.round(expected/100));
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stock_market_bases WHERE code='KARMA'").get().n,0);
 market.close();db.close();
});


test('low-priced shares continue generating real varying candles below the rounding threshold',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE stock_prices(code TEXT PRIMARY KEY,name TEXT,price INTEGER,change REAL,tick INTEGER); CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER); INSERT INTO stock_prices VALUES('LOW','Low price',83,0,0);");
  let at=Date.parse('2026-11-09T12:00:00Z');
  const market=installMarket(db,{clock:()=>at,automatic:false});
  for(let i=0;i<1200;i++){at+=5000;market.advance();}
  const bars=market.history('LOW').candles;
  assert.ok(bars.some(c=>c.high!==c.low),'integer rounding must not permanently freeze a low-priced share');
  assert.ok(bars.every(c=>Number.isInteger(c.close)&&c.low>=30));
  market.close();db.close();
});
