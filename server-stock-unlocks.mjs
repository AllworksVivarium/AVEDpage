import {stockRiskRules} from './stock-risk.mjs';
import {stockEquityByEmployee} from './server-stock-equity.mjs';

// Cash peaks are maintained by personal_metrics; stock equity is observed only
// at completed transactions and quote updates, preserving account milestones.
export function installStockUnlocks(db){
 db.exec(`CREATE TABLE IF NOT EXISTS stock_leverage_unlocks(
  employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  max_leverage INTEGER NOT NULL,qualifying_assets INTEGER NOT NULL DEFAULT 0,
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS stock_leverage_migrations(name TEXT PRIMARY KEY);`);
 if(!db.prepare("SELECT 1 FROM stock_leverage_migrations WHERE name='historical-trades-v1'").get()){
  const owned=!db.isTransaction;if(owned)db.exec('BEGIN IMMEDIATE');
  try{
   db.exec(`INSERT INTO stock_leverage_unlocks(employee_id,max_leverage)
    SELECT employee_id,MAX(leverage) FROM stock_trades WHERE leverage IN (3,10) GROUP BY employee_id
    ON CONFLICT(employee_id) DO UPDATE SET max_leverage=MAX(max_leverage,excluded.max_leverage);
    INSERT INTO stock_leverage_migrations VALUES('historical-trades-v1');`);
   if(owned)db.exec('COMMIT');
  }catch(e){if(owned)db.exec('ROLLBACK');throw e;}
 }
 const saved=db.prepare('SELECT max_leverage AS maxLeverage FROM stock_leverage_unlocks WHERE employee_id=?');
 const metrics=db.prepare('SELECT balance,peak FROM personal_metrics WHERE employee_id=?');
 const position=db.prepare(`SELECT COALESCE(SUM(l.margin_used+CASE WHEN l.quantity>0 THEN 1 ELSE -1 END*(ABS(l.quantity)*p.price-l.position_notional)),0) AS equity
  FROM stock_lots l JOIN stock_prices p ON p.code=l.code WHERE l.employee_id=? AND l.quantity<>0`);
 const store=db.prepare(`INSERT INTO stock_leverage_unlocks(employee_id,max_leverage,qualifying_assets) VALUES(?,?,?)
  ON CONFLICT(employee_id) DO UPDATE SET max_leverage=excluded.max_leverage,qualifying_assets=excluded.qualifying_assets,unlocked_at=CURRENT_TIMESTAMP
  WHERE excluded.max_leverage>stock_leverage_unlocks.max_leverage`);
 function level(assets){return assets>stockRiskRules.leverageAssetThresholds[10]?10:assets>stockRiskRules.leverageAssetThresholds[3]?3:1;}
 function remember(id,assets,previous=saved.get(id)?.maxLeverage||1){
  const next=Math.max(previous,level(assets));if(next>previous)store.run(id,next,assets);return next;
 }
 function status(id){
  const cash=metrics.get(id)||{balance:0,peak:0},assets=Math.max(cash.peak,cash.balance+position.get(id).equity);
  const maxLeverage=remember(id,assets);
  return {unlockedLeverages:[1,3,10].filter(value=>value<=maxLeverage)};
 }
 function capture(ids){
  if(ids){for(const id of ids)status(id);return;}
  const equity=stockEquityByEmployee(db);
  const rows=db.prepare(`SELECT m.employee_id AS id,m.balance,m.peak,COALESCE(u.max_leverage,1) AS maxLeverage
   FROM personal_metrics m LEFT JOIN stock_leverage_unlocks u ON u.employee_id=m.employee_id`).all();
  for(const row of rows)if(row.maxLeverage<10)remember(row.id,Math.max(row.peak,row.balance+(equity.get(row.id)?.equity||0)),row.maxLeverage);
 }
 return {status,capture};
}
