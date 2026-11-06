import {installImageArchive} from './server-image-archive.mjs';
const targets=['forum_threads','forum_replies','posts','dossier_comments','chat_messages','life_records'];

export function auditRange(params){
  const from=params.get('from')||'2026-01-01',to=params.get('to')||'2027-12-31';
  for(const value of [from,to]){
    if(!/^202[67]-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('检索日期仅限 2026 年和 2027 年。');
  }
  if(from>to)throw new Error('起始日期不能晚于结束日期。');
  return {from,to,start:new Date(Date.parse(from)-8*3600000).toISOString(),end:new Date(Date.parse(to)+16*3600000).toISOString()};
}

export function installAudit(db){
  const images=installImageArchive(db);
  if(!db.prepare('PRAGMA table_info(activity_logs)').all().some(c=>c.name==='category')){
    db.exec(`ALTER TABLE activity_logs ADD COLUMN category TEXT NOT NULL DEFAULT 'speech';
      UPDATE activity_logs SET category='ledger' WHERE target='balance_ledger';
      UPDATE activity_logs SET category='image' WHERE target<>'balance_ledger' AND json_valid(details)
        AND (COALESCE(json_extract(details,'$.image_data'),'')<>'' OR COALESCE(json_extract(details,'$.imageData'),'')<>'');`);
  }
  db.exec(`DROP TRIGGER IF EXISTS audit_balance_ledger_INSERT;
    DROP TRIGGER IF EXISTS activity_results_only;
    CREATE TRIGGER activity_results_only BEFORE INSERT ON activity_logs
    WHEN NEW.action<>'insert' OR NEW.target NOT IN (${targets.map(t=>`'${t}'`).join(',')})
    BEGIN SELECT RAISE(IGNORE); END;
    CREATE INDEX IF NOT EXISTS activity_category_time ON activity_logs(category,julianday(created_at),id);
    CREATE INDEX IF NOT EXISTS activity_category_cursor ON activity_logs(category,id DESC);`);
  for(const table of targets){
    const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
    const image=columns.includes('image_data');
    const category=image?"CASE WHEN NEW.image_data<>'' THEN 'image' ELSE 'speech' END":"'speech'";
    // Image bytes remain in the source table; audit pages load metadata only.
    const snapshot=columns.flatMap(n=>[`'${n}'`,n==='image_data'?"CASE WHEN NEW.image_data<>'' THEN '[image]' ELSE '' END":`NEW.${n}`]).join(',');
    db.exec(`DROP TRIGGER IF EXISTS audit_${table}_INSERT;
      CREATE TRIGGER audit_${table}_INSERT AFTER INSERT ON ${table} BEGIN
      INSERT INTO activity_logs(employee_id,username,action,target,category,details)
      VALUES(NEW.employee_id,COALESCE((SELECT username FROM employees WHERE id=NEW.employee_id),''),'insert','${table}',${category},json_object(${snapshot})); END;`);
  }
  return {image:images.image,query(url){
    const range=auditRange(url.searchParams),category=url.searchParams.get('category');
    if(!category)return {items:[],next:null};
    if(category==='image')return images.query(url.searchParams,range);
    if(!['speech','image'].includes(category))throw new Error('请选择发言或图片记录。');
    const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;
    const keyword=(url.searchParams.get('keyword')||'').slice(0,120),like='%'+keyword+'%';
    const rows=db.prepare(`SELECT * FROM activity_logs WHERE category=? AND action='insert'
      AND target IN (${targets.map(t=>`'${t}'`).join(',')}) AND id<?
      AND julianday(created_at)>=julianday(?) AND julianday(created_at)<julianday(?)
      AND (?='' OR username LIKE ? OR details LIKE ?) ORDER BY id DESC LIMIT 51`).all(category,before,range.start,range.end,keyword,like,like);
    const items=rows.slice(0,50).map(row=>{
      let details;try{details=JSON.parse(row.details);}catch{details={};}
      for(const key of ['image_data','imageData'])if(details[key])details[key]='[image]';
      const kind={forum_threads:'thread',forum_replies:'reply',life_records:'life'}[row.target];
      const imageUrl=category==='image'&&kind&&Number.isInteger(details.id)?`/api/media/${kind}/${details.id}`:'';
      return {...row,details:JSON.stringify(details),imageUrl};
    });
    return {items,next:rows.length>50?items.at(-1).id:null};
  }};
}
