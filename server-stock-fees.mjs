// Fees already deducted by the trade are transferred here, within the same transaction.
export function installStockFeeFund(db) {
  if (!db.prepare('PRAGMA table_info(stock_trades)').all().some(c => c.name === 'fee')) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS company_fund_migrations(name TEXT PRIMARY KEY);
      CREATE INDEX IF NOT EXISTS company_fund_kind_amount ON company_fund(kind,amount);`);
    if (!db.prepare("SELECT 1 FROM company_fund_migrations WHERE name='stock-fees-v1'").get()) {
      db.exec(`INSERT INTO company_fund(employee_id,amount,kind,request_key,created_at)
        SELECT employee_id,fee,'stock_fee','stock-fee-backfill:'||id,created_at
        FROM stock_trades WHERE fee>0;
        INSERT INTO company_fund_migrations VALUES('stock-fees-v1');`);
    }
    // A random suffix avoids reusing a receipt if an account/trade is later deleted
    // and SQLite reuses its integer ID. The fund survives account deletion.
    db.exec(`CREATE TRIGGER IF NOT EXISTS stock_fee_to_company_fund AFTER INSERT ON stock_trades
      WHEN NEW.fee>0 BEGIN
      INSERT INTO company_fund(employee_id,amount,kind,request_key,created_at)
      VALUES(NEW.employee_id,NEW.fee,'stock_fee',
        'stock-fee:'||NEW.id||':'||lower(hex(randomblob(16))),NEW.created_at);
      END;`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function stockFeeTotals(db) {
  return db.prepare(`SELECT COALESCE(SUM(amount),0) AS total,COUNT(*) AS trades
    FROM company_fund WHERE kind='stock_fee'`).get();
}
