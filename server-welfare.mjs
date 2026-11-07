import {ensureCompanyRobots} from './server-company-robots.mjs';
export function installWelfare({db,send,readBody,requireEmployee,balanceFor,recordLedger}){
 ensureCompanyRobots(db);
 db.exec(`CREATE TABLE IF NOT EXISTS employee_preferences(employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,ranking_identity TEXT NOT NULL DEFAULT 'anonymous',forum_identity TEXT NOT NULL DEFAULT 'anonymous');
 CREATE TABLE IF NOT EXISTS employee_donations(id INTEGER PRIMARY KEY,sender_id INTEGER NOT NULL REFERENCES employees(id),recipient_id INTEGER NOT NULL REFERENCES employees(id),amount INTEGER NOT NULL CHECK(amount>0),request_key TEXT NOT NULL UNIQUE,sender_ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),recipient_ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS company_fund(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,amount INTEGER NOT NULL,kind TEXT NOT NULL,source_ledger_id INTEGER UNIQUE REFERENCES balance_ledger(id) ON DELETE SET NULL,request_key TEXT UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 INSERT OR IGNORE INTO company_fund(employee_id,amount,kind,source_ledger_id) SELECT employee_id,-delta,'relief',id FROM balance_ledger WHERE reason='应急低保' AND delta>0;
 CREATE TRIGGER IF NOT EXISTS fund_relief AFTER INSERT ON balance_ledger WHEN NEW.reason='应急低保' AND NEW.delta>0 BEGIN INSERT INTO company_fund(employee_id,amount,kind,source_ledger_id) VALUES(NEW.employee_id,-NEW.delta,'relief',NEW.id); END;`);
 const identity=value=>{if(!['anonymous','real'].includes(value))throw Error('请选择匿名或实名。');return value;};
 const preferences=id=>{const p=db.prepare('SELECT ranking_identity AS rankingIdentity,forum_identity AS forumIdentity FROM employee_preferences WHERE employee_id=?').get(id);return p||{rankingIdentity:'anonymous',forumIdentity:'anonymous'};};
 function summary(id){return {...preferences(id),balance:balanceFor(id),donated:db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM company_fund WHERE employee_id=? AND kind='donation'").get(id).n,relief:db.prepare("SELECT COUNT(*) AS count,COALESCE(-SUM(amount),0) AS amount FROM company_fund WHERE employee_id=? AND kind='relief'").get(id),checkins:db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(reward),0) AS amount FROM checkins WHERE employee_id=?').get(id)};}
 function overview(id){const rows=db.prepare(`SELECT e.id,CASE WHEN r.employee_id IS NOT NULL THEN r.codename WHEN COALESCE(q.ranking_identity,'anonymous')='real' THEN e.display_name ELSE COALESCE(NULLIF(p.anonymous_name,''),'匿名员工-'||e.id) END AS name,CASE WHEN r.employee_id IS NOT NULL THEN 'anonymous' WHEN COALESCE(q.ranking_identity,'anonymous')='real' THEN 'real' ELSE 'anonymous' END AS identityMode,0 AS balance,COALESCE(d.donated,0) AS donated FROM employees e LEFT JOIN company_robots r ON r.employee_id=e.id LEFT JOIN profiles p ON p.employee_id=e.id LEFT JOIN employee_preferences q ON q.employee_id=e.id LEFT JOIN (SELECT employee_id,SUM(amount) AS donated FROM company_fund WHERE kind='donation' GROUP BY employee_id) d ON d.employee_id=e.id WHERE (e.is_npc=0 AND e.enabled=1) OR r.employee_id IS NOT NULL`).all().map(row=>({...row,balance:balanceFor(row.id)}));const fund=db.prepare("SELECT COALESCE(SUM(amount),0) AS balance,COALESCE(SUM(CASE WHEN kind='donation' THEN amount ELSE 0 END),0) AS donated,COALESCE(-SUM(CASE WHEN kind='relief' THEN amount ELSE 0 END),0) AS reliefAmount,SUM(CASE WHEN kind='relief' THEN 1 ELSE 0 END) AS reliefCount FROM company_fund").get();return {fund:{...fund,reliefCount:fund.reliefCount||0},highest:[...rows].sort((a,b)=>b.balance-a.balance||a.id-b.id),lowest:[...rows].sort((a,b)=>a.balance-b.balance||a.id-b.id),donors:[...rows].sort((a,b)=>b.donated-a.donated||a.id-b.id),personal:summary(id)};}
 return {preferences,summary,async handle(req,res,url){if(!['/api/player/welfare','/api/player/finance','/api/player/ledger','/api/player/preferences','/api/player/donate','/api/player/donate/employee'].includes(url.pathname))return false;const user=requireEmployee(req,res);if(!user)return true;try{
  if(req.method==='GET'&&url.pathname==='/api/player/welfare'){send(res,200,overview(user.id));return true;}
  if(req.method==='GET'&&url.pathname==='/api/player/ledger'){const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER,rows=db.prepare('SELECT id,delta,reason,created_at AS createdAt FROM balance_ledger WHERE employee_id=? AND id<? ORDER BY id DESC LIMIT 21').all(user.id,before);send(res,200,{items:rows.slice(0,20),next:rows.length>20?rows[19].id:null});return true;}
  if(req.method==='GET'&&url.pathname==='/api/player/finance'){send(res,200,summary(user.id));return true;}
  if(req.method==='PUT'&&url.pathname==='/api/player/preferences'){const d=await readBody(req),old=preferences(user.id),ranking=identity(d.rankingIdentity??old.rankingIdentity),forum=identity(d.forumIdentity??old.forumIdentity);db.prepare('INSERT INTO employee_preferences VALUES(?,?,?) ON CONFLICT(employee_id) DO UPDATE SET ranking_identity=excluded.ranking_identity,forum_identity=excluded.forum_identity').run(user.id,ranking,forum);send(res,200,preferences(user.id));return true;}
  if(req.method==='POST'&&url.pathname==='/api/player/donate/employee'){
   const d=await readBody(req);
   if(!Number.isSafeInteger(d.amount)||d.amount<1)throw Error('请输入有效的正整数捐赠金额。');
   if(!Number.isSafeInteger(d.recipientId)||d.recipientId===user.id)throw Error('请选择其他员工。');
   if(typeof d.requestId!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(d.requestId))throw Error('请重新提交捐赠委托。');
   db.exec('BEGIN IMMEDIATE');try{
    const key=user.id+':'+d.requestId,existing=db.prepare('SELECT recipient_id,amount FROM employee_donations WHERE request_key=?').get(key);
    if(existing&&(existing.recipient_id!==d.recipientId||existing.amount!==d.amount))throw Error('此委托已使用，请重新填写金额。');
    if(!existing){
     const recipient=overview(user.id).lowest.find(x=>x.id===d.recipientId);if(!recipient)throw Error('该员工已不在当前破产榜，请刷新榜单。');
     if(balanceFor(user.id)<d.amount)throw Error('可用余额不足，捐赠不能使用负债。');
     if(!Number.isSafeInteger(balanceFor(d.recipientId)+d.amount))throw Error('捐赠金额超出账户范围。');
     const sender=db.prepare('SELECT display_name AS name FROM employees WHERE id=?').get(user.id);
     const debit=recordLedger(user.id,-d.amount,'向'+recipient.name+'捐赠'),credit=recordLedger(d.recipientId,d.amount,'收到'+sender.name+'的捐赠');
     db.prepare('INSERT INTO employee_donations(sender_id,recipient_id,amount,request_key,sender_ledger_id,recipient_ledger_id) VALUES(?,?,?,?,?,?)').run(user.id,d.recipientId,d.amount,key,Number(debit.lastInsertRowid),Number(credit.lastInsertRowid));
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   send(res,200,overview(user.id));return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/player/donate'){
   const d=await readBody(req);if(!Number.isSafeInteger(d.amount)||d.amount<1)throw Error('请输入有效的正整数捐款金额。');if(typeof d.requestId!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(d.requestId))throw Error('请重新提交捐款委托。');
   db.exec('BEGIN IMMEDIATE');try{const key=user.id+':'+d.requestId,existing=db.prepare('SELECT amount FROM company_fund WHERE request_key=?').get(key);if(existing&&existing.amount!==d.amount)throw Error('此委托已使用，请重新填写金额。');if(!existing){if(balanceFor(user.id)<d.amount)throw Error('可用余额不足，捐款不能使用负债。');const row=recordLedger(user.id,-d.amount,'爱心账户捐款');db.prepare("INSERT INTO company_fund(employee_id,amount,kind,source_ledger_id,request_key) VALUES(?,?,'donation',?,?)").run(user.id,d.amount,Number(row.lastInsertRowid),key);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}send(res,200,overview(user.id));return true;
  }
  send(res,405,{error:'配给指令无效。'});return true;
 }catch(e){send(res,400,{error:e.message});return true;}}};
}
