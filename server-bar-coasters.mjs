export function installBarCoasters({db,clock,dayFor,name}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_coasters(
  id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day TEXT NOT NULL,alias TEXT NOT NULL,identity_mode TEXT NOT NULL,body TEXT NOT NULL,updated_at INTEGER NOT NULL,
  UNIQUE(employee_id,day));
 CREATE INDEX IF NOT EXISTS bar_coasters_updated ON bar_coasters(updated_at);`);
 const view=row=>row?{id:row.id,alias:row.alias,body:row.body,updatedAt:row.updated_at}:null;
 function read(id,exclude=0){
  const day=dayFor(clock()),own=db.prepare('SELECT * FROM bar_coasters WHERE employee_id=? AND day=?').get(id,day)||null;
  const selected=db.prepare('SELECT * FROM bar_coasters WHERE updated_at>=? AND employee_id!=? AND id!=? ORDER BY RANDOM() LIMIT 1').get(clock()-30*86400000,id,exclude)||db.prepare('SELECT * FROM bar_coasters WHERE updated_at>=? AND employee_id!=? ORDER BY RANDOM() LIMIT 1').get(clock()-30*86400000,id)||own;
  return {message:view(selected),own:own?{...view(own),identityMode:own.identity_mode}:null};
 }
 function write(actor,data){
  if(typeof data.body!=='string'||!data.body.trim()||Array.from(data.body.trim()).length>120)throw Error('留言请填写 1–120 字。');
  const mode=data.identityMode||'anonymous';if(!['anonymous','real'].includes(mode))throw Error('请选择实名或匿名。');
  const day=dayFor(clock()),body=data.body.trim(),alias=mode==='real'?(db.prepare('SELECT display_name FROM employees WHERE id=?').get(actor.id)?.display_name||'员工'):name(actor.id),old=db.prepare('SELECT * FROM bar_coasters WHERE employee_id=? AND day=?').get(actor.id,day);
  if(old&&old.body===body&&old.alias===alias&&old.identity_mode===mode)return read(actor.id);
  if(old&&clock()-old.updated_at<1500)throw Error('稍等一下再修改留言。');
  db.prepare(`INSERT INTO bar_coasters(employee_id,day,alias,identity_mode,body,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(employee_id,day) DO UPDATE SET alias=excluded.alias,identity_mode=excluded.identity_mode,body=excluded.body,updated_at=excluded.updated_at`).run(actor.id,day,alias,mode,body,clock());
  return read(actor.id);
 }
 return {read,write};
}
