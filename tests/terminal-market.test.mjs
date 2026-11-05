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
    CREATE TABLE stock_holdings(employee_id INTEGER,code TEXT,quantity INTEGER);
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
  const context={prefersReducedMotion:false,Math,document:{querySelectorAll:()=>[element]},clearTimeout(){},setTimeout(fn,ms){restore=fn;delay=ms;return 1;}};
  vm.runInNewContext(source.slice(start,end)+'triggerScpTitleRedactionGlitch();',context);
  assert.match(element.textContent,/^WY-001 · /);
  assert.match(element.textContent,/■/);
  assert.notEqual(element.textContent,'WY-001 · ■■■');
  assert.ok(delay<=100);
  restore();assert.equal(element.textContent,'WY-001 · 咖啡机');
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
  const added=await api('/api/admin/employees',{username:'review-player',displayName:'档案员',password:'player123',initialBalance:100000});assert.equal(added.status,201);
  const employeeLogin=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'档案员',password:'player123'})});
  assert.equal(employeeLogin.status,200);const playerCookie=employeeLogin.headers.get('set-cookie').split(';')[0];
  async function player(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie:playerCookie,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
  const state=(await player('/api/player/state')).data;assert.ok(state.serverTime);assert.ok(state.market.candles.length);
  const code=state.stocks[0].code;
  const buy=await player('/api/player/stocks?code='+code,{code,action:'buy',quantity:3,price:1,seed:'client-injected'});
  assert.equal(buy.status,200);const stock=buy.data.items.find(s=>s.code===code);
  assert.equal(stock.holding,3);assert.equal(buy.data.balance,100000-stock.price*3);
  assert.equal(buy.data.market.candles.at(-1).volume,3);
  const rejected=await player('/api/player/stocks',{code,action:'buy',quantity:-2});assert.equal(rejected.status,400);
  assert.equal((await player('/api/me')).data.balance,buy.data.balance);
  const sell=await player('/api/player/stocks?code='+code,{code,action:'sell',quantity:2});assert.equal(sell.status,200);
  const held=sell.data.items.find(s=>s.code===code);assert.equal(held.holding,1);
  assert.equal(sell.data.balance,buy.data.balance+held.price*2);
  const snapshot=new DatabaseSync(join(folder,'wanyehui.db'),{readOnly:true});
  assert.equal(snapshot.prepare('SELECT quantity FROM stock_holdings WHERE code=?').get(code).quantity,1);
  assert.ok(snapshot.prepare('SELECT COUNT(*) AS n FROM stock_candles').get().n>=4);snapshot.close();
});
