import {barGlassware} from './server-bar-preferences.mjs';

export function installBarPouring({db,clock,preferences,drinking}) {
 db.exec(`CREATE TABLE IF NOT EXISTS bar_pours(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES bar_orders(id) ON DELETE CASCADE,request_key TEXT NOT NULL,action TEXT NOT NULL,source TEXT,amount_ml INTEGER NOT NULL,created_at INTEGER NOT NULL,UNIQUE(employee_id,request_key));`);
 function change(actor,data) {
  if(!data||!Number.isSafeInteger(data.orderId)||typeof data.requestId!=='string'||! /^[A-Za-z0-9_-]{16,100}$/.test(data.requestId))throw Error('请重新选择当前饮品。');
  const action=data.action||'pour',source=action==='source'?data.source:null;
  if(!['pour','source'].includes(action)||action==='source'&&!['glass','bottle'].includes(source))throw Error('请选择倒入杯中或直接饮用。');
  db.exec('BEGIN IMMEDIATE');
  try {
   const order=drinking.currentOrder(actor.id),glass=barGlassware.find(g=>g.id===preferences.get(actor.id).glassId);
   if(!order||order.id!==data.orderId)throw Error('饮品已更换，请重新打开。');
   if(order.canPour===false)throw Error('这份饮品使用原杯。备用杯可以先留着，其他饮品再倒进去。');
   const old=db.prepare('SELECT order_id,action,source,amount_ml FROM bar_pours WHERE employee_id=? AND request_key=?').get(actor.id,data.requestId);
   if(old){if(old.order_id!==data.orderId||old.action!==action||old.source!==source)throw Error('倒入凭据已使用。');db.exec('COMMIT');return {amountMl:old.amount_ml};}
   let amount=0;
   if(action==='pour') {
    if(!glass)throw Error('先选一只杯子，再倒入饮品。');
    amount=Math.min(glass.capacityMl-order.glassMl,order.bottleMl);
    if(amount<=0)throw Error(order.bottleMl<=0?'原容器里已经没有剩余饮品了。':'杯子已经满了，先喝一口吧。');
    db.prepare("UPDATE bar_servings SET glass_ml=glass_ml+?,drink_from='glass' WHERE order_id=?").run(amount,order.id);
   }else {
    if(source==='glass'&&(!glass||order.glassMl<=0))throw Error('杯中还是空的，先倒一点进去。');
    if(source==='bottle'&&order.bottleMl<=0)throw Error('原容器里已经没有剩余饮品了。');
    db.prepare('UPDATE bar_servings SET drink_from=? WHERE order_id=?').run(source,order.id);
   }
   db.prepare('INSERT INTO bar_pours(employee_id,order_id,request_key,action,source,amount_ml,created_at) VALUES(?,?,?,?,?,?,?)').run(actor.id,order.id,data.requestId,action,source,amount,clock());
   db.exec('COMMIT');drinking.invalidate(actor.id);return {amountMl:amount};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 return {change};
}
