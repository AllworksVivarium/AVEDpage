// A negative-balance reset is a company expense, not newly created free money.
// Only future resets are covered; historical balances and ledgers stay intact.
export function installDebtRelief(db){
 db.exec(`CREATE TRIGGER IF NOT EXISTS fund_debt_reset AFTER INSERT ON balance_ledger
 WHEN NEW.reason='主动归零' AND NEW.delta>0
 BEGIN INSERT INTO company_fund(employee_id,amount,kind,source_ledger_id)
 VALUES(NEW.employee_id,-NEW.delta,'debt_relief',NEW.id); END;`);
}

// A separate, explicit operation: donations never accept negative amounts.
// The existing reset trigger records the company expense in this transaction.
export function transferDebt({db,employeeId,expectedDebt,requestId,balanceFor,recordLedger}){
 if(!Number.isSafeInteger(expectedDebt)||expectedDebt<1)throw Error('请确认当前负债金额。');
 if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(requestId))throw Error('请重新提交负债委托。');
 const key='debt-transfer:'+employeeId+':'+requestId;
 db.exec('BEGIN IMMEDIATE');
 try{
  const previous=db.prepare("SELECT amount FROM company_fund WHERE request_key=? AND kind='debt_relief'").get(key);
  if(previous){
   if(-previous.amount!==expectedDebt)throw Error('此委托已使用，请重新确认负债。');
   db.exec('COMMIT');return {amount:expectedDebt,repeated:true};
  }
  const balance=balanceFor(employeeId);
  if(balance>=0)throw Error('当前没有需要转交的负债。');
  if(-balance!==expectedDebt)throw Object.assign(Error('余额已变化，请重新确认负债金额。'),{code:'BALANCE_CHANGED'});
  const ledger=recordLedger(employeeId,-balance,'主动归零');
  const updated=db.prepare("UPDATE company_fund SET request_key=? WHERE source_ledger_id=? AND employee_id=? AND kind='debt_relief' AND amount=?").run(key,Number(ledger.lastInsertRowid),employeeId,balance);
  if(updated.changes!==1)throw Error('公司账单未能入账，请重试。');
  db.exec('COMMIT');return {amount:-balance,repeated:false};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
