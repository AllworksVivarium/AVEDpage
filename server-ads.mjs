import {createHash} from 'node:crypto';
import sharp from 'sharp';

const DAY=86400000,IDLE=30*60000;
export const adSlots=Object.freeze([{id:'popup',name:'全站弹窗',base:500000,step:10000,image:true},{id:'forum',name:'论坛文字位',base:50000,step:10000,image:false},{id:'casino',name:'游戏厅文字位',base:50000,step:10000,image:false}]);
const bidBounds=(slot,leading)=>({minimum:leading?leading.amount+slot.step:slot.base,maximum:Math.min(1000000000,(leading?.amount??slot.base)+slot.step)});
export const adProtectionPlans=Object.freeze([{days:1,price:20000},{days:3,price:50000},{days:7,price:100000}]);
export const adCreativeLimits=Object.freeze({title:20,popupBody:160,stripBody:60,signature:20,popupBreaks:5,stripBreaks:1});
export const adDay=now=>new Date(now+4*3600000).toISOString().slice(0,10);
const boundary=day=>Date.parse(day+'T04:00:00+08:00');
const text=(value,max)=>{if(typeof value!=='string'||Array.from(value.trim()).length>max)throw Error('广告文字超过长度限制。');return value.trim();};
async function creative(data,slot){
 const title=text(data.title??'',adCreativeLimits.title),body=text(typeof data.body==='string'?data.body.replace(/\r\n?/g,'\n'):data.body??'',slot.image?adCreativeLimits.popupBody:adCreativeLimits.stripBody);
 if(/[\r\n\t]/.test(title))throw Error('标题请使用单行文字。');
 if(data.title!==undefined&&!title)throw Error('请填写广告标题。');
 if((body.match(/\n/g)||[]).length>(slot.image?adCreativeLimits.popupBreaks:adCreativeLimits.stripBreaks))throw Error(slot.image?'正文最多手动换行 5 次。':'文字位正文最多手动换行 1 次。');
 const result={title,body,signature:text(data.signature??'',adCreativeLimits.signature),note:text(data.note??'',80),image:''};
 if(/[\r\n\t]/.test(result.signature))throw Error('署名请使用单行文字。');
 if(data.image){
  if(!slot.image)throw Error('此广告位仅支持文字。');
  if(typeof data.image!=='string'||data.image.length>1200000)throw Error('图片过大，请重新选择。');
  const match=data.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)throw Error('请选择 PNG、JPG 或 WEBP 图片。');
  try{const buffer=await sharp(Buffer.from(match[2],'base64'),{limitInputPixels:16000000,animated:false}).rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();result.image='data:image/webp;base64,'+buffer.toString('base64');}catch{throw Error('无法读取广告图片。');}
 }
 if(!result.body&&!result.image)throw Error('请填写广告文字或选择图片。');
 return result;
}

// One auction per slot and day. Holds, refunds and entitlement purchases use
// the existing wallet in the same SQLite transaction as the winning record.
export function installAds({db,balanceFor,recordLedger,clock=Date.now,send,readBody,requireEmployee,requireAdmin}){
 db.exec(`CREATE TABLE IF NOT EXISTS ad_bids(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id),day TEXT NOT NULL,slot TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),body TEXT NOT NULL,signature TEXT NOT NULL,note TEXT NOT NULL,image_data TEXT NOT NULL DEFAULT '',status TEXT NOT NULL CHECK(status IN ('leading','outbid','won','removed')),request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,created_at INTEGER NOT NULL,removed_reason TEXT NOT NULL DEFAULT '',UNIQUE(employee_id,request_key));
 CREATE UNIQUE INDEX IF NOT EXISTS ad_bid_leader ON ad_bids(day,slot) WHERE status='leading';
 CREATE INDEX IF NOT EXISTS ad_bid_owner ON ad_bids(employee_id,id DESC);
 CREATE INDEX IF NOT EXISTS ad_bid_delivery ON ad_bids(day,status,slot);
 CREATE TABLE IF NOT EXISTS ad_protection(employee_id INTEGER PRIMARY KEY REFERENCES employees(id),until_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS ad_protection_receipts(employee_id INTEGER NOT NULL REFERENCES employees(id),request_key TEXT NOT NULL,days INTEGER NOT NULL,until_at INTEGER NOT NULL,PRIMARY KEY(employee_id,request_key));
 CREATE TABLE IF NOT EXISTS ad_popup_visits(employee_id INTEGER PRIMARY KEY REFERENCES employees(id),shown_at INTEGER NOT NULL);`);
 if(!db.prepare('PRAGMA table_info(ad_bids)').all().some(column=>column.name==='title'))db.exec("ALTER TABLE ad_bids ADD COLUMN title TEXT NOT NULL DEFAULT ''");
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const settle=()=>db.prepare("UPDATE ad_bids SET status='won' WHERE status='leading' AND day<=?").run(adDay(clock()));
 const until=id=>db.prepare('SELECT until_at n FROM ad_protection WHERE employee_id=?').get(id)?.n||0;
 const key=value=>{if(typeof value!=='string'||! /^[A-Za-z0-9_-]{16,100}$/.test(value))throw Error('请重新提交操作。');return value;};
 const fields="id,employee_id,day,slot,amount,title,body,signature,note,status,created_at,removed_reason,(image_data<>'') AS has_image";
 const view=row=>({id:row.id,day:row.day,slot:row.slot,amount:row.amount,title:row.title||'',body:row.body,signature:row.signature,note:row.note,imageUrl:row.image_data||row.has_image?'/api/player/ads/images/'+row.id:'',status:row.status,createdAt:row.created_at,removedReason:row.removed_reason});
 const fingerprint=data=>{const parts=[data.day,data.slot,data.amount,data.body??'',data.signature??'',data.note??'',data.image??''];if(data.title!==undefined)parts.push(data.title);return createHash('sha256').update(JSON.stringify(parts)).digest('hex');};
 const matching=(id,k,f)=>{const prior=db.prepare('SELECT * FROM ad_bids WHERE employee_id=? AND request_key=?').get(id,k);if(prior&&prior.fingerprint!==f)throw Error('出价凭据已使用，请重新提交。');return prior;};
 function market(id){settle();const now=clock(),tomorrow=adDay(now+DAY);return {serverTime:now,tomorrow,endsAt:boundary(tomorrow),balance:balanceFor(id),protectionUntil:until(id),plans:adProtectionPlans,slots:adSlots.map(s=>{const bid=db.prepare("SELECT id,amount,employee_id FROM ad_bids WHERE day=? AND slot=? AND status='leading'").get(tomorrow,s.id);return {...s,amount:bid?.amount||0,mine:bid?.employee_id===Number(id),bidId:bid?.employee_id===Number(id)?bid.id:null,...bidBounds(s,bid)};}),mine:db.prepare('SELECT '+fields+' FROM ad_bids WHERE employee_id=? ORDER BY id DESC LIMIT 20').all(id).map(view)};}
 async function bid(id,data){
  const request=key(data.requestId),f=fingerprint(data),slot=adSlots.find(s=>s.id===data.slot);
  if(!slot)throw Error('请选择广告位。');
  const prior=matching(id,request,f);if(prior)return {bid:view(prior),...market(id)};
  if(data.day!==adDay(clock()+DAY))throw Error('仅可竞拍明天的广告位，请刷新报价。');
  if(data.confirmed!==true)throw Error('请确认出价。');
  const content=await creative(data,slot);
  return tx(()=>{
   settle();const existing=matching(id,request,f);if(existing)return {bid:view(existing),...market(id)};
   if(data.day!==adDay(clock()+DAY))throw Error('本轮竞拍已截止，请刷新报价。');
   const leading=db.prepare("SELECT * FROM ad_bids WHERE day=? AND slot=? AND status='leading'").get(data.day,slot.id),{minimum,maximum}=bidBounds(slot,leading);
   if(minimum>maximum)throw Error('该广告位报价已达上限。');
   if(!Number.isSafeInteger(data.amount)||data.amount<minimum||data.amount>maximum||(data.amount-minimum)%slot.step!==0)throw Error(leading?'当前报价已更新，请刷新报价；本次出价应为 '+minimum.toLocaleString('en-US')+' ¤，每次仅可加价 10,000 ¤。':'首次出价须为起拍价 '+minimum.toLocaleString('en-US')+' ¤，或加价 10,000 ¤。');
   const credit=leading?.employee_id===Number(id)?leading.amount:0;
   if(balanceFor(id)+credit<data.amount)throw Error('可用余额不足。');
   if(leading){db.prepare("UPDATE ad_bids SET status='outbid' WHERE id=?").run(leading.id);recordLedger(leading.employee_id,leading.amount,'广告竞价退回：'+slot.name);}
   recordLedger(id,-data.amount,'明日广告竞价：'+slot.name);
   const result=db.prepare("INSERT INTO ad_bids(employee_id,day,slot,amount,title,body,signature,note,image_data,status,request_key,fingerprint,created_at) VALUES(?,?,?,?,?,?,?,?,?,'leading',?,?,?)").run(id,data.day,slot.id,data.amount,content.title,content.body,content.signature,content.note,content.image,request,f,clock());
   return {bid:view(db.prepare('SELECT * FROM ad_bids WHERE id=?').get(Number(result.lastInsertRowid))),...market(id)};
  });
 }
 async function edit(id,bidId,data){
  const row=db.prepare('SELECT * FROM ad_bids WHERE id=? AND employee_id=?').get(bidId,id);if(!row)throw Error('未找到这份广告。');
  const content=await creative(data,adSlots.find(x=>x.id===row.slot));
  return tx(()=>{settle();const current=db.prepare('SELECT * FROM ad_bids WHERE id=? AND employee_id=?').get(bidId,id);if(current.status!=='leading'||current.day!==adDay(clock()+DAY))throw Error('仅可修改正在领先的明日广告。');db.prepare('UPDATE ad_bids SET title=?,body=?,signature=?,note=?,image_data=? WHERE id=?').run(data.title===undefined?current.title:content.title,content.body,content.signature,data.note===undefined?current.note:content.note,content.image,bidId);return market(id);});
 }
 function protect(id,data){
  const request=key(data.requestId),plan=adProtectionPlans.find(p=>p.days===data.days);if(!plan)throw Error('请选择保护时长。');if(data.confirmed!==true)throw Error('请确认广告保护费用。');
  return tx(()=>{const prior=db.prepare('SELECT * FROM ad_protection_receipts WHERE employee_id=? AND request_key=?').get(id,request);if(prior){if(prior.days!==plan.days)throw Error('购买凭据已使用。');return market(id);}
   if(balanceFor(id)<plan.price)throw Error('可用余额不足。');const end=Math.max(clock(),until(id))+plan.days*DAY;
   recordLedger(id,-plan.price,'广告保护：'+plan.days+' 天');db.prepare('INSERT INTO ad_protection VALUES(?,?) ON CONFLICT(employee_id) DO UPDATE SET until_at=excluded.until_at').run(id,end);db.prepare('INSERT INTO ad_protection_receipts VALUES(?,?,?,?)').run(id,request,plan.days,end);return market(id);
  });
 }
 function visit(id,requestPopup){return tx(()=>{settle();const now=clock(),protectedUntil=until(id);if(protectedUntil>now)return {serverTime:now,day:adDay(now),endsAt:boundary(adDay(now+DAY)),protectionUntil:protectedUntil,items:[],popup:null};
  const items=db.prepare("SELECT "+fields+" FROM ad_bids WHERE day=? AND status='won' ORDER BY id").all(adDay(now)).map(row=>{const item=view(row);delete item.note;return item;}),popup=items.find(x=>x.slot==='popup'),last=db.prepare('SELECT shown_at FROM ad_popup_visits WHERE employee_id=?').get(id)?.shown_at;
  const show=!!requestPopup&&popup&&(last===undefined||now-last>=IDLE);
  if(show)db.prepare('INSERT INTO ad_popup_visits VALUES(?,?) ON CONFLICT(employee_id) DO UPDATE SET shown_at=excluded.shown_at').run(id,now);
  return {serverTime:now,day:adDay(now),endsAt:boundary(adDay(now+DAY)),protectionUntil:protectedUntil,items:items.filter(x=>x.slot!=='popup'),popup:show?popup:null};
 });}
 function remove(bidId,reason){return tx(()=>{settle();const row=db.prepare('SELECT * FROM ad_bids WHERE id=?').get(bidId);if(!row)throw Error('未找到广告。');if(['leading','won'].includes(row.status)){recordLedger(row.employee_id,row.amount,'广告撤下退回');db.prepare("UPDATE ad_bids SET status='removed',removed_reason=? WHERE id=?").run(text(reason||'管理员撤下',120),bidId);}return {ok:true};});}
 return {market,bid,edit,protect,visit,remove,async handle(req,res,url){
  const path=url.pathname,admin=path.startsWith('/api/admin/ads');if(!admin&&!path.startsWith('/api/player/ads'))return false;
  const actor=(admin?requireAdmin:requireEmployee)(req,res);if(!actor)return true;
  try{
   const image=path.match(/^\/api\/(?:player|admin)\/ads\/images\/(\d+)$/);
   if(image&&req.method==='GET'){settle();const row=db.prepare('SELECT * FROM ad_bids WHERE id=?').get(image[1]);if(!row||!row.image_data||(!admin&&row.employee_id!==actor.id&&!(row.status==='won'&&row.day===adDay(clock())))){send(res,404,{error:'图片不可用。'});return true;}const bytes=Buffer.from(row.image_data.split(',')[1],'base64');res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;}
   const data=['POST','PUT'].includes(req.method)?await readBody(req,1250000):{};
   if(admin){if(path==='/api/admin/ads'&&req.method==='GET'){settle();send(res,200,{items:db.prepare('SELECT '+fields+' FROM ad_bids ORDER BY id DESC LIMIT 60').all().map(r=>({...view(r),imageUrl:r.image_data||r.has_image?'/api/admin/ads/images/'+r.id:''}))});return true;}const target=path.match(/^\/api\/admin\/ads\/(\d+)\/remove$/);if(target&&req.method==='POST'){send(res,200,remove(Number(target[1]),data.reason));return true;}}
   else if(path==='/api/player/ads/market'&&req.method==='GET'){send(res,200,market(actor.id));return true;}
   else if(path==='/api/player/ads/bids'&&req.method==='POST'){send(res,200,await bid(actor.id,data));return true;}
   else if(path==='/api/player/ads/protection'&&req.method==='POST'){send(res,200,protect(actor.id,data));return true;}
   else if(path==='/api/player/ads/visit'&&req.method==='POST'){send(res,200,visit(actor.id,data.popup===true));return true;}
   else {const target=path.match(/^\/api\/player\/ads\/bids\/(\d+)$/);if(target&&req.method==='PUT'){send(res,200,await edit(actor.id,Number(target[1]),data));return true;}}
   send(res,404,{error:'广告接口不存在。'});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
