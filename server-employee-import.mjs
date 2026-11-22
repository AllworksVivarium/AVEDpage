import {createHash} from 'node:crypto';
import parser from './public/employee-import.js';
import {normalizeAttributes} from './server-employee-attributes.mjs';
import personnelNames from './public/personnel-name.js';

export function installEmployeeImport({db,send,readBody,requireAdmin,hashPassword,log}){
 db.exec(`CREATE TABLE IF NOT EXISTS employee_import_batches(request_id TEXT PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,payload_hash TEXT NOT NULL,result_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 function plan(data){
  const parsed=parser.parse(data.text,data.mode),employees=db.prepare('SELECT id,username,display_name AS displayName,identity_kind AS identityKind,is_npc AS isNpc,attributes_json AS attributes FROM employees WHERE NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=employees.id)').all();
  const rows=[],errors=[...parsed.errors],targets=new Set(),qqs=new Set();
  for(const row of parsed.rows){
   if(data.mode==='create'){
    if(employees.some(e=>personnelNames.normalizeRealName(e.username)===row.name||personnelNames.normalizeRealName(e.displayName)===row.name)){errors.push({line:row.line,message:'员工已存在：'+row.name+'；更新数值请选择仅更新六维。'});continue;}
    if(db.prepare('SELECT 1 FROM employees WHERE username=?').get(row.name)){errors.push({line:row.line,message:'用户名已被占用：'+row.name});continue;}
    if(row.qqNumber&&(qqs.has(row.qqNumber)||db.prepare('SELECT 1 FROM employees WHERE qq_number=?').get(row.qqNumber))){errors.push({line:row.line,message:'QQ 号重复或已被使用。'});continue;}qqs.add(row.qqNumber);
    rows.push({...row,action:'新建员工'});
   }else{
    const exact=employees.filter(e=>e.username===row.name),matches=exact.length?exact:employees.filter(e=>e.displayName===row.name);
    if(matches.length!==1){errors.push({line:row.line,message:matches.length?'姓名对应多个账号，请填写准确用户名。':'未找到员工：'+row.name});continue;}
    const employee=matches[0];if(employee.isNpc||!['player_employee','player_containment','planning_member'].includes(employee.identityKind)){errors.push({line:row.line,message:'此档案不属于玩家账号。'});continue;}
    if(targets.has(employee.id)){errors.push({line:row.line,message:'同一账号在本批次出现多次。'});continue;}targets.add(employee.id);
    try{normalizeAttributes(row.attributes,{identityKind:employee.identityKind});}catch(error){errors.push({line:row.line,message:error.message});continue;}
    rows.push({...row,identityKind:employee.identityKind,id:employee.id,displayName:employee.displayName,previousAttributes:employee.attributes,action:'更新六维'});
   }
  }
  const warnings=rows.filter(r=>!['player_containment','company_containment'].includes(r.identityKind)&&r.attributes?.some(v=>v>90)).map(r=>({line:r.line,message:r.name+' 的属性超过常规上限 90，将按填写数值保存。'}));
  return {rows,errors,warnings,fingerprint:hash({mode:data.mode,rows}),count:rows.length};
 }
 return {plan,async handle(req,res,url){
  if(!['/api/admin/employees/import','/api/admin/employees/import/preview'].includes(url.pathname))return false;
  const actor=requireAdmin(req,res);if(!actor)return true;
  if(req.method!=='POST'){send(res,405,{error:'请使用导入指令。'});return true;}
  const data=await readBody(req,650000),preview=url.pathname.endsWith('/preview');
  const payloadHash=hash({mode:data.mode,text:data.text});
  if(!preview){
   if(typeof data.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)){send(res,400,{error:'请先识别并预览导入内容。'});return true;}
   const saved=db.prepare('SELECT * FROM employee_import_batches WHERE request_id=?').get(data.requestId);
   if(saved){if(saved.employee_id!==actor.id||saved.payload_hash!==payloadHash){send(res,409,{error:'本次导入标识已使用，请重新识别。'});return true;}send(res,200,JSON.parse(saved.result_json));return true;}
  }
  const result=plan(data);
  if(preview){send(res,200,result);return true;}
  if(result.errors.length){send(res,400,{error:'请修正识别结果中的错误后再导入。',errors:result.errors});return true;}
  if(data.fingerprint!==result.fingerprint){send(res,409,{error:'员工资料或导入内容已变化，请重新识别。'});return true;}
  try{
   // Bound password work: two accounts at a time, with a unique salt per account.
   const hashes=[];if(data.mode==='create')for(let i=0;i<result.rows.length;i+=2)hashes.push(...await Promise.all(result.rows.slice(i,i+2).map(()=>hashPassword('000000'))));
   db.exec('BEGIN IMMEDIATE');
   const saved=db.prepare('SELECT * FROM employee_import_batches WHERE request_id=?').get(data.requestId);
   if(saved){db.exec('ROLLBACK');if(saved.employee_id!==actor.id||saved.payload_hash!==payloadHash){send(res,409,{error:'本次导入标识已使用，请重新识别。'});return true;}send(res,200,JSON.parse(saved.result_json));return true;}
   const fresh=plan(data);if(fresh.errors.length||fresh.fingerprint!==data.fingerprint){db.exec('ROLLBACK');send(res,409,{error:'员工资料已变化，请重新识别。'});return true;}
   const ids=[];
   for(let i=0;i<fresh.rows.length;i++){
    const row=fresh.rows[i],attributes=normalizeAttributes(row.attributes,{identityKind:row.identityKind});
    if(data.mode==='create'){
     const insert=db.prepare("INSERT INTO employees(username,password_hash,display_name,qq_number,department,role,position_title,is_npc,is_leadership,enabled,identity_kind,attributes_json,containment_classification) VALUES(?,?,?,?,?,'employee','成员',0,0,1,'player_employee',?,'')").run(row.name,hashes[i],row.name,row.qqNumber||null,row.department,attributes);
     const id=Number(insert.lastInsertRowid);db.prepare('INSERT INTO profiles(employee_id,anonymous_name,bio) VALUES(?,?,?)').run(id,'匿名员工-'+id,'');ids.push(id);
    }else{db.prepare('UPDATE employees SET attributes_json=? WHERE id=?').run(attributes,row.id);ids.push(row.id);}
   }
   const response={ok:true,mode:data.mode,count:ids.length,ids};
   db.prepare('INSERT INTO employee_import_batches(request_id,employee_id,payload_hash,result_json) VALUES(?,?,?,?)').run(data.requestId,actor.id,payloadHash,JSON.stringify(response));
   log(actor.id,'employees.import',data.mode,{count:ids.length});db.exec('COMMIT');send(res,200,response);
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');send(res,error.status||409,{error:error.status?error.message:'导入未完成，请重新识别后重试。'});}
  return true;
 }};
}
