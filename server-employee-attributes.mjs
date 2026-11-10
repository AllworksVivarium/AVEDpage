const installed=new WeakSet();
export const attributeLabels=['力量','意志','洞察','敏捷','智力','体质'];
export function installEmployeeAttributes(db){if(installed.has(db))return;if(!db.prepare('PRAGMA table_info(employees)').all().some(c=>c.name==='attributes_json'))db.exec("ALTER TABLE employees ADD COLUMN attributes_json TEXT NOT NULL DEFAULT ''");installed.add(db);}
export function normalizeAttributes(values){if(values===null)return '';if(!Array.isArray(values)||values.length!==6||values.some(n=>!Number.isInteger(n)||n<0||n>100))throw Error('六维需填写六个 0–100 的整数，或全部留空。');return JSON.stringify(values);}
export function attributeValues(raw){try{const values=JSON.parse(raw||'null');return values===null?null:JSON.parse(normalizeAttributes(values));}catch{return null;}}
export function employeeAttributes(db,id){installEmployeeAttributes(db);return attributeValues(db.prepare('SELECT attributes_json FROM employees WHERE id=?').get(id)?.attributes_json);}
export async function handleEmployeeAttributes({db,send,readBody,requireAdmin},req,res,url){
 const match=url.pathname.match(/^\/api\/admin\/employees\/(\d+)\/attributes$/);if(!match)return false;
 if(!requireAdmin(req,res))return true;const id=Number(match[1]);if(!db.prepare('SELECT 1 FROM employees WHERE id=?').get(id)){send(res,404,{error:'员工档案不存在。'});return true;}
 try{if(req.method==='PUT'){const data=await readBody(req);db.prepare('UPDATE employees SET attributes_json=? WHERE id=?').run(normalizeAttributes(data.values),id);}else if(req.method!=='GET'){send(res,405,{error:'六维指令无效。'});return true;}send(res,200,{labels:attributeLabels,scale:100,values:employeeAttributes(db,id)});}catch(error){send(res,400,{error:error.message});}return true;
}
