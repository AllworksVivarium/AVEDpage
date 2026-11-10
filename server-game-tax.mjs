// New settlements only. Debits, receipts and fund credits share their caller's transaction.
export const GAME_TAX_PERCENT=3;
export function gameTaxAmount(cost,prize,penalty=0){for(const n of [cost,prize,penalty])if(!Number.isSafeInteger(n)||n<0)throw Error('游戏税费金额无效。');return Math.floor(Math.max(0,prize-cost-penalty)*GAME_TAX_PERCENT/100);}
export function installGameTax({db,recordLedger}){
 db.exec(`CREATE TABLE IF NOT EXISTS game_tax_receipts(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,game TEXT NOT NULL,settlement_key TEXT NOT NULL,cost INTEGER NOT NULL,prize INTEGER NOT NULL,penalty INTEGER NOT NULL,tax INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(employee_id,game,settlement_key));`);
 function charge({employeeId,game,key,cost,prize,penalty=0}){
  if(!db.isTransaction)throw Error('游戏税费须随结算一并提交。');if(!['scratch','slot','sky','derby','cards'].includes(game))throw Error('税费玩法无效。');
  const tax=gameTaxAmount(cost,prize,penalty);if(!tax)return 0;
  const previous=db.prepare('SELECT cost,prize,penalty,tax FROM game_tax_receipts WHERE employee_id=? AND game=? AND settlement_key=?').get(employeeId,game,String(key));
  if(previous){if(previous.cost!==cost||previous.prize!==prize||previous.penalty!==penalty)throw Error('税费结算不匹配。');return previous.tax;}
  const row=db.prepare('INSERT INTO game_tax_receipts(employee_id,game,settlement_key,cost,prize,penalty,tax) VALUES(?,?,?,?,?,?,?)').run(employeeId,game,String(key),cost,prize,penalty,tax);
  const ledger=recordLedger(employeeId,-tax,'小游戏净收益税 3% · '+game+' #'+row.lastInsertRowid);
  db.prepare("INSERT INTO company_fund(employee_id,amount,kind,source_ledger_id,request_key) VALUES(?,?,'game_tax',?,?)").run(employeeId,tax,Number(ledger.lastInsertRowid),'game-tax:'+row.lastInsertRowid);
  return tax;
 }
 return {charge};
}
