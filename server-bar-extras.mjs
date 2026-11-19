import {randomUUID} from 'node:crypto';
import {barDrinks} from './server-bar-catalog.mjs';
import {groupMusicAlbums} from './bar-music-albums.mjs';

export const JUKEBOX_PRICE=30000;
const WEEK=7*86400000;
export function installBarExtras({db,clock,balanceFor,recordLedger,name,isContainment,getMusic,drinking,dayFor}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_contact_handles(employee_id INTEGER NOT NULL REFERENCES employees(id),mode TEXT NOT NULL,token TEXT NOT NULL UNIQUE,PRIMARY KEY(employee_id,mode));
 CREATE TABLE IF NOT EXISTS bar_stored_drinks(id INTEGER PRIMARY KEY,sender_id INTEGER NOT NULL REFERENCES employees(id),recipient_id INTEGER REFERENCES employees(id),recipient_mode TEXT NOT NULL,recipient_name TEXT NOT NULL,sender_mode TEXT NOT NULL,sender_name TEXT NOT NULL,drink_id TEXT NOT NULL,note TEXT NOT NULL,price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,request_key TEXT NOT NULL,UNIQUE(sender_id,request_key));
 CREATE INDEX IF NOT EXISTS bar_stored_drinks_inbox ON bar_stored_drinks(recipient_id,status,expires_at);
 CREATE INDEX IF NOT EXISTS bar_stored_drinks_expiry ON bar_stored_drinks(status,expires_at);
 CREATE INDEX IF NOT EXISTS bar_stored_drinks_sender ON bar_stored_drinks(sender_id,id DESC);
 CREATE TABLE IF NOT EXISTS bar_jukebox_requests(id TEXT PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id),track_id INTEGER NOT NULL,title TEXT NOT NULL,alias TEXT NOT NULL,identity_mode TEXT NOT NULL,message TEXT NOT NULL,price INTEGER NOT NULL,created_at INTEGER NOT NULL,starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'active',request_key TEXT NOT NULL,UNIQUE(employee_id,request_key));
 CREATE INDEX IF NOT EXISTS bar_jukebox_queue ON bar_jukebox_requests(status,ends_at);`);
 const jukeColumns=new Set(db.prepare('PRAGMA table_info(bar_jukebox_requests)').all().map(c=>c.name));
 for(const column of ['batch_id','album_key'])if(!jukeColumns.has(column))db.exec(`ALTER TABLE bar_jukebox_requests ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
 const columns=new Set(db.prepare('PRAGMA table_info(employees)').all().map(x=>x.name));
 const eligibility=[columns.has('enabled')?'e.enabled=1':'1',columns.has('is_npc')?'e.is_npc=0':'1',columns.has('identity_kind')?"e.identity_kind IN ('player_employee','player_containment','planning_member')":'1',db.prepare("SELECT 1 FROM sqlite_master WHERE name='company_robots'").get()?'NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=e.id)':'1'].join(' AND ');
 const atomic=fn=>{const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');try{const out=fn();if(own)db.exec('COMMIT');return out;}catch(e){if(own)db.exec('ROLLBACK');throw e;}};
 const mode=value=>{if(!['anonymous','real'].includes(value))throw Error('请选择匿名或实名身份。');return value;};
 const requestKey=value=>{if(typeof value!=='string'||! /^[A-Za-z0-9_-]{16,100}$/.test(value))throw Error('请重新提交这份委托。');return value;};
 const text=(value,label)=>{if(value===undefined)return '';if(typeof value!=='string'||Array.from(value.trim()).length>120||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error(label+'最多 120 字。');return value.trim();};
 const author=(id,kind)=>kind==='real'?db.prepare('SELECT display_name FROM employees WHERE id=?').get(id)?.display_name||name(id):name(id);
 const findHandle=db.prepare('SELECT token FROM bar_contact_handles WHERE employee_id=? AND mode=?'),insertHandle=db.prepare('INSERT OR IGNORE INTO bar_contact_handles(employee_id,mode,token) VALUES(?,?,?)');
 function contacts(actor,kind,query=''){
  mode(kind);if(typeof query!=='string'||query.length>40)throw Error('请缩短搜索内容。');
  const label=kind==='real'?'e.display_name':"COALESCE(NULLIF(p.anonymous_name,''),'匿名员工-'||e.id)";
  const rows=db.prepare(`SELECT e.id,${label} AS label FROM employees e LEFT JOIN profiles p ON p.employee_id=e.id WHERE ${eligibility} AND e.id<>? AND instr(lower(${label}),lower(?))>0 ORDER BY label COLLATE NOCASE LIMIT 20`).all(actor.id,query.trim());
  return rows.map(row=>{let handle=findHandle.get(row.id,kind);if(!handle){insertHandle.run(row.id,kind,randomUUID());handle=findHandle.get(row.id,kind);}return {token:handle.token,name:row.label,isContainment:isContainment(row.id)};});
 }
 let lastSweep=-Infinity;
 function sweep(force=false){
  if(!force&&clock()-lastSweep<60000)return;
  atomic(()=>{for(const row of db.prepare("SELECT * FROM bar_stored_drinks WHERE status='pending' AND expires_at<=?").all(clock())){recordLedger(row.sender_id,row.price,'吧台留酒到期退回');db.prepare("UPDATE bar_stored_drinks SET status='expired' WHERE id=? AND status='pending'").run(row.id);}});
  lastSweep=clock();
 }
 const storedView=(row,id)=>({id:row.id,direction:row.sender_id===id?'outgoing':'incoming',recipientMode:row.recipient_mode,recipientName:row.recipient_name,senderMode:row.sender_mode,senderName:row.sender_name,senderIsContainment:isContainment(row.sender_id),drinkId:row.drink_id,note:row.note,price:row.price,expiresAt:row.expires_at,...(row.sender_id===id?{status:row.expires_at>clock()?'stored':'ended'}:{status:row.status})});
 function personal(id){sweep();const rows=db.prepare("SELECT * FROM (SELECT * FROM bar_stored_drinks WHERE sender_id=? ORDER BY id DESC LIMIT 10) UNION ALL SELECT * FROM bar_stored_drinks WHERE sender_id<>? AND status='pending' AND expires_at>? AND (recipient_id=? OR recipient_mode='public') ORDER BY id DESC").all(id,id,clock(),id);return {items:rows.map(row=>storedView(row,id))};}
 function leave(actor,data){
  const drink=barDrinks.find(x=>x.id===data.drinkId&&x.price>0&&x.orderable!==false);if(!drink)throw Error('请选择一款付费饮品。');
  const key=requestKey(data.requestId),senderMode=mode(data.identityMode??'anonymous'),note=text(data.note,'留酒便签'),recipientMode=data.recipientMode;
  if(!['anonymous','real','public'].includes(recipientMode))throw Error('请选择收件身份。');
  const contact=recipientMode==='public'?null:db.prepare(`SELECT h.employee_id AS id FROM bar_contact_handles h JOIN employees e ON e.id=h.employee_id WHERE h.token=? AND h.mode=? AND ${eligibility}`).get(String(data.recipientToken||''),recipientMode);
  if(recipientMode!=='public'&&(!contact||contact.id===actor.id))throw Error('请选择另一位收件人。');
  return atomic(()=>{
   const old=db.prepare('SELECT * FROM bar_stored_drinks WHERE sender_id=? AND request_key=?').get(actor.id,key);
   if(old){if(old.drink_id!==drink.id||old.recipient_mode!==recipientMode||old.recipient_id!==(contact?.id??null)||old.sender_mode!==senderMode||old.note!==note)throw Error('这份留酒凭据已使用。');return {ok:true};}
   if(balanceFor(actor.id)<drink.price)throw Error('余额不足，无法留下这杯。');
   const now=clock();if(db.prepare("SELECT COUNT(*) AS n FROM bar_stored_drinks WHERE sender_id=? AND status='pending' AND expires_at>?").get(actor.id,now).n>=5)throw Error('吧台最多同时保管你留下的 5 杯酒。');
   if(contact&&db.prepare("SELECT COUNT(*) AS n FROM bar_stored_drinks WHERE recipient_id=? AND recipient_mode=? AND status='pending' AND expires_at>?").get(contact.id,recipientMode,now).n>=10)throw Error('这个收件信箱暂时放满了。');
   if(!contact&&db.prepare("SELECT COUNT(*) AS n FROM bar_stored_drinks WHERE recipient_mode='public' AND status='pending' AND expires_at>?").get(now).n>=20)throw Error('吧台的待领酒位暂时放满了。');
   const recipientName=contact?author(contact.id,recipientMode):'下一位客人';
   recordLedger(actor.id,-drink.price,'吧台留酒：'+drink.name);
   db.prepare('INSERT INTO bar_stored_drinks(sender_id,recipient_id,recipient_mode,recipient_name,sender_mode,sender_name,drink_id,note,price,created_at,expires_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(actor.id,contact?.id??null,recipientMode,recipientName,senderMode,author(actor.id,senderMode),drink.id,note,drink.price,now,now+WEEK,key);
   return {ok:true};
  });
 }
 function receive(actor,id,data){
  if(!['accepted','declined'].includes(data.decision))throw Error('请选择领用或婉拒。');
  atomic(()=>{
   const row=db.prepare('SELECT * FROM bar_stored_drinks WHERE id=?').get(id);
   if(!row||row.sender_id===actor.id||row.recipient_mode!=='public'&&row.recipient_id!==actor.id||row.recipient_mode==='public'&&data.decision!=='accepted')throw Error('未找到可处理的留酒。');
   if(row.recipient_mode!=='public'&&data.identityMode!==row.recipient_mode)throw Error('请切换到对应的收件身份。');
   if(row.status===data.decision&&row.recipient_id===actor.id)return;
   if(row.status!=='pending'||row.expires_at<=clock())throw Error('这杯留酒已领用或已到期。');
   if(data.decision==='accepted'){
    if(drinking.currentOrder(actor.id)?.remainingMl>0)throw Error('先喝完桌上这一杯，再来领用吧。');
    db.prepare('INSERT INTO bar_orders(employee_id,day,drink_id,price,request_key,created_at,payer_id,gift_id) VALUES(?,?,?,?,?,?,?,?)').run(actor.id,dayFor(clock()),row.drink_id,row.price,'@stored:'+row.id,new Date(clock()).toISOString(),row.sender_id,-row.id);
   }else recordLedger(row.sender_id,row.price,'吧台留酒未领用退回');
   db.prepare('UPDATE bar_stored_drinks SET status=?,recipient_id=COALESCE(recipient_id,?) WHERE id=? AND status=\'pending\'').run(data.decision,actor.id,id);
  });drinking.invalidate(actor.id);
 }
 function queue(music=getMusic()){
  const ids=new Set(music.enabled?music.tracks.map(t=>t.id):[]);
  const invalid=db.prepare("SELECT * FROM bar_jukebox_requests WHERE status='active' AND ends_at>?").all(clock()).filter(row=>!ids.has(row.track_id));
  if(invalid.length)atomic(()=>{for(const row of invalid){recordLedger(row.employee_id,row.price,'点播曲目下架退回');db.prepare("UPDATE bar_jukebox_requests SET status='cancelled' WHERE id=? AND status='active'").run(row.id);}let end=clock();for(const row of db.prepare("SELECT * FROM bar_jukebox_requests WHERE status='active' AND ends_at>? ORDER BY starts_at,id").all(clock())){if(row.starts_at<=clock()){end=Math.max(end,row.ends_at);continue;}const duration=row.ends_at-row.starts_at;db.prepare('UPDATE bar_jukebox_requests SET starts_at=?,ends_at=? WHERE id=?').run(end,end+duration,row.id);end+=duration;}});
  const catalog=new Map(music.tracks.map(t=>[t.id,t]));
  const items=db.prepare("SELECT * FROM bar_jukebox_requests WHERE status='active' AND ends_at>? ORDER BY starts_at,id LIMIT 100").all(clock()).map(row=>({id:row.id,trackId:row.track_id,title:row.title,artist:catalog.get(row.track_id)?.artist||'',album:catalog.get(row.track_id)?.album||'',batchId:row.batch_id||row.id,albumRequest:!!row.album_key,alias:row.alias,identityMode:row.identity_mode,message:row.message,startsAt:row.starts_at,endsAt:row.ends_at,isContainment:isContainment(row.employee_id)}));
  return {price:JUKEBOX_PRICE,queue:items};
 }
 function requestSong(actor,data){
  const key=requestKey(data.requestId),kind=mode(data.identityMode??'anonymous'),message=text(data.message,'点播留言');
  const albumRequest=typeof data.albumId==='string'&&data.albumId.length>0;
  if(albumRequest&&(data.albumId.length>100||data.trackId!==undefined))throw Error('请选择单曲或整张专辑。');
  return atomic(()=>{
   const old=db.prepare('SELECT * FROM bar_jukebox_requests WHERE employee_id=? AND request_key=?').get(actor.id,key);
   if(old){if((albumRequest?old.album_key!==data.albumId:!!old.album_key||old.track_id!==data.trackId)||old.identity_mode!==kind||old.message!==message)throw Error('这份点播凭据已使用。');return {ok:true};}
   const music=getMusic(),album=albumRequest&&groupMusicAlbums(music.tracks).find(a=>a.id===data.albumId),selected=albumRequest?album?.tracks:music.tracks.filter(t=>t.id===data.trackId);
   if(!music.enabled||!selected?.length)throw Error('这首歌或专辑暂时不能点播，请选择已上架曲目。');
   if(selected.length>50)throw Error('一张专辑最多点播 50 首。');
   queue(music);const now=clock(),pending=db.prepare("SELECT id,batch_id,employee_id,ends_at FROM bar_jukebox_requests WHERE status='active' AND ends_at>? ORDER BY ends_at DESC").all(now),batches=new Set(pending.map(r=>r.batch_id||r.id)),mine=new Set(pending.filter(r=>r.employee_id===actor.id).map(r=>r.batch_id||r.id));
   if(batches.size>=20||mine.size>=2||pending.length+selected.length>100)throw Error('点播队列暂满；每位客人最多保留两份点播（两首单曲、两张专辑或各一份）。');
   const price=JUKEBOX_PRICE*selected.length;
   if(balanceFor(actor.id)<price)throw Error(`余额不足，本次点播需要 ${price.toLocaleString('en-US')} ¤。`);
   let start=Math.max(now,pending[0]?.ends_at||now);const batch=randomUUID(),alias=author(actor.id,kind);
   recordLedger(actor.id,-price,'酒吧点播：'+(albumRequest?album.title:selected[0].title));
   const insert=db.prepare('INSERT INTO bar_jukebox_requests(id,employee_id,track_id,title,alias,identity_mode,message,price,created_at,starts_at,ends_at,request_key,batch_id,album_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
   for(const [index,track] of selected.entries()){
    const duration=Math.max(30,Math.min(900,Number(track.durationSeconds)||180))*1000;
    insert.run(randomUUID(),actor.id,track.id,track.title,alias,kind,message,JUKEBOX_PRICE,now,start,start+duration,index===0?key:key+':'+index,batch,albumRequest?data.albumId:'');start+=duration;
   }
   return {ok:true};
  });
 }
 const usualCache=new Map();
 function usual(id){
  const cached=usualCache.get(id);if(cached&&clock()-cached.at<60000)return cached.value;
  const row=db.prepare(`SELECT drink_id AS drinkId,COUNT(*) AS orders,COUNT(DISTINCT day) AS days FROM bar_orders WHERE employee_id=? AND price>0 AND gift_id IS NULL AND round_id IS NULL AND COALESCE(payer_id,employee_id)=employee_id GROUP BY drink_id HAVING COUNT(*)>=3 AND COUNT(DISTINCT day)>=2 ORDER BY orders DESC,MAX(id) DESC LIMIT 1`).get(id);
  const drink=row&&barDrinks.find(d=>d.id===row.drinkId),value=drink?{...row,name:drink.name}:null;
  if(usualCache.size>=1000)usualCache.delete(usualCache.keys().next().value);usualCache.set(id,{at:clock(),value});return value;
 }
 return {contacts,personal,leave,receive,queue,requestSong,usual,invalidate:id=>usualCache.delete(id)};
}
