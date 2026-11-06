import {randomBytes} from 'node:crypto';
export function ensureCompanyRobots(db){db.exec(`CREATE TABLE IF NOT EXISTS company_robots(employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,codename TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);}
export function installCompanyRobots({db,send,readBody,requireAdmin,balanceFor,recordLedger,log=()=>{}}){
 ensureCompanyRobots(db);
 const list=()=>db.prepare('SELECT r.employee_id AS id,r.codename,r.revision,COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=r.employee_id),0) AS balance FROM company_robots r ORDER BY r.employee_id').all();
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
 return {async handle(req,res,url){if(!/^\/api\/admin\/company-robots(?:\/\d+)?$/.test(url.pathname))return false;const actor=requireAdmin(req,res);if(!actor)return true;
  try{if(req.method==='GET'&&url.pathname==='/api/admin/company-robots'){send(res,200,{items:list()});return true;}
   if(!['POST','PUT'].includes(req.method)){send(res,405,{error:'不支持的操作。'});return true;}
   const data=await readBody(req),codename=typeof data.codename==='string'?data.codename.trim():'';
   if(!codename||codename.length>32||/[\u0000-\u001f\u007f]/.test(codename))throw Error('内网代号须为 1—32 个可见字符。');
   if(!Number.isSafeInteger(data.balance)||Math.abs(data.balance)>1000000000)throw Error('余额须为 -1,000,000,000 至 1,000,000,000 的整数。');
   const id=Number(url.pathname.split('/')[4]);if(req.method==='POST'&&id||req.method==='PUT'&&!id)throw Error('请选择有效机器人。');
   const result=transaction(()=>{
    let robotId=id,oldBalance=0;
    if(req.method==='POST'){
     const row=db.prepare("INSERT INTO employees(username,password_hash,display_name,department,role,enabled,is_npc) VALUES(?,?,?,'','employee',0,1)").run('company-robot-'+randomBytes(16).toString('hex'),randomBytes(64).toString('hex'),codename);robotId=Number(row.lastInsertRowid);
     db.prepare('INSERT INTO company_robots(employee_id,codename) VALUES(?,?)').run(robotId,codename);
    }else{
     const row=db.prepare('SELECT * FROM company_robots WHERE employee_id=?').get(id);if(!row)throw Error('机器人不存在。');oldBalance=balanceFor(id);
     if(row.revision!==data.revision||oldBalance!==data.expectedBalance)throw Object.assign(Error('资料或余额已更新，请刷新后再保存。'),{status:409});
     db.prepare('UPDATE company_robots SET codename=?,revision=revision+1 WHERE employee_id=?').run(codename,id);db.prepare('UPDATE employees SET display_name=? WHERE id=?').run(codename,id);
    }
    const delta=data.balance-oldBalance;if(delta)recordLedger(robotId,delta,'管理员调整公司机器人余额');
    log(actor.id,req.method==='POST'?'robot.create':'robot.update','company-robot',{id:robotId,codename,oldBalance,balance:data.balance});return {id:robotId,codename,balance:balanceFor(robotId)};
   });send(res,200,result);return true;
  }catch(e){send(res,e.status||(/UNIQUE constraint/.test(e.message)?409:400),{error:/UNIQUE constraint/.test(e.message)?'这个内网代号已被机器人使用。':e.message});return true;}
 }};
}
