import {installEmployeeAttributes,attributeValues} from './server-employee-attributes.mjs';
import {storedAvatar} from './server-default-avatar.mjs';
export const directoryDepartments=['收容部','武装部','后勤部','科研部','医疗部'];
export function directoryDepartment(value){
 const text=String(value||'').normalize('NFKC').replace(/\s/g,'');
 if(/收容/.test(text))return '收容部';if(/武装|武裝|武器|战斗|戰鬥|作战/.test(text))return '武装部';if(/后勤|後勤/.test(text))return '后勤部';if(/科研|研究/.test(text))return '科研部';if(/医疗|醫療|医療/.test(text))return '医疗部';return '公司直属';
}
export function directoryEmployees(db){installEmployeeAttributes(db);return db.prepare('SELECT e.id,e.attributes_json AS attributes,e.display_name AS displayName,e.department,e.identity_kind AS identityKind,e.enabled,e.position_title AS positionTitle,e.is_npc AS isNpc,e.is_leadership AS isLeadership,p.avatar_url AS avatarUrl,p.avatar_preset AS avatarPreset,p.bio AS bio FROM employees e LEFT JOIN profiles p ON p.employee_id=e.id WHERE NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=e.id) ORDER BY e.id').all().map(e=>({...e,attributes:attributeValues(e.attributes),avatarUrl:storedAvatar(e.id,e.avatarUrl,e.avatarPreset,256),registeredDepartment:e.department,department:directoryDepartment(e.department)}));}
