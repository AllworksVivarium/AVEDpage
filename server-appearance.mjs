const palettes={oxblood:{name:'黑金绛红',price:0},mineral:{name:'矿物收藏',price:20000},darkroom:{name:'钴蓝静频',price:20000}};
const backgrounds={image:{name:'建筑背景',price:0},sphere:{name:'信号球体',price:50000}};
const patterns={plain:{name:'无纹理',price:0},halftone:{name:'波纹网点',price:10000},fade:{name:'渐隐网点',price:10000},grain:{name:'磨砂纸纹',price:10000}};

export function installAppearance({db,send,readBody,requireEmployee,balanceFor,recordLedger}){
 db.exec(`CREATE TABLE IF NOT EXISTS employee_palettes(
 employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 palette TEXT NOT NULL CHECK(palette IN ('mineral','darkroom')),
 ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,palette));`);
 db.exec(`CREATE TABLE IF NOT EXISTS employee_backgrounds(
 employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('background','pattern')),item TEXT NOT NULL,
 ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,kind,item),
 CHECK((kind='background' AND item='sphere') OR (kind='pattern' AND item IN ('halftone','fade','grain'))));`);
 const owned=db.prepare('SELECT palette FROM employee_palettes WHERE employee_id=?');
 const ownedBackgrounds=db.prepare('SELECT item FROM employee_backgrounds WHERE employee_id=? AND kind=?');
 const prices=catalog=>Object.fromEntries(Object.entries(catalog).map(([key,value])=>[key,value.price]));
 const snapshot=id=>({owned:['oxblood',...owned.all(id).map(r=>r.palette)],prices:prices(palettes),
  backgrounds:{owned:['image',...ownedBackgrounds.all(id,'background').map(r=>r.item)],prices:prices(backgrounds)},
  patterns:{owned:['plain',...ownedBackgrounds.all(id,'pattern').map(r=>r.item)],prices:prices(patterns)}});
 return {snapshot,async handle(req,res,url){
  if(url.pathname!=='/api/player/appearance')return false;
  const user=requireEmployee(req,res);if(!user)return true;
  if(req.method==='GET'){send(res,200,{appearance:snapshot(user.id),balance:balanceFor(user.id)});return true;}
  if(req.method!=='POST'){send(res,405,{error:'配色指令无效。'});return true;}
  try{
   const body=await readBody(req),kinds=['palette','background','pattern'].filter(key=>Object.hasOwn(body||{},key));
   if(kinds.length!==1)throw Error('请一次选择一项外观。');
   const kind=kinds[0],key=body[kind],catalog={palette:palettes,background:backgrounds,pattern:patterns}[kind];
   if(typeof key!=='string'||!Object.hasOwn(catalog,key))throw Error('请选择有效外观。');
   const item=catalog[key];
   db.exec('BEGIN IMMEDIATE');
   try{
    const state=snapshot(user.id),unlocked=kind==='palette'?state.owned:state[kind==='background'?'backgrounds':'patterns'].owned;
    if(item.price&&!unlocked.includes(key)){
     if(balanceFor(user.id)<item.price)throw Error('余额不足，解锁需要 '+item.price.toLocaleString('en-US')+' A 币。');
     const debit=recordLedger(user.id,-item.price,(kind==='palette'?'解锁配色：':'解锁背景：')+item.name);
     if(kind==='palette')db.prepare('INSERT INTO employee_palettes(employee_id,palette,ledger_id) VALUES(?,?,?)').run(user.id,key,Number(debit.lastInsertRowid));
     else db.prepare('INSERT INTO employee_backgrounds(employee_id,kind,item,ledger_id) VALUES(?,?,?,?)').run(user.id,kind,key,Number(debit.lastInsertRowid));
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   send(res,200,{appearance:snapshot(user.id),balance:balanceFor(user.id)});
  }catch(e){send(res,400,{error:e.message});}
  return true;
 }};
}
