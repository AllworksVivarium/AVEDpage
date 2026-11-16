export function incomeEvents(db,employeeId,after){
 if(after===null){
  const row=db.prepare('SELECT COALESCE(MAX(id),0) AS cursor FROM balance_ledger WHERE employee_id=?').get(employeeId);
  return {cursor:row.cursor,items:[],more:false};
 }
 if(!Number.isSafeInteger(after)||after<0)throw Error('入账记录游标无效。');
 const rows=db.prepare('SELECT id,delta,created_at AS createdAt FROM balance_ledger WHERE employee_id=? AND id>? ORDER BY id LIMIT 51').all(employeeId,after);
 const page=rows.slice(0,50);
 return {cursor:page.at(-1)?.id??after,items:page.filter(row=>row.delta>0).map(row=>({id:row.id,amount:row.delta,createdAt:row.createdAt})),more:rows.length>50};
}
