export const forumReactionCatalog=Object.freeze([
 {id:'question',name:'？',price:2000}, {id:'heart',name:'喜欢',price:4000},
 {id:'eyes',name:'围观',price:6000}, {id:'applause',name:'鼓掌',price:8000},
 {id:'cup',name:'敬一杯',price:10000}, {id:'flower',name:'送花',price:15000},
 {id:'spark',name:'闪闪发光',price:30000,animated:true},
 {id:'fire',name:'热烈回应',price:60000,animated:true},
 {id:'signal',name:'异常共鸣',price:100000,animated:true}
]);

export function installForumReactions({db,balanceFor,recordLedger}){
 db.exec(`CREATE TABLE IF NOT EXISTS forum_reactions(
  id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK(target_kind IN ('thread','reply')),target_id INTEGER NOT NULL,
  reaction TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(target_kind,target_id,reaction,employee_id));
  CREATE INDEX IF NOT EXISTS forum_reactions_target ON forum_reactions(target_kind,target_id,reaction);
  CREATE TABLE IF NOT EXISTS forum_reaction_versions(thread_id INTEGER PRIMARY KEY REFERENCES forum_threads(id) ON DELETE CASCADE,revision INTEGER NOT NULL);`);
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
 return {catalog:forumReactionCatalog,summary,decoratePage,
  add(actor,data){
   const {kind,targetId,reaction}=data||{},item=forumReactionCatalog.find(x=>x.id===reaction);
   if(!item)throw Error('请选择有效反应。');
   if(data.confirmed!==true)throw Error('请确认本次反应的费用。');
   db.exec('BEGIN IMMEDIATE');try{
    visible(kind,targetId);
    const prior=db.prepare('SELECT id FROM forum_reactions WHERE employee_id=? AND target_kind=? AND target_id=? AND reaction=?').get(actor,kind,targetId,reaction);
    if(!prior){
     if(balanceFor(actor)<item.price)throw Error('余额不足，此反应需要 '+item.price.toLocaleString('en-US')+' A 币。');
     const ledger=recordLedger(actor,-item.price,'论坛反应：'+item.name);
     db.prepare('INSERT INTO forum_reactions(employee_id,target_kind,target_id,reaction,price,ledger_id) VALUES(?,?,?,?,?,?)').run(actor,kind,targetId,reaction,item.price,Number(ledger.lastInsertRowid));
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
