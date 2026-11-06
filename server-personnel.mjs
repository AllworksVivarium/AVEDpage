import {directoryDepartment,directoryDepartments} from './server-directory.mjs';

export const identityKinds=['player_employee','player_containment','planning_member','company_containment'];
export function installPersonnel(db){
  if(!db.prepare('PRAGMA table_info(employees)').all().some(c=>c.name==='identity_kind')){
    db.exec(`ALTER TABLE employees ADD COLUMN identity_kind TEXT NOT NULL DEFAULT 'player_employee';
      UPDATE employees SET identity_kind=CASE
        WHEN is_leadership=1 OR position_title LIKE '%部长%' THEN 'planning_member'
        WHEN is_npc=1 THEN 'company_containment' ELSE 'player_employee' END;
      UPDATE employees SET is_leadership=(identity_kind='planning_member');`);
  }
  db.exec(`UPDATE employees SET department='公司直属' WHERE department IN ('','直属 / 待分配','公司直属领导');`);
}

// Account permissions and fictional positions are deliberately independent.
export function personnelAssignment(data,previous={}){
  const kind=data.identityKind??previous.identityKind??(data.isLeadership||/部长/.test(data.positionTitle||'')?'planning_member':data.isNpc?'company_containment':'player_employee');
  if(!identityKinds.includes(kind))throw new Error('请选择有效的档案身份。');
  let department=directoryDepartment(data.department??previous.department),positionTitle=data.positionTitle??previous.positionTitle??'';
  if(typeof positionTitle!=='string'||positionTitle.length>80)throw new Error('职务名称最多 80 字。');
  positionTitle=positionTitle.trim();
  const isLeadership=kind==='planning_member';
  if(isLeadership){
    if(directoryDepartments.includes(department))positionTitle='部长';
    else if(!positionTitle)throw new Error('公司直属领导请填写实际职务名称。');
  }else if(kind==='player_employee'){
    if(/部长|领导|董事|总裁|总监|监察长|顾问|总经理|副总|主席|会长/.test(positionTitle))throw new Error('玩家不能担任领导职务，请选择企划组领导身份。');
    positionTitle=positionTitle||'成员';
  }else{
    department='公司直属';positionTitle=positionTitle||'收容物';
  }
  const rawNpc=data.isNpc??(data.identityKind&&data.identityKind!==previous.identityKind?false:previous.isNpc??false);
  if(typeof rawNpc!=='boolean')throw new Error('账号类型无效。');
  const isNpc=kind==='company_containment'||(kind==='planning_member'&&rawNpc);
  return {identityKind:kind,department,positionTitle,isNpc,isLeadership};
}
