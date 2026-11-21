const installed=new WeakSet();
export const attributeLabels=['力量','意志','洞察','敏捷','智力','体质'];
export function installEmployeeAttributes(db){if(installed.has(db))return;if(!db.prepare('PRAGMA table_info(employees)').all().some(c=>c.name==='attributes_json'))db.exec("ALTER TABLE employees ADD COLUMN attributes_json TEXT NOT NULL DEFAULT ''");installed.add(db);}
export function normalizeAttributes(values,{identityKind='player_employee'}={}){
 if(values===null)return '';const containment=['player_containment','company_containment'].includes(identityKind),max=containment?Number.MAX_SAFE_INTEGER:100;
 if(!Array.isArray(values)||values.length!==6||values.some(n=>!Number.isSafeInteger(n)||n<0||n>max))throw Error(containment?'收容物六维需填写六个非负安全整数，或全部留空。':'六维需填写六个 0–100 的整数，或全部留空。');return JSON.stringify(values);
}
export function attributeValues(raw){try{const values=JSON.parse(raw||'null');return values===null?null:JSON.parse(normalizeAttributes(values,{identityKind:'company_containment'}));}catch{return null;}}
export function employeeAttributes(db,id){installEmployeeAttributes(db);return attributeValues(db.prepare('SELECT attributes_json FROM employees WHERE id=?').get(id)?.attributes_json);}
export async function handleEmployeeAttributes({db,send,readBody,requireAdmin},req,res,url){
 const match=url.pathname.match(/^\/api\/admin\/employees\/(\d+)\/attributes$/);if(!match)return false;
 if(!requireAdmin(req,res))return true;const id=Number(match[1]);const employee=db.prepare('SELECT * FROM employees WHERE id=?').get(id);if(!employee){send(res,404,{error:'员工档案不存在。'});return true;}
 try{if(req.method==='PUT'){const data=await readBody(req);db.prepare('UPDATE employees SET attributes_json=? WHERE id=?').run(normalizeAttributes(data.values,{identityKind:employee.identity_kind}),id);}else if(req.method!=='GET'){send(res,405,{error:'六维指令无效。'});return true;}send(res,200,{labels:attributeLabels,scale:100,values:employeeAttributes(db,id)});}catch(error){send(res,400,{error:error.message});}return true;
}
