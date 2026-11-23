import {randomBytes} from 'node:crypto';

// Names are snapshots; routing always uses the immutable account foreign key.
export function installForumMentions(db,{nameSQL}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS forum_mention_targets(
  key TEXT PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('anonymous','real')),label TEXT NOT NULL,UNIQUE(employee_id,mode,label));
 CREATE TABLE IF NOT EXISTS forum_mention_spans(
  source_kind TEXT NOT NULL CHECK(source_kind IN ('thread','reply')),source_id INTEGER NOT NULL,thread_id INTEGER NOT NULL,
  start_pos INTEGER NOT NULL,end_pos INTEGER NOT NULL,target_key TEXT NOT NULL REFERENCES forum_mention_targets(key) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,label TEXT NOT NULL,mode TEXT NOT NULL,
  PRIMARY KEY(source_kind,source_id,start_pos));
 CREATE INDEX IF NOT EXISTS forum_mention_recipients ON forum_mention_spans(recipient_id,source_kind,source_id);
 CREATE TABLE IF NOT EXISTS forum_mention_notices(
  id INTEGER PRIMARY KEY AUTOINCREMENT,recipient_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,source_id INTEGER NOT NULL,thread_id INTEGER NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recipient_id,source_kind,source_id));
 CREATE INDEX IF NOT EXISTS forum_mention_inbox ON forum_mention_notices(recipient_id,is_read,id);`);
 const publicSources=`SELECT 'thread' AS sourceKind,t.id AS sourceId,t.id AS threadId,0 AS replyId,t.title,t.body,t.employee_id AS authorId,${nameSQL?nameSQL('t'):"t.anonymous_name"} AS authorName
  FROM forum_threads t WHERE t.status='published' AND t.moderation='approved' AND t.deleted_at=''
  UNION ALL SELECT 'reply',r.id,t.id,r.id,t.title,r.body,r.employee_id,${nameSQL?nameSQL('r'):"r.anonymous_name"}
  FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id WHERE r.status='published' AND r.moderation='approved' AND r.deleted_at='' AND t.status='published' AND t.moderation='approved' AND t.deleted_at=''`;
 const deliver=condition=>`INSERT OR IGNORE INTO forum_mention_notices(recipient_id,source_kind,source_id,thread_id)
  SELECT m.recipient_id,m.source_kind,m.source_id,m.thread_id FROM forum_mention_spans m JOIN (${publicSources}) s ON s.sourceKind=m.source_kind AND s.sourceId=m.source_id
  JOIN employees e ON e.id=m.recipient_id AND e.enabled=1 AND e.is_npc=0 WHERE s.authorId<>m.recipient_id AND ${condition};`;
 db.exec(`CREATE TRIGGER IF NOT EXISTS forum_mention_span_notify AFTER INSERT ON forum_mention_spans BEGIN ${deliver('m.source_kind=NEW.source_kind AND m.source_id=NEW.source_id')} END;`);
 for(const [kind,table]of [['thread','forum_threads'],['reply','forum_replies']]){
  db.exec(`CREATE TRIGGER IF NOT EXISTS forum_mention_${kind}_publish AFTER UPDATE OF status,moderation,deleted_at ON ${table} BEGIN ${deliver(kind==='thread'?'m.thread_id=NEW.id':"m.source_kind='reply' AND m.source_id=NEW.id")} END;
   CREATE TRIGGER IF NOT EXISTS forum_mention_${kind}_delete AFTER DELETE ON ${table} BEGIN
   DELETE FROM forum_mention_spans WHERE ${kind==='thread'?'thread_id=OLD.id':"source_kind='reply' AND source_id=OLD.id"};
   DELETE FROM forum_mention_notices WHERE ${kind==='thread'?'thread_id=OLD.id':"source_kind='reply' AND source_id=OLD.id"};END;`);
 }
 function target(id,mode,label){
  db.prepare('INSERT OR IGNORE INTO forum_mention_targets(key,employee_id,mode,label) VALUES(?,?,?,?)').run(randomBytes(24).toString('hex'),id,mode,label);
  return {key:db.prepare('SELECT key FROM forum_mention_targets WHERE employee_id=? AND mode=? AND label=?').get(id,mode,label).key,mode,label};
 }
 const visible=`FROM forum_mention_notices n JOIN (${publicSources}) s ON s.sourceKind=n.source_kind AND s.sourceId=n.source_id
  WHERE n.recipient_id=? AND EXISTS(SELECT 1 FROM forum_mention_spans m WHERE m.source_kind=n.source_kind AND m.source_id=n.source_id AND m.recipient_id=n.recipient_id)`;
 return {
  search(viewer,q,mode){
   if(!['anonymous','real'].includes(mode)||typeof q!=='string'||q.length>32)throw Error('提及检索条件无效。');
   q=q.trim();if(!q)return {items:[],ambiguous:false};
   const field=mode==='real'?'e.display_name':'p.anonymous_name';
   const rows=db.prepare(`SELECT e.id,${field} AS label,(SELECT COUNT(*) FROM employees other LEFT JOIN profiles op ON op.employee_id=other.id WHERE other.enabled=1 AND other.is_npc=0 AND ${mode==='real'?'other.display_name':'op.anonymous_name'}=${field} COLLATE NOCASE) AS duplicates
    FROM employees e JOIN profiles p ON p.employee_id=e.id WHERE e.enabled=1 AND e.is_npc=0 AND e.id<>? AND ${field}<>'' AND instr(lower(${field}),lower(?))>0 ORDER BY CASE WHEN ${field}=? THEN 0 ELSE 1 END,${field},e.id LIMIT 8`).all(viewer,q,q);
   return {items:rows.filter(r=>r.duplicates===1).map(r=>target(r.id,mode,r.label)),ambiguous:rows.some(r=>r.duplicates>1)};
  },
  prepare(body,spans=[]){
   if(!Array.isArray(spans)||spans.length>20)throw Error('每条发言最多提及 20 次。');
   if(spans.some(s=>!s||!Number.isSafeInteger(s.start)||!Number.isSafeInteger(s.end)))throw Error('提及内容无效，请重新选择。');
   let end=-1;return [...spans].sort((a,b)=>a.start-b.start).map(s=>{
    if(!s||!Number.isSafeInteger(s.start)||!Number.isSafeInteger(s.end)||s.start<0||s.start<end||s.end<=s.start||s.end>body.length||typeof s.key!=='string')throw Error('提及内容无效，请重新选择。');
    const t=db.prepare('SELECT t.*,e.enabled,e.is_npc FROM forum_mention_targets t JOIN employees e ON e.id=t.employee_id WHERE key=?').get(s.key);
    if(!t||!t.enabled||t.is_npc||body.slice(s.start,s.end)!=='@'+t.label)throw Error('提及对象已不可用，请重新选择。');
    end=s.end;return {start:s.start,end:s.end,key:s.key,recipient:t.employee_id,label:t.label,mode:t.mode};
   });
  },
  save(kind,id,thread,spans){
   db.prepare('DELETE FROM forum_mention_spans WHERE source_kind=? AND source_id=?').run(kind,id);
   const insert=db.prepare('INSERT INTO forum_mention_spans(source_kind,source_id,thread_id,start_pos,end_pos,target_key,recipient_id,label,mode) VALUES(?,?,?,?,?,?,?,?,?)');
   for(const s of spans)insert.run(kind,id,thread,s.start,s.end,s.key,s.recipient,s.label,s.mode);
  },
  decorate(kind,item){
   const spans=db.prepare('SELECT start_pos AS start,end_pos AS end,target_key AS key,label,mode FROM forum_mention_spans WHERE source_kind=? AND source_id=? ORDER BY start_pos').all(kind,item.id);
   return {...item,mentions:spans};
  },
  inbox(id){
   const rows=db.prepare(`WITH ranked AS (SELECT n.id AS mentionId,'mention' AS kind,1-n.is_read AS unread,n.thread_id AS threadId,s.replyId,s.title,s.authorName,substr(s.body,1,90) AS excerpt,n.created_at AS createdAt,1 AS count,
    SUM(1-n.is_read) OVER () AS unreadTotal,ROW_NUMBER() OVER (PARTITION BY n.is_read ORDER BY n.id DESC) AS position ${visible})
    SELECT * FROM ranked WHERE position<=CASE WHEN unread=1 THEN 20 ELSE 5 END ORDER BY unread DESC,mentionId DESC`).all(id);
   return {unread:rows[0]?.unreadTotal||0,items:rows.map(({unreadTotal,position,...item})=>item)};
  },
  read(id,thread,ids){
   if(!Array.isArray(ids)||ids.length>20||ids.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('提及阅读位置无效。');
   db.exec('SAVEPOINT read_forum_mentions');try{
    for(const notice of ids){
     const row=db.prepare(`SELECT n.id,n.source_kind,n.source_id ${visible} AND n.id=? AND n.thread_id=?`).get(id,notice,thread);if(!row)continue;
     db.prepare('UPDATE forum_mention_notices SET is_read=1 WHERE id=?').run(row.id);
     if(row.source_kind==='reply')db.prepare('UPDATE forum_notifications SET is_read=1 WHERE employee_id=? AND thread_id=? AND reply_id=?').run(id,thread,row.source_id);
    }
    db.exec('RELEASE read_forum_mentions');
   }catch(error){db.exec('ROLLBACK TO read_forum_mentions;RELEASE read_forum_mentions');throw error;}
   return {ok:true};
  }
 };
}
