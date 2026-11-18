export const forumReactionCatalog=Object.freeze([
 {id:'plus',name:'+1',price:300,animated:true},
 {id:'heart',name:'心动一下',price:300,animated:true},
 {id:'thumb',name:'大拇指',price:300,animated:true},
 {id:'flower',name:'鲜花',price:800,animated:true},
 {id:'medal',name:'值得表彰',price:800,animated:true},
 {id:'hundred',name:'满分！',price:800,animated:true},
 {id:'cup',name:'这杯敬你',price:800,animated:true},
 {id:'bulb',name:'醍醐灌顶',price:800,animated:true},
 {id:'check',name:'对勾',price:800,animated:true},
 {id:'eyes',name:'围观',price:800,animated:true},
 {id:'mahjong',name:'中',price:800,animated:true},
 {id:'fan',name:'我扇！',price:800,animated:true},
 {id:'spark',name:'闪耀登场',price:1500,animated:true},
 {id:'fire',name:'热度拉满',price:1500,animated:true},
 {id:'applause',name:'肃然起敬',price:1500,animated:true},
 {id:'pig',name:'猪',price:1500,animated:true},
 {id:'thinking',name:'思考',price:1500,animated:true},
 {id:'question',name:'问号',price:1500,animated:true}
]);

export function installForumReactions({db,balanceFor,recordLedger}){
 db.exec(`CREATE TABLE IF NOT EXISTS forum_reactions(
  id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK(target_kind IN ('thread','reply')),target_id INTEGER NOT NULL,
  reaction TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(target_kind,target_id,reaction,employee_id));
  CREATE INDEX IF NOT EXISTS forum_reactions_target ON forum_reactions(target_kind,target_id,reaction);
  CREATE TABLE IF NOT EXISTS forum_reaction_versions(thread_id INTEGER PRIMARY KEY REFERENCES forum_threads(id) ON DELETE CASCADE,revision INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS forum_reaction_notifications(
   id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
   reaction_id INTEGER NOT NULL UNIQUE REFERENCES forum_reactions(id) ON DELETE CASCADE,
   read_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS forum_reaction_notifications_inbox ON forum_reaction_notifications(employee_id,read_at,id);`);
 const visible=(kind,id)=>{
  if(!['thread','reply'].includes(kind)||!Number.isSafeInteger(id)||id<1)throw Error('请选择有效的发言。');
  const sql=kind==='thread'?"SELECT 1 FROM forum_threads WHERE id=? AND status='published' AND moderation='approved' AND deleted_at=''":"SELECT 1 FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id WHERE r.id=? AND r.status='published' AND r.moderation='approved' AND r.deleted_at='' AND t.status='published' AND t.moderation='approved' AND t.deleted_at=''";
  if(!db.prepare(sql).get(id))throw Error('发言已移除或暂不可见。');
 };
 const summary=(kind,id,viewer)=>db.prepare('SELECT reaction AS id,COUNT(*) AS count,MAX(employee_id=?) AS mine FROM forum_reactions WHERE target_kind=? AND target_id=? GROUP BY reaction ORDER BY MIN(id)').all(viewer,kind,id).map(row=>({...row}));
 function decoratePage(threadId,page,viewer){
  const ids=(page.items||[]).map(x=>x.id),rows=db.prepare(`SELECT target_kind,target_id,reaction AS id,COUNT(*) AS count,MAX(employee_id=?) AS mine FROM forum_reactions WHERE (target_kind='thread' AND target_id=?)${ids.length?` OR (target_kind='reply' AND target_id IN (${ids.map(()=>'?').join(',')}))`:''} GROUP BY target_kind,target_id,reaction ORDER BY MIN(id)`).all(viewer,threadId,...ids),groups=new Map();
  for(const {target_kind,target_id,...item}of rows){const k=target_kind+':'+target_id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}
  return {threadReactions:groups.get('thread:'+threadId)||[],...page,items:page.items?.map(item=>({...item,reactions:groups.get('reply:'+item.id)||[]}))};
 }
 const noticeVisible=`FROM forum_reaction_notifications n JOIN forum_reactions a ON a.id=n.reaction_id
 LEFT JOIN forum_replies r ON a.target_kind='reply' AND r.id=a.target_id
 JOIN forum_threads t ON t.id=CASE WHEN a.target_kind='thread' THEN a.target_id ELSE r.thread_id END
 WHERE n.employee_id=? AND a.employee_id<>n.employee_id
 AND t.status='published' AND t.moderation='approved' AND t.deleted_at=''
 AND (a.target_kind='thread' OR (r.status='published' AND r.moderation='approved' AND r.deleted_at=''))`;
 const noticeSelect=`SELECT n.id AS notificationId,(n.read_at='') AS unread,t.id AS threadId,t.title,
 CASE WHEN a.target_kind='reply' THEN a.target_id ELSE 0 END AS replyId,a.reaction,n.created_at AS createdAt `;
 // Moderation columns finish migrating after services are installed at startup.
 let noticeQueries;
 const notices=()=>noticeQueries??=( {
  count:db.prepare('SELECT COUNT(*) AS n '+noticeVisible+" AND n.read_at=''"),
  fresh:db.prepare(noticeSelect+noticeVisible+" AND n.read_at='' ORDER BY n.id DESC LIMIT 20"),
  old:db.prepare(noticeSelect+noticeVisible+" AND n.read_at<>'' ORDER BY n.id DESC LIMIT 5")
 });
 return {catalog:forumReactionCatalog,summary,decoratePage,
  inbox(id){const q=notices();return {unread:q.count.get(id).n,items:[...q.fresh.all(id),...q.old.all(id)]};},
  read(id,ids){
   if(!Array.isArray(ids)||ids.length>20||ids.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('无效的反应提醒。');
   if(ids.length)db.prepare(`UPDATE forum_reaction_notifications SET read_at=CURRENT_TIMESTAMP WHERE employee_id=? AND id IN (${ids.map(()=>'?').join(',')})`).run(id,...ids);
   return {ok:true};
  },
  add(actor,data){
   const {kind,targetId,reaction}=data||{},item=forumReactionCatalog.find(x=>x.id===reaction);
   if(!item)throw Error('请选择有效反应。');
   if(data.confirmed!==true)throw Error('请确认本次反应的费用。');
   db.exec('BEGIN IMMEDIATE');try{
    visible(kind,targetId);
    const prior=db.prepare('SELECT id FROM forum_reactions WHERE employee_id=? AND target_kind=? AND target_id=? AND reaction=?').get(actor,kind,targetId,reaction);
    if(!prior){
     if(balanceFor(actor)<item.price)throw Error('余额不足，此反应需要 '+item.price.toLocaleString('en-US')+' ¤。');
     const ledger=recordLedger(actor,-item.price,'论坛反应：'+item.name);
     const added=db.prepare('INSERT INTO forum_reactions(employee_id,target_kind,target_id,reaction,price,ledger_id) VALUES(?,?,?,?,?,?)').run(actor,kind,targetId,reaction,item.price,Number(ledger.lastInsertRowid));
     const recipient=db.prepare('SELECT employee_id FROM '+(kind==='thread'?'forum_threads':'forum_replies')+' WHERE id=?').get(targetId).employee_id;
     if(recipient!==actor)db.prepare('INSERT INTO forum_reaction_notifications(employee_id,reaction_id) VALUES(?,?)').run(recipient,Number(added.lastInsertRowid));
    }
    if(!prior&&db.prepare("SELECT 1 FROM sqlite_master WHERE name='forum_reply_clock'").get()){
     db.exec('UPDATE forum_reply_clock SET revision=revision+1 WHERE id=1');
     const threadId=kind==='thread'?targetId:db.prepare('SELECT thread_id FROM forum_replies WHERE id=?').get(targetId).thread_id;
     db.prepare('INSERT INTO forum_reaction_versions VALUES(?,(SELECT revision FROM forum_reply_clock WHERE id=1)) ON CONFLICT(thread_id) DO UPDATE SET revision=excluded.revision').run(threadId);
    }
    const reactions=summary(kind,targetId,actor),balance=balanceFor(actor);db.exec('COMMIT');
    return {reactions,balance,charged:prior?0:item.price};
   }catch(error){db.exec('ROLLBACK');throw error;}
  }
 };
}
