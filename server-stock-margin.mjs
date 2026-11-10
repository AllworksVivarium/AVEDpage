// Called within the player's existing financial transaction. A retry never debits twice.
export function installStockMargin({db,lots,balanceFor,recordLedger}){
 return function topUp(employeeId,{lotId,amount,requestKey}){
  if(!Number.isSafeInteger(lotId)||lotId<1||!Number.isSafeInteger(amount)||amount<1)throw Error('请选择持仓，并填写正整数金额。');
  if(typeof requestKey!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey))throw Error('追加请求编号无效。');
  const previous=db.prepare('SELECT lot_id,amount FROM stock_margin_topups WHERE employee_id=? AND request_key=?').get(employeeId,requestKey);
  if(previous){if(previous.lot_id!==lotId||previous.amount!==amount)throw Error('追加请求编号已被使用。');return {replayed:true};}
  const lot=lots.list(employeeId).find(l=>l.id===lotId);
  if(!lot)throw Error('该笔持仓已经平仓或不存在。');
  if(!lot.liquidationEligible)throw Error('现金多仓无需追加保证金。');
  if(lot.shouldLiquidate)throw Error('该笔持仓已触及强平线，无法追加保证金。');
  if(balanceFor(employeeId)<amount)throw Error('可用余额不足。');
  const aggregate=db.prepare('SELECT SUM(margin_used) AS margin,SUM(position_notional) AS notional FROM stock_lots WHERE employee_id=? AND code=? AND quantity<>0').get(employeeId,lot.code);
  if(!Number.isSafeInteger(lot.marginUsed+amount)||!Number.isSafeInteger(aggregate.margin+amount))throw Error('追加金额超出限额。');
  recordLedger(employeeId,-amount,'追加保证金 '+lot.code+' · #'+lotId);
  db.prepare('UPDATE stock_lots SET margin_used=margin_used+? WHERE id=? AND employee_id=?').run(amount,lotId,employeeId);
  const margin=aggregate.margin+amount;
  db.prepare('UPDATE stock_holdings SET margin_used=?,cost_basis=?,leverage=? WHERE employee_id=? AND code=?').run(margin,margin,aggregate.notional/margin,employeeId,lot.code);
  db.prepare('INSERT INTO stock_margin_topups(employee_id,lot_id,amount,request_key) VALUES(?,?,?,?)').run(employeeId,lotId,amount,requestKey);
  return {replayed:false};
 };
}
