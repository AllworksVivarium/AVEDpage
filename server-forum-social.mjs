import {storedAvatar,installAvatarPresets} from './server-default-avatar.mjs';

export function installForumSocialSchema(db){
 installAvatarPresets(db);
 db.exec(`CREATE TABLE IF NOT EXISTS forum_personas(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS forum_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,reply_id INTEGER NOT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,thread_id INTEGER NOT NULL,UNIQUE(employee_id,reply_id));
 CREATE INDEX IF NOT EXISTS forum_notifications_inbox ON forum_notifications(employee_id,thread_id,id);
 CREATE TABLE IF NOT EXISTS forum_notification_reads(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,last_notification_id INTEGER NOT NULL,PRIMARY KEY(employee_id,thread_id));`);
 db.exec('CREATE TABLE IF NOT EXISTS forum_workshop_requests(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,request_id TEXT NOT NULL,result_json TEXT NOT NULL,PRIMARY KEY(employee_id,request_id))');
 for(const table of ['forum_threads','forum_replies']){
  const columns=db.prepare(`PRAGMA table_info(${table})`).all();if(!columns.length)continue;
  if(!columns.some(c=>c.name==='persona_id'))db.exec(`ALTER TABLE ${table} ADD COLUMN persona_id INTEGER REFERENCES forum_personas(id)`);
  if(table==='forum_replies'&&!columns.some(c=>c.name==='reply_to_id'))db.exec('ALTER TABLE forum_replies ADD COLUMN reply_to_id INTEGER REFERENCES forum_replies(id) ON DELETE SET NULL');
 }
 if(!db.prepare('PRAGMA table_info(forum_threads)').all().length)return;
 for(const event of ['INSERT','UPDATE OF status,moderation,deleted_at'])db.exec(`CREATE TRIGGER IF NOT EXISTS forum_notify_${event==='INSERT'?'insert':'publish'} AFTER ${event} ON forum_replies
 WHEN NEW.status='published' AND NEW.moderation='approved' AND NEW.deleted_at='' BEGIN
 INSERT OR IGNORE INTO forum_notifications(employee_id,reply_id,thread_id)
 SELECT employee_id,NEW.id,NEW.thread_id FROM forum_threads WHERE id=NEW.thread_id AND employee_id<>NEW.employee_id
 UNION SELECT employee_id,NEW.id,NEW.thread_id FROM forum_replies WHERE id=NEW.reply_to_id AND thread_id=NEW.thread_id AND employee_id<>NEW.employee_id;
 END;`);
}

// Anonymous authors never carry an avatar reference; personas never expose their operator's balance.
export const forumNameSQL=a=>`CASE WHEN ${a}.persona_id IS NOT NULL THEN (SELECT name FROM forum_personas WHERE id=${a}.persona_id) WHEN ${a}.identity_mode='real' THEN (SELECT display_name FROM employees WHERE id=${a}.employee_id) ELSE (SELECT anonymous_name FROM profiles WHERE employee_id=${a}.employee_id) END`;
export const forumAuthorSQL=a=>`${forumNameSQL(a)} AS anonymousName,${a}.identity_mode AS identityMode,${a}.persona_id AS personaId,
 CASE WHEN ${a}.persona_id IS NULL AND ${a}.identity_mode='real' THEN (SELECT avatar_url FROM profiles WHERE employee_id=${a}.employee_id) ELSE '' END AS avatarData,
 CASE WHEN ${a}.persona_id IS NULL AND ${a}.identity_mode='real' THEN ${a}.employee_id ELSE NULL END AS avatarId,CASE WHEN ${a}.persona_id IS NULL AND ${a}.identity_mode='real' THEN (SELECT avatar_preset FROM profiles WHERE employee_id=${a}.employee_id) ELSE '' END AS avatarPreset,
 CASE WHEN ${a}.persona_id IS NULL THEN (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=${a}.employee_id) ELSE NULL END AS balance`;
export function mapForumAuthor(row){const {avatarData,avatarId,avatarPreset,...rest}=row;return {...rest,avatarUrl:avatarId?storedAvatar(avatarId,avatarData,avatarPreset,64):''};}

export function installForumSocial(db){
 installForumSocialSchema(db);
 function allowed(id){return !!db.prepare("SELECT 1 FROM employees WHERE id=? AND enabled=1 AND (role='admin' OR identity_kind='planning_member')").get(id);}
 function requireWorkshop(id){if(!allowed(id)){const e=Error('此功能仅对企划组成员和管理员开放。');e.status=403;throw e;}}
 function persona(id,value){if(value==null||value==='')return null;requireWorkshop(id);if(!Number.isSafeInteger(value)||!db.prepare('SELECT id FROM forum_personas WHERE id=?').get(value))throw Error('演绎身份不存在。');return value;}
 function target(thread,value){if(value==null||value==='')return null;if(!Number.isSafeInteger(value)||!db.prepare("SELECT id FROM forum_replies WHERE id=? AND thread_id=? AND status='published' AND moderation='approved' AND deleted_at=''").get(value,thread))throw Error('回复对象不存在或不在本帖中。');return value;}
 const visible=`FROM forum_notifications n JOIN forum_threads t ON t.id=n.thread_id JOIN forum_replies r ON r.id=n.reply_id
 LEFT JOIN forum_notification_reads v ON v.employee_id=n.employee_id AND v.thread_id=n.thread_id
 WHERE n.employee_id=? AND n.id>COALESCE(v.last_notification_id,0) AND r.employee_id<>n.employee_id
 AND t.status='published' AND t.moderation='approved' AND t.deleted_at='' AND r.status='published' AND r.moderation='approved' AND r.deleted_at=''`;
 return {allowed,persona,target,
  list(id){return {canManage:allowed(id),items:allowed(id)?db.prepare('SELECT id,name FROM forum_personas ORDER BY id DESC LIMIT 200').all():[]};},
  create(id,name){requireWorkshop(id);if(typeof name!=='string'||!name.trim()||name.trim().length>32)throw Error('身份名称应为 1 至 32 字。');name=name.trim();if(db.prepare('SELECT 1 FROM employees WHERE display_name=? COLLATE NOCASE OR username=? COLLATE NOCASE UNION SELECT 1 FROM profiles WHERE anonymous_name=? COLLATE NOCASE').get(name,name,name))throw Error('此名称已被员工使用，请另选一个演绎名称。');if(db.prepare('SELECT COUNT(*) AS n FROM forum_personas').get().n>=200)throw Error('演绎身份已达到 200 个。');if(db.prepare('SELECT 1 FROM forum_personas WHERE name=? COLLATE NOCASE').get(name))throw Error('演绎身份已存在。');const r=db.prepare('INSERT INTO forum_personas(name,created_by) VALUES(?,?)').run(name,id);return {id:Number(r.lastInsertRowid),name};},
  topics(id){requireWorkshop(id);return {items:db.prepare("SELECT id,title FROM forum_threads WHERE status='published' AND moderation='approved' AND deleted_at='' ORDER BY id DESC LIMIT 30").all()};},
  publish(id,data){
   requireWorkshop(id);if(typeof data.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(data.requestId))throw Error('缺少发布凭据，请重新打开编排。');
   const existing=db.prepare('SELECT result_json FROM forum_workshop_requests WHERE employee_id=? AND request_id=?').get(id,data.requestId);if(existing)return JSON.parse(existing.result_json);
   if(!Array.isArray(data.lines)||data.lines.length<1||data.lines.length>12)throw Error('每次编排 1 至 12 条发言。');
   const lines=data.lines.map(line=>{if(!line||typeof line.body!=='string'||!line.body.trim()||line.body.trim().length>3000)throw Error('每条发言应为 1 至 3000 字。');const personaId=persona(id,line.personaId);if(!personaId)throw Error('请为每条发言选择演绎身份。');return {personaId,body:line.body.trim()};});
   let threadId=data.threadId;if(threadId!=null&&(!Number.isSafeInteger(threadId)||!db.prepare("SELECT 1 FROM forum_threads WHERE id=? AND status='published' AND moderation='approved' AND deleted_at=''").get(threadId)))throw Error('请选择有效主题。');
   if(threadId==null&&(typeof data.title!=='string'||!data.title.trim()||data.title.trim().length>120))throw Error('新主题标题应为 1 至 120 字。');
   const alias=db.prepare('SELECT anonymous_name FROM profiles WHERE employee_id=?').get(id)?.anonymous_name||'演绎';
   db.exec('BEGIN IMMEDIATE');try{
    const replyIds=[];for(const [i,line] of lines.entries()){
     if(threadId==null&&i===0)threadId=Number(db.prepare("INSERT INTO forum_threads(employee_id,anonymous_name,title,body,persona_id) VALUES(?,?,?,?,?)").run(id,alias,data.title.trim(),line.body,line.personaId).lastInsertRowid);
     else replyIds.push(Number(db.prepare('INSERT INTO forum_replies(thread_id,employee_id,anonymous_name,body,persona_id) VALUES(?,?,?,?,?)').run(threadId,id,alias,line.body,line.personaId).lastInsertRowid));
    }
    const result={threadId,replyIds};db.prepare('INSERT INTO forum_workshop_requests VALUES(?,?,?)').run(id,data.requestId,JSON.stringify(result));db.exec('COMMIT');return result;
   }catch(e){db.exec('ROLLBACK');throw e;}
  },
  inbox(id){return {unread:db.prepare('SELECT COUNT(*) AS n '+visible).get(id).n,items:db.prepare(`WITH unread AS (SELECT n.id,n.thread_id,n.reply_id,t.title,r.created_at ${visible}),grouped AS (SELECT thread_id,COUNT(*) AS count,MAX(id) AS latest FROM unread GROUP BY thread_id ORDER BY latest DESC LIMIT 20)
   SELECT u.thread_id AS threadId,u.title,g.count,u.reply_id AS replyId,u.created_at AS createdAt FROM grouped g JOIN unread u ON u.id=g.latest ORDER BY g.latest DESC`).all(id)};},
  readThrough(thread,viewer){return db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM forum_notifications WHERE thread_id=? AND employee_id=?').get(thread,viewer).id;},
  read(id,thread,through){if(!Number.isSafeInteger(through)||through<0)throw Error('无效阅读位置。');if(!db.prepare("SELECT 1 FROM forum_threads WHERE id=? AND status='published' AND deleted_at=''").get(thread))throw Error('帖子不存在。');const max=db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM forum_notifications WHERE thread_id=? AND employee_id=?').get(thread,id).id;db.prepare('INSERT INTO forum_notification_reads VALUES(?,?,?) ON CONFLICT(employee_id,thread_id) DO UPDATE SET last_notification_id=MAX(last_notification_id,excluded.last_notification_id)').run(id,thread,Math.min(through,max));return {ok:true};}
 };
}
