const palettes={oxblood:{name:'黑金绛红',price:0},mineral:{name:'矿物收藏',price:20000},darkroom:{name:'钴蓝静频',price:20000}};

export function installAppearance({db,send,readBody,requireEmployee,balanceFor,recordLedger}){
 db.exec(`CREATE TABLE IF NOT EXISTS employee_palettes(
 employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 palette TEXT NOT NULL CHECK(palette IN ('mineral','darkroom')),
 ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,palette));`);
 const owned=db.prepare('SELECT palette FROM employee_palettes WHERE employee_id=?');
 const snapshot=id=>({owned:['oxblood',...owned.all(id).map(r=>r.palette)],prices:Object.fromEntries(Object.entries(palettes).map(([key,value])=>[key,value.price]))});
 return {snapshot,async handle(req,res,url){
  if(url.pathname!=='/api/player/appearance')return false;
  const user=requireEmployee(req,res);if(!user)return true;
  if(req.method==='GET'){send(res,200,{appearance:snapshot(user.id),balance:balanceFor(user.id)});return true;}
  if(req.method!=='POST'){send(res,405,{error:'配色指令无效。'});return true;}
  try{
   const {palette}=await readBody(req);
   if(typeof palette!=='string'||!Object.hasOwn(palettes,palette))throw Error('请选择有效配色。');
   const item=palettes[palette];
   db.exec('BEGIN IMMEDIATE');
   try{
    if(item.price&&!snapshot(user.id).owned.includes(palette)){
     if(balanceFor(user.id)<item.price)throw Error('余额不足，解锁此配色需要 20,000 点。');
     const debit=recordLedger(user.id,-item.price,'解锁配色：'+item.name);
     db.prepare('INSERT INTO employee_palettes(employee_id,palette,ledger_id) VALUES(?,?,?)').run(user.id,palette,Number(debit.lastInsertRowid));
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   send(res,200,{appearance:snapshot(user.id),balance:balanceFor(user.id)});
  }catch(e){send(res,400,{error:e.message});}
  return true;
 }};
}
