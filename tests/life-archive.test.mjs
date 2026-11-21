import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {installLife,prepareLifeImage} from '../server-life.mjs';
import content from '../public/life-content.js';
import {installMedia} from '../server-media.mjs';

function fixture(options={}){
  const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT);INSERT INTO employees VALUES(1,'真实甲'),(2,'真实乙'),(3,'真实丙');
    CREATE TABLE profiles(employee_id INTEGER PRIMARY KEY REFERENCES employees(id),anonymous_name TEXT);INSERT INTO profiles VALUES(1,'一'),(2,'二'),(3,'三');
    CREATE TABLE life_records(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),title TEXT,body TEXT,kind TEXT,tags TEXT DEFAULT '[]',image_data TEXT DEFAULT '',moderation TEXT DEFAULT 'approved',created_at TEXT DEFAULT CURRENT_TIMESTAMP,deleted_at TEXT DEFAULT '',deleted_by INTEGER);
    CREATE TABLE speech_revisions(id INTEGER PRIMARY KEY,source_type TEXT,source_id INTEGER,employee_id INTEGER,before_json TEXT,after_json TEXT);
    INSERT INTO life_records(employee_id,title,body,kind,tags) VALUES(1,'旧作品','旧正文','article','["日常"]');`);
  const app=installLife({db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,log(){},...options});
  const call=async(path,method='GET',body,user=1)=>{const res={};await app.handle({method,body},res,new URL('http://local'+path),typeof user==='object'?user:{id:user,role:'employee'});return res;};
  return {db,call,app};
}
test('restricted document format renders literal text and rejects embeds, retains long prose',()=>{
  const delta=content.normalize({ops:[{insert:'<img src=x onerror=alert(1)>',attributes:{bold:true,color:'red',onclick:'x'}},{insert:'\n',attributes:{header:2}}]});
  assert.equal(content.html(delta),'<h2><strong>&lt;img src=x onerror=alert(1)&gt;</strong></h2>');
  assert.equal('color' in delta.ops[0].attributes,false);
  assert.throws(()=>content.normalize({ops:[{insert:{image:'javascript:evil'}}]}),/附图/);
  assert.equal(content.text(content.normalize(undefined,'长'.repeat(80000))).length,80000);
  assert.throws(()=>content.normalize(undefined,'长'.repeat(100001)),/100000/);
});
test('legacy works remain readable; edit ownership, revision conflicts, soft removal and private pending works',async t=>{
  const {db,call}=fixture();t.after(()=>db.close());
  let legacy=await call('/api/player/life/1');assert.equal(legacy.data.content.ops[0].insert,'旧正文\n');
  const payload={title:'新标题',kind:'article',content:{ops:[{insert:'长文'.repeat(20000)+'\n'}]},tags:['收容部'],template:'ruled',revision:1};
  assert.equal((await call('/api/player/life/1','PUT',payload,2)).status,404);
  assert.equal((await call('/api/player/life/1','PUT',payload)).status,200);
  assert.equal((await call('/api/player/life/1','PUT',payload)).status,409);
  legacy=(await call('/api/player/life/1')).data;assert.equal(legacy.revision,2);assert.equal(legacy.body.length,40000);assert.equal(legacy.template,'ruled');
  db.prepare("UPDATE life_records SET moderation='pending' WHERE id=1").run();
  assert.equal((await call('/api/player/life')).data.items.length,0);
  assert.equal((await call('/api/player/life?mine=1')).data.items.length,1);
  assert.equal((await call('/api/player/life/1','GET',undefined,2)).status,404);
  assert.equal((await call('/api/player/life/1','DELETE',undefined,2)).status,404);
  assert.equal((await call('/api/player/life/1','DELETE')).status,200);
  assert.equal((await call('/api/player/life?mine=1')).data.items.length,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM life_records').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM speech_revisions').get().n,1);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
});
test('random board spreads authors, stable seeded paging excludes later submissions; tags, type and date order filter',async t=>{
  const {db,call}=fixture();t.after(()=>db.close());const insert=db.prepare("INSERT INTO life_records(employee_id,title,body,kind,tags) VALUES(?,?,'正文','article',?)");
  for(let i=0;i<44;i++)insert.run(i<40?1:2+i%2,'作品'+i,JSON.stringify([i%2?'收容部':'后勤部']));
  const a=(await call('/api/player/life?order=random&seed=one')).data,b=(await call('/api/player/life?order=random&seed=one')).data;
  assert.deepEqual(a.items.map(x=>x.id),b.items.map(x=>x.id));assert.equal(new Set(a.items.slice(0,3).map(x=>x.displayName)).size,3);
  insert.run(2,'后来作品','["收容部"]');
  const second=(await call('/api/player/life?order=random&seed=one&offset='+a.next+'&snapshot='+a.snapshot)).data;
  assert.ok(second.items.every(x=>!a.items.some(y=>x.id===y.id)&&x.id<=a.snapshot));
  const filtered=(await call('/api/player/life?tag='+encodeURIComponent('收容部')+'&kind=article&order=oldest')).data;
  assert.ok(filtered.items.every(x=>x.tags.includes('收容部')));assert.ok(filtered.items[0].id<filtered.items[1].id);
  assert.equal((await call('/api/player/life?kind=art')).data.items.length,0);
});
test('image works publish immediately on creation and revision, with preserved administrative removal',async t=>{
  const {db,call}=fixture();t.after(()=>db.close());
  const image='data:image/png;base64,'+(await sharp({create:{width:8,height:8,channels:3,background:'#eee'}}).png().toBuffer()).toString('base64');
  const payload={title:'直接公开的画作',kind:'art',imageData:image};
  const saved=await call('/api/player/life','POST',payload);assert.equal(saved.status,201);assert.equal(saved.data.pending,false);
  const work=(await call('/api/player/life/'+saved.data.id,'GET',undefined,2)).data;assert.equal(work.title,payload.title);assert.ok(work.imageData);
  const edited=await call('/api/player/life/'+saved.data.id,'PUT',{...payload,title:'修订后仍公开',revision:work.revision});assert.equal(edited.data.pending,false);
  assert.equal((await call('/api/player/life/'+saved.data.id,'GET',undefined,2)).data.title,'修订后仍公开');
  db.exec("UPDATE life_records SET moderation='pending' WHERE id=1;INSERT INTO life_records(employee_id,title,body,kind,moderation) VALUES(1,'已拒绝','正文','article','rejected');INSERT INTO life_records(employee_id,title,body,kind,moderation,deleted_at) VALUES(1,'已删除','正文','article','pending','removed');");
  installLife({db,send(){},readBody(){},log(){}});
  assert.equal(db.prepare('SELECT moderation FROM life_records WHERE id=1').get().moderation,'approved');
  assert.equal(db.prepare("SELECT moderation FROM life_records WHERE title='已拒绝'").get().moderation,'rejected');
  assert.equal(db.prepare("SELECT moderation FROM life_records WHERE title='已删除'").get().moderation,'pending');
});

test('long images retain readable width and a separate preview, malformed uploads rejected',async()=>{
  const input=await sharp({create:{width:1000,height:8000,channels:3,background:'#e0d5bd'}}).png().toBuffer();
  const result=await prepareLifeImage('data:image/png;base64,'+input.toString('base64'));
  assert.equal(result.width,1000);assert.equal(result.height,8000);
  const thumb=await sharp(Buffer.from(result.thumbnail.split(',')[1],'base64')).metadata();assert.equal(thumb.width,600);assert.equal(thumb.height,4800);
  await assert.rejects(prepareLifeImage('data:image/png;base64,bm90LWFuLWltYWdl'),/无法读取/);
});
test('pending image and thumbnail are private to the author, public media cannot expose deleted works',async t=>{
  const {db}=fixture();t.after(()=>db.close());
  const full='data:image/webp;base64,YWJj',preview='data:image/webp;base64,ZGVm';db.prepare("UPDATE life_records SET image_data=?,thumbnail_data=?,moderation='pending' WHERE id=1").run(full,preview);
  let actor=2;const app=installMedia({db,send:(res,status,data)=>Object.assign(res,{status,data}),requireEmployee:()=>({id:actor,role:'employee'})});
  const read=async query=>{const res={writeHead(status,headers){Object.assign(this,{status,headers});},end(bytes){this.bytes=bytes;}};await app.handle({method:'GET',headers:{}},res,new URL('http://local/api/media/life/1'+query));return res;};
  assert.equal((await read('')).status,404);assert.equal((await read('?preview=1')).status,404);
  actor=1;assert.equal((await read('')).bytes.toString(),'abc');assert.equal((await read('?preview=1')).bytes.toString(),'def');
  db.exec("UPDATE life_records SET deleted_at='removed' WHERE id=1");assert.equal((await read('')).status,404);
});

test('paper tone and presentation persist, text images remain articles and legacy image-only works infer correctly',async t=>{
  const {db,call}=fixture();t.after(()=>db.close());
  const image='data:image/png;base64,'+(await sharp({create:{width:20,height:100,channels:3,background:'#eee'}}).png().toBuffer()).toString('base64');
  const text={title:'网格正文',kind:'article',body:'第一行\n第二行',template:'grid',paperTone:'blue',presentation:'text',imageData:image};
  const saved=await call('/api/player/life','POST',text);assert.equal(saved.status,201);
  let work=(await call('/api/player/life/'+saved.data.id)).data;
  assert.equal(work.presentation,'text');assert.equal(work.paperTone,'blue');assert.equal(work.template,'grid');assert.ok(work.imageData);
  assert.equal((await call('/api/player/life/'+work.id,'PUT',{...text,imageData:undefined,paperTone:'sage',revision:work.revision})).status,200);
  work=(await call('/api/player/life/'+work.id)).data;assert.equal(work.paperTone,'sage');assert.equal(work.presentation,'text');
  const long=await call('/api/player/life','POST',{title:'长图',kind:'article',presentation:'image',body:'可选附言',imageData:image});
  const longWork=(await call('/api/player/life/'+long.data.id)).data;assert.equal(longWork.kind,'article');assert.equal(longWork.presentation,'image');
  const legacy=await call('/api/player/life','POST',{title:'旧格式长图',kind:'article',imageData:image});
  assert.equal((await call('/api/player/life/'+legacy.data.id)).data.presentation,'image');
  await assert.rejects(call('/api/player/life','POST',{...text,paperTone:'url(evil)'}),/纸色/);
  await assert.rejects(call('/api/player/life','POST',{...text,presentation:'other'}),/呈现方式/);
  await assert.rejects(call('/api/player/life','POST',{...text,imageData:'',body:''}),/正文/);
  await assert.rejects(call('/api/player/life','POST',{...text,presentation:'image',imageData:''}),/上传作品图片/);
  assert.equal(content.presentation({kind:'art',presentation:'text'}),'image');
  assert.equal(content.presentation({kind:'article',body:'正文',imageData:image}),'text');
});


test('likes reset on Beijing midnight, remain idempotent, keep counts and identities private, and receipt snapshots preserve later likes',async t=>{
  let now=Date.parse('2026-11-20T15:59:59Z');const {db,call}=fixture({clock:()=>now});t.after(()=>db.close());
  const own=(await call('/api/player/life/1')).data;assert.equal(own.displayName,'真实甲');assert.equal(own.likeCount,0);assert.equal('anonymousName' in own,false);
  assert.equal((await call('/api/player/life/1/like','POST',undefined,1)).status,400);
  assert.equal((await call('/api/player/life/1/like','POST',undefined,2)).status,200);
  await Promise.all(Array.from({length:8},()=>call('/api/player/life/1/like','POST',undefined,2)));
  assert.equal((await call('/api/player/life/1')).data.likeCount,1);
  for(const actor of [2,{id:3,role:'admin'}]){
    const other=(await call('/api/player/life/1','GET',undefined,actor)).data;assert.equal('likeCount' in other,false);assert.equal('support_likes' in other,false);assert.equal('employeeId' in other,false);
    assert.ok((await call('/api/player/life','GET',undefined,actor)).data.items.every(x=>!('likeCount' in x)));
  }
  const first=(await call('/api/player/life/notifications')).data.items[0];assert.deepEqual(Object.keys(first).sort(),['count','id','through','title']);assert.equal(first.count,1);
  await call('/api/player/life/notifications','POST',{id:1,through:999},2);assert.equal((await call('/api/player/life/notifications')).data.items.length,1);
  await call('/api/player/life/1/like','POST',undefined,3);
  await call('/api/player/life/notifications','POST',{id:1,through:first.through});assert.equal((await call('/api/player/life/notifications')).data.items[0].count,1);
  assert.equal((await call('/api/player/life/1','GET',undefined,2)).data.likedToday,true);
  now+=1000;assert.equal((await call('/api/player/life/1','GET',undefined,2)).data.likedToday,false);
  await call('/api/player/life/1/like','POST',undefined,2);assert.equal((await call('/api/player/life/1')).data.likeCount,3);
  db.exec("UPDATE life_records SET moderation='pending' WHERE id=1");assert.equal((await call('/api/player/life/1/like','POST',undefined,2)).status,404);
  db.exec("UPDATE life_records SET moderation='approved',deleted_at='removed' WHERE id=1");assert.equal((await call('/api/player/life/1/like','POST',undefined,3)).status,404);assert.deepEqual((await call('/api/player/life/notifications')).data.items,[]);
});

test('admin tag catalog controls creation, renaming follows existing works, disabled legacy choices remain editable',async t=>{
  const {db,call}=fixture();t.after(()=>db.close());const admin={id:3,role:'admin'};
  const tags=(await call('/api/player/life/catalog')).data.items;for(const name of ['日常','活动','主线','收容部','后勤部'])assert.ok(tags.some(t=>t.name===name));
  assert.equal((await call('/api/admin/life/tags','POST',{name:'测试'})).status,403);
  await assert.rejects(call('/api/player/life','POST',{title:'作品',kind:'article',body:'正文',tags:['不存在']}),/已登记/);
  await call('/api/admin/life/tags','POST',{name:'写作练习'},admin);
  const created=await call('/api/player/life','POST',{title:'练习',kind:'article',body:'正文',tags:['写作练习']});
  const tag=(await call('/api/admin/life/tags','GET',undefined,admin)).data.items.find(x=>x.name==='写作练习');
  await call('/api/admin/life/tags/'+tag.id,'PUT',{name:'创作练习',enabled:false},admin);
  let work=(await call('/api/player/life/'+created.data.id)).data;assert.deepEqual(work.tags,['创作练习']);assert.equal(work.revision,2);
  assert.ok(!(await call('/api/player/life/catalog')).data.items.some(t=>t.name==='创作练习'));
  assert.equal((await call('/api/player/life/'+work.id,'PUT',{title:'修改练习',kind:'article',body:'正文二',tags:work.tags,revision:work.revision})).status,200);
  await assert.rejects(call('/api/player/life','POST',{title:'另一篇',kind:'article',body:'正文',tags:work.tags}),/已登记/);
  await assert.rejects(call('/api/admin/life/tags','POST',{name:'日常'},admin),/已存在/);
  await assert.rejects(call('/api/admin/life/tags/'+tag.id,'PUT',{name:'bad,tag'},admin),/逗号/);
  assert.equal((await call('/api/admin/life/settings','GET')).status,403);
});

test('support likes use a one-to-three lifetime quota, spaced days apart, stop at ten, and never expose source identities',async t=>{
  let now=Date.parse('2026-11-20T00:00:00Z');const DAY=86400000;
  const {db,call,app}=fixture({clock:()=>now,random:(min,max)=>max<=4?3:min});t.after(()=>db.close());
  let record=db.prepare('SELECT * FROM life_engagement WHERE life_id=1').get();assert.equal(record.support_quota,3);assert.equal(record.next_support_at,now+3*DAY);assert.equal(app.sweep(),0);
  for(let n=1;n<=3;n++){now+=3*DAY;assert.equal(app.sweep(),1);assert.equal(app.sweep(),0);record=db.prepare('SELECT * FROM life_engagement WHERE life_id=1').get();assert.equal(record.support_likes,n);assert.equal(record.total_likes,n);}
  now+=5*DAY;assert.equal(app.sweep(),0);assert.equal((await call('/api/player/life/notifications')).data.items[0].count,3);
  const made=await call('/api/player/life','POST',{title:'边界作品',kind:'article',body:'正文'});db.prepare('UPDATE life_engagement SET total_likes=9,next_support_at=? WHERE life_id=?').run(now,made.data.id);
  assert.equal(app.sweep(),1);now+=5*DAY;assert.equal(app.sweep(),0);assert.equal((await call('/api/player/life/'+made.data.id)).data.likeCount,10);
  const hidden=await call('/api/player/life','POST',{title:'未公开',kind:'article',body:'正文'});db.prepare('UPDATE life_engagement SET next_support_at=? WHERE life_id=?').run(now,hidden.data.id);db.prepare("UPDATE life_records SET moderation='pending' WHERE id=?").run(hidden.data.id);assert.equal(app.sweep(),0);
  const admin={id:3,role:'admin'};assert.deepEqual((await call('/api/admin/life/settings','GET',undefined,admin)).data,{enabled:true,minDays:3,maxDays:5,lowThreshold:10});
  await call('/api/admin/life/settings','PUT',{enabled:false,minDays:3,maxDays:5,lowThreshold:10},admin);db.prepare('UPDATE life_engagement SET next_support_at=0').run();assert.equal(app.sweep(),0);
  await assert.rejects(call('/api/admin/life/settings','PUT',{enabled:true,minDays:0,maxDays:5,lowThreshold:10},admin),/间隔/);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
});


test('support scheduler staggers different works, keeps quota and renamed defaults across restart without catching up in a burst',async t=>{
  let now=Date.parse('2026-11-20T00:00:00Z');const DAY=86400000,options={clock:()=>now,random:min=>min};
  const {db,call,app}=fixture(options);t.after(()=>db.close());const admin={id:3,role:'admin'};
  const daily=(await call('/api/admin/life/tags','GET',undefined,admin)).data.items.find(t=>t.name==='日常');await call('/api/admin/life/tags/'+daily.id,'PUT',{name:'随笔',enabled:true},admin);
  const second=await call('/api/player/life','POST',{title:'第二件',body:'正文',kind:'article'});
  assert.equal(db.prepare('SELECT support_quota FROM life_engagement WHERE life_id=?').get(second.data.id).support_quota,1);
  now+=3*DAY;assert.equal(app.sweep(),1);assert.equal(app.sweep(),0);now+=60000;assert.equal(app.sweep(),1);
  const times=db.prepare('SELECT last_support_at FROM life_engagement ORDER BY last_support_at').all();assert.equal(times[1].last_support_at-times[0].last_support_at,60000);
  now+=6*DAY;const third=await call('/api/player/life','POST',{title:'重启前',body:'正文',kind:'article'});now+=6*DAY;
  const restarted=installLife({db,send(){},readBody:async req=>req.body,log(){},...options});assert.equal(restarted.sweep(),0);
  const pending=db.prepare('SELECT * FROM life_engagement WHERE life_id=?').get(third.data.id);assert.equal(pending.next_support_at,now+3*DAY);assert.equal(pending.support_quota,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM life_tags WHERE name='日常'").get().n,0);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM life_tags WHERE name='随笔'").get().n,1);
  now+=3*DAY;assert.equal(restarted.sweep(),1);now+=10*DAY;assert.equal(restarted.sweep(),0);
});


test('preview defaults center legacy and new works while explicitly chosen edges survive edits and restarts',async t=>{
 const {db,call}=fixture();t.after(()=>db.close());
 assert.equal((await call('/api/player/life/1')).data.previewPosition,50);
 const payload={title:'裁切测试',kind:'article',body:'正文',tags:['日常']};
 const created=await call('/api/player/life','POST',payload);assert.equal(created.status,201);
 const id=created.data.id;assert.equal((await call('/api/player/life/'+id)).data.previewPosition,50);
 await call('/api/player/life/'+id,'PUT',{...payload,previewPosition:0,revision:1});
 assert.equal((await call('/api/player/life/'+id)).data.previewPosition,0);
 await call('/api/player/life/'+id,'PUT',{...payload,revision:2});
 assert.equal((await call('/api/player/life/'+id)).data.previewPosition,0);
 installLife({db,send(){},readBody:async req=>req.body,log(){}});
 assert.equal((await call('/api/player/life/'+id)).data.previewPosition,0);
 assert.equal((await call('/api/player/life/1')).data.previewPosition,50);
});


test('tag removal updates work revisions atomically, preserves works and stays deleted after restart, including department tags',async t=>{
 const {db,call}=fixture();t.after(()=>db.close());const admin={id:3,role:'admin'};
 const tags=(await call('/api/admin/life/tags','GET',undefined,admin)).data.items,daily=tags.find(x=>x.name==='日常'),dept=tags.find(x=>x.name==='收容部');
 assert.equal(daily.usageCount,1);assert.equal('usageCount' in (await call('/api/player/life/catalog')).data.items[0],false);
 assert.equal((await call('/api/admin/life/tags/'+daily.id,'DELETE')).status,403);
 const before=(await call('/api/player/life/1')).data;
 assert.equal((await call('/api/admin/life/tags/'+daily.id,'DELETE',undefined,admin)).status,200);
 const after=(await call('/api/player/life/1')).data;assert.equal(after.title,before.title);assert.equal(after.body,before.body);assert.deepEqual(after.tags,[]);assert.equal(after.revision,before.revision+1);
 assert.equal((await call('/api/player/life/1','PUT',{title:'旧编辑',kind:'article',body:'正文',tags:['日常'],revision:before.revision})).status,409);
 assert.equal((await call('/api/admin/life/tags/'+daily.id,'DELETE',undefined,admin)).status,404);
 assert.equal((await call('/api/admin/life/tags/'+daily.id,'PUT',{name:'旧标签'},admin)).status,404);
 assert.equal((await call('/api/admin/life/tags/'+dept.id,'DELETE',undefined,admin)).status,200);
 installLife({db,send(){},readBody:async req=>req.body,log(){}});
 for(const name of ['日常','收容部'])assert.ok(!(await call('/api/admin/life/tags','GET',undefined,admin)).data.items.some(x=>x.name===name));
 await assert.rejects(call('/api/player/life','POST',{title:'新作品',kind:'article',body:'正文',tags:['日常']}),/已登记/);
 assert.equal((await call('/api/admin/life/tags','POST',{name:'日常'},admin)).status,200);
 const restored=(await call('/api/admin/life/tags','GET',undefined,admin)).data.items.find(x=>x.name==='日常');assert.equal(restored.id,daily.id);assert.equal(restored.usageCount,0);
 assert.deepEqual((await call('/api/player/life/1')).data.tags,[]);
 assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('tag deletion rolls back when a work cannot be updated',async t=>{
 const {db,call}=fixture();t.after(()=>db.close());const admin={id:3,role:'admin'},daily=(await call('/api/admin/life/tags','GET',undefined,admin)).data.items.find(x=>x.name==='日常');
 db.exec("CREATE TRIGGER reject_tag_update BEFORE UPDATE OF tags ON life_records BEGIN SELECT RAISE(ABORT,'blocked'); END");
 await assert.rejects(call('/api/admin/life/tags/'+daily.id,'DELETE',undefined,admin),/blocked/);
 assert.ok((await call('/api/player/life/catalog')).data.items.some(x=>x.name==='日常'));assert.deepEqual((await call('/api/player/life/1')).data.tags,['日常']);
});
