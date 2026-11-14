import {dossierView} from './server-dossier-content.mjs';
import {stockRiskRules,requireStockLeverage,stockPositionRisk,stockTradeFee} from './stock-risk.mjs';
import {stockFeeTotals} from './server-stock-fees.mjs';
import {installStockMargin} from './server-stock-margin.mjs';
import {installStockLots} from './server-stock-lots.mjs';
import {installForumList} from './server-forum-list.mjs';
import {radioVisibleSQL} from './server-radio-retention.mjs';
import {recordImageReview,checkImageVersion} from './server-image-archive.mjs';
import {installForumSocial,forumAuthorSQL,mapForumAuthor} from './server-forum-social.mjs';
import {installForumReplies} from './server-forum-replies.mjs';
import {createForumPresence} from './server-forum-presence.mjs';
import {mediaReference} from './server-media.mjs';
import {weighted,scratchPrizeMultipliers} from './server-economy.mjs';
import {spinSlot} from './server-slot.mjs';
import {directoryEmployees} from './server-directory.mjs';
import { installMarket } from './server-market.mjs';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { scratchTiers, scratchGameTypes, departmentsData, stocksData } from './server-content.mjs';
import { generateOutcomeTicket, settleGameTicket } from './server-ticket.mjs';
import {validateGameStake} from './game-stake-limits.mjs';


export function installPlayerService({db,send,readBody,requireEmployee,requireAdmin,balanceFor,recordLedger,publicProfile,today,sessionEmployee,getEconomy,getPersonal,getHighlights,getGameTax=()=>null}) {
  const chatStreams=new Map(),chatRequests=new WeakMap();let chatStatement;
  const chatItems=room=>(chatStatement??=db.prepare(`SELECT c.id,COALESCE(p.anonymous_name,c.alias) AS alias,c.body,c.created_at AS createdAt FROM chat_messages c LEFT JOIN profiles p ON p.employee_id=c.employee_id WHERE room=? AND c.deleted_at='' AND ${radioVisibleSQL} ORDER BY c.id DESC LIMIT 80`)).all(room).reverse();
  function emitChat(room){const payload='data: '+JSON.stringify({items:chatItems(room)})+'\n\n';for(const response of chatStreams.get(room)||[]){if(response.destroyed||response.writableLength>262144){response.destroy();chatStreams.get(room).delete(response);}else response.write(payload);}}
  // A shared heartbeat queries and serializes each radio room once, not once per listener.
  const chatHeartbeat=setInterval(()=>{for(const [room,clients] of chatStreams){try{for(const response of [...clients])if(!sessionEmployee(chatRequests.get(response))){clients.delete(response);response.end();}if(clients.size)emitChat(room);}catch(e){console.error('Radio heartbeat:',e.message);}}},20000);chatHeartbeat.unref();
  const addColumn=(table,name,definition)=>{
    if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  addColumn('announcements','recipient',"TEXT NOT NULL DEFAULT ''");
  addColumn('announcements','issuer',"TEXT NOT NULL DEFAULT ''");
  if(!db.prepare('PRAGMA table_info(announcements)').all().some(c=>c.name==='issuer_explicit')){
    addColumn('announcements','issuer_explicit','INTEGER NOT NULL DEFAULT 0');
    db.prepare("UPDATE announcements SET issuer_explicit=1 WHERE trim(issuer)<>'' AND issuer<>'万业携生'").run();
  }
  addColumn('announcements','drafter',"TEXT NOT NULL DEFAULT ''");
  addColumn('announcements','issued_on',"TEXT NOT NULL DEFAULT ''");
  for(const table of ['forum_threads','forum_replies']) {
    addColumn(table,'identity_mode',"TEXT NOT NULL DEFAULT 'anonymous'");
    addColumn(table,'image_data',"TEXT NOT NULL DEFAULT ''");
    addColumn(table,'moderation',"TEXT NOT NULL DEFAULT 'approved'");
  }
  const forumSocial=installForumSocial(db);
  const forumPresence=createForumPresence();
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs(id INTEGER PRIMARY KEY,employee_id INTEGER,username TEXT NOT NULL DEFAULT '',action TEXT NOT NULL,target TEXT NOT NULL DEFAULT '',details TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS earned_achievements(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,code TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,code));
    CREATE TABLE IF NOT EXISTS player_daily(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,day TEXT NOT NULL,action TEXT NOT NULL,PRIMARY KEY(employee_id,day,action));
    CREATE TABLE IF NOT EXISTS dossier_comments(id INTEGER PRIMARY KEY,dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,room TEXT NOT NULL,alias TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS player_rounds(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,game TEXT NOT NULL,state_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS stock_prices(code TEXT PRIMARY KEY,name TEXT NOT NULL,price INTEGER NOT NULL,change REAL NOT NULL DEFAULT 0,tick INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_holdings(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,code TEXT REFERENCES stock_prices(code),quantity INTEGER NOT NULL DEFAULT 0,cost_basis INTEGER NOT NULL DEFAULT 0,position_notional INTEGER NOT NULL DEFAULT 0,margin_used INTEGER NOT NULL DEFAULT 0,realized_pnl INTEGER NOT NULL DEFAULT 0,leverage INTEGER NOT NULL DEFAULT 0,stop_loss INTEGER,take_profit INTEGER,PRIMARY KEY(employee_id,code));
    CREATE TABLE IF NOT EXISTS stock_trades(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,code TEXT NOT NULL REFERENCES stock_prices(code),action TEXT NOT NULL CHECK (action IN ('buy','sell')),quantity INTEGER NOT NULL,price INTEGER NOT NULL,amount INTEGER NOT NULL,leverage INTEGER NOT NULL DEFAULT 1,holding_before INTEGER NOT NULL,holding_after INTEGER NOT NULL,cost_before INTEGER NOT NULL,cost_after INTEGER NOT NULL,realized_pnl_change INTEGER NOT NULL DEFAULT 0,balance_after INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS stock_trades_personal_chart ON stock_trades(employee_id,code,created_at DESC,id DESC);
    CREATE TABLE IF NOT EXISTS stock_orders(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,code TEXT NOT NULL REFERENCES stock_prices(code),side TEXT NOT NULL CHECK (side IN ('long','short')),quantity INTEGER NOT NULL,leverage INTEGER NOT NULL DEFAULT 3,limit_price INTEGER NOT NULL,stop_loss INTEGER,take_profit INTEGER,status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,filled_at TEXT NOT NULL DEFAULT '',filled_price INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS company_departments(code TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,motto TEXT NOT NULL);
  `);
  addColumn('stock_holdings','cost_basis','INTEGER NOT NULL DEFAULT 0');
  addColumn('stock_holdings','position_notional','INTEGER NOT NULL DEFAULT 0');
  addColumn('stock_holdings','margin_used','INTEGER NOT NULL DEFAULT 0');
  addColumn('stock_holdings','realized_pnl','INTEGER NOT NULL DEFAULT 0');
  addColumn('stock_holdings','leverage','INTEGER NOT NULL DEFAULT 0');
  addColumn('stock_holdings','stop_loss','INTEGER');
  addColumn('stock_holdings','take_profit','INTEGER');
  addColumn('stock_orders','leverage','INTEGER NOT NULL DEFAULT 3');
  addColumn('stock_trades','leverage','INTEGER NOT NULL DEFAULT 1');
  try {
    db.exec(`UPDATE stock_holdings
      SET leverage=COALESCE((
        SELECT t.leverage FROM stock_trades t
        WHERE t.employee_id=stock_holdings.employee_id AND t.code=stock_holdings.code AND t.holding_after<>0
        ORDER BY t.id DESC LIMIT 1
      ),leverage)
      WHERE quantity<>0 AND COALESCE(leverage,0)<=0;`);
  } catch {}
  const log=()=>{}; // Result-only database triggers own activity records.
  // Database snapshots survive deletion of the original account or post. Passwords and session tokens are excluded.
  for(const table of ['employees','profiles','balance_ledger','checkins','game_tickets','forum_threads','forum_replies','posts','dossiers','announcements','dossier_comments','chat_messages','stock_holdings']) {
    const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name).filter(n=>!['password_hash','seed'].includes(n));
    for(const action of ['INSERT','UPDATE','DELETE']) {
      db.exec(`DROP TRIGGER IF EXISTS audit_${table}_${action}`);
      if(action!=='INSERT'||!['balance_ledger','forum_threads','forum_replies','posts','dossier_comments','chat_messages'].includes(table))continue;
      const row=action==='DELETE'?'OLD':'NEW';
      const who=table==='employees'?`${row}.id`:columns.includes('employee_id')?`${row}.employee_id`:'NULL';
      const snapshot=columns.flatMap(n=>[`'${n}'`,`${row}.${n}`]).join(',');
      db.exec(`CREATE TRIGGER IF NOT EXISTS audit_${table}_${action} AFTER ${action} ON ${table} BEGIN
        INSERT INTO activity_logs(employee_id,username,action,target,details) VALUES(${who},COALESCE((SELECT username FROM employees WHERE id=${who}),''),'${action.toLowerCase()}','${table}',json_object(${snapshot})); END;`);
    }
  }
  db.exec(`CREATE TRIGGER IF NOT EXISTS activity_results_only BEFORE INSERT ON activity_logs
    WHEN NEW.action <> 'insert' OR NEW.target NOT IN ('balance_ledger','forum_threads','forum_replies','posts','dossier_comments','chat_messages')
    BEGIN SELECT RAISE(IGNORE); END;`);
  const award=()=>{}; // Ledger and settlement triggers award achievements atomically.
  for(const d of departmentsData)db.prepare('INSERT OR IGNORE INTO company_departments(code,name,description,motto) VALUES(?,?,?,?)').run(d.code,d.name,d.desc,d.motto);
  const oldMottos=['以绝对理性构筑牢笼，将不可名状封入几何。', '先于黎明封锁，隐于白雾歼灭。', '秩序始于配给，稳定源于细节。', '解析异常法则，重构现实边界。', '修补躯壳之伤，锚定理智之弦。'];for(let i=0;i<departmentsData.length;i++)db.prepare('UPDATE company_departments SET motto=? WHERE code=? AND motto=?').run(departmentsData[i].motto,departmentsData[i].code,oldMottos[i]);
  for(const s of stocksData)db.prepare('INSERT OR IGNORE INTO stock_prices(code,name,price,tick) VALUES(?,?,?,?)').run(s.code,s.name,s.price,Math.floor(Date.now()/60000));
  if(!db.prepare("SELECT 1 FROM content_initializations WHERE name='aved-007'").get()){
  db.prepare('INSERT OR IGNORE INTO dossiers(code,title,department,status,summary) VALUES(?,?,?,?,?)').run('AVED-007','法棍','收容部','观察中','法棍是一只法斗，当前列入观察序列。');
    db.prepare("INSERT INTO content_initializations VALUES('aved-007')").run();
  }
  for(const [code,name] of [['AVED.VIV','收容部'],['AVED.ANC','武装部'],['AVED.MEM','后勤部'],['AVED.RES','科研部'],['AVED.MED','医疗部']]){db.prepare('INSERT OR IGNORE INTO stock_prices(code,name,price,tick) VALUES(?,?,3200,?)').run(code,name,Math.floor(Date.now()/60000));db.prepare('UPDATE stock_prices SET name=? WHERE code=?').run(name,code);}
  const valid=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=n;
  const image=s=>{if(!s)return '';if(typeof s!=='string'||s.length>2200000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s))throw new Error('图片请使用不超过 1.5 MB 的 PNG、JPG 或 WEBP。');return s;};
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
  function rng(seed) {let counter=0;return ()=>createHmac('sha256',Buffer.from(seed,'hex')).update(String(counter++)).digest().readUInt32BE(0)/4294967296;}
  const random=()=>{const seed=randomBytes(32).toString('hex');return {seed,seedHash:createHash('sha256').update(seed).digest('hex'),random:rng(seed)};};
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS scratch_request_once ON game_tickets(employee_id,json_extract(result_json,'$.requestKey')) WHERE game='scratch' AND json_extract(result_json,'$.requestKey') IS NOT NULL");
  function settledScratch(id,key){const row=db.prepare("SELECT * FROM game_tickets WHERE employee_id=? AND game='scratch' AND json_extract(result_json,'$.requestKey')=?").get(id,key);return row?{ticketId:row.id,cost:row.cost,prize:row.prize,penalty:JSON.parse(row.result_json).penalty||0,tax:JSON.parse(row.result_json).tax||0,balance:balanceFor(id),result:JSON.parse(row.result_json),seed:row.seed,seedHash:row.seed_hash,gameHighlight:getHighlights().event(id,row.id)}:null;}
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS slot_request_once ON game_tickets(employee_id,json_extract(result_json,'$.requestKey')) WHERE game='slot' AND json_extract(result_json,'$.requestKey') IS NOT NULL");
  const settle=(id,game,cost,prize,result,proof)=>settleGameTicket({db,transaction,balanceFor,recordLedger,award,getHighlights,gameTax:getGameTax()},id,game,cost,prize,result,proof);
  const bet=validateGameStake;
  // Only replace the exact system-generated starter copy; preserve authored notices.
  db.prepare('UPDATE announcements SET body=? WHERE title=? AND body=?').run('公司内部通讯已接通。请各部门员工核验个人档案，查阅通告，并依权限使用各项设施。','员工终端已启用','这里发布的公告会保存在服务器数据库中。员工可以在公告下方匿名留言。');
  db.prepare('UPDATE dossiers SET summary=? WHERE code=? AND summary=?').run('卷宗待核。','WY-002','档案内容由管理人员录入。');
  db.prepare('UPDATE dossiers SET summary=? WHERE code=? AND summary=?').run('法棍是一只法斗，当前列入观察序列。','AVED-007','法棍是一只法斗。具体收容措施与异常特征由管理员补充。');
  const marketService=installMarket(db);
  const stockLots=installStockLots(db);
  const stockMargin=installStockMargin({db,lots:stockLots,balanceFor,recordLedger});
  const market=id=>{const items=marketService.items(id),lots=stockLots.list(id);return items.map(s=>{
    const positions=lots.filter(l=>l.code===s.code),longHolding=positions.reduce((n,l)=>n+Math.max(0,l.holding),0),shortHolding=positions.reduce((n,l)=>n+Math.max(0,-l.holding),0);
    const marginUsed=positions.reduce((n,l)=>n+l.marginUsed,0),positionNotional=positions.reduce((n,l)=>n+l.positionNotional,0),unrealizedPnl=positions.reduce((n,l)=>n+l.unrealizedPnl,0);
    return {...s,lots:positions,longHolding,shortHolding,holding:longHolding-shortHolding,side:longHolding&&shortHolding?'hedged':longHolding?'long':shortHolding?'short':'flat',marginUsed,costBasis:marginUsed,positionNotional,unrealizedPnl,totalPnl:unrealizedPnl+s.realizedPnl,avgCost:positionNotional/Math.max(1,longHolding+shortHolding),effectiveLeverage:marginUsed?Math.round(positionNotional/marginUsed*100)/100:0};
  });};
  const normalizeOptionalPrice=value=>{
    if(value==null||value==='')return null;
    const n=Math.round(Number(value));
    if(!Number.isSafeInteger(n)||n<=0)throw new Error('价格应为正整数。');
    return n;
  };
  const normalizeLeverage=value=>{
    const n=Math.round(Number(value));
    if(!Number.isSafeInteger(n)||![1,3,10].includes(n))throw new Error('杠杆仅支持 1x、3x 或 10x。');
    return n;
  };
  const validateStopsAgainstPrice=(side,price,stopLoss,takeProfit)=>{
    if(side==='long') {
      if(stopLoss!==null&&stopLoss>=price)throw new Error('买涨时止损需低于现价。');
      if(takeProfit!==null&&takeProfit<=price)throw new Error('买涨时止盈需高于现价。');
      return;
    }
    if(stopLoss!==null&&stopLoss<=price)throw new Error('买跌时止损需高于现价。');
    if(takeProfit!==null&&takeProfit>=price)throw new Error('买跌时止盈需低于现价。');
  };
  const pendingOrders=id=>db.prepare("SELECT id,code,side,quantity,leverage,limit_price AS limitPrice,stop_loss AS stopLoss,take_profit AS takeProfit,created_at AS createdAt FROM stock_orders WHERE employee_id=? AND status='open' ORDER BY id DESC").all(id);
  function executeStockTrade(id,{stock,delta,leverage=3,stopLoss=null,takeProfit=null,reason='',lotId=null,intent='auto'}) {
    if(!Number.isSafeInteger(delta)||delta===0)throw new Error('交易指令无效。');
    leverage=normalizeLeverage(leverage);
    const amount=Math.abs(delta)*stock.price;
    if(!Number.isSafeInteger(amount))throw new Error('委托金额超出限额。');
    const position=db.prepare('SELECT cost_basis,realized_pnl FROM stock_holdings WHERE employee_id=? AND code=?').get(id,stock.code);
    const plan=stockLots.plan(id,stock.code,delta,stock.price,leverage,lotId,intent);
    if(plan.openQuantity)requireStockLeverage(balanceFor(id),leverage);
    const fee=stockTradeFee(amount);
    plan.openFee=plan.openQuantity?Math.round(fee*(plan.openQuantity/Math.abs(delta))):0;
    const closingFee=fee-plan.openFee,openingFees=plan.changes.reduce((n,c)=>n+c.openFee,0);
    const realized=plan.pnl-fee,netPnl=plan.closeQuantity?plan.pnl-closingFee-openingFees:-fee;
    const nextRealized=(position?.realized_pnl||0)+realized;
    for(const n of [plan.next,plan.nextMargin,plan.nextNotional,plan.pnl,nextRealized])if(!Number.isSafeInteger(n))throw new Error('交易结果超出限额。');
    if(plan.nextMargin<0||plan.nextNotional<0)throw new Error('持仓账目无效。');
    const available=balanceFor(id)+plan.closeMargin+plan.pnl;
    if(plan.openQuantity&&available<plan.openMargin+fee)throw new Error('可用余额不足。');
    if(!Number.isSafeInteger(available-plan.openMargin-fee))throw new Error('交易结果超出限额。');
    const actualLeverage=plan.openQuantity?leverage:plan.changes.length===1?plan.changes[0].lot.leverage:Math.round(plan.closeNotional/Math.max(1,plan.closeMargin)*100)/100;
    recordLedger(id,plan.closeMargin+plan.pnl-plan.openMargin-fee,(plan.openQuantity?'开仓 ':'平仓 ')+stock.code+' × '+Math.abs(delta)+' @'+actualLeverage+'x · 手续费 '+fee+(reason?(' · '+reason):''));
    stockLots.apply(id,stock.code,delta,leverage,stopLoss,takeProfit,plan);
    const aggregateLeverage=plan.nextMargin?plan.nextNotional/plan.nextMargin:0;
    db.prepare('INSERT INTO stock_holdings(employee_id,code,quantity,cost_basis,position_notional,margin_used,realized_pnl,leverage,stop_loss,take_profit) VALUES(?,?,?,?,?,?,?,?,NULL,NULL) ON CONFLICT(employee_id,code) DO UPDATE SET quantity=excluded.quantity,cost_basis=excluded.cost_basis,position_notional=excluded.position_notional,margin_used=excluded.margin_used,realized_pnl=excluded.realized_pnl,leverage=excluded.leverage,stop_loss=NULL,take_profit=NULL').run(id,stock.code,plan.next,plan.nextMargin,plan.nextNotional,plan.nextMargin,nextRealized,aggregateLeverage);
    db.prepare('INSERT INTO stock_trades(employee_id,code,action,quantity,price,amount,leverage,holding_before,holding_after,cost_before,cost_after,realized_pnl_change,balance_after,intent,position_side,close_reason,fee,net_pnl) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,stock.code,delta>0?'buy':'sell',Math.abs(delta),stock.price,amount,actualLeverage,plan.held,plan.next,position?.cost_basis||0,plan.nextMargin,realized,balanceFor(id),plan.closeQuantity?(plan.openQuantity?'mixed':'close'):'open',plan.openQuantity?(delta>0?'long':'short'):(delta>0?'short':'long'),plan.closeQuantity?reason:'',fee,netPnl);
    marketService.trade(stock.code,delta,stock.price);
  }
  function processStockAutomations(id) {
    market(id);
    const openOrders=db.prepare("SELECT id,code,side,quantity,leverage,limit_price AS limitPrice,stop_loss AS stopLoss,take_profit AS takeProfit FROM stock_orders WHERE employee_id=? AND status='open' ORDER BY id").all(id);
    for(const order of openOrders) {
      const stock=db.prepare('SELECT code,price FROM stock_prices WHERE code=?').get(order.code);
      if(!stock) {
        db.prepare("UPDATE stock_orders SET status='cancelled' WHERE id=?").run(order.id);
        continue;
      }
      const shouldFill=order.side==='long'?stock.price<=order.limitPrice:stock.price>=order.limitPrice;
      if(!shouldFill)continue;
      try {
        executeStockTrade(id,{stock,delta:order.side==='long'?order.quantity:-order.quantity,leverage:order.leverage,stopLoss:order.stopLoss??null,takeProfit:order.takeProfit??null,reason:'限价单成交',intent:'open'});
        db.prepare("UPDATE stock_orders SET status='filled',filled_at=CURRENT_TIMESTAMP,filled_price=? WHERE id=?").run(stock.price,order.id);
      } catch(error) {
        if(error.code==='LEVERAGE_LOCKED'){db.prepare("UPDATE stock_orders SET status='cancelled' WHERE id=?").run(order.id);continue;}
        if(error.message!=='可用余额不足。')throw error;
      }
    }
    processProtectedStockLots(id);
  }
  function processProtectedStockLots(employeeId=null){
    stockMargin.autoTopUp(employeeId);
    const positions=db.prepare(`SELECT l.id,l.employee_id AS employeeId,l.code,l.quantity,l.quantity AS holding,l.position_notional AS positionNotional,l.margin_used AS marginUsed,l.stop_loss AS stopLoss,l.take_profit AS takeProfit,s.price FROM stock_lots l JOIN stock_prices s ON s.code=l.code WHERE l.quantity<>0 AND (l.quantity<0 OR l.position_notional>l.margin_used OR l.stop_loss IS NOT NULL OR l.take_profit IS NOT NULL) AND (? IS NULL OR l.employee_id=?) AND (((l.quantity<0 OR l.position_notional>l.margin_used) AND l.margin_used+CASE WHEN l.quantity>0 THEN l.quantity*s.price-l.position_notional ELSE l.position_notional+l.quantity*s.price END <= (l.margin_used+4)/5) OR (l.take_profit IS NOT NULL AND ((l.quantity>0 AND s.price>=l.take_profit) OR (l.quantity<0 AND s.price<=l.take_profit))) OR (l.stop_loss IS NOT NULL AND ((l.quantity>0 AND s.price<=l.stop_loss) OR (l.quantity<0 AND s.price>=l.stop_loss)))) ORDER BY l.id`).all(employeeId,employeeId);
    for(const p of positions) {
      let hit=stockPositionRisk(p).shouldLiquidate?'强制平仓':'';
      if(!hit&&p.quantity>0) {
        if(p.takeProfit!=null&&p.price>=p.takeProfit)hit='止盈';
        else if(p.stopLoss!=null&&p.price<=p.stopLoss)hit='止损';
      } else if(!hit) {
        if(p.takeProfit!=null&&p.price<=p.takeProfit)hit='止盈';
        else if(p.stopLoss!=null&&p.price>=p.stopLoss)hit='止损';
      }
      if(!hit)continue;
      executeStockTrade(p.employeeId,{stock:{code:p.code,price:p.price},delta:-p.quantity,stopLoss:null,takeProfit:null,reason:hit==='强制平仓'?hit:hit+'自动平仓',lotId:p.id,intent:'close'});
    }
  }
  marketService.onQuote(()=>processProtectedStockLots());
  const forum=installForumList(db);
  const replies=installForumReplies(db);
  return {log,initializeStockLots:stockLots.migrate,close(){clearInterval(chatHeartbeat);for(const clients of chatStreams.values())for(const response of clients)response.end();chatStreams.clear();marketService.close();}, async handle(req,res,url) {
    const path=url.pathname;
    if(!path.startsWith('/api/player/')&&!path.startsWith('/api/admin/moderation')&&path!=='/api/admin/activity')return false;
    const employee=path.startsWith('/api/admin/')?requireAdmin(req,res):requireEmployee(req,res);if(!employee)return true;
    const id=employee.id;let data={};
    try {
      if(req.method==='POST'||req.method==='PUT')data=await readBody(req,path==='/api/player/forum/notifications'?8192:2500000);
      if(path==='/api/player/state'&&req.method==='GET') {
        const bootstrap=url.searchParams.get('bootstrap')==='1',section=url.searchParams.get('section');
        if(section&&!['news','departments','containment','forum','casino','life'].includes(section))throw new Error('未知页面。');
        const include=name=>!bootstrap&&(!section||section===name);
        if(include('casino'))transaction(()=>{processStockAutomations(id);});
        award(id);const profile=publicProfile(id);
        send(res,200,{employee,balance:balanceFor(id),profile,stockRiskRules,stockPreferences:stockMargin.preferences(id),stockRisk:stockLots.riskSummary(id),economy:getEconomy().publicRules(),serverTime:Date.now(),market:!include('casino')?null:marketService.history('KARMA',1,id),
          checkin:!!db.prepare('SELECT 1 FROM checkins WHERE employee_id=? AND checkin_date=?').get(id,today()),
          streak:db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE employee_id=?').get(id).n,
          achievements:getPersonal().earned(id),gameRecords:getHighlights().records(id),
          history:[],
          employees:!include('departments')?[]:directoryEmployees(db).map(e=>({...e,avatarUrl:mediaReference('avatar',e.id,e.avatarUrl)})),
          departments:!(include('departments')||include('life'))?[]:db.prepare('SELECT code,name,description AS desc,motto FROM company_departments').all(),
          announcements:!include('news')?[]:db.prepare(`SELECT a.id,a.title,a.body,a.pinned,a.recipient,CASE WHEN a.issuer_explicit=1 THEN a.issuer ELSE '' END AS issuer,a.drafter,a.issued_on AS issuedOn,COALESCE(NULLIF(a.published_at,''),a.created_at) AS createdAt,COALESCE(NULLIF(a.published_at,''),a.created_at) AS publishedAt,(SELECT COUNT(*) FROM posts p WHERE p.announcement_id=a.id AND p.status='published' AND p.deleted_at='') AS postCount FROM announcements a ORDER BY a.pinned DESC,datetime(COALESCE(NULLIF(a.published_at,''),a.created_at)) DESC,a.id DESC`).all(),
          dossiers:!include('containment')?[]:db.prepare('SELECT id,code,title,department,status,summary,classification,procedures,sections_json FROM dossiers ORDER BY id').all().map(dossierView),
          forum:!include('forum')?{items:[],next:null}:forum(id),stocks:!include('casino')?[]:market(id),stockOrders:!include('casino')?[]:pendingOrders(id)});return true;
      }
      if(path==='/api/player/directory'&&req.method==='GET'){send(res,200,{items:directoryEmployees(db).map(e=>({...e,avatarUrl:mediaReference('avatar',e.id,e.avatarUrl)}))});return true;}
      if(path==='/api/player/view'&&req.method==='POST'){if(valid(data.page,40))log(id,'view',data.page);send(res,200,{ok:true});return true;}
      if(path==='/api/player/forum'&&req.method==='GET'){send(res,200,forum(id,url.searchParams));return true;}
      if(path==='/api/player/forum/personas'){
        if(req.method==='GET')send(res,200,forumSocial.list(id));
        else if(req.method==='POST')send(res,201,forumSocial.create(id,data.name));
        else send(res,405,{error:'指令无效。'});return true;
      }
      if(path==='/api/player/forum/workshop'){
        if(req.method==='GET')send(res,200,forumSocial.topics(id));
        else if(req.method==='POST')send(res,201,forumSocial.publish(id,data));
        else send(res,405,{error:'指令无效。'});return true;
      }
      if(path==='/api/player/forum/notifications'&&req.method==='GET'){send(res,200,{...forumSocial.inbox(id),stockRisk:stockLots.riskSummary(id)});return true;}
      if(path==='/api/player/forum/notifications'&&req.method==='POST'){
        const presence=forumPresence.sync(id,data),threadId=Number(data.threadId||0),revision=Number(data.revision||0);
        if(!Number.isSafeInteger(threadId)||threadId<0||!Number.isSafeInteger(revision)||revision<0)throw Error('无效的帖子刷新位置。');
        const latest=threadId?db.prepare("SELECT MAX(v.revision) AS revision FROM forum_reply_versions v JOIN forum_threads t ON t.id=v.thread_id WHERE v.thread_id=? AND t.status='published' AND t.moderation='approved' AND t.deleted_at=''").get(threadId)?.revision||0:0;
        send(res,200,{...forumSocial.inbox(id),presence,threadId,repliesChanged:latest>revision,stockRisk:stockLots.riskSummary(id)});return true;
      }
      const forumView=path.match(/^\/api\/player\/forum\/(\d+)\/view$/);
      if(forumView&&req.method==='POST'){send(res,200,forum.recordView(id,Number(forumView[1])));return true;}
      const forumRead=path.match(/^\/api\/player\/forum\/(\d+)\/read$/);
      if(forumRead&&req.method==='POST'){send(res,200,data.replyIds!==undefined?forumSocial.readReplies(id,Number(forumRead[1]),data.replyIds):forumSocial.read(id,Number(forumRead[1]),data.through));return true;}
      const thread=path.match(/^\/api\/player\/forum\/(\d+)$/);
      if(thread&&req.method==='GET'){const row=db.prepare("SELECT id FROM forum_threads WHERE id=? AND status='published' AND deleted_at=''").get(thread[1]);if(!row)throw new Error('帖子不存在或未通过审核。');const topic=db.prepare(`SELECT f.id,f.title,f.body,f.view_count AS viewCount,f.image_data AS imageData,${forumAuthorSQL('f')},f.created_at AS createdAt,f.edited_at AS editedAt,(f.employee_id=?) AS canEdit,(SELECT COUNT(*) FROM forum_replies WHERE thread_id=f.id AND status='published' AND deleted_at='') AS replyCount FROM forum_threads f JOIN profiles p ON p.employee_id=f.employee_id WHERE f.id=?`).get(id,thread[1]);topic.imageData=mediaReference('thread',topic.id,topic.imageData);send(res,200,{thread:{...mapForumAuthor(topic),readThrough:forumSocial.readThrough(Number(thread[1]),id)},...replies(Number(thread[1]),id,url.searchParams)});return true;}
      if((path==='/api/player/forum'||thread)&&req.method==='POST') {
        if(!valid(data.body,3000)||(!thread&&!valid(data.title,120)))throw new Error('请填写标题与正文，正文最多 3000 字。');
        const img=image(data.imageData),status=img?'hidden':'published',moderation=img?'pending':'approved',alias=publicProfile(id).anonymousName;
        if(!alias)throw new Error('请先保存匿名名称。');const identityMode=data.identityMode??'anonymous';if(!['anonymous','real'].includes(identityMode))throw new Error('请选择发言身份。');
        const personaId=forumSocial.persona(id,data.personaId),replyToId=thread?forumSocial.target(Number(thread[1]),data.replyToId):null;
        let row;
        if(thread){if(!db.prepare("SELECT id FROM forum_threads WHERE id=? AND status='published' AND deleted_at=''").get(thread[1]))throw new Error('帖子不存在。');row=db.prepare('INSERT INTO forum_replies(thread_id,employee_id,anonymous_name,body,image_data,status,moderation,identity_mode,persona_id,reply_to_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(thread[1],id,alias,data.body.trim(),img,status,moderation,identityMode,personaId,replyToId);}
        else row=db.prepare('INSERT INTO forum_threads(employee_id,anonymous_name,title,body,image_data,status,moderation,identity_mode,persona_id) VALUES(?,?,?,?,?,?,?,?,?)').run(id,alias,data.title.trim(),data.body.trim(),img,status,moderation,identityMode,personaId);
        send(res,201,{id:Number(row.lastInsertRowid),pending:!!img});return true;
      }
      if(path==='/api/admin/moderation'&&req.method==='GET') {
        const items=db.prepare(`SELECT 'thread' AS kind,f.id,f.title,f.body,f.image_data AS imageData,f.employee_id AS employeeId,e.username,e.display_name AS displayName,f.created_at AS createdAt FROM forum_threads f JOIN employees e ON e.id=f.employee_id WHERE f.moderation='pending'
          UNION ALL SELECT 'reply',r.id,t.title,r.body,r.image_data,r.employee_id,e.username,e.display_name,r.created_at FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id JOIN employees e ON e.id=r.employee_id WHERE r.moderation='pending' ORDER BY createdAt`).all();send(res,200,{items});return true;
      }
      const moderation=path.match(/^\/api\/admin\/moderation\/(thread|reply)\/(\d+)$/);
      if(moderation&&req.method==='POST') {
        if(!['approve','reject'].includes(data.action))throw new Error('审核操作无效。');
        const table=moderation[1]==='thread'?'forum_threads':'forum_replies';
        transaction(()=>{checkImageVersion(db,moderation[1],Number(moderation[2]),data.archiveId);const result=db.prepare(`UPDATE ${table} SET status=?,moderation=? WHERE id=? AND moderation='pending'`).run(data.action==='approve'?'published':'hidden',data.action==='approve'?'approved':'rejected',moderation[2]);
        if(!result.changes)throw new Error('内容已处理或已删除。');recordImageReview(db,moderation[1],Number(moderation[2]),employee,data.action);});log(id,'moderation',table+'/'+moderation[2],{decision:data.action});send(res,200,{ok:true});return true;
      }
      if(path==='/api/admin/activity'&&req.method==='GET'){const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;send(res,200,{items:db.prepare("SELECT * FROM activity_logs WHERE action='insert' AND target IN ('balance_ledger','forum_threads','forum_replies','posts','dossier_comments','chat_messages') AND id<? ORDER BY id DESC LIMIT 100").all(before)});return true;}
      const dossier=path.match(/^\/api\/player\/dossiers\/(\d+)\/comments$/);
      if(dossier){if(!db.prepare('SELECT id FROM dossiers WHERE id=?').get(dossier[1]))throw new Error('档案不存在。');
        if(req.method==='POST'){if(!valid(data.body,2000))throw new Error('评议最多 2000 字。');db.prepare('INSERT INTO dossier_comments(dossier_id,employee_id,body) VALUES(?,?,?)').run(dossier[1],id,data.body.trim());}
        send(res,200,{items:db.prepare(`SELECT c.id,c.body,e.display_name AS displayName,e.department,c.created_at AS createdAt FROM dossier_comments c JOIN employees e ON e.id=c.employee_id WHERE dossier_id=? AND c.deleted_at='' ORDER BY c.id`).all(dossier[1])});return true;}
      if(path==='/api/player/balance/zero'&&req.method==='POST'){transaction(()=>{const b=balanceFor(id);if(b)recordLedger(id,-b,'主动归零');award(id);});send(res,200,{balance:balanceFor(id)});return true;}
      if(path==='/api/player/relief'&&req.method==='POST'){transaction(()=>{if(balanceFor(id)>=10000)throw new Error('余额低于 10,000 才能领取。');recordLedger(id,10000,'应急低保');award(id);});send(res,200,{balance:balanceFor(id)});return true;}
      if(path==='/api/player/games/scratch'&&req.method==='POST') {
        if(data.requestKey!==undefined&&!(typeof data.requestKey==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(data.requestKey)))throw new Error('无效票据请求。');
        if(data.requestKey){const previous=settledScratch(id,data.requestKey);if(previous){if(previous.result.tier.id!==data.tier||previous.result.gameType.type!==data.type||previous.cost!==data.cost)throw new Error('票据请求不匹配。');send(res,200,previous);return true;}}

        const config=getEconomy().get(),rule=config.scratch.find(t=>t.id===data.tier),game=scratchGameTypes.find(g=>g.type===data.type);if(!rule||!game)throw new Error('请选择有效票种。');if(data.cost!==rule.cost||data.revision!==config.revision)throw Object.assign(new Error('票券规程已修订，请重新确认票种。'),{code:'RULES_CHANGED'});
        const tier={...scratchTiers.find(t=>t.id===data.tier),name:rule.name,cost:validateGameStake(rule.cost)},proof=random(),outcome=weighted(rule.variants[game.type],proof.random),ticket=generateOutcomeTicket(tier,game,proof.seed,proof.random,outcome);if(data.requestKey)ticket.requestKey=data.requestKey;ticket.revision=config.revision;ticket.multiplier=outcome.multiplier;ticket.rarePrize=outcome.multiplier>=5;
        send(res,200,settle(id,'scratch',tier.cost,ticket.totalPayout,ticket,proof));return true;
      }
      if(path==='/api/player/games/slot'&&req.method==='POST') {
        if(typeof data.requestKey!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(data.requestKey))throw new Error('请刷新页面后重试本次运转。');
        const previous=db.prepare("SELECT * FROM game_tickets WHERE employee_id=? AND game='slot' AND json_extract(result_json,'$.requestKey')=?").get(id,data.requestKey);
        if(previous){if(previous.cost!==data.bet)throw Error('运转请求金额不一致。');const result=JSON.parse(previous.result_json);send(res,200,{ticketId:previous.id,cost:previous.cost,prize:previous.prize,penalty:result.penalty||0,tax:result.tax||0,result,balance:balanceFor(id)});return true;}

        const cost=bet(data.bet),proof=random(),{prize,result}=spinSlot(cost,proof.random);
        result.requestKey=data.requestKey;send(res,200,settle(id,'slot',cost,prize,result,proof));return true;
      }
      if(path==='/api/player/games/cards'){send(res,410,{error:'旧牌桌已停用，请进入新版练习牌桌。',code:'GAME_RETIRED'});return true;}
      if(path==='/api/player/stocks/history'&&req.method==='GET') {
        const before=url.searchParams.get('before');send(res,200,{...stockLots.history(id,before===null?null:Number(before)),marketFees:stockFeeTotals(db)});return true;
      }
      if(path==='/api/player/stocks/margin'&&req.method==='POST'){
        let result;transaction(()=>{processStockAutomations(id);result=stockMargin.topUp(id,data);});
        send(res,200,{...result,items:market(id),balance:balanceFor(id),stockRisk:stockLots.riskSummary(id)});return true;
      }
      if(path==='/api/player/stocks/preferences'&&['GET','POST'].includes(req.method)){
        const preferences=req.method==='POST'?transaction(()=>stockMargin.setPreferences(id,data.autoMargin)):stockMargin.preferences(id);
        send(res,200,{stockPreferences:preferences});return true;
      }
      if(path==='/api/player/stocks') {
        if(!['GET','POST'].includes(req.method)){send(res,405,{error:'交易指令无效。'});return true;}
        const code=url.searchParams.get('code')||'KARMA',period=Number(url.searchParams.get('period')||1);
        // Validate chart selection before committing any trade.
        marketService.history(code,period);
        transaction(()=>{
          processStockAutomations(id);
          if(req.method==='POST') {
            if(data.action==='cancelOrder') {
              const orderId=Number(data.orderId);
              if(!Number.isSafeInteger(orderId)||orderId<1)throw new Error('订单编号无效。');
              const changed=db.prepare("UPDATE stock_orders SET status='cancelled' WHERE id=? AND employee_id=? AND status='open'").run(orderId,id).changes;
              if(!changed)throw new Error('该挂单不存在或已失效。');
              log(id,'stock.cancelOrder',String(orderId),{});
            } else {
              const code=String(data.code??'').trim();
              const quantityRaw=String(data.quantity??'').trim();
              const quantity=Number(quantityRaw.replaceAll(',',''));
              if(!code)throw new Error('交易失败：缺少证券代码。');
              if(!Number.isFinite(quantity)||!Number.isSafeInteger(quantity))throw new Error('交易失败：数量格式无效。');
              if(quantity<1)throw new Error('交易失败：数量需为正整数。');
              const stock=db.prepare('SELECT code,price FROM stock_prices WHERE code=?').get(code);
              if(!stock)throw new Error('交易失败：证券代码不存在。');
              const orderType=String(data.orderType??'').toLowerCase()==='limit'?'limit':'market';
              let side=(String(data.side??'').toLowerCase()==='short'||String(data.action??'').toLowerCase()==='sell')?'short':'long';
              const intent=data.intent;
              const lotId=data.lotId==null?null:Number(data.lotId);
              if(lotId!==null&&intent!=='close')throw new Error('指定持仓仅用于平仓。');
              if(intent!==undefined&&!['open','close'].includes(intent))throw new Error('交易意图无效。');
              const positions=stockLots.list(id).filter(l=>l.code===code);
              if(intent==='close'){
                const chosen=lotId===null?positions:positions.filter(l=>l.id===lotId);
                if(!chosen.length)throw new Error('持仓不存在。');
                if(chosen.some(l=>l.holding>0)&&chosen.some(l=>l.holding<0))throw new Error('同时持有多空仓位，请到我的持仓选择具体仓位平仓。');
                if(quantity>chosen.reduce((n,l)=>n+Math.abs(l.holding),0))throw new Error('平仓数量不能超过当前持仓。');
                side=chosen[0].holding>0?'short':'long';
                if(data.orderType==='limit')throw new Error('平仓请使用市价委托。');

              }
              const leverage=normalizeLeverage(data.leverage??3);
              const stopLoss=intent==='close'?null:normalizeOptionalPrice(data.stopLoss);
              const takeProfit=intent==='close'?null:normalizeOptionalPrice(data.takeProfit);
              if(orderType==='limit') {
                requireStockLeverage(balanceFor(id),leverage);
                if(db.prepare("SELECT COUNT(*) AS n FROM stock_orders WHERE employee_id=? AND status='open'").get(id).n>=100)throw new Error('未成交委托最多 100 笔，请先撤销部分委托。');
                const limitPrice=normalizeOptionalPrice(data.limitPrice);
                if(limitPrice===null)throw new Error('限价单需填写触发价格。');
                if(!Number.isSafeInteger(quantity*limitPrice))throw new Error('委托金额超出可精确计量范围。');
                db.prepare("INSERT INTO stock_orders(employee_id,code,side,quantity,leverage,limit_price,stop_loss,take_profit,status) VALUES(?,?,?,?,?,?,?,?,'open')").run(id,stock.code,side,quantity,leverage,limitPrice,stopLoss,takeProfit);
                log(id,'stock.limitOrder',stock.code,{side,quantity,leverage,limitPrice,stopLoss,takeProfit});
                processStockAutomations(id);
              } else {
                if(intent!=='close')validateStopsAgainstPrice(side,stock.price,stopLoss,takeProfit);
                executeStockTrade(id,{stock,delta:side==='long'?quantity:-quantity,leverage,stopLoss,takeProfit,lotId,intent:intent||'auto'});
                award(id);
              }
            }
          }
        });
        send(res,200,{items:market(id),orders:pendingOrders(id),riskRules:stockRiskRules,stockPreferences:stockMargin.preferences(id),stockRisk:stockLots.riskSummary(id),balance:balanceFor(id),market:marketService.history(code,period,id),serverTime:Date.now()});return true;
      }
      if(path==='/api/player/chat/stream'&&req.method==='GET') {
        const room=url.searchParams.get('room');if(!['sky','derby'].includes(room))throw new Error('聊天室不存在。');
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
        if(!chatStreams.has(room))chatStreams.set(room,new Set());
        for(const old of [...chatStreams.get(room)].filter(r=>r.avedEmployeeId===id).slice(0,-1)){old.end();chatStreams.get(room).delete(old);}
        res.avedEmployeeId=id;chatRequests.set(res,req);chatStreams.get(room).add(res);
        res.write('data: '+JSON.stringify({items:chatItems(room)})+'\n\n');
        res.on('close',()=>{chatStreams.get(room)?.delete(res);});return true;
      }
      if(path==='/api/player/chat') {
        const room=req.method==='POST'?data.room:url.searchParams.get('room');if(!['sky','derby'].includes(room))throw new Error('聊天室不存在。');
        if(req.method==='POST'){if(!valid(data.body,500))throw new Error('消息最多 500 字。');db.prepare('INSERT INTO chat_messages(employee_id,room,alias,body) VALUES(?,?,?,?)').run(id,room,publicProfile(id).anonymousName,data.body.trim());emitChat(room);}
        send(res,200,{items:chatItems(room)});return true;
      }
      send(res,404,{error:'接口不存在。'});return true;
    }catch(error){send(res,error.status===403?403:400,{error:error.message,...(error.code?{code:error.code}:{})});return true;}
  }};
}
