// Called within the player's existing financial transaction. A retry never debits twice.
import {randomUUID} from 'node:crypto';
import {stockPositionRisk} from './stock-risk.mjs';

export function installStockMargin({db,lots,balanceFor,recordLedger}){
 db.exec(`CREATE TABLE IF NOT EXISTS stock_preferences(employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,auto_margin INTEGER NOT NULL DEFAULT 0 CHECK(auto_margin IN (0,1)));`);
 if(!db.prepare('PRAGMA table_info(stock_margin_topups)').all().some(c=>c.name==='automatic'))db.exec('ALTER TABLE stock_margin_topups ADD COLUMN automatic INTEGER NOT NULL DEFAULT 0');
 const preferences=id=>({autoMargin:!!db.prepare('SELECT auto_margin FROM stock_preferences WHERE employee_id=?').get(id)?.auto_margin});
 function setPreferences(id,enabled){if(typeof enabled!=='boolean')throw Error('请选择是否自动补保证金。');db.prepare('INSERT INTO stock_preferences VALUES(?,?) ON CONFLICT(employee_id) DO UPDATE SET auto_margin=excluded.auto_margin').run(id,Number(enabled));return preferences(id);}
 function transfer(employeeId,lot,amount,requestKey,automatic=false){
  if(balanceFor(employeeId)<amount)throw Error('可用余额不足。');
  const aggregate=db.prepare('SELECT SUM(margin_used) AS margin,SUM(position_notional) AS notional FROM stock_lots WHERE employee_id=? AND code=? AND quantity<>0').get(employeeId,lot.code);
  if(!Number.isSafeInteger(lot.marginUsed+amount)||!Number.isSafeInteger(aggregate.margin+amount))throw Error('追加金额超出限额。');
  recordLedger(employeeId,-amount,(automatic?'自动追加保证金 ':'追加保证金 ')+lot.code+' · #'+lot.id);
  db.prepare('UPDATE stock_lots SET margin_used=margin_used+? WHERE id=? AND employee_id=?').run(amount,lot.id,employeeId);
  const margin=aggregate.margin+amount;
  db.prepare('UPDATE stock_holdings SET margin_used=?,cost_basis=?,leverage=? WHERE employee_id=? AND code=?').run(margin,margin,aggregate.notional/margin,employeeId,lot.code);
  db.prepare('INSERT INTO stock_margin_topups(employee_id,lot_id,amount,request_key,automatic) VALUES(?,?,?,?,?)').run(employeeId,lot.id,amount,requestKey,Number(automatic));
 }
 function topUp(employeeId,{lotId,amount,requestKey}){
  if(!Number.isSafeInteger(lotId)||lotId<1||!Number.isSafeInteger(amount)||amount<1)throw Error('请选择持仓，并填写正整数金额。');
  if(typeof requestKey!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey))throw Error('追加请求编号无效。');
  const previous=db.prepare('SELECT lot_id,amount FROM stock_margin_topups WHERE employee_id=? AND request_key=?').get(employeeId,requestKey);
  if(previous){if(previous.lot_id!==lotId||previous.amount!==amount)throw Error('追加请求编号已被使用。');return {replayed:true};}
  const lot=lots.list(employeeId).find(l=>l.id===lotId);
  if(!lot)throw Error('该笔持仓已经平仓或不存在。');
  if(!lot.liquidationEligible)throw Error('现金多仓无需追加保证金。');
  if(lot.shouldLiquidate)throw Error('该笔持仓已触及强平线，无法追加保证金。');
  transfer(employeeId,lot,amount,requestKey);
  return {replayed:false};
 }
 // The existing quote transaction owns this call, including offline accounts.
 // Rescue precedes liquidation; uncommitted balances are shared in lot-id order.
 function autoTopUp(employeeId=null){
  const due=db.prepare(`SELECT l.id,l.employee_id AS employeeId,l.code,l.quantity AS holding,l.position_notional AS positionNotional,l.margin_used AS marginUsed,s.price
   FROM stock_lots l JOIN stock_preferences p ON p.employee_id=l.employee_id AND p.auto_margin=1 JOIN stock_prices s ON s.code=l.code
   WHERE l.quantity<>0 AND (l.quantity<0 OR l.position_notional>l.margin_used) AND (? IS NULL OR l.employee_id=?)
   AND l.margin_used+CASE WHEN l.quantity>0 THEN l.quantity*s.price-l.position_notional ELSE l.position_notional+l.quantity*s.price END <= (l.margin_used+4)/5 ORDER BY l.id`).all(employeeId,employeeId);
  for(const lot of due){
   const available=balanceFor(lot.employeeId);if(!Number.isSafeInteger(available)||available<1)continue;
   const risk=stockPositionRisk(lot),loss=lot.marginUsed-risk.positionEquity;
   if(!Number.isSafeInteger(loss)||loss<1)continue;
   // (margin + amount - loss)/(margin + amount) >= 40%, rounded up.
   const required=(BigInt(loss)*5n+2n)/3n-BigInt(lot.marginUsed);
   const totalMargin=db.prepare('SELECT SUM(margin_used) AS margin FROM stock_lots WHERE employee_id=? AND code=? AND quantity<>0').get(lot.employeeId,lot.code).margin;
   const capacity=Math.min(Number.MAX_SAFE_INTEGER-lot.marginUsed,Number.MAX_SAFE_INTEGER-totalMargin);
   const amount=Math.min(available,capacity,required>BigInt(Number.MAX_SAFE_INTEGER)?Number.MAX_SAFE_INTEGER:Number(required));
   if(amount>0)transfer(lot.employeeId,lot,amount,'auto_'+randomUUID(),true);
  }
 }
 return {topUp,autoTopUp,preferences,setPreferences};
}
