import {storedAvatar} from './server-default-avatar.mjs';
import {recordImageReview,checkImageVersion} from './server-image-archive.mjs';
import {installAudit,auditRange} from './server-audit.mjs';
import {mediaReference} from './server-media.mjs';
// Persistent community records and moderation. Raw timestamps remain server-side.
export function installCommunity({db,send,readBody,requireEmployee,requireAdmin,publicProfile,balanceFor,log}) {
  const add=(table,name,definition)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);};
  for(const table of ['forum_threads','forum_replies','posts','dossier_comments','chat_messages']) {
    add(table,'edited_at',"TEXT NOT NULL DEFAULT ''");add(table,'deleted_at',"TEXT NOT NULL DEFAULT ''");add(table,'deleted_by','INTEGER');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS alias_history(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL,alias TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(employee_id,alias));
    CREATE TABLE IF NOT EXISTS speech_revisions(id INTEGER PRIMARY KEY,source_type TEXT NOT NULL,source_id INTEGER NOT NULL,employee_id INTEGER NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS life_records(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id),title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL CHECK(kind IN ('article','art')),tags TEXT NOT NULL DEFAULT '[]',image_data TEXT NOT NULL DEFAULT '',moderation TEXT NOT NULL DEFAULT 'approved',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,deleted_at TEXT NOT NULL DEFAULT '',deleted_by INTEGER);
    CREATE TABLE IF NOT EXISTS terminology_rules(id INTEGER PRIMARY KEY,pattern TEXT NOT NULL,replacement TEXT NOT NULL,is_regex INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS community_migrations(name TEXT PRIMARY KEY);
    CREATE INDEX IF NOT EXISTS life_records_public ON life_records(moderation,deleted_at,id);
    CREATE INDEX IF NOT EXISTS revisions_source ON speech_revisions(source_type,source_id,id);
    CREATE INDEX IF NOT EXISTS activity_created ON activity_logs(created_at,id);
    INSERT OR IGNORE INTO alias_history(employee_id,alias) SELECT employee_id,anonymous_name FROM profiles WHERE anonymous_name<>'';
    INSERT OR IGNORE INTO alias_history(employee_id,alias) SELECT employee_id,anonymous_name FROM forum_threads WHERE anonymous_name<>'';
    INSERT OR IGNORE INTO alias_history(employee_id,alias) SELECT employee_id,anonymous_name FROM forum_replies WHERE anonymous_name<>'';
    DROP TRIGGER IF EXISTS audit_profiles_INSERT;DROP TRIGGER IF EXISTS audit_profiles_UPDATE;DROP TRIGGER IF EXISTS audit_profiles_DELETE;
    INSERT INTO terminology_rules(pattern,replacement) SELECT '娱乐','愉乐' WHERE NOT EXISTS(SELECT 1 FROM community_migrations WHERE name='terminology-seed');
    INSERT OR IGNORE INTO community_migrations VALUES('terminology-seed');`);
  // Profile snapshots deliberately omit avatars. Only alias changes create history.
  db.exec(`CREATE TRIGGER IF NOT EXISTS community_alias_update AFTER UPDATE OF anonymous_name ON profiles WHEN OLD.anonymous_name<>NEW.anonymous_name BEGIN
    INSERT INTO alias_history(employee_id,alias) SELECT OLD.employee_id,OLD.anonymous_name WHERE NOT EXISTS(SELECT 1 FROM alias_history WHERE employee_id=OLD.employee_id AND alias=OLD.anonymous_name);
    INSERT INTO alias_history(employee_id,alias) SELECT NEW.employee_id,NEW.anonymous_name WHERE NOT EXISTS(SELECT 1 FROM alias_history WHERE employee_id=NEW.employee_id AND alias=NEW.anonymous_name);END;
    CREATE TRIGGER IF NOT EXISTS community_alias_insert AFTER INSERT ON profiles BEGIN INSERT INTO alias_history(employee_id,alias) SELECT NEW.employee_id,NEW.anonymous_name WHERE NOT EXISTS(SELECT 1 FROM alias_history WHERE employee_id=NEW.employee_id AND alias=NEW.anonymous_name);END;`);
  if(!db.prepare("SELECT 1 FROM community_migrations WHERE name='bulletins-v2'").get()) {
    const insert=db.prepare('INSERT INTO announcements(title,body,pinned,created_at) VALUES(?,?,0,?)');
    insert.run('关于员工生活档案归集的通知','各部门可将工作间隙的见闻、手稿与影像送交生活记录。涉及收容信息的材料，请先核验所属权限。',new Date().toISOString());
    insert.run('公共区域广播与设备巡检通告','公共广播线路已完成例行巡检。发现异常回声、重复呼号或无人值守设备自行启动时，请立即联系设施值班人员。',new Date(Date.now()-86400000).toISOString());
    db.prepare("INSERT INTO community_migrations VALUES('bulletins-v2')").run();
  }
  const audit=installAudit(db);
  const valid=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=n;
  const image=s=>{if(!s)return '';if(typeof s!=='string'||s.length>2200000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s))throw new Error('图片须为不超过 1.5 MB 的 PNG、JPG 或 WEBP。');return s;};
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
  const aliases=id=>db.prepare('SELECT alias FROM alias_history WHERE employee_id=? ORDER BY id').all(id).map(x=>x.alias);
  const revisions=(type,id)=>db.prepare('SELECT id,before_json AS before,after_json AS after,created_at AS createdAt FROM speech_revisions WHERE source_type=? AND source_id=? ORDER BY id').all(type,id).map(x=>({...x,before:JSON.parse(x.before),after:JSON.parse(x.after)}));
  const tables={thread:'forum_threads',reply:'forum_replies',comment:'posts',dossier:'dossier_comments',chat:'chat_messages',life:'life_records'};
  function speechRecords(url) {
    const sources=[['thread','forum_threads','title'],['reply','forum_replies',"''"],['comment','posts',"''"],['dossier','dossier_comments',"''"],['chat','chat_messages',"''"],['life','life_records','title']];
    const sql=sources.map(([type,table,title])=>`SELECT '${type}' AS sourceType,s.id AS sourceId,s.employee_id AS employeeId,s.body,${title==='title'?'s.title':title} AS title,s.created_at AS createdAt,s.deleted_at AS deletedAt,s.deleted_by AS deletedBy,${type==='life'?"''":'s.edited_at'} AS editedAt,e.username,e.display_name AS displayName,e.qq_number AS qqNumber,e.department,p.anonymous_name AS anonymousName,${['thread','reply'].includes(type)?'(SELECT name FROM forum_personas WHERE id=s.persona_id)':"''"} AS personaName FROM ${table} s LEFT JOIN employees e ON e.id=s.employee_id LEFT JOIN profiles p ON p.employee_id=s.employee_id`).join(' UNION ALL ');
    const {from,to}=auditRange(url.searchParams),keyword=(url.searchParams.get('keyword')||'').slice(0,120),source=url.searchParams.get('sourceType')||'',employee=url.searchParams.get('employeeId')||'',before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;
    if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to)))throw new Error('检索区间无效。');
    const rows=db.prepare(`SELECT * FROM (${sql}) WHERE (?='' OR sourceType=?) AND (?='' OR employeeId=?) AND (?='' OR date(createdAt,'+8 hours')>=?) AND (?='' OR date(createdAt,'+8 hours')<=?) AND (?='' OR body LIKE ? OR title LIKE ? OR username LIKE ? OR displayName LIKE ? OR qqNumber LIKE ? OR anonymousName LIKE ? OR personaName LIKE ?) AND sourceId<? ORDER BY createdAt DESC,sourceType,sourceId DESC LIMIT 50 OFFSET ?`).all(source,source,employee,employee,from,from,to,to,keyword,...Array(7).fill('%'+keyword+'%'),before,Math.min(1000000,Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0))));
    return rows.map(r=>({...r,aliases:aliases(r.employeeId),revisions:revisions(r.sourceType,r.sourceId)}));
  }
  function safeRule(data) {
    if(!valid(data.pattern,80)||typeof data.replacement!=='string'||data.replacement.length>160)throw new Error('请填写替换词，原词最多 80 字，替换内容最多 160 字。');
    if(data.isRegex) {
      // Restrict patterns to a finite sequence of literals/classes; no repetition or groups.
      // This prevents a display rule from creating catastrophic backtracking in every browser.
      if(/[()*+?{}|\\]/.test(data.pattern))throw new Error('正则仅支持文字、字符类、点号及首尾锚点。');
      try{new RegExp(data.pattern,'gu');}catch{throw new Error('正则表达式无效。');}
    }
    return [data.pattern,data.replacement,data.isRegex?1:0,data.enabled===false?0:1];
  }
  return {async handle(req,res,url) {
    const path=url.pathname,method=req.method;
    const edit=path.match(/^\/api\/player\/forum\/(thread|reply)\/(\d+)$/);
    const adminDelete=path.match(/^\/api\/admin\/(?:forum\/(threads|replies)|(?:speech\/)?(posts|dossier_comments|chat_messages|life_records))\/(\d+)$/);
    const dossierEdit=path.match(/^\/api\/admin\/dossiers\/(\d+)$/);
    const review=path.match(/^\/api\/admin\/moderation\/life\/(\d+)$/);
    const forumAdmin=path.match(/^\/api\/admin\/forum(?:\/(\d+))?$/);
    const handles=(forumAdmin&&method==='GET')||/^\/api\/admin\/image-archive\/\d+$/.test(path)||path==='/api/terminology'||path.startsWith('/api/admin/terminology')||path==='/api/admin/speech-records'||path==='/api/admin/activity'||path==='/api/posts'||path==='/api/player/life'||path==='/api/admin/life'||(path==='/api/admin/moderation'&&method==='GET')||(edit&&method==='PUT')||(adminDelete&&method==='DELETE')||(dossierEdit&&method==='PUT')||review;
    if(!handles)return false;
    const user=path.startsWith('/api/admin/')?requireAdmin(req,res):requireEmployee(req,res);if(!user)return true;
    try {
      if(/^\/api\/admin\/image-archive\/\d+$/.test(path)){if(method!=='GET'){send(res,405,{error:'指令无效。'});return true;}audit.image(Number(path.split('/').at(-1)),res);return true;}
      if(forumAdmin&&method==='GET'){
        const tid=Number(forumAdmin[1]),before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;
        if(tid){
          const thread=db.prepare("SELECT id,title FROM forum_threads WHERE id=? AND deleted_at=''").get(tid);if(!thread)throw Error('主题不存在。');
          const rows=db.prepare("SELECT r.id,r.body,r.status,r.moderation,r.created_at AS createdAt,e.display_name AS operatorName,COALESCE((SELECT name FROM forum_personas WHERE id=r.persona_id),r.anonymous_name) AS authorName FROM forum_replies r LEFT JOIN employees e ON e.id=r.employee_id WHERE r.thread_id=? AND r.deleted_at='' AND r.id>? ORDER BY r.id LIMIT 21").all(tid,Math.max(0,Number(url.searchParams.get('after'))||0));
          send(res,200,{thread,items:rows.slice(0,20),next:rows.length>20?rows[19].id:null});
        }else{
          const keyword=(url.searchParams.get('keyword')||'').slice(0,120);
          const rows=db.prepare("SELECT f.id,f.title,substr(f.body,1,180) AS excerpt,f.status,f.moderation,f.created_at AS createdAt,e.display_name AS operatorName,COALESCE((SELECT name FROM forum_personas WHERE id=f.persona_id),f.anonymous_name) AS authorName,(SELECT COUNT(*) FROM forum_replies WHERE thread_id=f.id AND deleted_at='') AS replyCount FROM forum_threads f LEFT JOIN employees e ON e.id=f.employee_id WHERE f.deleted_at='' AND f.id<? AND (?='' OR f.title LIKE ? OR f.body LIKE ?) ORDER BY f.id DESC LIMIT 21").all(before,keyword,'%'+keyword+'%','%'+keyword+'%');
          send(res,200,{items:rows.slice(0,20),next:rows.length>20?rows[19].id:null});
        }return true;
      }
      if(path==='/api/terminology'&&method==='GET'){send(res,200,{items:db.prepare('SELECT id,pattern,replacement,is_regex AS isRegex FROM terminology_rules WHERE enabled=1 ORDER BY id').all()});return true;}
      if(path.startsWith('/api/admin/terminology')) {
        const rid=Number(path.split('/')[4]);
        if(method==='GET')send(res,200,{items:db.prepare('SELECT id,pattern,replacement,is_regex AS isRegex,enabled FROM terminology_rules ORDER BY id').all()});
        else if(method==='POST'||method==='PUT') {const d=await readBody(req),values=safeRule(d);if(method==='PUT'){if(!db.prepare('UPDATE terminology_rules SET pattern=?,replacement=?,is_regex=?,enabled=? WHERE id=?').run(...values,rid).changes)throw new Error('词条不存在。');}else db.prepare('INSERT INTO terminology_rules(pattern,replacement,is_regex,enabled) VALUES(?,?,?,?)').run(...values);log(user.id,'terminology',String(rid||''),{pattern:d.pattern});send(res,200,{ok:true});}
        else if(method==='DELETE'){db.prepare('DELETE FROM terminology_rules WHERE id=?').run(rid);log(user.id,'terminology.delete',String(rid));send(res,200,{ok:true});}else send(res,405,{error:'指令无效。'});return true;
      }
      if(path==='/api/admin/speech-records'&&method==='GET'){send(res,200,{items:speechRecords(url)});return true;}
      if(path==='/api/admin/activity'&&method==='GET'){send(res,200,audit.query(url));return true;}
      if(path==='/api/posts') {
        if(method==='GET'){send(res,200,{items:db.prepare("SELECT s.id,s.body,s.created_at AS createdAt,e.display_name AS displayName,e.department,e.position_title AS positionTitle,e.id AS avatarId,p.avatar_url AS avatarData,p.avatar_preset AS avatarPreset FROM posts s JOIN employees e ON e.id=s.employee_id LEFT JOIN profiles p ON p.employee_id=e.id WHERE announcement_id=? AND status='published' AND deleted_at='' ORDER BY julianday(s.created_at) ASC,s.id ASC").all(Number(url.searchParams.get('announcementId'))).map(({avatarId,avatarData,avatarPreset,...item})=>({...item,avatarUrl:storedAvatar(avatarId,avatarData,avatarPreset,64)}))});return true;}
        if(method==='POST'){const d=await readBody(req);if(!db.prepare('SELECT id FROM announcements WHERE id=?').get(Number(d.announcementId))||!valid(d.body,2000))throw new Error('请选择有效通告并填写留言。');const r=db.prepare('INSERT INTO posts(announcement_id,employee_id,anonymous_name,body) VALUES(?,?,?,?)').run(Number(d.announcementId),user.id,user.displayName,d.body.trim());send(res,201,{id:Number(r.lastInsertRowid)});return true;}
      }
      if(edit&&method==='PUT') {
        const table=tables[edit[1]],row=db.prepare(`SELECT * FROM ${table} WHERE id=? AND employee_id=? AND deleted_at=''`).get(edit[2],user.id);
        if(!row){send(res,404,{error:'发言不存在或不属于当前员工。'});return true;}
        const d=await readBody(req,2500000);if(!valid(d.body,3000)||(edit[1]==='thread'&&!valid(d.title,120)))throw new Error('请填写有效标题和正文。');
        const img=d.imageData===undefined?row.image_data:image(d.imageData),needsReview=!!img,identityMode=d.identityMode??row.identity_mode??'anonymous';if(!['anonymous','real'].includes(identityMode))throw new Error('请选择发言身份。');
        tx(()=>{db.prepare('INSERT INTO speech_revisions(source_type,source_id,employee_id,before_json,after_json) VALUES(?,?,?,?,?)').run(edit[1],row.id,user.id,JSON.stringify({title:row.title,body:row.body,imageData:row.image_data,identityMode:row.identity_mode}),JSON.stringify({title:d.title,body:d.body.trim(),imageData:img,identityMode}));
          if(edit[1]==='thread')db.prepare("UPDATE forum_threads SET title=?,body=?,image_data=?,status=?,moderation=?,edited_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(d.title.trim(),d.body.trim(),img,needsReview?'hidden':'published',needsReview?'pending':'approved',row.id);
          else db.prepare("UPDATE forum_replies SET body=?,image_data=?,status=?,moderation=?,edited_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(d.body.trim(),img,needsReview?'hidden':'published',needsReview?'pending':'approved',row.id);
          db.prepare('UPDATE '+table+' SET identity_mode=? WHERE id=?').run(identityMode,row.id);log(user.id,'speech.edit',edit[1]+'/'+row.id);});send(res,200,{ok:true,pending:needsReview});return true;
      }
      if(adminDelete&&method==='DELETE') {
        const table=({threads:'forum_threads',replies:'forum_replies'})[adminDelete[1]]||adminDelete[2],rid=Number(adminDelete[3]);
        tx(()=>{const old=db.prepare(`SELECT * FROM ${table} WHERE id=? AND deleted_at=''`).get(rid);if(!old)throw new Error('记录不存在或已移除。');
          db.prepare(`UPDATE ${table} SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),deleted_by=?${['forum_threads','forum_replies','posts'].includes(table)?",status='hidden'":''} WHERE id=?`).run(user.id,rid);
          log(user.id,'moderator.delete',table+'/'+rid,{record:old,moderatorName:user.displayName});});send(res,200,{ok:true});return true;
      }
      if(dossierEdit&&method==='PUT') {
        const d=await readBody(req);if(!valid(d.code,80)||!valid(d.title,150)||!valid(d.summary,12000))throw new Error('请填写编号、名称和档案正文。');
        if(!db.prepare('UPDATE dossiers SET code=?,title=?,department=?,status=?,summary=? WHERE id=?').run(d.code.trim(),d.title.trim(),String(d.department||'').slice(0,80),String(d.status||'观察中').slice(0,80),d.summary.trim(),dossierEdit[1]).changes)throw new Error('档案不存在。');send(res,200,{ok:true});return true;
      }
      if(path==='/api/player/life'||path==='/api/admin/life') {
        if(method==='GET') {
          const q='%'+(url.searchParams.get('q')||'').slice(0,120)+'%',kind=url.searchParams.get('kind')||'',department=url.searchParams.get('department')||'',order=url.searchParams.get('order')==='oldest'?'ASC':'DESC',before=Number(url.searchParams.get('before'))||0;
          const rows=db.prepare(`SELECT l.id,l.title,l.body,l.kind,l.tags,l.image_data AS imageData,l.moderation,l.created_at AS createdAt,p.anonymous_name AS anonymousName FROM life_records l JOIN profiles p ON p.employee_id=l.employee_id WHERE l.deleted_at='' ${path.includes('/admin/')?'':"AND l.moderation='approved'"} AND (?='' OR kind=?) AND (title LIKE ? OR body LIKE ?) AND (?='' OR EXISTS(SELECT 1 FROM json_each(l.tags) WHERE value=?)) AND (?=0 OR l.id${order==='ASC'?'>':'<'}?) ORDER BY l.id ${order} LIMIT 21`).all(kind,kind,q,q,department,department,before,before);
          send(res,200,{items:rows.slice(0,20).map(r=>({...r,tags:JSON.parse(r.tags),imageData:mediaReference('life',r.id,r.imageData)})),next:rows.length>20?rows[19].id:null});return true;
        }
        if(method==='POST'&&path==='/api/player/life') {
          const d=await readBody(req,2500000),img=image(d.imageData),tags=Array.isArray(d.tags)?[...new Set(d.tags.map(x=>String(x).trim()).filter(Boolean))]:[];
          if(!valid(d.title,120)||typeof d.body!=='string'||d.body.length>10000||!['article','art'].includes(d.kind)||(d.kind==='art'&&!img)||(d.kind==='article'&&!d.body.trim())||tags.length>8||tags.some(t=>t.length>40))throw new Error('请填写标题和作品，标签最多八项。');
          const r=db.prepare('INSERT INTO life_records(employee_id,title,body,kind,tags,image_data,moderation) VALUES(?,?,?,?,?,?,?)').run(user.id,d.title.trim(),d.body.trim(),d.kind,JSON.stringify(tags),img,img?'pending':'approved');log(user.id,'life.submit',String(r.lastInsertRowid),{kind:d.kind,pending:!!img});send(res,201,{id:Number(r.lastInsertRowid),pending:!!img});return true;
        }
      }
      if(path==='/api/admin/moderation'&&method==='GET') {
        const items=db.prepare(`SELECT 'thread' AS kind,f.id,f.title,f.body,f.image_data AS imageData,f.employee_id AS employeeId,e.username,e.display_name AS displayName,f.created_at AS createdAt FROM forum_threads f JOIN employees e ON e.id=f.employee_id WHERE f.moderation='pending' AND f.deleted_at=''
          UNION ALL SELECT 'reply',r.id,t.title,r.body,r.image_data,r.employee_id,e.username,e.display_name,r.created_at FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id JOIN employees e ON e.id=r.employee_id WHERE r.moderation='pending' AND r.deleted_at='' AND t.deleted_at=''
          UNION ALL SELECT 'life',l.id,l.title,l.body,l.image_data,l.employee_id,e.username,e.display_name,l.created_at FROM life_records l JOIN employees e ON e.id=l.employee_id WHERE l.moderation='pending' AND l.deleted_at='' ORDER BY createdAt`).all().map(row=>({...row,archiveId:db.prepare('SELECT id FROM image_upload_archive WHERE source_type=? AND source_id=? ORDER BY id DESC LIMIT 1').get(row.kind,row.id)?.id,sourceBoard:row.kind==='life'?'生活记录':'匿名聊天论坛',imageData:mediaReference(row.kind,row.id,row.imageData)}));send(res,200,{items});return true;
      }
      if(review&&method==='POST') {
        const d=await readBody(req);if(!['approve','reject'].includes(d.action))throw new Error('审核指令无效。');
        tx(()=>{checkImageVersion(db,'life',Number(review[1]),d.archiveId);if(!db.prepare("UPDATE life_records SET moderation=? WHERE id=? AND moderation='pending' AND deleted_at=''").run(d.action==='approve'?'approved':'rejected',review[1]).changes)throw new Error('材料已核验或已移除。');recordImageReview(db,'life',Number(review[1]),user,d.action);});log(user.id,'moderation','life/'+review[1],{decision:d.action});send(res,200,{ok:true});return true;
      }
      send(res,405,{error:'指令无效。'});return true;
    }catch(e){send(res,400,{error:e.message});return true;}
  }};
}
