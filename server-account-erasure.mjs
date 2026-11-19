import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const quote=s=>'"'+s.replaceAll('"','""')+'"';
const ownerColumns=['employee_id','employeeId','actor_id','sender_id','recipient_id','payer_id','owner_id','user_id','robot_employee_id'];
const weakColumns=['created_by','deleted_by','reviewed_by'];
const sources={thread:'forum_threads',reply:'forum_replies',comment:'posts',chat:'chat_messages',life:'life_records',dossier:'dossier_comments',announcement:'announcements'};
const accountKeys=new Set([...ownerColumns,'employeeId','actorId','senderId','recipientId','payerId','ownerId','userId','created_by','createdBy','reviewed_by','reviewedBy','deleted_by','deletedBy']);

// The caller owns the transaction, including refunds. No foreign keys are disabled.
export function purgeEmployeeData(db,employee,{recordLedger}={}){
 if(!db.isTransaction)throw Error('Account erasure requires a transaction.');
 const id=employee.id;
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
 const meta=new Map(tables.map(table=>[table,{columns:db.prepare(`PRAGMA table_info(${quote(table)})`).all(),foreign:db.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all()}]));
 const has=(table,column)=>meta.get(table)?.columns.some(c=>c.name===column);
 const exists=table=>meta.has(table);
 const run=(sql,...args)=>db.prepare(sql).run(...args);
 const refund=(recipient,amount,reason)=>{
  if(recipient===id||!amount||!db.prepare('SELECT 1 FROM employees WHERE id=?').get(recipient))return;
  if(recordLedger)recordLedger(recipient,amount,reason);
  else run('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)',recipient,amount,reason);
 };
 const rooms=[];
 // Cancel the shared table before removing its participant; release other people's escrow.
 if(exists('card_table_rooms'))for(const row of db.prepare('SELECT id,state_json FROM card_table_rooms').all()){
  const room=JSON.parse(row.state_json);
  if(room.seats?.some(p=>p&&!p.bot&&p.id===id)||room.host===id)rooms.push(row.id);
 }
 if(exists('card_money_rounds')&&exists('card_money_seats')){
  for(const round of db.prepare('SELECT r.* FROM card_money_rounds r WHERE r.settlement_json IS NULL AND EXISTS(SELECT 1 FROM card_money_seats s WHERE s.round_id=r.id AND s.employee_id=?)').all(id)){
   if(!rooms.includes(round.room_id))rooms.push(round.room_id);
   for(const seat of db.prepare('SELECT employee_id,reserve FROM card_money_seats WHERE round_id=? AND employee_id IS NOT NULL').all(round.id))refund(seat.employee_id,seat.reserve,'智斗太姥退回锁定筹码');
   run('UPDATE card_money_rounds SET settlement_json=?,system_delta=0 WHERE id=?',JSON.stringify({cancelled:true,players:[]}),round.id);
  }
 }
 if(exists('bar_stored_drinks'))for(const gift of db.prepare("SELECT sender_id,price FROM bar_stored_drinks WHERE recipient_id=? AND sender_id<>? AND status='pending'").all(id,id))refund(gift.sender_id,gift.price,'吧台留酒未领用退回');

 db.exec('CREATE TEMP TABLE account_erasure_rows(table_name TEXT NOT NULL,row_id INTEGER NOT NULL,PRIMARY KEY(table_name,row_id))');
 const planned=(table,alias='')=>`${alias?quote(alias)+'.':''}rowid IN (SELECT row_id FROM temp.account_erasure_rows WHERE table_name='${table.replaceAll("'","''")}')`;
 const mark=(table,where,args=[])=>Number(run(`INSERT OR IGNORE INTO temp.account_erasure_rows SELECT ?,rowid FROM ${quote(table)} WHERE ${where}`,table,...args).changes);
 try{
  mark('employees','id=?',[id]);
  if(exists('employee_donations')&&exists('balance_ledger'))for(const donation of db.prepare('SELECT * FROM employee_donations WHERE sender_id=? OR recipient_id=?').all(id,id)){
   const counterpart=donation.sender_id===id?donation.recipient_ledger_id:donation.sender_ledger_id;
   run("UPDATE balance_ledger SET reason='员工捐赠' WHERE id=? AND employee_id<>?",counterpart,id);
   if(has('activity_logs','details'))mark('activity_logs',"target='balance_ledger' AND CASE WHEN json_valid(details) THEN json_extract(details,'$.id') END=?",[counterpart]);
  }
  for(const [table,m] of meta){
   if(table==='employees')continue;
   const columns=new Set(m.columns.map(c=>c.name));
   const owners=new Set(ownerColumns.filter(c=>columns.has(c)));
   for(const f of m.foreign)if(f.table==='employees'&&!weakColumns.includes(f.from))owners.add(f.from);
   if(table==='company_fund')owners.delete('employee_id');
   if(table==='announcements'&&columns.has('created_by'))owners.add('created_by');
   if(owners.size)mark(table,[...owners].map(c=>`${quote(c)}=?`).join(' OR '),[...owners].map(()=>id));
   if(['activity_logs','image_upload_archive','event_account_history'].includes(table)&&columns.has('username'))mark(table,'username=?',[employee.username]);
  }
  for(const room of rooms)if(exists('card_table_rooms'))mark('card_table_rooms','id=?',[room]);
  // JSON audit snapshots can refer to the account even when the operator is someone else.
  if(has('activity_logs','details')){
   const path=`/api/admin/employees/${id}`;
   mark('activity_logs',`target=? OR substr(target,1,?)=? OR (target='employees' AND CASE WHEN json_valid(details) THEN json_extract(details,'$.id') END=?) OR EXISTS(
    SELECT 1 FROM json_tree(CASE WHEN json_valid(details) THEN details ELSE '{}' END) j
    WHERE (j.key IN (${[...accountKeys].map(k=>"'"+k+"'").join(',')}) AND CAST(j.atom AS TEXT)=?) OR (j.key='username' AND j.atom=?))`,[path,path.length+1,path+'/',id,String(id),employee.username]);
  }
  let added;
  do{
   added=0;
   for(const [table,m] of meta){
    const groups=Map.groupBy(m.foreign,f=>f.id);
    for(const group of groups.values()){
     const parent=group[0].table;if(!exists(parent)||group[0].on_delete==='SET NULL'||group[0].on_delete==='SET DEFAULT')continue;
     const joins=group.map(f=>`c.${quote(f.from)}=p.${quote(f.to||meta.get(parent).columns.find(c=>c.pk)?.name||'id')}`).join(' AND ');
     added+=mark(table,`rowid IN (SELECT c.rowid FROM ${quote(table)} c JOIN ${quote(parent)} p ON ${joins} WHERE ${planned(parent,'p')})`);
    }
   }
   for(const [kind,parent] of Object.entries(sources))if(exists(parent)){
    for(const archive of ['speech_revisions','image_upload_archive'])if(has(archive,'source_type'))added+=mark(archive,`source_type=? AND source_id IN (SELECT id FROM ${quote(parent)} WHERE ${planned(parent)})`,[kind]);
    if(has('activity_logs','details'))added+=mark('activity_logs',`target=? AND CASE WHEN json_valid(details) THEN json_extract(details,'$.id') END IN (SELECT id FROM ${quote(parent)} WHERE ${planned(parent)})`,[parent]);
   }
   for(const [child,key,parent] of [['bar_servings','order_id','bar_orders'],['bar_pours','order_id','bar_orders'],['bar_sips','order_id','bar_orders'],['bar_cheers','sender_order','bar_orders'],['bar_cheers','recipient_order','bar_orders'],['bar_orders','gift_id','bar_gifts'],['bar_orders','round_id','bar_rounds']])if(has(child,key)&&exists(parent))added+=mark(child,`${quote(key)} IN (SELECT id FROM ${quote(parent)} WHERE ${planned(parent)})`);
   for(const [kind,parent] of [['thread','forum_threads'],['reply','forum_replies']])if(exists('forum_reactions')&&exists(parent))added+=mark('forum_reactions',`target_kind=? AND target_id IN (SELECT id FROM ${quote(parent)} WHERE ${planned(parent)})`,[kind]);
  }while(added);

  // Fund totals belong to the company. Remove attribution, not other people's money.
  if(has('company_fund','employee_id')){
   const linked=has('company_fund','source_ledger_id')&&exists('balance_ledger')?` OR source_ledger_id IN (SELECT id FROM balance_ledger WHERE ${planned('balance_ledger')})`:'';
   const assignments=['employee_id=NULL',...(has('company_fund','source_ledger_id')?['source_ledger_id=NULL']:[]),...(has('company_fund','request_key')?['request_key=NULL']:[])];
   run(`UPDATE company_fund SET ${assignments.join(',')} WHERE employee_id=?${linked}`,id);
  }
  for(const [table,m] of meta)for(const column of weakColumns)if(has(table,column)){
   const nullable=!m.columns.find(c=>c.name===column).notnull;
   const extra=column==='reviewed_by'&&has(table,'reviewer_name')?",reviewer_name=''":'';
   if(nullable)run(`UPDATE ${quote(table)} SET ${quote(column)}=NULL${extra} WHERE ${quote(column)}=? AND NOT (${planned(table)})`,id);
   else mark(table,`${quote(column)}=?`,[id]);
  }
  const counts={};
  for(const table of tables.filter(t=>t!=='employees'))counts[table]=Number(run(`DELETE FROM ${quote(table)} WHERE ${planned(table)}`).changes);
  counts.employees=Number(run('DELETE FROM employees WHERE id=?',id).changes);
  // Account-deletion triggers may have written one last history row. Remove it too.
  for(const [table,m] of meta)if(table!=='employees'){
   const own=ownerColumns.filter(c=>has(table,c)&&!(table==='company_fund'&&c==='employee_id'));
   if(own.length)counts[table]=(counts[table]||0)+Number(run(`DELETE FROM ${quote(table)} WHERE ${own.map(c=>quote(c)+'=?').join(' OR ')}`,...own.map(()=>id)).changes);
  }
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Account erasure left an invalid reference.');
  return {rooms,deleted:counts};
 }finally{db.exec('DROP TABLE temp.account_erasure_rows');}
}

export function eraseEmployeeAccount({db,dataDir,employeeId,recordLedger,lockTimeoutMs=5000}){
 const employee=db.prepare('SELECT * FROM employees WHERE id=?').get(employeeId);
 if(!employee)return null;
 const snapshots=[],connections=[];
 const maintenanceLock=new DatabaseSync(resolve(dataDir,'maintenance-lock.sqlite'));
 const directory=resolve(dataDir,'daily-backups');
 try{
  try{maintenanceLock.exec(`PRAGMA busy_timeout=${Math.max(0,Math.floor(lockTimeoutMs))};BEGIN IMMEDIATE`);}
  catch(error){throw Object.assign(Error('Account erasure is waiting for scheduled maintenance.'),{status:503,cause:error});}
  if(existsSync(directory))for(const file of readdirSync(directory))if(/^(?:daily|five-day)-\d{4}-\d{2}-\d{2}\.sqlite$/.test(file)){
   const snapshot=new DatabaseSync(resolve(directory,file));snapshots.push(snapshot);
   snapshot.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;PRAGMA secure_delete=ON');
   const saved=snapshot.prepare('SELECT * FROM employees WHERE id=?').get(employeeId);
   if(saved&&saved.created_at===employee.created_at){
    if(saved.username!==employee.username&&(!saved.password_hash||saved.password_hash!==employee.password_hash))throw Error('备份中的账号身份无法确认，删除已取消。');
    connections.push({db:snapshot,employee:saved});
   }
  }
  connections.push({db,employee});
  for(const item of connections)item.db.exec('PRAGMA secure_delete=ON;BEGIN IMMEDIATE;PRAGMA defer_foreign_keys=ON');
  let result;
  for(const item of connections){const report=purgeEmployeeData(item.db,item.employee,{recordLedger:item.db===db?recordLedger:undefined});if(item.db===db)result=report;}
  // Sanitize existing recovery snapshots before the live deletion becomes visible.
  for(const item of connections)item.db.exec('COMMIT');
  for(const item of connections)item.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  return {...result,snapshotsSanitized:connections.length-1};
 }catch(error){for(const item of connections)if(item.db.isTransaction)item.db.exec('ROLLBACK');throw error;}
 finally{for(const snapshot of snapshots)snapshot.close();if(maintenanceLock.isTransaction)maintenanceLock.exec('ROLLBACK');maintenanceLock.close();}
}
