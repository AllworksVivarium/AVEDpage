import {businessDay,businessDayEnd} from './server-business-day.mjs';
import {randomInt} from 'node:crypto';

export function installPayrollIntrusion({db,send,readBody,requireEmployee,requireAdmin,balanceFor,recordLedger,clock=Date.now,roll=randomInt}){
 db.exec(`CREATE TABLE IF NOT EXISTS payroll_batches(request_key TEXT PRIMARY KEY,created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,recipient_count INTEGER NOT NULL,total INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS payroll_notices(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,batch_key TEXT NOT NULL REFERENCES payroll_batches(request_key) ON DELETE CASCADE,amount INTEGER NOT NULL,day TEXT NOT NULL,read_at TEXT NOT NULL DEFAULT '',UNIQUE(employee_id,batch_key));
 CREATE INDEX IF NOT EXISTS payroll_notices_pending ON payroll_notices(employee_id,day,read_at);
 CREATE TABLE IF NOT EXISTS containment_intrusion_preferences(employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,automatic INTEGER NOT NULL DEFAULT 0 CHECK(automatic IN (0,1)));
 CREATE TABLE IF NOT EXISTS containment_intrusions(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,day TEXT NOT NULL,amount INTEGER NOT NULL,ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),PRIMARY KEY(employee_id,day));`);
 const day=()=>businessDay(clock());
 const eligible=id=>!!db.prepare("SELECT 1 FROM employees WHERE id=? AND identity_kind='player_containment' AND enabled=1 AND is_npc=0").get(id);
 const recipients=()=>db.prepare("SELECT id FROM employees WHERE enabled=1 AND is_npc=0 AND identity_kind IN ('player_employee','planning_member') AND NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=employees.id) ORDER BY id").all();
 function transaction(task){db.exec('BEGIN IMMEDIATE');try{const result=task();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 function status(id){const date=day(),claim=db.prepare('SELECT amount FROM containment_intrusions WHERE employee_id=? AND day=?').get(id,date);return {day:date,claimed:!!claim,amount:claim?.amount||0,automatic:!!db.prepare('SELECT automatic FROM containment_intrusion_preferences WHERE employee_id=?').get(id)?.automatic,balance:balanceFor(id),resetAt:businessDayEnd(clock())};}
 function steal(id){return transaction(()=>{
  if(!eligible(id))throw Error('此接入方式仅对收容物开放。');
  const date=day(),existing=db.prepare('SELECT amount FROM containment_intrusions WHERE employee_id=? AND day=?').get(id,date);
  if(existing)return {...status(id),reward:0};
  const amount=[60000,65000,75000][roll(3)];
  if(!Number.isSafeInteger(balanceFor(id)+amount))throw Error('账户余额超出范围。');
  const ledger=recordLedger(id,amount,'未知来源汇入 / 基金链路黑入');
  db.prepare('INSERT INTO containment_intrusions VALUES(?,?,?,?)').run(id,date,amount,Number(ledger.lastInsertRowid));
  db.prepare("INSERT INTO company_fund(employee_id,amount,kind,source_ledger_id,request_key) VALUES(?,?,'containment_intrusion',?,?)").run(id,-amount,Number(ledger.lastInsertRowid),'intrusion:'+id+':'+date);
  return {...status(id),reward:amount};
 });}
 function runAutomatic(){for(const {employee_id:id} of db.prepare("SELECT p.employee_id FROM containment_intrusion_preferences p JOIN employees e ON e.id=p.employee_id WHERE p.automatic=1 AND e.identity_kind='player_containment' AND e.enabled=1 AND e.is_npc=0 AND NOT EXISTS(SELECT 1 FROM containment_intrusions c WHERE c.employee_id=e.id AND c.day=?)").all(day())){try{steal(id);}catch(e){console.error('Automatic intrusion:',id,e.message);}}}
 return {runAutomatic,status,steal,async handle(req,res,url){
  const path=url.pathname;if(!['/api/admin/payroll','/api/player/intrusion','/api/player/payroll-notices','/api/player/payroll-notices/read'].includes(path))return false;
  const actor=path.startsWith('/api/admin/')?requireAdmin(req,res):requireEmployee(req,res);if(!actor)return true;
  try{
   if(path==='/api/player/payroll-notices'){
    if(req.method!=='GET'){send(res,405,{error:'请求方式无效。'});return true;}
    send(res,200,{items:db.prepare("SELECT id,amount,day FROM payroll_notices WHERE employee_id=? AND day=? AND read_at='' ORDER BY id").all(actor.id,day())});return true;
   }
   if(path==='/api/player/payroll-notices/read'){
    if(req.method!=='POST'){send(res,405,{error:'请求方式无效。'});return true;}
    const d=await readBody(req);if(!Number.isSafeInteger(d.id)||d.id<1)throw Error('工资提醒无效。');
    const result=db.prepare("UPDATE payroll_notices SET read_at=? WHERE id=? AND employee_id=? AND day=? AND read_at=''").run(new Date(clock()).toISOString(),d.id,actor.id,day());
    send(res,200,{ok:true,claimed:result.changes===1});return true;
   }
   if(path==='/api/admin/payroll'){
    if(req.method==='GET'){const count=recipients().length;send(res,200,{count,amount:200000,total:count*200000});return true;}
    if(req.method!=='POST')throw Error('发薪指令无效。');
    const d=await readBody(req);if(typeof d.requestId!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(d.requestId))throw Error('请重新提交发薪批次。');
    const result=transaction(()=>{const key=actor.id+':'+d.requestId,old=db.prepare('SELECT recipient_count AS count,total FROM payroll_batches WHERE request_key=?').get(key);if(old)return {...old,replayed:true};
     const ids=recipients();if(d.expectedCount!==ids.length)throw Error('员工名单已变更，请刷新后重新确认发薪。');
     db.prepare('INSERT INTO payroll_batches(request_key,created_by,recipient_count,total) VALUES(?,?,?,?)').run(key,actor.id,ids.length,ids.length*200000);
     const notice=db.prepare('INSERT INTO payroll_notices(employee_id,batch_key,amount,day) VALUES(?,?,?,?)'),date=day();
     for(const {id} of ids){if(!Number.isSafeInteger(balanceFor(id)+200000))throw Error('账户余额超出范围，未发放本批工资。');recordLedger(id,200000,'公司工资 / 批次 '+key);notice.run(id,key,200000,date);}
     // Read receipts need only survive the reminder's business day.
     db.prepare('DELETE FROM payroll_notices WHERE day<?').run(date);
     return {count:ids.length,total:ids.length*200000,replayed:false};});
    send(res,200,{...result,amount:200000});return true;
   }
   if(!eligible(actor.id)){send(res,403,{error:'此接入方式仅对收容物开放。'});return true;}
   if(req.method==='GET'){send(res,200,status(actor.id));return true;}
   if(req.method==='POST'){send(res,200,steal(actor.id));return true;}
   if(req.method==='PUT'){const d=await readBody(req);if(typeof d.automatic!=='boolean')throw Error('请选择是否每日自动黑入。');db.prepare('INSERT INTO containment_intrusion_preferences VALUES(?,?) ON CONFLICT(employee_id) DO UPDATE SET automatic=excluded.automatic').run(actor.id,d.automatic?1:0);send(res,200,d.automatic?steal(actor.id):status(actor.id));return true;}
   send(res,405,{error:'接入指令无效。'});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
