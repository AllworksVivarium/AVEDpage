export const directoryDepartments=['收容部','武装部','后勤部','科研部','医疗部'];
export function directoryDepartment(value){
 const text=String(value||'').normalize('NFKC').replace(/\s/g,'');
 if(/收容/.test(text))return '收容部';if(/武装|武裝|武器|战斗|戰鬥|作战/.test(text))return '武装部';if(/后勤|後勤/.test(text))return '后勤部';if(/科研|研究/.test(text))return '科研部';if(/医疗|醫療|医療/.test(text))return '医疗部';return '直属 / 待分配';
}
export function directoryEmployees(db){return db.prepare('SELECT e.id,e.display_name AS displayName,e.department,e.enabled,p.avatar_url AS avatarUrl FROM employees e LEFT JOIN profiles p ON p.employee_id=e.id ORDER BY e.id').all().map(e=>({...e,registeredDepartment:e.department,department:directoryDepartment(e.department)}));}
