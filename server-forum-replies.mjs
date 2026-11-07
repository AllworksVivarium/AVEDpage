import {installForumSocialSchema,forumAuthorSQL,forumNameSQL,mapForumAuthor} from './server-forum-social.mjs';
import {mediaReference} from './server-media.mjs';

// One revision per reply, including tombstones; editing never copies image bytes.
export function installForumReplies(db){
 installForumSocialSchema(db);
 db.exec(`CREATE TABLE IF NOT EXISTS forum_reply_clock(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
 INSERT OR IGNORE INTO forum_reply_clock VALUES(1,0);
 CREATE TABLE IF NOT EXISTS forum_reply_versions(reply_id INTEGER PRIMARY KEY,thread_id INTEGER NOT NULL,revision INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS forum_reply_versions_poll ON forum_reply_versions(thread_id,revision);
 CREATE INDEX IF NOT EXISTS forum_replies_page ON forum_replies(thread_id,id);`);
 for(const action of ['INSERT','UPDATE','DELETE']){
  const row=action==='DELETE'?'OLD':'NEW';
  db.exec(`CREATE TRIGGER IF NOT EXISTS forum_reply_version_${action} AFTER ${action} ON forum_replies BEGIN
   UPDATE forum_reply_clock SET revision=revision+1 WHERE id=1;
   INSERT INTO forum_reply_versions VALUES(${row}.id,${row}.thread_id,(SELECT revision FROM forum_reply_clock WHERE id=1))
   ON CONFLICT(reply_id) DO UPDATE SET thread_id=excluded.thread_id,revision=excluded.revision;
  END;`);
 }
 const number=(q,key)=>{const n=Number(q.get(key)||0);if(!Number.isSafeInteger(n)||n<0)throw Error('无效回复游标。');return n;};
 const select=`SELECT r.id,r.body,r.image_data AS imageData,${forumAuthorSQL('r')},r.created_at AS createdAt,r.edited_at AS editedAt,(r.employee_id=?) AS canEdit,
 q.id AS replyToId,${forumNameSQL('q')} AS replyToName,substr(q.body,1,120) AS replyToBody
 FROM forum_replies r JOIN profiles p ON p.employee_id=r.employee_id
 LEFT JOIN forum_replies q ON q.id=r.reply_to_id AND q.thread_id=r.thread_id AND q.status='published' AND q.deleted_at='' WHERE r.thread_id=? AND r.status='published' AND r.deleted_at=''`;
 const map=row=>mapForumAuthor({...row,imageData:mediaReference('reply',row.id,row.imageData)});
 return (threadId,viewer,q)=>{
  const revision=db.prepare('SELECT revision FROM forum_reply_clock WHERE id=1').get().revision;
  if(q.has('since')){
   const since=number(q,'since');
   const changes=db.prepare('SELECT reply_id,revision FROM forum_reply_versions WHERE thread_id=? AND revision>? ORDER BY revision LIMIT 21').all(threadId,since);
   const page=changes.slice(0,20),items=[],removed=[];
   const statement=db.prepare(select+' AND r.id=?');
   for(const c of page){const row=statement.get(viewer,threadId,c.reply_id);if(row)items.push(map(row));else removed.push(c.reply_id);}
   return {items,removed,changesCursor:changes.length>20?page.at(-1).revision:revision,moreChanges:changes.length>20};
  }
  const rows=db.prepare(select+' AND r.id>? ORDER BY r.id LIMIT 21').all(viewer,threadId,number(q,'after'));
  return {items:rows.slice(0,20).map(map),next:rows.length>20?rows[19].id:null,changesCursor:revision};
 };
}
