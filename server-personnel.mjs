import {directoryDepartment} from './server-directory.mjs';
import {normalizeContainmentClassification} from './server-dossier-content.mjs';

export const identityKinds=['player_employee','player_containment','planning_member','company_containment'];
export function installPersonnel(db){
  if(!db.prepare('PRAGMA table_info(employees)').all().some(c=>c.name==='team_name'))db.exec("ALTER TABLE employees ADD COLUMN team_name TEXT NOT NULL DEFAULT ''");
  if(!db.prepare('PRAGMA table_info(employees)').all().some(c=>c.name==='containment_classification'))db.exec("ALTER TABLE employees ADD COLUMN containment_classification TEXT NOT NULL DEFAULT ''");
  if(!db.prepare('PRAGMA table_info(employees)').all().some(c=>c.name==='identity_kind')){
    db.exec(`ALTER TABLE employees ADD COLUMN identity_kind TEXT NOT NULL DEFAULT 'player_employee';
      UPDATE employees SET identity_kind=CASE
        WHEN is_leadership=1 OR position_title LIKE '%部长%' THEN 'planning_member'
        WHEN is_npc=1 THEN 'company_containment' ELSE 'player_employee' END;
      UPDATE employees SET is_leadership=(identity_kind='planning_member');`);
  }
  db.exec(`UPDATE employees SET department='公司直属' WHERE department IN ('','直属 / 待分配','公司直属领导','公司直属部');
    UPDATE employees SET position_title='成员' WHERE identity_kind='player_employee' AND position_title<>'成员';
    UPDATE employees SET position_title='收容物' WHERE identity_kind IN ('player_containment','company_containment') AND position_title<>'收容物';`);
}

// Account permissions and fictional positions are deliberately independent.
export function personnelAssignment(data,previous={}){
  const kind=data.identityKind??previous.identityKind??(data.isLeadership||/部长/.test(data.positionTitle||'')?'planning_member':data.isNpc?'company_containment':'player_employee');
  if(!identityKinds.includes(kind))throw new Error('请选择有效的档案身份。');
  let department=directoryDepartment(data.department??previous.department),positionTitle=data.positionTitle??previous.positionTitle??'';
  if(typeof positionTitle!=='string'||positionTitle.length>80)throw new Error('职务名称最多 80 字。');
  positionTitle=positionTitle.trim();
  let teamName=data.teamName??previous.teamName??'';
  if(typeof teamName!=='string'||teamName.trim().length>30||/[\x00-\x1f\x7f]/.test(teamName))throw new Error('下属组名称须为 30 字以内的可见文字。');teamName=teamName.trim();
  if(kind!=='planning_member'||department!=='后勤部')teamName='';
  if(teamName){teamName=teamName.replace(/部$/,'组');if(!/组$/.test(teamName))teamName+='组';if(teamName.length>30)throw new Error('下属组名称最多 30 字。');positionTitle=teamName+'长';}
  const isLeadership=kind==='planning_member';
  if(isLeadership){
    if(!positionTitle)throw new Error('请填写实际职位名称。');
  }else if(kind==='player_employee'){
    if(/部长|领导|董事|总裁|总监|监察长|顾问|总经理|副总|主席|会长/.test(positionTitle))throw new Error('玩家不能担任领导职务，请选择企划组成员身份。');
    positionTitle='成员';
  }else{
    department='公司直属';positionTitle='收容物';
  }
  const rawNpc=data.isNpc??(data.identityKind&&data.identityKind!==previous.identityKind?false:previous.isNpc??false);
  if(typeof rawNpc!=='boolean')throw new Error('账号类型无效。');
  const isNpc=kind==='company_containment'||(kind==='planning_member'&&rawNpc);
  const containmentClassification=kind.endsWith('_containment')?normalizeContainmentClassification(data.containmentClassification??previous.containmentClassification??''):'';
  return {identityKind:kind,department,positionTitle,isNpc,isLeadership,containmentClassification,teamName};
}
