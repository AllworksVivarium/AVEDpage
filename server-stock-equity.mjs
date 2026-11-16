// Read all accounts in one aggregation using the same mark-to-market as positions.
export function stockEquityByEmployee(db){
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 if(!tables.has('stock_prices'))return new Map();
 const migrated=tables.has('stock_lot_migrations')&&db.prepare("SELECT 1 FROM stock_lot_migrations WHERE name='lots-v1'").get();
 let source;
 if(migrated&&tables.has('stock_lots')){
  source='SELECT employee_id,code,quantity,margin_used AS margin,position_notional AS notional FROM stock_lots WHERE quantity<>0';
 }else if(tables.has('stock_holdings')){
  source=`SELECT employee_id,code,quantity,CASE WHEN margin_used>0 THEN margin_used ELSE cost_basis END AS margin,
   CASE WHEN position_notional>0 THEN position_notional ELSE cost_basis*MAX(leverage,1) END AS notional
   FROM stock_holdings WHERE quantity<>0`;
 }else return new Map();
 const rows=db.prepare(`SELECT h.employee_id AS employeeId,SUM(h.margin) AS margin,
  SUM(CASE WHEN h.quantity>0 THEN 1 ELSE -1 END*(ABS(h.quantity)*s.price-h.notional)) AS unrealizedPnl
  FROM (${source}) h JOIN stock_prices s ON s.code=h.code GROUP BY h.employee_id`).all();
 return new Map(rows.map(row=>[row.employeeId,{margin:row.margin,unrealizedPnl:row.unrealizedPnl,equity:row.margin+row.unrealizedPnl}]));
}
