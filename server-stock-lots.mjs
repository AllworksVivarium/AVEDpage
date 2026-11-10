import {stockPositionRisk} from './stock-risk.mjs';
// Each fill is independent. Aggregate holdings remain a compatible account summary.
export function installStockLots(db){
 db.exec(`CREATE TABLE IF NOT EXISTS stock_lots(
  id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  code TEXT NOT NULL REFERENCES stock_prices(code),quantity INTEGER NOT NULL,
  position_notional INTEGER NOT NULL,margin_used INTEGER NOT NULL,leverage REAL NOT NULL,
  stop_loss INTEGER,take_profit INTEGER,legacy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS stock_lots_open ON stock_lots(employee_id,code,id) WHERE quantity<>0;
  CREATE INDEX IF NOT EXISTS stock_lots_protected ON stock_lots(code,employee_id,id) WHERE quantity<>0 AND (quantity<0 OR position_notional>margin_used OR stop_loss IS NOT NULL OR take_profit IS NOT NULL);
  CREATE INDEX IF NOT EXISTS stock_trades_history ON stock_trades(employee_id,id DESC);
  CREATE TABLE IF NOT EXISTS stock_lot_migrations(name TEXT PRIMARY KEY);`);
 const tradeColumns=new Set(db.prepare('PRAGMA table_info(stock_trades)').all().map(c=>c.name));
 for(const name of ['intent','position_side','close_reason'])if(!tradeColumns.has(name))db.exec(`ALTER TABLE stock_trades ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
 function migrate(){
  if(db.prepare("SELECT 1 FROM stock_lot_migrations WHERE name='lots-v1'").get())return;
  const owned=!db.isTransaction;if(owned)db.exec('BEGIN IMMEDIATE');
  try{
   // Run after startup's legacy split. Never invent historical fills or alter cash.
   db.exec(`INSERT INTO stock_lots(employee_id,code,quantity,position_notional,margin_used,leverage,stop_loss,take_profit,legacy)
    SELECT employee_id,code,quantity,CASE WHEN position_notional>0 THEN position_notional ELSE cost_basis*MAX(leverage,1) END,
    CASE WHEN margin_used>0 THEN margin_used ELSE cost_basis END,CASE WHEN position_notional>0 AND (margin_used>0 OR cost_basis>0) THEN ROUND(1.0*position_notional/CASE WHEN margin_used>0 THEN margin_used ELSE cost_basis END,2) ELSE MAX(leverage,1) END,stop_loss,take_profit,1 FROM stock_holdings WHERE quantity<>0;
    INSERT INTO stock_lot_migrations VALUES('lots-v1');`);
   if(owned)db.exec('COMMIT');
  }catch(e){if(owned)db.exec('ROLLBACK');throw e;}
 }
 const select=`SELECT l.id,l.code,l.quantity AS holding,l.position_notional AS positionNotional,l.margin_used AS marginUsed,
  l.leverage,l.stop_loss AS stopLoss,l.take_profit AS takeProfit,l.legacy,l.created_at AS createdAt,s.name,s.price
  FROM stock_lots l JOIN stock_prices s ON s.code=l.code WHERE l.employee_id=? AND l.quantity<>0`;
 function list(id){migrate();return db.prepare(select+' ORDER BY l.id DESC').all(id).map(l=>({...l,avgCost:l.positionNotional/Math.abs(l.holding),unrealizedPnl:Math.sign(l.holding)*(Math.abs(l.holding)*l.price-l.positionNotional),...stockPositionRisk(l)}));}
 function plan(id,code,delta,price,leverage,lotId=null,intent='auto'){
  const lots=list(id).filter(l=>l.code===code).sort((a,b)=>a.id-b.id),held=lots.reduce((n,l)=>n+l.holding,0);
  if(lotId!==null&&(!Number.isSafeInteger(lotId)||lotId<1))throw new Error('持仓编号无效。');
  const chosen=(lotId===null?lots:lots.filter(l=>l.id===lotId)).filter(l=>Math.sign(l.holding)!==Math.sign(delta));
  if(lotId!==null&&(!chosen.length||Math.sign(chosen[0].holding)===Math.sign(delta)||Math.abs(delta)>Math.abs(chosen[0].holding)))throw new Error('该笔持仓不存在或平仓数量超出持仓。');
  const available=chosen.reduce((n,l)=>n+Math.abs(l.holding),0);
  if((intent==='close'||lotId!==null)&&Math.abs(delta)>available)throw new Error('平仓数量超出持仓。');
  const closeQuantity=intent==='open'?0:Math.min(Math.abs(delta),available);
  let remaining=closeQuantity,closeNotional=0,closeMargin=0;const changes=[];
  for(const lot of chosen){if(!remaining)break;const qty=Math.min(remaining,Math.abs(lot.holding)),full=qty===Math.abs(lot.holding);
   const notional=full?lot.positionNotional:Math.round(lot.positionNotional*qty/Math.abs(lot.holding));
   const margin=full?lot.marginUsed:Math.round(lot.marginUsed*qty/Math.abs(lot.holding));
   changes.push({lot,qty,notional,margin});closeNotional+=notional;closeMargin+=margin;remaining-=qty;
  }
  if(remaining)throw new Error('平仓数量超出持仓。');
  const openQuantity=Math.abs(delta)-closeQuantity,openNotional=openQuantity*price,openMargin=openQuantity?Math.ceil(openNotional/leverage):0;
  const pnl=changes.reduce((n,c)=>n+Math.sign(c.lot.holding)*(c.qty*price-c.notional),0);
  return {held,next:held+delta,changes,closeQuantity,openQuantity,openNotional,openMargin,closeNotional,closeMargin,pnl,
   nextNotional:lots.reduce((n,l)=>n+l.positionNotional,0)-closeNotional+openNotional,
   nextMargin:lots.reduce((n,l)=>n+l.marginUsed,0)-closeMargin+openMargin};
 }
 function apply(id,code,delta,leverage,stopLoss,takeProfit,plan){
  for(const c of plan.changes)db.prepare('UPDATE stock_lots SET quantity=quantity-?,position_notional=position_notional-?,margin_used=margin_used-? WHERE id=?').run(Math.sign(c.lot.holding)*c.qty,c.notional,c.margin,c.lot.id);
  if(plan.openQuantity)db.prepare('INSERT INTO stock_lots(employee_id,code,quantity,position_notional,margin_used,leverage,stop_loss,take_profit) VALUES(?,?,?,?,?,?,?,?)').run(id,code,Math.sign(delta)*plan.openQuantity,plan.openNotional,plan.openMargin,leverage,stopLoss,takeProfit);
 }
 const closed="(intent IN ('close','mixed') OR (intent='' AND holding_before<>0 AND ((holding_before>0 AND action='sell') OR (holding_before<0 AND action='buy'))))";
 function history(id,before=null){
  if(before!==null&&(!Number.isSafeInteger(before)||before<1))throw new Error('记录游标无效。');
  const rows=db.prepare(`SELECT id,code,action,quantity,price,leverage,intent,position_side AS positionSide,close_reason AS closeReason,holding_before AS holdingBefore,holding_after AS holdingAfter,realized_pnl_change AS pnl,created_at AS createdAt,CASE WHEN ${closed} THEN 1 ELSE 0 END AS closing FROM stock_trades WHERE employee_id=? AND id<? ORDER BY id DESC LIMIT 21`).all(id,before??Number.MAX_SAFE_INTEGER);
  const summary=db.prepare(`SELECT COUNT(*) AS closedCount,COALESCE(SUM(realized_pnl_change>0),0) AS wins,COALESCE(SUM(realized_pnl_change=0),0) AS draws,COALESCE(SUM(realized_pnl_change),0) AS realizedPnl FROM stock_trades WHERE employee_id=? AND ${closed}`).get(id);
  return {items:rows.slice(0,20),nextCursor:rows.length>20?rows[19].id:null,summary:{...summary,winRate:summary.closedCount?summary.wins/summary.closedCount:null}};
 }
 return {list,plan,apply,history,migrate};
}
