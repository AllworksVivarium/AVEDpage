import {barToleranceOptions} from './server-bar-preferences.mjs';

export const barBusinessDay=time=>new Date(time+4*3600000).toISOString().slice(0,10);
export const servingRecipe=id=>id==='mineral-water'?{volume:500,sips:4,strength:0}:id==='onyx-shot'?{volume:0,sips:0,strength:0}:id.endsWith('-shot')?{volume:30,sips:1,strength:400}:id==='lemon-cocktail'?{volume:200,sips:4,strength:80}:id.endsWith('-highball')?{volume:350,sips:4,strength:70}:id==='amber-brew'?{volume:330,sips:3,strength:50}:id.endsWith('-fizz')?{volume:330,sips:4,strength:30}:{volume:500,sips:4,strength:50};

export function installBarDrinking({db,clock,preferences,name}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_servings(
  order_id INTEGER PRIMARY KEY REFERENCES bar_orders(id) ON DELETE CASCADE,
  volume_ml INTEGER NOT NULL,remaining_ml INTEGER NOT NULL,sip_count INTEGER NOT NULL,sips_taken INTEGER NOT NULL DEFAULT 0,strength INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS bar_sips(
  id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES bar_orders(id) ON DELETE CASCADE,request_key TEXT NOT NULL,
  amount_ml INTEGER NOT NULL,weighted_units INTEGER NOT NULL,day TEXT NOT NULL,alias TEXT NOT NULL,created_at INTEGER NOT NULL,
  UNIQUE(employee_id,request_key));
 CREATE INDEX IF NOT EXISTS bar_sips_day ON bar_sips(day,employee_id);
 CREATE INDEX IF NOT EXISTS bar_sips_employee ON bar_sips(employee_id,id DESC);
 CREATE TABLE IF NOT EXISTS bar_drink_daily(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,day TEXT NOT NULL,total_ml INTEGER NOT NULL,weighted_units INTEGER NOT NULL,sip_count INTEGER NOT NULL,last_alias TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(employee_id,day));`);
 // One-time compatibility for today's events from an earlier local build.
 db.prepare(`INSERT OR IGNORE INTO bar_drink_daily(employee_id,day,total_ml,weighted_units,sip_count,last_alias,updated_at) SELECT employee_id,day,SUM(amount_ml),SUM(weighted_units),COUNT(*),MAX(alias),MAX(created_at) FROM bar_sips WHERE day=? AND weighted_units>0 GROUP BY employee_id,day`).run(barBusinessDay(clock()));
 let boardCache=null;const recentEvents=[],orderCache=new Map(),dailyCache=new Map();
 const rawOrder=id=>db.prepare('SELECT id,drink_id AS drinkId,price,created_at AS createdAt FROM bar_orders WHERE employee_id=? ORDER BY id DESC LIMIT 1').get(id);
 function decorate(order){
  if(!order)return null;const recipe=servingRecipe(order.drinkId);
  if(!db.prepare('SELECT 1 FROM bar_servings WHERE order_id=?').get(order.id))db.prepare('INSERT OR IGNORE INTO bar_servings(order_id,volume_ml,remaining_ml,sip_count,strength) VALUES(?,?,?,?,?)').run(order.id,recipe.volume,recipe.volume,recipe.sips,recipe.strength);
  return {...order,...db.prepare('SELECT volume_ml AS volumeMl,remaining_ml AS remainingMl,sip_count AS sipCount,sips_taken AS sipsTaken FROM bar_servings WHERE order_id=?').get(order.id)};
 }
 const currentOrder=id=>{const cached=orderCache.get(id);if(cached&&clock()-cached.at<5000)return cached.value;const value=decorate(rawOrder(id));orderCache.set(id,{at:clock(),value});if(orderCache.size>1000)orderCache.delete(orderCache.keys().next().value);return value;};
 function status(id){
  const day=barBusinessDay(clock());let cached=dailyCache.get(id);if(!cached||cached.day!==day||clock()-cached.at>5000){cached={day,at:clock(),totals:db.prepare('SELECT total_ml AS totalMl,weighted_units AS units,sip_count AS sipCount FROM bar_drink_daily WHERE employee_id=? AND day=?').get(id,day)||{totalMl:0,units:0,sipCount:0}};dailyCache.set(id,cached);if(dailyCache.size>1000)dailyCache.delete(dailyCache.keys().next().value);}const totals=cached.totals;
  const tolerance=barToleranceOptions.find(option=>option.id===preferences.get(id).toleranceId)||barToleranceOptions[1];
  return {day,totalMl:totals.totalMl,sipCount:totals.sipCount,weightedUnits:totals.units,thresholdUnits:Math.round(20000*tolerance.multiplier)};
 }
 function sip(actor,data){
  if(!Number.isSafeInteger(data.orderId)||typeof data.requestId!=='string'||! /^[A-Za-z0-9_-]{16,100}$/.test(data.requestId))throw Error('请重新选择当前饮品。');
  const identity=data.identityMode||'anonymous';if(!['anonymous','real'].includes(identity))throw Error('请选择实名或匿名。');
  db.exec('BEGIN IMMEDIATE');let receipt,isNew=false;
  try{
   receipt=db.prepare('SELECT id,order_id AS orderId,amount_ml AS amountMl FROM bar_sips WHERE employee_id=? AND request_key=?').get(actor.id,data.requestId);
   if(receipt){if(receipt.orderId!==data.orderId)throw Error('饮用凭据已使用。');}
   else{
    const order=currentOrder(actor.id);if(!order||order.id!==data.orderId)throw Error('饮品已更换，请重新打开。');
    if(order.remainingMl<=0||order.sipCount<=0)throw Error('这一杯已经喝完了。');
    const now=clock();
    const serving=db.prepare('SELECT * FROM bar_servings WHERE order_id=?').get(order.id),amount=Math.min(serving.remaining_ml,Math.floor(serving.volume_ml*(serving.sips_taken+1)/serving.sip_count)-Math.floor(serving.volume_ml*serving.sips_taken/serving.sip_count));
    if(amount<=0)throw Error('这一杯已经喝完了。');
    const alias=identity==='real'?(db.prepare('SELECT display_name FROM employees WHERE id=?').get(actor.id)?.display_name||'员工'):name(actor.id);
    db.prepare('UPDATE bar_servings SET remaining_ml=remaining_ml-?,sips_taken=sips_taken+1 WHERE order_id=?').run(amount,order.id);
    const result=db.prepare('INSERT INTO bar_sips(employee_id,order_id,request_key,amount_ml,weighted_units,day,alias,created_at) VALUES(?,?,?,?,?,?,?,?)').run(actor.id,order.id,data.requestId,amount,amount*serving.strength,barBusinessDay(now),alias,now);
    if(serving.strength>0)db.prepare(`INSERT INTO bar_drink_daily(employee_id,day,total_ml,weighted_units,sip_count,last_alias,updated_at) VALUES(?,?,?,?,1,?,?) ON CONFLICT(employee_id,day) DO UPDATE SET total_ml=total_ml+excluded.total_ml,weighted_units=weighted_units+excluded.weighted_units,sip_count=sip_count+1,last_alias=excluded.last_alias,updated_at=excluded.updated_at`).run(actor.id,barBusinessDay(now),amount,amount*serving.strength,alias,now);
    receipt={id:Number(result.lastInsertRowid),orderId:order.id,amountMl:amount};
    isNew=true;
   }db.exec('COMMIT');if(isNew){boardCache=null;orderCache.delete(actor.id);dailyCache.delete(actor.id);recentEvents.push({id:receipt.id,employeeId:actor.id,at:clock()});}
  }catch(error){db.exec('ROLLBACK');throw error;}
  return {receipt,myDrink:currentOrder(actor.id),drinking:status(actor.id)};
 }
 function leaderboard(){const day=barBusinessDay(clock());if(boardCache?.day===day&&clock()-boardCache.at<15000)return boardCache.value;const value={day,resetAt:new Date(Date.parse(day+'T04:00:00+08:00')+86400000).toISOString(),items:db.prepare('SELECT employee_id AS employeeId,total_ml AS totalMl,last_alias AS alias FROM bar_drink_daily WHERE day=? ORDER BY total_ml DESC,updated_at ASC LIMIT 10').all(day).map((row,index)=>({...row,rank:index+1}))};boardCache={day,at:clock(),value};return value;}
 const recent=()=>{while(recentEvents.length&&(recentEvents[0].at<clock()-5000||recentEvents.length>12))recentEvents.shift();return [...recentEvents];};
 return {currentOrder,status,sip,leaderboard,recent,invalidate(id){orderCache.delete(id);dailyCache.delete(id);}};
}
