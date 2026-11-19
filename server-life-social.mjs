import {randomInt} from 'node:crypto';
import {departmentsData} from './server-content.mjs';

const DAY=86400000;
export function installLifeSocial({db,send,readBody,clock=Date.now,random=randomInt}){
  db.exec(`CREATE TABLE IF NOT EXISTS life_tags(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),department_code TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS life_social_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 1,min_days INTEGER NOT NULL DEFAULT 3,max_days INTEGER NOT NULL DEFAULT 5,low_threshold INTEGER NOT NULL DEFAULT 10);
    INSERT OR IGNORE INTO life_social_settings(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS life_daily_likes(life_id INTEGER NOT NULL REFERENCES life_records(id) ON DELETE CASCADE,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,day TEXT NOT NULL,PRIMARY KEY(life_id,employee_id,day));
    CREATE TABLE IF NOT EXISTS life_engagement(life_id INTEGER PRIMARY KEY REFERENCES life_records(id) ON DELETE CASCADE,total_likes INTEGER NOT NULL DEFAULT 0,seen_likes INTEGER NOT NULL DEFAULT 0,support_likes INTEGER NOT NULL DEFAULT 0,support_quota INTEGER NOT NULL DEFAULT 1,next_support_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS life_support_due ON life_engagement(next_support_at);
    CREATE TABLE IF NOT EXISTS life_social_migrations(name TEXT PRIMARY KEY);`);
  const hasDepartments=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='company_departments'").get();
  const departments=hasDepartments?db.prepare('SELECT code,name FROM company_departments').all():departmentsData;
  for(const d of departments)db.prepare('INSERT OR IGNORE INTO life_tags(name,department_code) VALUES(?,?)').run(d.name,d.code);
  if(!db.prepare("SELECT 1 FROM life_social_migrations WHERE name='default-tags'").get()){
    for(const name of ['日常','活动','主线'])db.prepare('INSERT OR IGNORE INTO life_tags(name) VALUES(?)').run(name);
    db.prepare("INSERT INTO life_social_migrations VALUES('default-tags')").run();
  }
  // Preserve existing tags once; subsequent new tags must be registered by an admin.
  if(!db.prepare("SELECT 1 FROM life_social_migrations WHERE name='legacy-tags'").get()){
    db.exec("INSERT OR IGNORE INTO life_tags(name) SELECT DISTINCT trim(j.value) FROM life_records l,json_each(l.tags) j WHERE typeof(j.value)='text' AND length(trim(j.value)) BETWEEN 1 AND 40;INSERT INTO life_social_migrations VALUES('legacy-tags')");
  }
  if(!db.prepare('PRAGMA table_info(life_engagement)').all().some(c=>c.name==='support_quota'))db.exec('ALTER TABLE life_engagement ADD COLUMN support_quota INTEGER NOT NULL DEFAULT 1');
  if(!db.prepare('PRAGMA table_info(life_engagement)').all().some(c=>c.name==='last_support_at'))db.exec('ALTER TABLE life_engagement ADD COLUMN last_support_at INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS life_support_last ON life_engagement(last_support_at)');
  const settings=()=>{const s=db.prepare('SELECT * FROM life_social_settings WHERE id=1').get();return {enabled:!!s.enabled,minDays:s.min_days,maxDays:s.max_days,lowThreshold:s.low_threshold};};
  const delay=()=>{const s=settings();return random(s.minDays*DAY,s.maxDays*DAY+1);};
  const day=()=>new Date(clock()+8*3600000).toISOString().slice(0,10);
  function ensure(id){db.prepare('INSERT OR IGNORE INTO life_engagement(life_id,next_support_at,support_quota) VALUES(?,?,?)').run(id,clock()+delay(),random(1,4));}
  for(const r of db.prepare('SELECT id FROM life_records WHERE id NOT IN(SELECT life_id FROM life_engagement)').all())ensure(r.id);
  // Spread overdue jobs after restarts instead of replaying missed events in a burst.
  for(const r of db.prepare('SELECT life_id FROM life_engagement WHERE next_support_at<=?').all(clock()))db.prepare('UPDATE life_engagement SET next_support_at=? WHERE life_id=?').run(clock()+delay(),r.life_id);
  const catalog=(all=false)=>db.prepare('SELECT id,name,enabled,department_code AS departmentCode FROM life_tags'+(all?'':' WHERE enabled=1')+' ORDER BY department_code IS NULL,id').all();
  function validateTags(tags,previous=[]){
    const allowed=new Set(catalog().map(t=>t.name));
    if(tags.some(t=>!allowed.has(t)&&!previous.includes(t)))throw Error('请选择已登记的标签。');
  }
  function summary(id,actor,own){
    const s=db.prepare('SELECT total_likes FROM life_engagement WHERE life_id=?').get(id);
    return {likeDay:day(),likedToday:!!db.prepare('SELECT 1 FROM life_daily_likes WHERE life_id=? AND employee_id=? AND day=?').get(id,actor,day()),...(own?{likeCount:s?.total_likes||0}:{})};
  }
  function sweep(){
    const s=settings();if(!s.enabled)return 0;let count=0;
    if(clock()-(db.prepare('SELECT COALESCE(MAX(last_support_at),0) AS last FROM life_engagement').get().last)<60000)return 0;
    const due=db.prepare("SELECT g.life_id FROM life_engagement g JOIN life_records l ON l.id=g.life_id WHERE g.next_support_at<=? AND g.total_likes<? AND g.support_likes<g.support_quota AND l.moderation='approved' AND l.deleted_at='' ORDER BY g.next_support_at,g.life_id LIMIT 1").all(clock(),s.lowThreshold);
    for(const r of due)count+=db.prepare('UPDATE life_engagement SET total_likes=total_likes+1,support_likes=support_likes+1,next_support_at=?,last_support_at=? WHERE life_id=? AND next_support_at<=? AND total_likes<? AND support_likes<support_quota').run(clock()+delay(),clock(),r.life_id,clock(),s.lowThreshold).changes;
    return count;
  }
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}
  async function handle(req,res,url,user){
    const path=url.pathname,method=req.method,like=path.match(/^\/api\/player\/life\/(\d+)\/like$/),tag=path.match(/^\/api\/admin\/life\/tags(?:\/(\d+))?$/),adminSettings=path==='/api/admin/life/settings',notices=path==='/api/player/life/notifications';
    if(path!=='/api/player/life/catalog'&&!like&&!tag&&!adminSettings&&!notices)return false;
    if((tag||adminSettings)&&user.role!=='admin'){send(res,403,{error:'需要管理权限。'});return true;}
    if(path==='/api/player/life/catalog'&&method==='GET'){send(res,200,{items:catalog()});return true;}
    if(notices&&method==='GET'){
      const items=db.prepare("SELECT l.id,l.title,g.total_likes-g.seen_likes AS count,g.total_likes AS through FROM life_engagement g JOIN life_records l ON l.id=g.life_id WHERE l.employee_id=? AND l.deleted_at='' AND g.total_likes>g.seen_likes ORDER BY l.id DESC LIMIT 50").all(user.id);send(res,200,{items});return true;
    }
    if(notices&&method==='POST'){
      const d=await readBody(req,2000);if(!Number.isSafeInteger(d.id)||!Number.isSafeInteger(d.through)||d.through<0)throw Error('消息回执无效。');
      db.prepare('UPDATE life_engagement SET seen_likes=MAX(seen_likes,MIN(total_likes,?)) WHERE life_id=? AND EXISTS(SELECT 1 FROM life_records l WHERE l.id=life_id AND l.employee_id=?)').run(d.through,d.id,user.id);send(res,200,{ok:true});return true;
    }
    if(like&&method==='POST'){
      const id=Number(like[1]);const work=db.prepare("SELECT employee_id FROM life_records WHERE id=? AND moderation='approved' AND deleted_at=''").get(id);
      if(!work){send(res,404,{error:'作品不存在或尚未公开。'});return true;}
      if(work.employee_id===user.id){send(res,400,{error:'不能给自己的作品点赞。'});return true;}
      const today=day();transaction(()=>{ensure(id);const inserted=db.prepare('INSERT OR IGNORE INTO life_daily_likes(life_id,employee_id,day) VALUES(?,?,?)').run(id,user.id,today).changes;if(inserted)db.prepare('UPDATE life_engagement SET total_likes=total_likes+1 WHERE life_id=?').run(id);});
      send(res,200,{likedToday:true,likeDay:today});return true;
    }
    if(tag&&method==='GET'&&!tag[1]){send(res,200,{items:catalog(true)});return true;}
    if(tag&&(method==='POST'&&!tag[1]||method==='PUT'&&tag[1])){
      const d=await readBody(req,2000),name=typeof d.name==='string'?d.name.trim():'';if(!name||name.length>40||/[\r\n,，]/.test(name)||d.enabled!==undefined&&typeof d.enabled!=='boolean')throw Error('标签须为 1～40 字，不能包含逗号或换行。');
      const id=Number(tag[1])||0,old=id?db.prepare('SELECT * FROM life_tags WHERE id=?').get(id):null;if(id&&!old){send(res,404,{error:'标签不存在。'});return true;}
      if(db.prepare('SELECT 1 FROM life_tags WHERE name=? AND id<>?').get(name,id))throw Error('标签名称已存在。');
      transaction(()=>{
        if(old){db.prepare('UPDATE life_tags SET name=?,enabled=? WHERE id=?').run(name,d.enabled===false?0:1,id);
          if(old.name!==name)for(const row of db.prepare('SELECT id,tags FROM life_records WHERE EXISTS(SELECT 1 FROM json_each(tags) WHERE value=?)').all(old.name))db.prepare('UPDATE life_records SET tags=?,revision=revision+1 WHERE id=?').run(JSON.stringify(JSON.parse(row.tags).map(t=>t===old.name?name:t)),row.id);
        }else db.prepare('INSERT INTO life_tags(name,enabled) VALUES(?,?)').run(name,d.enabled===false?0:1);
      });send(res,200,{items:catalog(true)});return true;
    }
    if(adminSettings&&method==='GET'){send(res,200,settings());return true;}
    if(adminSettings&&method==='PUT'){
      const d=await readBody(req,2000);if(typeof d.enabled!=='boolean'||![d.minDays,d.maxDays,d.lowThreshold].every(Number.isInteger)||d.minDays<1||d.maxDays<d.minDays||d.maxDays>30||d.lowThreshold<1||d.lowThreshold>100)throw Error('间隔须为 1～30 天，低赞阈值须为 1～100。');
      transaction(()=>{db.prepare('UPDATE life_social_settings SET enabled=?,min_days=?,max_days=?,low_threshold=? WHERE id=1').run(d.enabled?1:0,d.minDays,d.maxDays,d.lowThreshold);for(const r of db.prepare('SELECT life_id FROM life_engagement').all())db.prepare('UPDATE life_engagement SET next_support_at=? WHERE life_id=?').run(clock()+delay(),r.life_id);});send(res,200,settings());return true;
    }
    send(res,405,{error:'指令无效。'});return true;
  }
  return {handle,summary,catalog,validateTags,ensure,sweep};
}
