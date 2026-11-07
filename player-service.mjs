import {recordImageReview,checkImageVersion} from './server-image-archive.mjs';
import {mediaReference} from './server-media.mjs';
import {weighted,scratchPrizeMultipliers} from './server-economy.mjs';
import {spinSlot} from './server-slot.mjs';
import {runners as derbyRules,derbyReturn} from './server-derby.mjs';
import {directoryEmployees} from './server-directory.mjs';
import { installMarket } from './server-market.mjs';
import { newCards, cardsAction, publicCards } from './server-cards.mjs';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { scratchTiers, scratchGameTypes, departmentsData, stocksData } from './server-content.mjs';
import { generateSealedTicket, applyScratchBomb, settleGameTicket } from './server-ticket.mjs';

export const DERBY_ODDS=derbyRules.map(r=>r.odds);
export const DERBY_WIN_PROBABILITIES=derbyRules.map(r=>r.weight);

export function installPlayerService({db,send,readBody,requireEmployee,requireAdmin,balanceFor,recordLedger,publicProfile,today,sessionEmployee,getEconomy,getPersonal,getHighlights}) {
  const chatStreams=new Map();
  const chatItems=room=>db.prepare(`SELECT c.id,COALESCE(p.anonymous_name,c.alias) AS alias,c.body,c.created_at AS createdAt FROM chat_messages c LEFT JOIN profiles p ON p.employee_id=c.employee_id WHERE room=? AND c.deleted_at='' ORDER BY c.id DESC LIMIT 80`).all(room).reverse();
  function emitChat(room){const payload='data: '+JSON.stringify({items:chatItems(room)})+'\n\n';for(const response of chatStreams.get(room)||[])response.write(payload);}
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
  const derbyWinnerFromRandom=r=>{let cumulative=0;for(let i=0;i<DERBY_WIN_PROBABILITIES.length;i++){cumulative+=DERBY_WIN_PROBABILITIES[i];if(r<cumulative)return i;}return DERBY_WIN_PROBABILITIES.length-1;};
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS scratch_request_once ON game_tickets(employee_id,json_extract(result_json,'$.requestKey')) WHERE game='scratch' AND json_extract(result_json,'$.requestKey') IS NOT NULL");
  function settledScratch(id,key){const row=db.prepare("SELECT * FROM game_tickets WHERE employee_id=? AND game='scratch' AND json_extract(result_json,'$.requestKey')=?").get(id,key);return row?{ticketId:row.id,cost:row.cost,prize:row.prize,penalty:JSON.parse(row.result_json).penalty||0,balance:balanceFor(id),result:JSON.parse(row.result_json),seed:row.seed,seedHash:row.seed_hash,gameHighlight:getHighlights().event(id,row.id)}:null;}
  const settle=(id,game,cost,prize,result,proof)=>settleGameTicket({db,transaction,balanceFor,recordLedger,award,getHighlights},id,game,cost,prize,result,proof);
  const bet=n=>{if(!Number.isSafeInteger(n)||n<100||n>1000000)throw new Error('投入应为 100 至 1,000,000 的整数。');return n;};
  // Only replace the exact system-generated starter copy; preserve authored notices.
  db.prepare('UPDATE announcements SET body=? WHERE title=? AND body=?').run('公司内部通讯已接通。请各部门员工核验个人档案，查阅通告，并依权限使用各项设施。','员工终端已启用','这里发布的公告会保存在服务器数据库中。员工可以在公告下方匿名留言。');
  db.prepare('UPDATE dossiers SET summary=? WHERE code=? AND summary=?').run('卷宗待核。','WY-002','档案内容由管理人员录入。');
  db.prepare('UPDATE dossiers SET summary=? WHERE code=? AND summary=?').run('法棍是一只法斗，当前列入观察序列。','AVED-007','法棍是一只法斗。具体收容措施与异常特征由管理员补充。');
  const marketService=installMarket(db);
  const market=id=>marketService.items(id);
  const normalizeOptionalPrice=value=>{
    if(value==null||value==='')return null;
    const n=Math.round(Number(value));
    if(!Number.isSafeInteger(n)||n<=0)throw new Error('价格应为正整数。');
    return n;
  };
  const normalizeLeverage=value=>{
    const n=Math.round(Number(value));
    if(!Number.isSafeInteger(n)||![3,10].includes(n))throw new Error('杠杆仅支持 3x 或 10x。');
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
  function executeStockTrade(id,{stock,delta,leverage=3,stopLoss=null,takeProfit=null,reason=''}) {
    if(!Number.isSafeInteger(delta)||delta===0)throw new Error('交易指令无效。');
    leverage=normalizeLeverage(leverage);
    const amount=Math.abs(delta)*stock.price;
    if(!Number.isSafeInteger(amount))throw new Error('委托金额超出限额。');
    const position=db.prepare('SELECT quantity,cost_basis AS costBasis,position_notional AS positionNotional,margin_used AS marginUsed,realized_pnl AS realizedPnl,leverage,stop_loss AS stopLoss,take_profit AS takeProfit FROM stock_holdings WHERE employee_id=? AND code=?').get(id,stock.code);
    const held=position?.quantity||0;
    const costBasis=position?.costBasis||0;
    const positionNotional=position?.positionNotional||((held!==0&&costBasis>0)?costBasis:0);
    const marginUsed=position?.marginUsed||((held!==0&&costBasis>0)?costBasis:0);
    const realizedPnl=position?.realizedPnl||0;
    const next=held+delta;
    if(!Number.isSafeInteger(next)||Math.abs(next)>1000000)throw new Error('持仓超出限额。');
    const closing=Math.sign(held)!==0&&Math.sign(held)!==Math.sign(delta);
    const closeQuantity=closing?Math.min(Math.abs(held),Math.abs(delta)):0;
    const openQuantity=closing?Math.max(0,Math.abs(delta)-Math.abs(held)):Math.abs(delta);
    const fullClose=closeQuantity>0&&closeQuantity===Math.abs(held);
    const closeNotional=closeQuantity>0?(fullClose?positionNotional:Math.round(positionNotional*closeQuantity/Math.abs(held))):0;
    const closeMarginRelease=closeQuantity>0?(fullClose?marginUsed:Math.round(marginUsed*closeQuantity/Math.abs(held))):0;
    const openNotional=openQuantity*stock.price;
    const openMargin=openQuantity>0?Math.ceil(openNotional/leverage):0;
    let nextCostBasis=costBasis-closeMarginRelease+openMargin;
    let nextPositionNotional=positionNotional-closeNotional+openNotional;
    let realizedPnlChange=0;
    if(closeQuantity>0) {
      realizedPnlChange=held>0
        ? closeQuantity*stock.price-closeNotional
        : closeNotional-closeQuantity*stock.price;
    }
    if(next===0) {
      nextCostBasis=0;
      nextPositionNotional=0;
    }
    const currentLeverage=Number(position?.leverage)||0;
    const nextLeverage=next===0
      ? 0
      : openQuantity>0
        ? leverage
        : currentLeverage;
    const nextRealizedPnl=realizedPnl+realizedPnlChange;
    if(!Number.isSafeInteger(nextCostBasis)||nextCostBasis<0||!Number.isSafeInteger(nextPositionNotional)||nextPositionNotional<0||!Number.isSafeInteger(realizedPnlChange)||!Number.isSafeInteger(nextRealizedPnl))throw new Error('交易结果超出限额。');
    const ledgerDelta=closeMarginRelease+realizedPnlChange-openMargin;
    recordLedger(id,ledgerDelta,(delta>0?'买涨 ':'买跌 ')+stock.code+' × '+Math.abs(delta)+' @'+leverage+'x'+(reason?(' · '+reason):''));
    const nextStopLoss=next===0?null:(stopLoss!==null?stopLoss:position?.stopLoss??null);
    const nextTakeProfit=next===0?null:(takeProfit!==null?takeProfit:position?.takeProfit??null);
    db.prepare('INSERT INTO stock_holdings(employee_id,code,quantity,cost_basis,position_notional,margin_used,realized_pnl,leverage,stop_loss,take_profit) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_id,code) DO UPDATE SET quantity=excluded.quantity,cost_basis=excluded.cost_basis,position_notional=excluded.position_notional,margin_used=excluded.margin_used,realized_pnl=excluded.realized_pnl,leverage=excluded.leverage,stop_loss=excluded.stop_loss,take_profit=excluded.take_profit').run(id,stock.code,next,nextCostBasis,nextPositionNotional,nextCostBasis,nextRealizedPnl,nextLeverage,nextStopLoss,nextTakeProfit);
    const balanceAfter=balanceFor(id);
    db.prepare('INSERT INTO stock_trades(employee_id,code,action,quantity,price,amount,leverage,holding_before,holding_after,cost_before,cost_after,realized_pnl_change,balance_after) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,stock.code,delta>0?'buy':'sell',Math.abs(delta),stock.price,amount,leverage,held,next,costBasis,nextCostBasis,realizedPnlChange,balanceAfter);
    marketService.trade(stock.code,delta,stock.price);
    log(id,'stock.'+(delta>0?'buy':'sell'),stock.code,{quantity:Math.abs(delta),price:stock.price,amount,leverage,openedMargin:openMargin,releasedMargin:closeMarginRelease,holdingBefore:held,holdingAfter:next,costBefore:costBasis,costAfter:nextCostBasis,realizedPnlChange,balanceAfter,side:delta>0?'long':'short',stopLoss:nextStopLoss,takeProfit:nextTakeProfit,reason});
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
        executeStockTrade(id,{stock,delta:order.side==='long'?order.quantity:-order.quantity,leverage:order.leverage,stopLoss:order.stopLoss??null,takeProfit:order.takeProfit??null,reason:'限价单成交'});
        db.prepare("UPDATE stock_orders SET status='filled',filled_at=CURRENT_TIMESTAMP,filled_price=? WHERE id=?").run(stock.price,order.id);
      } catch(error) {
        if(error.message!=='可用余额不足。')throw error;
      }
    }
    const positions=db.prepare('SELECT h.code,h.quantity,h.stop_loss AS stopLoss,h.take_profit AS takeProfit,s.price FROM stock_holdings h JOIN stock_prices s ON s.code=h.code WHERE h.employee_id=? AND h.quantity<>0').all(id);
    for(const p of positions) {
      let hit='';
      if(p.quantity>0) {
        if(p.takeProfit!=null&&p.price>=p.takeProfit)hit='止盈';
        else if(p.stopLoss!=null&&p.price<=p.stopLoss)hit='止损';
      } else {
        if(p.takeProfit!=null&&p.price<=p.takeProfit)hit='止盈';
        else if(p.stopLoss!=null&&p.price>=p.stopLoss)hit='止损';
      }
      if(!hit)continue;
      executeStockTrade(id,{stock:{code:p.code,price:p.price},delta:-p.quantity,stopLoss:null,takeProfit:null,reason:hit+'自动平仓'});
    }
  }
  function forum(before=Number.MAX_SAFE_INTEGER,viewer=0) {
    const rows=db.prepare(`SELECT f.id,f.title,f.body,f.image_data AS imageData,CASE WHEN f.identity_mode='real' THEN (SELECT display_name FROM employees WHERE id=f.employee_id) ELSE p.anonymous_name END AS anonymousName,f.identity_mode AS identityMode,f.created_at AS createdAt,f.edited_at AS editedAt,(f.employee_id=?) AS canEdit,
      (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=f.employee_id) AS balance,
      (SELECT COUNT(*) FROM forum_replies WHERE thread_id=f.id AND status='published' AND deleted_at='') AS replyCount
      FROM forum_threads f JOIN profiles p ON p.employee_id=f.employee_id WHERE f.status='published' AND f.deleted_at='' AND f.id<? ORDER BY f.id DESC LIMIT 11`).all(viewer,before);
    return {items:rows.slice(0,10).map(row=>({...row,imageData:mediaReference('thread',row.id,row.imageData)})),next:rows.length>10?rows[9].id:null};
  }
  const replies=(id,viewer=0)=>db.prepare(`SELECT r.id,r.body,r.image_data AS imageData,CASE WHEN r.identity_mode='real' THEN (SELECT display_name FROM employees WHERE id=r.employee_id) ELSE p.anonymous_name END AS anonymousName,r.identity_mode AS identityMode,r.created_at AS createdAt,r.edited_at AS editedAt,(r.employee_id=?) AS canEdit,
    (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=r.employee_id) AS balance FROM forum_replies r JOIN forum_threads f ON f.id=r.thread_id JOIN profiles p ON p.employee_id=r.employee_id WHERE r.thread_id=? AND r.status='published' AND r.deleted_at='' AND f.status='published' AND f.deleted_at='' ORDER BY r.id`).all(viewer,id).map(row=>({...row,imageData:mediaReference('reply',row.id,row.imageData)}));
  const saveRound=(id,game,state)=>Number(db.prepare('INSERT INTO player_rounds(employee_id,game,state_json) VALUES(?,?,?)').run(id,game,JSON.stringify(state)).lastInsertRowid);
  const loadRound=(id,round,game)=>{const r=db.prepare('SELECT state_json FROM player_rounds WHERE id=? AND employee_id=? AND game=?').get(round,id,game);if(!r)throw new Error('该局不存在，请重新开始。');return JSON.parse(r.state_json);};
  const updateRound=(round,state)=>db.prepare('UPDATE player_rounds SET state_json=? WHERE id=?').run(JSON.stringify(state),round);
  return {log,close:marketService.close, async handle(req,res,url) {
    const path=url.pathname;
    if(!path.startsWith('/api/player/')&&!path.startsWith('/api/admin/moderation')&&path!=='/api/admin/activity')return false;
    const employee=path.startsWith('/api/admin/')?requireAdmin(req,res):requireEmployee(req,res);if(!employee)return true;
    const id=employee.id;let data={};
    try {
      if(req.method==='POST'||req.method==='PUT')data=await readBody(req,2500000);
      if(path==='/api/player/state'&&req.method==='GET') {
        const bootstrap=url.searchParams.get('bootstrap')==='1';
        if(!bootstrap)transaction(()=>{processStockAutomations(id);});
        award(id);const profile=publicProfile(id);
        send(res,200,{employee,balance:balanceFor(id),profile,economy:getEconomy().publicRules(),serverTime:Date.now(),market:bootstrap?null:marketService.history(),
          checkin:!!db.prepare('SELECT 1 FROM checkins WHERE employee_id=? AND checkin_date=?').get(id,today()),
          streak:db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE employee_id=?').get(id).n,
          achievements:getPersonal().earned(id),gameRecords:getHighlights().records(id),
          history:[],
          employees:bootstrap?[]:directoryEmployees(db).map(e=>({...e,avatarUrl:mediaReference('avatar',e.id,e.avatarUrl)})),
          departments:bootstrap?[]:db.prepare('SELECT code,name,description AS desc,motto FROM company_departments').all(),
          announcements:bootstrap?[]:db.prepare(`SELECT a.id,a.title,a.body,a.pinned,a.recipient,CASE WHEN a.issuer_explicit=1 THEN a.issuer ELSE '' END AS issuer,a.drafter,a.issued_on AS issuedOn,COALESCE(NULLIF(a.published_at,''),a.created_at) AS createdAt,COALESCE(NULLIF(a.published_at,''),a.created_at) AS publishedAt,(SELECT COUNT(*) FROM posts p WHERE p.announcement_id=a.id AND p.status='published' AND p.deleted_at='') AS postCount FROM announcements a ORDER BY a.pinned DESC,datetime(COALESCE(NULLIF(a.published_at,''),a.created_at)) DESC,a.id DESC`).all(),
          dossiers:bootstrap?[]:db.prepare('SELECT id,code,title,department,status,summary FROM dossiers ORDER BY id').all(),
          forum:bootstrap?{items:[],next:null}:forum(Number.MAX_SAFE_INTEGER,id),stocks:bootstrap?[]:market(id),stockOrders:bootstrap?[]:pendingOrders(id),music:bootstrap?[]:db.prepare('SELECT id,title,url,kind FROM music_tracks WHERE enabled=1 ORDER BY id').all()});return true;
      }
      if(path==='/api/player/directory'&&req.method==='GET'){send(res,200,{items:directoryEmployees(db).map(e=>({...e,avatarUrl:mediaReference('avatar',e.id,e.avatarUrl)}))});return true;}
      if(path==='/api/player/view'&&req.method==='POST'){if(valid(data.page,40))log(id,'view',data.page);send(res,200,{ok:true});return true;}
      if(path==='/api/player/forum'&&req.method==='GET'){send(res,200,forum(Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER,id));return true;}
      const thread=path.match(/^\/api\/player\/forum\/(\d+)$/);
      if(thread&&req.method==='GET'){const row=db.prepare("SELECT id FROM forum_threads WHERE id=? AND status='published' AND deleted_at=''").get(thread[1]);if(!row)throw new Error('帖子不存在或未通过审核。');const topic=db.prepare(`SELECT f.id,f.title,f.body,f.image_data AS imageData,CASE WHEN f.identity_mode='real' THEN (SELECT display_name FROM employees WHERE id=f.employee_id) ELSE p.anonymous_name END AS anonymousName,f.identity_mode AS identityMode,f.created_at AS createdAt,f.edited_at AS editedAt,(f.employee_id=?) AS canEdit,(SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=f.employee_id) AS balance,(SELECT COUNT(*) FROM forum_replies WHERE thread_id=f.id AND status='published' AND deleted_at='') AS replyCount FROM forum_threads f JOIN profiles p ON p.employee_id=f.employee_id WHERE f.id=?`).get(id,thread[1]);topic.imageData=mediaReference('thread',topic.id,topic.imageData);send(res,200,{thread:topic,items:replies(Number(thread[1]),id)});return true;}
      if((path==='/api/player/forum'||thread)&&req.method==='POST') {
        if(!valid(data.body,3000)||(!thread&&!valid(data.title,120)))throw new Error('请填写标题与正文，正文最多 3000 字。');
        const img=image(data.imageData),status=img?'hidden':'published',moderation=img?'pending':'approved',alias=publicProfile(id).anonymousName;
        if(!alias)throw new Error('请先保存匿名名称。');const identityMode=data.identityMode??'anonymous';if(!['anonymous','real'].includes(identityMode))throw new Error('请选择发言身份。');
        let row;
        if(thread){if(!db.prepare("SELECT id FROM forum_threads WHERE id=? AND status='published'").get(thread[1]))throw new Error('帖子不存在。');row=db.prepare('INSERT INTO forum_replies(thread_id,employee_id,anonymous_name,body,image_data,status,moderation) VALUES(?,?,?,?,?,?,?)').run(thread[1],id,alias,data.body.trim(),img,status,moderation);}
        else row=db.prepare('INSERT INTO forum_threads(employee_id,anonymous_name,title,body,image_data,status,moderation) VALUES(?,?,?,?,?,?,?)').run(id,alias,data.title.trim(),data.body.trim(),img,status,moderation);
        db.prepare('UPDATE '+(thread?'forum_replies':'forum_threads')+' SET identity_mode=? WHERE id=?').run(identityMode,row.lastInsertRowid);send(res,201,{id:Number(row.lastInsertRowid),pending:!!img});return true;
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
        const tier={...scratchTiers.find(t=>t.id===data.tier),name:rule.name,cost:rule.cost},proof=random(),outcome=weighted(rule.variants[game.type],proof.random),ticket=generateSealedTicket(tier,game,proof.seed,proof.random,Math.floor(tier.cost*outcome.multiplier));if(outcome.penaltyMultiplier)applyScratchBomb(ticket,outcome.penaltyMultiplier,proof.random);if(data.requestKey)ticket.requestKey=data.requestKey;ticket.revision=config.revision;ticket.multiplier=outcome.multiplier;ticket.rarePrize=scratchPrizeMultipliers[rule.id].includes(outcome.multiplier);
        send(res,200,settle(id,'scratch',tier.cost,ticket.totalPayout,ticket,proof));return true;
      }
      if(path==='/api/player/games/slot'&&req.method==='POST') {
        const cost=bet(data.bet),proof=random(),{prize,result}=spinSlot(cost,proof.random);
        send(res,200,settle(id,'slot',cost,prize,result,proof));return true;
      }
      if(path==='/api/player/games/derby'&&req.method==='POST') {
        const cost=bet(data.bet);if(!Number.isInteger(data.runner)||data.runner<0||data.runner>3)throw new Error('请选择跑道。');
        const proof=random(),winner=derbyWinnerFromRandom(proof.random()),prize=derbyReturn(cost,data.runner,winner,proof.random);
        send(res,200,settle(id,'derby',cost,prize,{winner},proof));return true;
      }
      if(path==='/api/player/games/cards'&&req.method==='POST') {
        const action=data.action;
        if(action==='start'){
          const existing=db.prepare("SELECT id,state_json FROM player_rounds WHERE employee_id=? AND game='cards' ORDER BY id DESC LIMIT 1").get(id);
          if(existing){const state=JSON.parse(existing.state_json);if(state.phase!=='ended'){send(res,200,{...publicCards(state,existing.id),balance:balanceFor(id)});return true;}}
          const proof=random(),state={...newCards(proof.random),seed:proof.seed,seedHash:proof.seedHash};
          const round=saveRound(id,'cards',state);log(id,'cards.start',round,{seedHash:proof.seedHash});send(res,200,{...publicCards(state,round),balance:balanceFor(id)});return true;
        }
        const state=loadRound(id,Number(data.round),'cards');
        transaction(()=>{cardsAction(state,action,data.cards);if(state.phase==='ended'&&!state.settled){state.settled=true;const prize=state.winner===0?20000:0;if(prize)recordLedger(id,prize,'牌桌获胜');db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(id,'cards',0,prize,state.seed,state.seedHash,JSON.stringify({winner:state.winner,round:Number(data.round)}));award(id);}updateRound(data.round,state);log(id,'cards.'+action,data.round,{cards:data.cards||[],winner:state.winner});});
        send(res,200,{...publicCards(state,data.round),balance:balanceFor(id),gameHighlight:getHighlights().roundEvent(id,'cards',Number(data.round))});return true;
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
              const quantity=Math.round(Number(quantityRaw.replaceAll(',','')));
              if(!code)throw new Error('交易失败：缺少证券代码。');
              if(!Number.isFinite(quantity)||!Number.isSafeInteger(quantity))throw new Error('交易失败：数量格式无效。');
              if(quantity<1||quantity>10000)throw new Error('交易失败：数量需在 1~10,000。');
              const stock=db.prepare('SELECT code,price FROM stock_prices WHERE code=?').get(code);
              if(!stock)throw new Error('交易失败：证券代码不存在。');
              const orderType=String(data.orderType??'').toLowerCase()==='limit'?'limit':'market';
              const side=(String(data.side??'').toLowerCase()==='short'||String(data.action??'').toLowerCase()==='sell')?'short':'long';
              const leverage=normalizeLeverage(data.leverage??3);
              const stopLoss=normalizeOptionalPrice(data.stopLoss);
              const takeProfit=normalizeOptionalPrice(data.takeProfit);
              if(orderType==='limit') {
                const limitPrice=normalizeOptionalPrice(data.limitPrice);
                if(limitPrice===null)throw new Error('限价单需填写触发价格。');
                db.prepare("INSERT INTO stock_orders(employee_id,code,side,quantity,leverage,limit_price,stop_loss,take_profit,status) VALUES(?,?,?,?,?,?,?,?,'open')").run(id,stock.code,side,quantity,leverage,limitPrice,stopLoss,takeProfit);
                log(id,'stock.limitOrder',stock.code,{side,quantity,leverage,limitPrice,stopLoss,takeProfit});
                processStockAutomations(id);
              } else {
                validateStopsAgainstPrice(side,stock.price,stopLoss,takeProfit);
                executeStockTrade(id,{stock,delta:side==='long'?quantity:-quantity,leverage,stopLoss,takeProfit});
                award(id);
              }
            }
          }
        });
        send(res,200,{items:market(id),orders:pendingOrders(id),balance:balanceFor(id),market:marketService.history(code,period),serverTime:Date.now()});return true;
      }
      if(path==='/api/player/chat/stream'&&req.method==='GET') {
        const room=url.searchParams.get('room');if(!['sky','derby'].includes(room))throw new Error('聊天室不存在。');
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
        if(!chatStreams.has(room))chatStreams.set(room,new Set());chatStreams.get(room).add(res);
        res.write('data: '+JSON.stringify({items:chatItems(room)})+'\n\n');
        const timer=setInterval(()=>{if(!sessionEmployee(req)){res.end();return;}res.write(': heartbeat\n\n');emitChat(room);},20000);
        res.on('close',()=>{clearInterval(timer);chatStreams.get(room)?.delete(res);});return true;
      }
      if(path==='/api/player/chat') {
        const room=req.method==='POST'?data.room:url.searchParams.get('room');if(!['sky','derby'].includes(room))throw new Error('聊天室不存在。');
        if(req.method==='POST'){if(!valid(data.body,500))throw new Error('消息最多 500 字。');db.prepare('INSERT INTO chat_messages(employee_id,room,alias,body) VALUES(?,?,?,?)').run(id,room,publicProfile(id).anonymousName,data.body.trim());emitChat(room);}
        send(res,200,{items:db.prepare(`SELECT c.id,COALESCE(p.anonymous_name,c.alias) AS alias,c.body,c.created_at AS createdAt FROM chat_messages c LEFT JOIN profiles p ON p.employee_id=c.employee_id WHERE room=? AND c.deleted_at='' ORDER BY c.id DESC LIMIT 80`).all(room).reverse()});return true;
      }
      send(res,404,{error:'接口不存在。'});return true;
    }catch(error){send(res,400,{error:error.message,...(error.code?{code:error.code}:{})});return true;}
  }};
}
