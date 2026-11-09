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
 const hasTopics=!!db.prepare("SELECT 1 FROM sqlite_master WHERE name='forum_threads'").get();
 const owner=hasTopics?"EXISTS(SELECT 1 FROM forum_threads t WHERE t.id=r.thread_id AND t.employee_id=r.employee_id AND t.persona_id IS r.persona_id AND t.identity_mode=r.identity_mode)":'0';
 const select=`SELECT r.id,r.body,r.image_data AS imageData,${forumAuthorSQL('r')},r.created_at AS createdAt,r.edited_at AS editedAt,(r.employee_id=?) AS canEdit,
 (SELECT COUNT(*) FROM forum_replies f WHERE f.thread_id=r.thread_id AND f.id<=r.id) AS floor,${owner} AS isTopicAuthor,
 q.id AS replyToId,${forumNameSQL('q')} AS replyToName,substr(q.body,1,120) AS replyToBody,
 CASE WHEN q.id IS NOT NULL THEN (SELECT COUNT(*) FROM forum_replies f WHERE f.thread_id=q.thread_id AND f.id<=q.id) END AS replyToFloor
 FROM forum_replies r JOIN profiles p ON p.employee_id=r.employee_id
 LEFT JOIN forum_replies q ON q.id=r.reply_to_id AND q.thread_id=r.thread_id AND q.status='published' AND q.deleted_at='' WHERE r.thread_id=? AND r.status='published' AND r.deleted_at=''`;
 const map=row=>mapForumAuthor({...row,imageData:mediaReference('reply',row.id,row.imageData)});
 return (threadId,viewer,q)=>{
  const revision=db.prepare('SELECT revision FROM forum_reply_clock WHERE id=1').get().revision;
  if(q.has('page')||q.has('reply')){
   let page=number(q,'page')||1;const target=number(q,'reply'),pageSize=20;
   const visible="thread_id=? AND status='published' AND deleted_at=''";
   const total=db.prepare('SELECT COUNT(*) AS n FROM forum_replies WHERE '+visible).get(threadId).n,pages=Math.max(1,Math.ceil(total/pageSize));
   if(target){
    const item=db.prepare(select+' AND r.id=?').get(viewer,threadId,target);
    if(!item)throw Error('该楼层已删除或暂不可见。');
    const preceding=db.prepare('SELECT COUNT(*) AS n FROM forum_replies WHERE '+visible+' AND id<?').get(threadId,target).n;
    page=Math.floor(preceding/pageSize)+1;
    if(q.get('context')==='1')return {items:[map(item)],page,pages,total,pageSize,changesCursor:revision};
   }
   page=Math.min(page,pages);
   if(q.get('revision')===String(revision))return {notModified:true,page,pages,total,pageSize,changesCursor:revision};
   const items=db.prepare(select+' ORDER BY r.id LIMIT ? OFFSET ?').all(viewer,threadId,pageSize,(page-1)*pageSize).map(map);
   return {items,page,pages,total,pageSize,changesCursor:revision};
  }
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
