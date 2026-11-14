import {forumAuthorSQL,mapForumAuthor} from './server-forum-social.mjs';

export function installForumList(db){
 db.exec("CREATE INDEX IF NOT EXISTS forum_threads_browse ON forum_threads(status,id); CREATE INDEX IF NOT EXISTS forum_replies_activity ON forum_replies(thread_id,status,created_at)");
 if(!db.prepare('PRAGMA table_info(forum_threads)').all().some(c=>c.name==='view_count'))db.exec('ALTER TABLE forum_threads ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0');
 db.exec(`CREATE TABLE IF NOT EXISTS forum_view_visitors(thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,last_seen INTEGER NOT NULL,PRIMARY KEY(thread_id,employee_id))`);
 const browse=(viewer,q=new URLSearchParams())=>{
  const requested=Number(q.get('page')||1),sort=q.get('sort')||'newest',search=(q.get('q')||'').trim();
  if(!Number.isSafeInteger(requested)||requested<1||!['newest','activity'].includes(sort)||search.length>100)throw Error('无效的论坛检索条件。');
  const before=Number(q.get('before')||Number.MAX_SAFE_INTEGER);
  if(!Number.isSafeInteger(before)||before<1)throw Error('无效的帖子位置。');
  const where="f.status='published' AND f.moderation='approved' AND f.deleted_at='' AND f.id<? AND (?='' OR instr(lower(f.title),lower(?))>0 OR instr(lower(f.body),lower(?))>0)",args=[before,search,search,search];
  const total=db.prepare('SELECT COUNT(*) AS n FROM forum_threads f WHERE '+where).get(...args).n,pageSize=10,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requested,pages);
  const order=sort==='activity'?"MAX(julianday(f.created_at),COALESCE((SELECT MAX(julianday(r.created_at)) FROM forum_replies r WHERE r.thread_id=f.id AND r.status='published' AND r.moderation='approved' AND r.deleted_at=''),julianday(f.created_at))) DESC,f.id DESC":"f.id DESC";
  const rows=db.prepare(`SELECT f.id,f.title,f.view_count AS viewCount,substr(f.body,1,100) AS body,length(f.body)>100 AS truncated,${forumAuthorSQL('f')},f.created_at AS createdAt,f.edited_at AS editedAt,(f.employee_id=?) AS canEdit,
   (SELECT COUNT(*) FROM forum_replies r WHERE r.thread_id=f.id AND r.status='published' AND r.moderation='approved' AND r.deleted_at='') AS replyCount
   FROM forum_threads f JOIN profiles p ON p.employee_id=f.employee_id WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(viewer,...args,pageSize,(page-1)*pageSize);
  return {items:rows.map(row=>({...mapForumAuthor(row),preview:true})),page,pages,pageSize,total,sort,q:search,next:page<pages?rows.at(-1)?.id:null};
 };
 browse.recordView=(viewer,thread,now=Date.now())=>{
  const topic=db.prepare("SELECT view_count AS viewCount FROM forum_threads WHERE id=? AND status='published' AND moderation='approved' AND deleted_at=''").get(thread);
  if(!topic)throw Error('帖子不存在或未通过审核。');
  const previous=db.prepare('SELECT last_seen FROM forum_view_visitors WHERE thread_id=? AND employee_id=?').get(thread,viewer);
  if(previous&&now-previous.last_seen<30*60*1000)return topic;
  db.exec('SAVEPOINT forum_view');
  try{
   db.prepare('INSERT INTO forum_view_visitors VALUES(?,?,?) ON CONFLICT(thread_id,employee_id) DO UPDATE SET last_seen=excluded.last_seen').run(thread,viewer,now);
   db.prepare('UPDATE forum_threads SET view_count=view_count+1 WHERE id=?').run(thread);
   db.exec('RELEASE forum_view');
  }catch(error){db.exec('ROLLBACK TO forum_view; RELEASE forum_view');throw error;}
  return {viewCount:topic.viewCount+1};
 };
 return browse;
}
