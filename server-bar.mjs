import {barDrinks} from './server-bar-catalog.mjs';
import {randomInt} from 'node:crypto';
import {createBarCheers} from './server-bar-cheers.mjs';
import {installBarPreferences,barToleranceOptions,barGlassware,barFeatures} from './server-bar-preferences.mjs';
import {installBarDrinking,barBusinessDay} from './server-bar-drinking.mjs';
import {installBarCoasters} from './server-bar-coasters.mjs';

export const barDay=barBusinessDay;
const DAY=86400000;
const waterLines=['这瓶不用记账。你应该会喜欢。','今天想喝水，那就喝水。','这里也欢迎只喝水的客人。','喝什么都行，坐得舒服就好。','这瓶水给你，慢慢坐。','今天先喝水？很有预算意识。'];
const bartenders=[
 {id:'night',name:'夜班调酒师',welcome:'欢迎光临。今晚的位置为你留着。',lines:['今天想喝点什么？','不着急，坐一会儿也好。','工作留在门外，杯子放在这里。','今晚的歌，适合慢慢听。']},
 {id:'rain',name:'雨天值班员',welcome:'进来坐。这里暂时没有待办事项。',lines:['今天过得怎么样？','杯垫下没有工作通知，放心。','再忙也要记得歇一会儿。','想说什么就说，不想说也可以。']},
 {id:'late',name:'晚归调酒师',welcome:'晚上好，欢迎来到下班之后。',lines:['今天的交接单，就写到这里吧。','喝点什么，还是先听首歌？','这一杯不催进度。','吧台今天也没有绩效排名。']}
];

export function installBar({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,getMusic=()=>({enabled:true,previewFallback:true,tracks:[]}),clock=()=>Date.now(),heartbeatMs=15000}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_orders(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,day TEXT NOT NULL,drink_id TEXT NOT NULL,price INTEGER NOT NULL,request_key TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(employee_id,request_key));
 CREATE INDEX IF NOT EXISTS bar_orders_day ON bar_orders(day,employee_id,id DESC);
 CREATE TABLE IF NOT EXISTS bar_messages(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,alias TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS bar_messages_date ON bar_messages(created_at,id);
 CREATE TABLE IF NOT EXISTS bar_shifts(day TEXT PRIMARY KEY,npc_id TEXT NOT NULL);`);
 if(!db.prepare('PRAGMA table_info(bar_messages)').all().some(column=>column.name==='identity_mode'))db.exec("ALTER TABLE bar_messages ADD COLUMN identity_mode TEXT NOT NULL DEFAULT 'anonymous' CHECK(identity_mode IN ('anonymous','real'))");
 const preferences=installBarPreferences({db,clock});
 const streams=new Map(),lastChat=new Map();
 const iso=()=>new Date(clock()).toISOString();
 const name=id=>db.prepare('SELECT anonymous_name FROM profiles WHERE employee_id=?').get(id)?.anonymous_name||'匿名员工';
 const drinking=installBarDrinking({db,clock,preferences,name}),coasters=installBarCoasters({db,clock,dayFor:barDay,name});
 const currentOrder=drinking.currentOrder;
 const cheers=createBarCheers({db,clock,dayFor:barDay,name,currentOrder,isOnline:id=>[...streams.values()].some(client=>client.id===id)});
 function prune(){db.prepare('DELETE FROM bar_messages WHERE created_at<?').run(new Date(clock()-5*DAY).toISOString());}
 function history(before=Number.MAX_SAFE_INTEGER){const rows=db.prepare('SELECT id,employee_id AS employeeId,alias,identity_mode AS identityMode,body,created_at AS createdAt FROM bar_messages WHERE id<? AND created_at>=? ORDER BY id DESC LIMIT 41').all(before,new Date(clock()-5*DAY).toISOString());return {items:rows.slice(0,40).reverse(),nextBefore:rows.length>40?rows[39].id:null};}
 function shared(){
  const ids=[...new Set([...streams.values()].map(x=>x.id))],day=barDay(clock());
  let shift=db.prepare('SELECT npc_id FROM bar_shifts WHERE day=?').get(day);if(!shift){db.prepare('INSERT OR IGNORE INTO bar_shifts(day,npc_id) VALUES(?,?)').run(day,bartenders[randomInt(bartenders.length)].id);shift=db.prepare('SELECT npc_id FROM bar_shifts WHERE day=?').get(day);}
  const guests=ids.slice(0,100).map(id=>({employeeId:id,alias:name(id),drink:currentOrder(id,day)}));
  return {day,serverTime:clock(),onlineCount:ids.length,guests,cheers:cheers.shared(),recentSips:drinking.recent(),leaderboard:drinking.leaderboard(),npc:{...(bartenders.find(x=>x.id===shift.npc_id)||bartenders[0]),image:'/assets/bar/bartender-preview-v7.png',temporary:true},music:getMusic(),...history()};
 }
 const state=(id,common=shared())=>({...common,selfId:id,myDrink:currentOrder(id,common.day),balance:balanceFor(id),cheersInvites:cheers.personal(id),barPreferences:preferences.get(id),drinking:drinking.status(id)});
 const online=id=>[...streams.values()].some(client=>client.id===id);
 function detach(response){const client=streams.get(response);if(!client)return false;streams.delete(response);if(!online(client.id))drinking.seen(client.id,{force:true});return true;}
 function emit(response,data){if(response.destroyed||response.writableLength>262144){detach(response);response.destroy();return;}response.write('event: bar\ndata: '+JSON.stringify(data)+'\n\n');}
 let broadcastTimer=null;
 function broadcast(){if(broadcastTimer||!streams.size)return;broadcastTimer=setTimeout(()=>{broadcastTimer=null;try{if(!streams.size)return;const common=shared();for(const [response,client] of streams)emit(response,state(client.id,common));}catch(error){console.error('Bar update:',error.message);}},200);broadcastTimer.unref();}
 let lastPrune=clock();const timer=setInterval(()=>{try{for(const [response,client] of streams){const actor=sessionEmployee(client.req);if(!actor||actor.id!==client.id){detach(response);response.end();}}if(clock()-lastPrune>3600000){prune();lastPrune=clock();}for(const id of new Set([...streams.values()].map(client=>client.id)))drinking.seen(id);if(streams.size)broadcast();}catch(error){console.error('Bar heartbeat:',error.message);}},heartbeatMs);timer.unref();prune();
 return {currentOrder,history,prune,refresh:broadcast,close(){clearInterval(timer);if(broadcastTimer)clearTimeout(broadcastTimer);for(const id of new Set([...streams.values()].map(client=>client.id)))drinking.seen(id,{force:true});for(const response of [...streams.keys()])response.end();streams.clear();},async handle(req,res,url){
  const path=url.pathname;if(!path.startsWith('/api/player/bar'))return false;
  const cheersReply=path.match(/^\/api\/player\/bar\/cheers\/([a-f0-9-]{36})$/);
  if(!['/api/player/bar','/api/player/bar/events','/api/player/bar/orders','/api/player/bar/messages','/api/player/bar/cheers','/api/player/bar/preferences','/api/player/bar/pour','/api/player/bar/sip','/api/player/bar/coaster','/api/player/bar/ranking'].includes(path)&&!cheersReply){send(res,404,{error:'未找到酒吧接口。'});return true;}
  const actor=requireEmployee(req,res);if(!actor)return true;
  try{
   if(path==='/api/player/bar/sip'&&req.method==='POST'){const result=drinking.sip(actor,await readBody(req));send(res,200,{...state(actor.id),receipt:result.receipt});broadcast();return true;}
   if(path==='/api/player/bar/coaster'&&req.method==='GET'){send(res,200,coasters.read(actor.id,Number(url.searchParams.get('exclude'))||0));return true;}
   if(path==='/api/player/bar/coaster'&&req.method==='POST'){send(res,200,coasters.write(actor,await readBody(req)));return true;}
   if(path==='/api/player/bar/ranking'&&req.method==='GET'){send(res,200,{...drinking.leaderboard(),mine:drinking.status(actor.id)});return true;}
   if(path==='/api/player/bar/pour'&&req.method==='POST'){send(res,409,{error:'倒酒功能暂未开放。',code:'FEATURE_DISABLED'});return true;}
   if(path==='/api/player/bar/preferences'&&req.method==='POST'){const result=preferences.save(actor.id,await readBody(req));send(res,200,{barPreferences:result,myDrink:currentOrder(actor.id)});broadcast();return true;}
   if(req.method==='POST'&&(path==='/api/player/bar/cheers'||cheersReply)){
    const data=await readBody(req),result=cheersReply?cheers.respond(actor,cheersReply[1],data):cheers.request(actor,data);send(res,200,result);broadcast();return true;
   }
   if(path==='/api/player/bar/events'&&req.method==='GET'){
    if([...streams.values()].filter(x=>x.id===actor.id).length>=4){send(res,429,{error:'酒吧窗口已达上限，请关闭重复页面。'});return true;}
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': bar connected\n\n');
    if(!online(actor.id))drinking.visit(actor.id);streams.set(res,{id:actor.id,req});res.on('close',()=>{if(detach(res))broadcast();});broadcast();return true;
   }
   if(path==='/api/player/bar'&&req.method==='GET'){if(!online(actor.id))drinking.visit(actor.id);send(res,200,{...state(actor.id),menu:barDrinks,glassware:barGlassware,features:barFeatures,toleranceOptions:barToleranceOptions.map(({id,label})=>({id,label}))});return true;}
   if(path==='/api/player/bar/messages'&&req.method==='GET'){
    const raw=url.searchParams.get('before'),before=raw===null?Number.MAX_SAFE_INTEGER:Number(raw);if(!Number.isSafeInteger(before)||before<1)throw Error('聊天记录页码无效。');send(res,200,history(before));return true;
   }
   if(path==='/api/player/bar/messages'&&req.method==='POST'){
    const data=await readBody(req);if(typeof data.body!=='string'||!data.body.trim()||Array.from(data.body.trim()).length>300)throw Error('消息请填写 1–300 字。');
    const identityMode=data.identityMode===undefined?'anonymous':data.identityMode;if(!['anonymous','real'].includes(identityMode))throw Error('请选择实名或匿名。');
    if(clock()-(lastChat.get(actor.id)??-Infinity)<1500){send(res,429,{error:'慢一点，上一句话刚刚送达。'});return true;}
    const author=identityMode==='real'?db.prepare('SELECT display_name FROM employees WHERE id=?').get(actor.id)?.display_name:name(actor.id);
    const result=db.prepare('INSERT INTO bar_messages(employee_id,alias,identity_mode,body,created_at) VALUES(?,?,?,?,?)').run(actor.id,author||'员工',identityMode,data.body.trim(),iso());lastChat.set(actor.id,clock());if(lastChat.size>1000)for(const [id,at] of lastChat)if(clock()-at>60000)lastChat.delete(id);
    send(res,201,{ok:true,id:Number(result.lastInsertRowid)});broadcast();return true;
   }
   if(path==='/api/player/bar/orders'&&req.method==='POST'){
    const data=await readBody(req),drink=barDrinks.find(x=>x.id===data.drinkId);
    if(!drink||typeof data.requestId!=='string'||! /^[A-Za-z0-9_-]{16,100}$/.test(data.requestId))throw Error('请选择有效饮品并重新提交点单。');
    db.exec('BEGIN IMMEDIATE');let receipt;
    try{
     const previous=db.prepare('SELECT id,drink_id AS drinkId,price,day,created_at AS createdAt FROM bar_orders WHERE employee_id=? AND request_key=?').get(actor.id,data.requestId);
     if(previous){if(previous.drinkId!==drink.id)throw Error('点单凭据已使用，请重新选择饮品。');receipt=previous;}
     else{
      if(drink.orderable===false)throw Error('这是空杯，不能作为饮品点单。');
      if(drink.price>0&&balanceFor(actor.id)<drink.price)throw Error('余额不足，换一杯试试吧。');
      if(drink.price>0)recordLedger(actor.id,-drink.price,'酒吧点单：'+drink.name);
      const day=barDay(clock()),createdAt=iso(),result=db.prepare('INSERT INTO bar_orders(employee_id,day,drink_id,price,request_key,created_at) VALUES(?,?,?,?,?,?)').run(actor.id,day,drink.id,drink.price,data.requestId,createdAt);receipt={id:Number(result.lastInsertRowid),drinkId:drink.id,price:drink.price,day,createdAt};
     }db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    drinking.invalidate(actor.id);send(res,200,{receipt,myDrink:currentOrder(actor.id),balance:balanceFor(actor.id),...(drink.id==='mineral-water'?{bartenderLine:waterLines[randomInt(waterLines.length)]}:{})});broadcast();return true;
   }
   send(res,405,{error:'酒吧不支持这个操作。'});return true;
  }catch(error){send(res,400,{error:error.message});return true;}
 }};
}
