import {storedAvatar,installAvatarPresets,avatarPresets} from './server-default-avatar.mjs';
import {ensureCompanyRobots} from './server-company-robots.mjs';
import {randomBytes} from 'node:crypto';
import {presenceKey} from './server-forum-presence.mjs';

function migrateLegacyPersonaOwner(db){
 const columns=db.prepare('PRAGMA table_info(forum_personas)').all();
 const owner=columns.find(c=>c.name==='created_by'),foreign=db.prepare('PRAGMA foreign_key_list(forum_personas)').all();
 if(!owner?.notnull&&foreign.some(f=>f.from==='created_by'&&f.on_delete==='SET NULL'))return;
 if(db.isTransaction)throw Error('演绎身份迁移必须在启动阶段执行。');
 const keys=db.prepare('PRAGMA foreign_keys').get().foreign_keys;
 const schema=db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND ((tbl_name='forum_personas' AND type IN ('index','trigger')) OR (type IN ('trigger','view') AND lower(sql) LIKE '%forum_personas%'))").all();
 const quote=name=>'"'+name.replaceAll('"','""')+'"';
 db.exec('PRAGMA foreign_keys=OFF;BEGIN IMMEDIATE');
 try{
  for(const entry of schema)if(entry.type==='trigger'||entry.type==='view')db.exec('DROP '+entry.type.toUpperCase()+' '+quote(entry.name));
  db.exec(`CREATE TABLE forum_personas_migration(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,robot_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,robot_name TEXT NOT NULL DEFAULT '');
   INSERT INTO forum_personas_migration(id,name,created_by,created_at,robot_employee_id,robot_name)
   SELECT id,name,created_by,created_at,${columns.some(c=>c.name==='robot_employee_id')?'robot_employee_id':'NULL'},${columns.some(c=>c.name==='robot_name')?'robot_name':"''"} FROM forum_personas;
   DROP TABLE forum_personas;ALTER TABLE forum_personas_migration RENAME TO forum_personas;`);
  for(const type of ['view','index','trigger'])for(const entry of schema)if(entry.type===type)db.exec(entry.sql);
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('演绎身份迁移关联校验失败。');
  db.exec('COMMIT');
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
 finally{db.exec('PRAGMA foreign_keys='+(keys?'ON':'OFF'));}
}

function syncRobotPersonas(db){
 // Deleted robots retain robot_name and must never be recreated by this legacy binding.
 db.exec(`UPDATE forum_personas SET robot_employee_id=(SELECT employee_id FROM company_robots WHERE codename=forum_personas.name COLLATE BINARY),robot_name=name
 WHERE robot_employee_id IS NULL AND robot_name='' AND EXISTS(SELECT 1 FROM company_robots r WHERE r.codename=forum_personas.name COLLATE BINARY AND NOT EXISTS(SELECT 1 FROM forum_personas p WHERE p.robot_employee_id=r.employee_id));
 INSERT INTO forum_personas(name,robot_employee_id,robot_name)
 SELECT 'robot-'||r.employee_id||'-'||lower(hex(randomblob(8))),r.employee_id,r.codename FROM company_robots r WHERE NOT EXISTS(SELECT 1 FROM forum_personas p WHERE p.robot_employee_id=r.employee_id);`);
}

function migrateHistoricalRobotPersonas(db){
 const references=['forum_threads','forum_replies'].filter(table=>db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='persona_id')).map(table=>`EXISTS(SELECT 1 FROM ${table} WHERE persona_id=p.id)`);
 if(!references.length)return;
 db.exec('SAVEPOINT migrate_forum_robots');
 try{
  // Bind existing same-name robots first. Unused legacy roles do not become new accounts.
  syncRobotPersonas(db);
  const legacy=db.prepare(`SELECT p.id,p.name FROM forum_personas p WHERE p.robot_employee_id IS NULL AND p.robot_name='' AND (${references.join(' OR ')}) ORDER BY p.id`).all();
  for(const role of legacy){
   const robotId=Number(db.prepare("INSERT INTO employees(username,password_hash,display_name,department,role,enabled,is_npc) VALUES(?,?,?,'','employee',0,1)").run('company-robot-'+randomBytes(16).toString('hex'),randomBytes(64).toString('hex'),role.name).lastInsertRowid);
   db.prepare('INSERT INTO company_robots(employee_id,codename) VALUES(?,?)').run(robotId,role.name);
   db.prepare('INSERT INTO profiles(employee_id,anonymous_name,avatar_preset) VALUES(?,?,?)').run(robotId,role.name,avatarPresets[robotId%avatarPresets.length]);
   db.prepare('UPDATE forum_personas SET robot_employee_id=?,robot_name=? WHERE id=?').run(robotId,role.name,role.id);
  }
  // No ledger writes: old identities never owned the operator's money.
  db.exec('RELEASE migrate_forum_robots');
 }catch(error){db.exec('ROLLBACK TO migrate_forum_robots;RELEASE migrate_forum_robots');throw error;}
}

export function installForumSocialSchema(db){
 installAvatarPresets(db);
 ensureCompanyRobots(db);
 db.exec(`CREATE TABLE IF NOT EXISTS forum_personas(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS forum_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,reply_id INTEGER NOT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,thread_id INTEGER NOT NULL,UNIQUE(employee_id,reply_id));
 CREATE INDEX IF NOT EXISTS forum_notifications_inbox ON forum_notifications(employee_id,thread_id,id);
 CREATE TABLE IF NOT EXISTS forum_notification_reads(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,last_notification_id INTEGER NOT NULL,PRIMARY KEY(employee_id,thread_id));`);
 if(!db.prepare('PRAGMA table_info(forum_notifications)').all().some(c=>c.name==='read_at'))db.exec("ALTER TABLE forum_notifications ADD COLUMN read_at TEXT NOT NULL DEFAULT ''");
 migrateLegacyPersonaOwner(db);
 db.exec('CREATE TABLE IF NOT EXISTS forum_workshop_requests(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,request_id TEXT NOT NULL,result_json TEXT NOT NULL,PRIMARY KEY(employee_id,request_id))');
 for(const [name,definition] of [['robot_employee_id','INTEGER REFERENCES employees(id) ON DELETE SET NULL'],['robot_name',"TEXT NOT NULL DEFAULT ''"]]){
  if(!db.prepare('PRAGMA table_info(forum_personas)').all().some(c=>c.name===name))db.exec(`ALTER TABLE forum_personas ADD COLUMN ${name} ${definition}`);
 }
 db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS forum_personas_robot ON forum_personas(robot_employee_id) WHERE robot_employee_id IS NOT NULL;
 CREATE TRIGGER IF NOT EXISTS forum_robot_name AFTER UPDATE OF codename ON company_robots BEGIN
 UPDATE forum_personas SET robot_name=NEW.codename WHERE robot_employee_id=NEW.employee_id; END;`);
 for(const table of ['forum_threads','forum_replies']){
  const columns=db.prepare(`PRAGMA table_info(${table})`).all();if(!columns.length)continue;
  if(!columns.some(c=>c.name==='persona_id'))db.exec(`ALTER TABLE ${table} ADD COLUMN persona_id INTEGER REFERENCES forum_personas(id)`);
  if(table==='forum_replies'&&!columns.some(c=>c.name==='reply_to_id'))db.exec('ALTER TABLE forum_replies ADD COLUMN reply_to_id INTEGER REFERENCES forum_replies(id) ON DELETE SET NULL');
 }
 migrateHistoricalRobotPersonas(db);
 if(!db.prepare('PRAGMA table_info(forum_threads)').all().length)return;
 // Migrate legacy timestamps/watermarks once; new notices use a binary read flag.
 db.exec('SAVEPOINT forum_notice_state');
 try{
  const columns=db.prepare('PRAGMA table_info(forum_notifications)').all();
  if(!columns.some(c=>c.name==='is_read')){
   db.exec("ALTER TABLE forum_notifications ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1));UPDATE forum_notifications SET is_read=1 WHERE read_at<>'' OR id<=COALESCE((SELECT last_notification_id FROM forum_notification_reads v WHERE v.employee_id=forum_notifications.employee_id AND v.thread_id=forum_notifications.thread_id),0)");
  }
  if(!columns.some(c=>c.name==='kind')){
   db.exec("ALTER TABLE forum_notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'thread' CHECK(kind IN ('thread','reply'));UPDATE forum_notifications SET kind='reply' WHERE EXISTS(SELECT 1 FROM forum_replies r JOIN forum_replies q ON q.id=r.reply_to_id WHERE r.id=forum_notifications.reply_id AND q.employee_id=forum_notifications.employee_id)");
  }
  db.exec('RELEASE forum_notice_state');
 }catch(error){db.exec('ROLLBACK TO forum_notice_state;RELEASE forum_notice_state');throw error;}
 db.exec('DROP TRIGGER IF EXISTS forum_notify_insert;DROP TRIGGER IF EXISTS forum_notify_publish');
 for(const event of ['INSERT','UPDATE OF status,moderation,deleted_at'])db.exec(`CREATE TRIGGER IF NOT EXISTS forum_notify_${event==='INSERT'?'insert':'publish'} AFTER ${event} ON forum_replies
 WHEN NEW.status='published' AND NEW.moderation='approved' AND NEW.deleted_at='' BEGIN
 INSERT OR IGNORE INTO forum_notifications(employee_id,reply_id,thread_id,kind)
 SELECT employee_id,NEW.id,NEW.thread_id,CASE WHEN MAX(direct)=1 THEN 'reply' ELSE 'thread' END FROM (
 SELECT employee_id,0 AS direct FROM forum_threads WHERE id=NEW.thread_id
 UNION ALL SELECT employee_id,1 AS direct FROM forum_replies WHERE id=NEW.reply_to_id AND thread_id=NEW.thread_id
 ) WHERE employee_id<>NEW.employee_id GROUP BY employee_id;
 END;`);
}

// Anonymous authors never carry an avatar reference; personas never expose their operator's balance.
export const forumPersonaNameSQL=id=>`(SELECT COALESCE((SELECT codename FROM company_robots WHERE employee_id=p.robot_employee_id),NULLIF(p.robot_name,''),p.name) FROM forum_personas p WHERE p.id=${id})`;
const forumAdminSQL=a=>`${a}.persona_id IS NULL AND EXISTS(SELECT 1 FROM employees WHERE id=${a}.employee_id AND username='AVED' COLLATE BINARY)`;
export const forumNameSQL=a=>`CASE WHEN ${a}.persona_id IS NOT NULL THEN ${forumPersonaNameSQL(a+'.persona_id')} WHEN (${forumAdminSQL(a)}) OR ${a}.identity_mode='real' THEN (SELECT display_name FROM employees WHERE id=${a}.employee_id) ELSE (SELECT anonymous_name FROM profiles WHERE employee_id=${a}.employee_id) END`;
export const forumAuthorSQL=a=>`${forumNameSQL(a)} AS anonymousName,(${forumAdminSQL(a)}) AS isForumAdmin,${a}.identity_mode AS identityMode,${a}.persona_id AS personaId,
 CASE WHEN ${a}.persona_id IS NULL THEN ${a}.employee_id ELSE (SELECT robot_employee_id FROM forum_personas WHERE id=${a}.persona_id) END AS presenceEmployeeId,
 CASE WHEN ${a}.persona_id IS NULL AND ${a}.identity_mode='real' THEN (SELECT avatar_url FROM profiles WHERE employee_id=${a}.employee_id) ELSE '' END AS avatarData,
 CASE WHEN ${a}.persona_id IS NULL AND ${a}.identity_mode='real' THEN ${a}.employee_id ELSE NULL END AS avatarId,CASE WHEN ${a}.persona_id IS NULL AND ${a}.identity_mode='real' THEN (SELECT avatar_preset FROM profiles WHERE employee_id=${a}.employee_id) ELSE '' END AS avatarPreset,
 CASE WHEN ${a}.persona_id IS NULL THEN (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=${a}.employee_id)
 ELSE (SELECT (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=p.robot_employee_id) FROM forum_personas p WHERE p.id=${a}.persona_id AND p.robot_employee_id IS NOT NULL) END AS balance`;
export function mapForumAuthor(row){const {avatarData,avatarId,avatarPreset,presenceEmployeeId,...rest}=row;return {...rest,presenceKey:presenceKey(presenceEmployeeId,!row.personaId&&row.identityMode==='real'?'real':'anonymous'),avatarUrl:avatarId?storedAvatar(avatarId,avatarData,avatarPreset,64):''};}

export function installForumSocial(db){
 installForumSocialSchema(db);
 function allowed(id){return !!db.prepare("SELECT 1 FROM employees WHERE id=? AND enabled=1 AND username='AVED' COLLATE BINARY").get(id);}
 function requireWorkshop(id){if(!allowed(id)){const e=Error('当前身份无权使用演绎编排。');e.status=403;throw e;}}
 function persona(id,value){if(value==null||value==='')return null;requireWorkshop(id);if(!Number.isSafeInteger(value)||!db.prepare('SELECT p.id FROM forum_personas p JOIN company_robots r ON r.employee_id=p.robot_employee_id WHERE p.id=?').get(value))throw Error('演绎机器人不存在，请刷新后重新选择。');return value;}
 function target(thread,value){if(value==null||value==='')return null;if(!Number.isSafeInteger(value)||!db.prepare("SELECT id FROM forum_replies WHERE id=? AND thread_id=? AND status='published' AND moderation='approved' AND deleted_at=''").get(value,thread))throw Error('回复对象不存在或不在本帖中。');return value;}
 const visible=`FROM forum_notifications n JOIN forum_threads t ON t.id=n.thread_id JOIN forum_replies r ON r.id=n.reply_id
 WHERE n.employee_id=? AND r.employee_id<>n.employee_id
 AND t.status='published' AND t.moderation='approved' AND t.deleted_at='' AND r.status='published' AND r.moderation='approved' AND r.deleted_at=''`;
 const inboxSQL=`WITH notices AS (
 SELECT n.id AS notificationId,1-n.is_read AS unread,n.kind,n.thread_id AS threadId,t.title,n.reply_id AS replyId,r.created_at AS createdAt,
 ${forumNameSQL('r')} AS authorName,substr(r.body,1,90) AS excerpt,
 (SELECT COUNT(*) FROM forum_replies f WHERE f.thread_id=r.thread_id AND f.id<=r.id) AS floor,
 CASE WHEN n.kind='reply' THEN n.reply_id ELSE n.thread_id END AS groupKey ${visible}
 ), ranked AS (
 SELECT *,SUM(unread) OVER group_window AS pendingCount,COUNT(*) OVER group_window AS totalCount,
 MAX(notificationId) OVER group_window AS through,
 ROW_NUMBER() OVER (PARTITION BY kind,groupKey ORDER BY unread DESC,notificationId DESC) AS chosen
 FROM notices WINDOW group_window AS (PARTITION BY kind,groupKey)
 ), groups AS (
 SELECT notificationId,(pendingCount>0) AS unread,kind,threadId,title,replyId,createdAt,authorName,excerpt,floor,through,
 CASE WHEN pendingCount>0 THEN pendingCount ELSE totalCount END AS count FROM ranked WHERE chosen=1
 ), limited AS (
 SELECT *,SUM(unread) OVER () AS unreadTotal,ROW_NUMBER() OVER (PARTITION BY unread ORDER BY through DESC) AS position FROM groups
 ) SELECT * FROM limited WHERE position<=CASE WHEN unread=1 THEN 20 ELSE 5 END ORDER BY unread DESC,through DESC`;
 function readVisible(id,thread,condition,args){
  db.prepare(`UPDATE forum_notifications SET is_read=1 WHERE employee_id=? AND thread_id=? AND ${condition}
   AND id IN (SELECT n.id ${visible})`).run(id,thread,...args,id);
 }
 return {allowed,persona,target,
  list(id){const canManage=allowed(id);if(!canManage)return {canManage,items:[]};syncRobotPersonas(db);return {canManage,items:db.prepare('SELECT p.id,r.employee_id AS robotId,r.codename AS name,r.purpose,(SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=r.employee_id) AS balance FROM forum_personas p JOIN company_robots r ON r.employee_id=p.robot_employee_id ORDER BY r.employee_id DESC').all()};},
  create(id){requireWorkshop(id);throw Error('请在管理端的公司机器人中新增或修改演绎身份。');},
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
  inbox(id){
   const rows=db.prepare(inboxSQL).all(id);
   return {unread:rows[0]?.unreadTotal||0,items:rows.map(({unreadTotal,position,...item})=>item)};
  },
  readReplies(id,thread,ids){
   if(!Array.isArray(ids)||ids.length>20||ids.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('无效的已读楼层。');
   if(ids.length)readVisible(id,thread,`reply_id IN (${ids.map(()=>'?').join(',')})`,ids);
   return {ok:true};
  },
  readThrough(thread,viewer){return db.prepare("SELECT COALESCE(MAX(id),0) AS id FROM forum_notifications WHERE thread_id=? AND employee_id=? AND kind='thread'").get(thread,viewer).id;},
  read(id,thread,through){
   if(!Number.isSafeInteger(through)||through<0)throw Error('无效阅读位置。');
   if(!db.prepare("SELECT 1 FROM forum_threads WHERE id=? AND status='published' AND moderation='approved' AND deleted_at=''").get(thread))throw Error('帖子不存在。');
   // A snapshot can only clear ordinary thread notices, never direct replies or later arrivals.
   readVisible(id,thread,"kind='thread' AND id<=?",[through]);return {ok:true};
  }
 };
}
