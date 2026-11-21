import {createHash,timingSafeEqual} from 'node:crypto';
import {attributeLabels,attributeValues} from './server-employee-attributes.mjs';

const schema='aved.six-attributes.v1';
const digest=value=>createHash('sha256').update(value).digest('hex');

// Read-only website snapshot. A SealDice adapter chooses the destination card.
export function attributeSnapshot(db){
 const employees=db.prepare(`SELECT id,display_name,qq_number,identity_kind,attributes_json FROM employees e
  WHERE enabled=1 AND is_npc=0 AND identity_kind IN ('player_employee','player_containment','planning_member')
  AND username<>'AVED' COLLATE BINARY AND NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=e.id)
  ORDER BY id`).all();
 const qqCounts=new Map();
 for(const employee of employees){const qq=String(employee.qq_number||'').trim();if(/^\d{5,12}$/.test(qq))qqCounts.set(qq,(qqCounts.get(qq)||0)+1);}
 const records=[],exportRows=[],issues=[];
 for(const employee of employees){
  const values=attributeValues(employee.attributes_json),qq=String(employee.qq_number||'').trim();
  const issue=reason=>issues.push({employeeId:employee.id,name:employee.display_name,reason});
  if(!values){issue('六维尚未完整登记');continue;}
  const row={employeeId:employee.id,name:employee.display_name,qqNumber:qq,attributes:Object.fromEntries(attributeLabels.map((label,i)=>[label,values[i]]))};
  exportRows.push(row);
  if(!/^\d{5,12}$/.test(qq)){issue('请登记有效 QQ 号');continue;}
  if(qqCounts.get(qq)!==1){issue('QQ 号对应多份档案，请核对');continue;}
  records.push({...row,revision:digest(JSON.stringify(row))});
 }
 return {schema,direction:'website-to-sealdice',labels:attributeLabels,revision:digest(JSON.stringify(records)),records,exportRows,issues};
}

export function installSealdiceSync({db,send,requireAdmin,token=process.env.SEALDICE_SYNC_TOKEN||''}){
 const secret=String(token).trim(),enabled=secret.length>=32&&secret.length<=512;
 const expected=enabled?digest(secret):null;
 return {handle(req,res,url){
  const admin=url.pathname==='/api/admin/employees/attributes/export';
  if(!admin&&url.pathname!=='/api/integrations/sealdice/attributes')return false;
  if(admin){if(!requireAdmin(req,res))return true;}
  else{
   if(!enabled){send(res,503,{error:'海豹同步接口尚未启用。',code:'SEALDICE_SYNC_DISABLED'});return true;}
   const auth=req.headers.authorization||'',match=typeof auth==='string'&&auth.match(/^Bearer ([^\s]{32,512})$/);
   if(!match||!timingSafeEqual(Buffer.from(digest(match[1]),'hex'),Buffer.from(expected,'hex'))){send(res,401,{error:'同步密钥无效。'},{'WWW-Authenticate':'Bearer'});return true;}
  }
  if(req.method!=='GET'){send(res,405,{error:'请使用 GET 读取六维资料。'},{Allow:'GET'});return true;}
  const {exportRows,issues,...snapshot}=attributeSnapshot(db);
  send(res,200,admin?{...snapshot,exportRows,issues,syncEnabled:enabled}:snapshot);
  return true;
 }};
}
