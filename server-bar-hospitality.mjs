import {barDrinks} from './server-bar-catalog.mjs';

// All spending is committed with the order. Expiry is evaluated on access,
// using the bar's existing heartbeat; no per-invitation timers or polling.
export function installBarHospitality({db,clock,dayFor,name,isOnline,balanceFor,recordLedger,drinking}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_rounds(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id),alias TEXT NOT NULL,budget INTEGER NOT NULL,spent INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'active',request_key TEXT NOT NULL,UNIQUE(employee_id,request_key));
 CREATE INDEX IF NOT EXISTS bar_rounds_active ON bar_rounds(status,ends_at);
 CREATE TABLE IF NOT EXISTS bar_gifts(id INTEGER PRIMARY KEY,sender_id INTEGER NOT NULL REFERENCES employees(id),recipient_id INTEGER NOT NULL REFERENCES employees(id),sender_name TEXT NOT NULL,recipient_name TEXT NOT NULL,drink_id TEXT NOT NULL,price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,request_key TEXT NOT NULL,order_id INTEGER,UNIQUE(sender_id,request_key));
 CREATE INDEX IF NOT EXISTS bar_gifts_sender ON bar_gifts(sender_id,status,expires_at);
 CREATE INDEX IF NOT EXISTS bar_gifts_recipient ON bar_gifts(recipient_id,status,expires_at);`);
 const columns=new Set(db.prepare('PRAGMA table_info(bar_orders)').all().map(x=>x.name));
 for(const column of ['payer_id','gift_id','round_id'])if(!columns.has(column))db.exec(`ALTER TABLE bar_orders ADD COLUMN ${column} INTEGER`);
 const key=value=>{if(typeof value!=='string'||! /^[A-Za-z0-9_-]{16,100}$/.test(value))throw Error('请重新提交这份请客委托。');return value;};
 const item=id=>{const drink=barDrinks.find(x=>x.id===id&&x.orderable!==false);if(!drink)throw Error('请选择有效饮品。');return drink;};
 const alias=(actor,mode)=>{if(!['real','anonymous'].includes(mode))throw Error('请选择实名或匿名。');return mode==='real'?db.prepare('SELECT display_name FROM employees WHERE id=?').get(actor.id)?.display_name||name(actor.id):name(actor.id);};
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
 const roundView=r=>r?{id:r.id,employeeId:r.employee_id,alias:r.alias,budget:r.budget,spent:r.spent,endsAt:r.ends_at,status:r.status}:null;
 function activeRound(){
  const r=db.prepare("SELECT * FROM bar_rounds WHERE status='active' ORDER BY id DESC LIMIT 1").get();if(!r)return null;
  const status=r.ends_at<=clock()?'expired':r.spent>=r.budget?'budget':balanceFor(r.employee_id)<=0?'balance':null;
  if(status){db.prepare('UPDATE bar_rounds SET status=? WHERE id=?').run(status,r.id);return null;}return roundView(r);
 }
 const giftView=r=>({id:r.id,senderId:r.sender_id,recipientId:r.recipient_id,senderName:r.sender_name,recipientName:r.recipient_name,drinkId:r.drink_id,price:r.price,status:r.status,expiresAt:r.expires_at});
 function personal(id){return {gifts:db.prepare("SELECT * FROM bar_gifts WHERE sender_id=? AND status='pending' AND expires_at>? UNION ALL SELECT * FROM bar_gifts WHERE recipient_id=? AND status='pending' AND expires_at>? ORDER BY id DESC LIMIT 8").all(id,clock(),id,clock()).map(giftView),lastRound:roundView(db.prepare('SELECT * FROM bar_rounds WHERE employee_id=? ORDER BY id DESC LIMIT 1').get(id))};}
 function startRound(actor,data){
  const requestId=key(data.requestId),author=alias(actor,data.identityMode??'anonymous');
  if(!Number.isSafeInteger(data.budget)||data.budget<1||data.budget>1000000000)throw Error('请输入 1 至 10 亿之间的整数预算。');
  return transaction(()=>{
   const previous=db.prepare('SELECT * FROM bar_rounds WHERE employee_id=? AND request_key=?').get(actor.id,requestId);
   if(previous){if(previous.budget!==data.budget)throw Error('请客凭据已使用。');return roundView(previous);}
   if(activeRound())throw Error('已经有人在请全场喝酒了。');
   if(balanceFor(actor.id)<data.budget)throw Error('预算不能超过你的可用余额。');
   const now=clock(),row=db.prepare('INSERT INTO bar_rounds(employee_id,alias,budget,created_at,ends_at,request_key) VALUES(?,?,?,?,?,?)').run(actor.id,author,data.budget,now,now+3600000,requestId);
   return roundView(db.prepare('SELECT * FROM bar_rounds WHERE id=?').get(Number(row.lastInsertRowid)));
  });
 }
 function endRound(actor,id){return transaction(()=>{const r=db.prepare('SELECT * FROM bar_rounds WHERE id=?').get(id);if(!r||r.employee_id!==actor.id)throw Error('只能结束自己发起的请客。');if(r.status==='active')db.prepare("UPDATE bar_rounds SET status='cancelled' WHERE id=?").run(id);return {ok:true};});}
 function invite(actor,data){
  const drink=item(data.drinkId),requestId=key(data.requestId),author=alias(actor,data.identityMode??'anonymous');
  if(!Number.isSafeInteger(data.recipientId)||data.recipientId===actor.id)throw Error('请选择另一位客人。');
  return transaction(()=>{
   const previous=db.prepare('SELECT * FROM bar_gifts WHERE sender_id=? AND request_key=?').get(actor.id,requestId);
   if(previous){if(previous.drink_id!==drink.id||previous.recipient_id!==data.recipientId)throw Error('请客凭据已使用。');return giftView(previous);}
   if(!isOnline(data.recipientId))throw Error('这位客人已经离开酒吧。');
   if(drink.price>0&&balanceFor(actor.id)<drink.price)throw Error('余额不足，换一杯试试吧。');
   const now=clock();
   for(const [column,id] of [['sender_id',actor.id],['recipient_id',data.recipientId]])if(db.prepare(`SELECT COUNT(*) AS n FROM bar_gifts WHERE ${column}=? AND status='pending' AND expires_at>?`).get(id,now).n>=4)throw Error('请先处理已有的请客邀请，最多同时 4 份。');
   if(db.prepare("SELECT 1 FROM bar_gifts WHERE sender_id=? AND recipient_id=? AND status='pending' AND expires_at>?").get(actor.id,data.recipientId,now))throw Error('已经请过这位客人，请等对方回应。');
   const row=db.prepare('INSERT INTO bar_gifts(sender_id,recipient_id,sender_name,recipient_name,drink_id,price,created_at,expires_at,request_key) VALUES(?,?,?,?,?,?,?,?,?)').run(actor.id,data.recipientId,author,name(data.recipientId),drink.id,drink.price,now,now+300000,requestId);
   return giftView(db.prepare('SELECT * FROM bar_gifts WHERE id=?').get(Number(row.lastInsertRowid)));
  });
 }
 function insertOrder({recipientId,payerId,drink,requestId,giftId=null,roundId=null,price=drink.price}){
  if(price>0&&balanceFor(payerId)<price)throw Error('买单人的余额不足。');
  if(price>0)recordLedger(payerId,-price,(giftId?'酒吧请客：':roundId?'酒吧全场买单：':'酒吧点单：')+drink.name);
  const day=dayFor(clock()),createdAt=new Date(clock()).toISOString();
  const row=db.prepare('INSERT INTO bar_orders(employee_id,day,drink_id,price,request_key,created_at,payer_id,gift_id,round_id) VALUES(?,?,?,?,?,?,?,?,?)').run(recipientId,day,drink.id,price,requestId,createdAt,payerId,giftId,roundId);
  return {id:Number(row.lastInsertRowid),drinkId:drink.id,price,day,createdAt,payerId,giftId,roundId};
 }
 function respond(actor,id,data){
  const result=transaction(()=>{
   const gift=db.prepare('SELECT * FROM bar_gifts WHERE id=?').get(id);if(!gift||![gift.sender_id,gift.recipient_id].includes(actor.id))throw Error('未找到这份请客邀请。');
   const decision=data.decision;if(!['accepted','declined','cancelled'].includes(decision))throw Error('请选择接受或婉拒。');
   if((decision==='cancelled'?gift.sender_id:gift.recipient_id)!==actor.id)throw Error('不能代替对方处理邀请。');
   if(gift.status===decision)return {gift:giftView(gift)};
   if(gift.status!=='pending'||gift.expires_at<=clock())throw Error('这份邀请已经结束。');
   if(decision==='accepted'){
    const receipt=insertOrder({recipientId:actor.id,payerId:gift.sender_id,drink:item(gift.drink_id),price:gift.price,requestId:'@gift:'+gift.id,giftId:gift.id});
    db.prepare('UPDATE bar_gifts SET status=?,order_id=? WHERE id=?').run(decision,receipt.id,id);
   }else db.prepare('UPDATE bar_gifts SET status=? WHERE id=?').run(decision,id);
   return {gift:giftView({...gift,status:decision})};
  });drinking.invalidate(actor.id);return result;
 }
 function order(actor,data){
  const drink=item(data.drinkId),requestId=key(data.requestId),roundId=data.roundId??null;
  if(roundId!==null&&(!Number.isSafeInteger(roundId)||roundId<1))throw Error('请重新确认买单人。');
  const previous=db.prepare('SELECT id,drink_id AS drinkId,price,day,created_at AS createdAt,COALESCE(payer_id,employee_id) AS payerId,gift_id AS giftId,round_id AS roundId FROM bar_orders WHERE employee_id=? AND request_key=?').get(actor.id,requestId);
  if(previous){if(previous.drinkId!==drink.id||previous.roundId!==roundId||previous.giftId)throw Error('点单凭据已使用，请重新选择饮品。');return previous;}
  // Evaluate expiry before the payment transaction so a rejected order cannot
  // roll back an exhausted sponsor back into the active state.
  const active=activeRound();
  if(active&&roundId===active.id&&drink.price>0&&(active.budget-active.spent<drink.price||balanceFor(active.employeeId)<drink.price)){
   db.prepare("UPDATE bar_rounds SET status=? WHERE id=?").run(active.budget-active.spent<drink.price?'budget':'balance',active.id);
  }
  const receipt=transaction(()=>{
   let payerId=actor.id;
   if(roundId){
    const r=activeRound();if(!r||r.id!==roundId)throw Error('这轮请客已结束，请重新确认点单。');
    if(drink.price>0){
     if(drinking.currentOrder(actor.id)?.remainingMl>0)throw Error('先喝完桌上这一杯，再请下一杯吧。');
     const last=db.prepare('SELECT created_at FROM bar_orders WHERE employee_id=? AND round_id IS NOT NULL AND price>0 ORDER BY id DESC LIMIT 1').get(actor.id);
     if(last&&clock()-Date.parse(last.created_at)<60000)throw Error('稍等一会儿，每分钟可以请一杯。');
    }
    payerId=r.employeeId;
   }
   const row=insertOrder({recipientId:actor.id,payerId,drink,requestId,roundId});
   if(roundId&&drink.price>0)db.prepare('UPDATE bar_rounds SET spent=spent+? WHERE id=?').run(drink.price,roundId);
   return row;
  });drinking.invalidate(actor.id);return receipt;
 }
 return {activeRound,personal,startRound,endRound,invite,respond,order};
}
