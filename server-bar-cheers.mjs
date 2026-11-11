import {randomUUID} from 'node:crypto';

// Invitations and names are decided on the server; accepting once creates one chat entry.
export function createBarCheers({db,clock,dayFor,name,currentOrder,isOnline}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_cheers(
 id TEXT PRIMARY KEY,sender_id INTEGER NOT NULL,recipient_id INTEGER NOT NULL,
 sender_name TEXT NOT NULL,recipient_name TEXT NOT NULL,sender_order INTEGER NOT NULL,recipient_order INTEGER NOT NULL,
 day TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',request_key TEXT NOT NULL,
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,resolved_at INTEGER,
 UNIQUE(sender_id,request_key));
 CREATE INDEX IF NOT EXISTS bar_cheers_sender ON bar_cheers(sender_id,created_at);
 CREATE INDEX IF NOT EXISTS bar_cheers_pending ON bar_cheers(status,expires_at);`);
 function author(id,mode){
  if(mode!==undefined&&!['anonymous','real'].includes(mode))throw Error('请选择实名或匿名。');
  return mode==='real'?(db.prepare('SELECT display_name FROM employees WHERE id=?').get(id)?.display_name||'员工'):name(id);
 }
 function sweep(){
  const now=clock();db.prepare("UPDATE bar_cheers SET status='expired',resolved_at=? WHERE status='pending' AND expires_at<=?").run(now,now);
  for(const row of db.prepare("SELECT * FROM bar_cheers WHERE status='pending'").all()){
   if(!isOnline(row.sender_id)||!isOnline(row.recipient_id)||row.day!==dayFor(now)||currentOrder(row.sender_id)?.id!==row.sender_order||currentOrder(row.recipient_id)?.id!==row.recipient_order)
    db.prepare("UPDATE bar_cheers SET status='cancelled',resolved_at=? WHERE id=? AND status='pending'").run(now,row.id);
  }
  db.prepare('DELETE FROM bar_cheers WHERE created_at<?').run(now-86400000);
 }
 const invitation=row=>({id:row.id,senderId:row.sender_id,recipientId:row.recipient_id,senderName:row.sender_name,recipientName:row.recipient_name,expiresAt:row.expires_at});
 return {
  shared(){sweep();return db.prepare("SELECT id,sender_id AS senderId,recipient_id AS recipientId,sender_name AS senderName,recipient_name AS recipientName,resolved_at AS acceptedAt FROM bar_cheers WHERE status='accepted' AND resolved_at>? ORDER BY resolved_at,id LIMIT 20").all(clock()-6000);},
  personal(id){return db.prepare("SELECT * FROM bar_cheers WHERE status='pending' AND (sender_id=? OR recipient_id=?) ORDER BY created_at,id LIMIT 8").all(id,id).map(invitation);},
  request(actor,data){
   sweep();const target=Number(data.targetId);
   if(!Number.isSafeInteger(target)||target<1||target===actor.id)throw Error('请选择另一位客人。');
   if(typeof data.requestId!=='string'||! /^[A-Za-z0-9_-]{16,100}$/.test(data.requestId))throw Error('请重新发起碰杯。');
   const old=db.prepare('SELECT * FROM bar_cheers WHERE sender_id=? AND request_key=?').get(actor.id,data.requestId);
   if(old){if(old.recipient_id!==target)throw Error('碰杯凭据已使用。');return {ok:true,id:old.id,status:old.status};}
   const senderName=author(actor.id,data.identityMode),own=currentOrder(actor.id),other=currentOrder(target);
   if(!isOnline(actor.id)||!isOnline(target))throw Error('对方已离开吧台。');
   if(!own||!other)throw Error('双方都点一杯酒后，就可以碰杯了。');
   const duplicate=db.prepare("SELECT id FROM bar_cheers WHERE status='pending' AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))").get(actor.id,target,target,actor.id);
   if(duplicate)throw Error('你们的碰杯邀请还在等待回应。');
   if(db.prepare("SELECT COUNT(*) AS count FROM bar_cheers WHERE status='pending' AND sender_id=?").get(actor.id).count>=4)throw Error('最多同时发出 4 份碰杯邀请。');
   if(db.prepare("SELECT COUNT(*) AS count FROM bar_cheers WHERE status='pending' AND recipient_id=?").get(target).count>=4)throw Error('对方的碰杯邀请有些多，稍后再试。');
   const last=db.prepare('SELECT created_at FROM bar_cheers WHERE sender_id=? AND recipient_id=? ORDER BY created_at DESC LIMIT 1').get(actor.id,target);
   if(last&&clock()-last.created_at<30000)throw Error('刚邀请过这位客人，稍后再试吧。');
   const id=randomUUID(),now=clock();
   db.prepare('INSERT INTO bar_cheers(id,sender_id,recipient_id,sender_name,recipient_name,sender_order,recipient_order,day,request_key,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,actor.id,target,senderName,name(target),own.id,other.id,dayFor(now),data.requestId,now,now+45000);
   return {ok:true,id,status:'pending'};
  },
  respond(actor,id,data){
   sweep();const row=db.prepare('SELECT * FROM bar_cheers WHERE id=?').get(id);
   if(!row||![row.sender_id,row.recipient_id].includes(actor.id))throw Error('碰杯邀请不存在。');
   const decision=data.decision;
   if(!['accepted','declined','cancelled'].includes(decision)||decision==='cancelled'&&actor.id!==row.sender_id||decision!=='cancelled'&&actor.id!==row.recipient_id)throw Error('无法回应这份碰杯邀请。');
   if(row.status===decision)return {ok:true,status:decision};
   if(row.status!=='pending')throw Error('这份碰杯邀请已经结束。');
   const recipientName=decision==='accepted'?author(actor.id,data.identityMode):row.recipient_name,now=clock();
   db.exec('BEGIN IMMEDIATE');
   try{
    const updated=db.prepare("UPDATE bar_cheers SET status=?,recipient_name=?,resolved_at=? WHERE id=? AND status='pending'").run(decision,recipientName,now,id);
    if(updated.changes!==1)throw Error('这份碰杯邀请已经结束。');
    if(decision==='accepted')db.prepare('INSERT INTO bar_messages(employee_id,alias,identity_mode,body,created_at) VALUES(NULL,?,?,?,?)').run('碰杯','anonymous',row.sender_name+' 和 '+recipientName+' 轻轻碰了一杯。',new Date(now).toISOString());
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   return {ok:true,status:decision};
  }
 };
}
