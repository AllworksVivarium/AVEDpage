export function installBegging({db,send,readBody,requireEmployee,balanceFor,recordLedger,highest,isContainment,clock=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS employee_begging_requests(
  id INTEGER PRIMARY KEY,sender_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,request_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  amount INTEGER NOT NULL DEFAULT 0 CHECK(amount BETWEEN 0 AND 1000000),requested_amount INTEGER CHECK(requested_amount BETWEEN 1 AND 1000000),
  donation_id INTEGER REFERENCES employee_donations(id) ON DELETE SET NULL,created_at INTEGER NOT NULL,resolved_at INTEGER,sender_seen_at INTEGER,
  CHECK(sender_id<>recipient_id));
  CREATE UNIQUE INDEX IF NOT EXISTS begging_pending_pair ON employee_begging_requests(sender_id,recipient_id) WHERE status='pending';
  CREATE INDEX IF NOT EXISTS begging_recipient ON employee_begging_requests(recipient_id,status,id);`);
 if(!db.prepare('PRAGMA table_info(employee_begging_requests)').all().some(column=>column.name==='sender_seen_at'))db.exec('ALTER TABLE employee_begging_requests ADD COLUMN sender_seen_at INTEGER');
 if(!db.prepare('PRAGMA table_info(employee_begging_requests)').all().some(column=>column.name==='requested_amount'))db.exec('ALTER TABLE employee_begging_requests ADD COLUMN requested_amount INTEGER CHECK(requested_amount BETWEEN 1 AND 1000000)');
 db.exec('CREATE INDEX IF NOT EXISTS begging_sender_unread ON employee_begging_requests(sender_id,status,sender_seen_at)');
 // Preserve existing history, including requests made before the once-per-person rule.
 db.exec(`CREATE INDEX IF NOT EXISTS begging_pair_history ON employee_begging_requests(sender_id,recipient_id);
  CREATE TRIGGER IF NOT EXISTS begging_one_per_person BEFORE INSERT ON employee_begging_requests
  WHEN EXISTS(SELECT 1 FROM employee_begging_requests WHERE sender_id=NEW.sender_id AND recipient_id=NEW.recipient_id)
  BEGIN SELECT RAISE(ABORT,'对同一位员工只能乞讨一次。');END;`);
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
 const name=id=>{
  const row=db.prepare(`SELECT e.display_name,COALESCE(r.codename,NULLIF(p.anonymous_name,''),'匿名员工-'||e.id) AS anonymous_name,q.ranking_identity
   FROM employees e LEFT JOIN profiles p ON p.employee_id=e.id LEFT JOIN employee_preferences q ON q.employee_id=e.id LEFT JOIN company_robots r ON r.employee_id=e.id WHERE e.id=?`).get(id);
  return row&&!isContainment(id)&&row.ranking_identity==='real'?row.display_name:row?.anonymous_name||'员工';
 };
 const eligible=id=>!!db.prepare('SELECT 1 FROM employees e WHERE e.id=? AND e.enabled=1 AND e.is_npc=0 AND NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=e.id)').get(id);
 // Company roster accounts accept requests just like other visible employees.
 const requestable=id=>!!db.prepare('SELECT 1 FROM employees e WHERE e.id=? AND ((e.enabled=1 AND e.is_npc=0) OR EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=e.id))').get(id);
 const item=row=>({id:row.id,senderId:row.sender_id,recipientId:row.recipient_id,senderName:name(row.sender_id),recipientName:name(row.recipient_id),status:row.status,requestedAmount:row.requested_amount,amount:row.amount,createdAt:row.created_at});
 const inbox=id=>({items:db.prepare("SELECT * FROM employee_begging_requests WHERE recipient_id=? AND status='pending' ORDER BY id").all(id).map(item),rewards:db.prepare("SELECT * FROM employee_begging_requests WHERE sender_id=? AND status='accepted' AND sender_seen_at IS NULL ORDER BY id").all(id).map(item)});
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}};
 return {async handle(req,res,url){
  if(!/^\/api\/player\/begging(?:\/\d+(?:\/read)?)?$/.test(url.pathname))return false;
  const user=requireEmployee(req,res);if(!user)return true;
  try{
   if(url.pathname==='/api/player/begging'&&req.method==='GET'){send(res,200,inbox(user.id));return true;}
   if(req.method!=='POST'){send(res,405,{error:'不支持的操作。'});return true;}
   const data=await readBody(req);
   if(url.pathname.endsWith('/read')){
    const id=Number(url.pathname.split('/')[4]);if(!Number.isSafeInteger(id)||id<1)fail('请求不存在。',404);
    const updated=db.prepare("UPDATE employee_begging_requests SET sender_seen_at=COALESCE(sender_seen_at,?) WHERE id=? AND sender_id=? AND status='accepted'").run(clock(),id,user.id);
    if(!updated.changes)fail('请求不存在。',404);send(res,200,{ok:true});return true;
   }
   if(url.pathname==='/api/player/begging'){
    if(!Number.isSafeInteger(data.recipientId)||data.recipientId<1||data.recipientId===user.id)fail('请选择其他员工。');
    if(!Number.isSafeInteger(data.amount)||data.amount<1||data.amount>1000000)fail('乞讨金额须为 1 至 1,000,000 的整数。');
    if(typeof data.requestId!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(data.requestId))fail('请重新提交乞讨请求。');
    const result=transaction(()=>{
     const key=user.id+':'+data.requestId,previous=db.prepare('SELECT * FROM employee_begging_requests WHERE request_key=?').get(key);
     if(previous){if(previous.recipient_id!==data.recipientId||previous.requested_amount!==data.amount)fail('这份请求凭据已使用。',409);return previous;}
     if(!requestable(data.recipientId)||!highest(user.id).some(row=>row.id===data.recipientId))fail('该员工当前无法接收请求，请刷新财神榜。');
     const previousRequest=db.prepare('SELECT 1 FROM employee_begging_requests WHERE sender_id=? AND recipient_id=? LIMIT 1').get(user.id,data.recipientId);
     if(previousRequest)fail('对同一位员工只能乞讨一次。',409);
     const inserted=db.prepare('INSERT INTO employee_begging_requests(sender_id,recipient_id,request_key,created_at,requested_amount) VALUES(?,?,?,?,?)').run(user.id,data.recipientId,key,clock(),data.amount);
     return db.prepare('SELECT * FROM employee_begging_requests WHERE id=?').get(inserted.lastInsertRowid);
    });send(res,200,item(result));return true;
   }
   const id=Number(url.pathname.split('/').at(-1));if(!Number.isSafeInteger(id)||id<1)fail('请求不存在。',404);
   if(!['accepted','declined'].includes(data.decision))fail('请选择同意或拒绝。');
   const result=transaction(()=>{
    const row=db.prepare('SELECT * FROM employee_begging_requests WHERE id=? AND recipient_id=?').get(id,user.id);if(!row)fail('请求不存在。',404);
    const amount=data.decision==='accepted'?(data.amount===undefined?row.requested_amount:data.amount):0;
    if(data.decision==='accepted'&&(!Number.isSafeInteger(amount)||amount<1||amount>1000000))fail('给予金额须为 1 至 1,000,000 的整数。');
    if(row.status!=='pending'){
     if(row.status!==data.decision||row.amount!==amount)fail('这份请求已处理，请刷新消息。',409);
     return row;
    }
    let donationId=null;
    if(data.decision==='accepted'){
     if(!eligible(row.sender_id))fail('对方账号当前无法接收款项。');
     if(balanceFor(user.id)<amount)fail('可用余额不足，不能使用负债支付。');
     if(!Number.isSafeInteger(balanceFor(row.sender_id)+amount))fail('金额超出账户范围。');
     const debit=recordLedger(user.id,-amount,'向'+name(row.sender_id)+'捐赠'),credit=recordLedger(row.sender_id,amount,'收到'+name(user.id)+'的捐赠');
     donationId=Number(db.prepare('INSERT INTO employee_donations(sender_id,recipient_id,amount,request_key,sender_ledger_id,recipient_ledger_id) VALUES(?,?,?,?,?,?)').run(user.id,row.sender_id,amount,'begging:'+row.id,Number(debit.lastInsertRowid),Number(credit.lastInsertRowid)).lastInsertRowid);
    }
    db.prepare("UPDATE employee_begging_requests SET status=?,amount=?,donation_id=?,resolved_at=? WHERE id=? AND status='pending'").run(data.decision,amount,donationId,clock(),id);
    return db.prepare('SELECT * FROM employee_begging_requests WHERE id=?').get(id);
   });send(res,200,{...item(result),balance:balanceFor(user.id)});return true;
  }catch(error){send(res,error.status||400,{error:error.message});return true;}
 }};
}
