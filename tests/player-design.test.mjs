import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {installPlayerDesign} from '../server-player-design.mjs';
import {catalog} from '../player-design-core.mjs';
import {saveProjectType} from '../tools/local-type-design.mjs';

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'aved-design-test-')),path=join(root,'public');await mkdir(path);
  await writeFile(join(path,'player-terminal.html'),'<h1>标题</h1><p>说明</p>');
  await writeFile(join(path,'player.js'),"a.textContent='重复';b.textContent='重复';");
  const db=new DatabaseSync(join(root,'test.db'));t.after(async()=>{db.close();assert.ok(root.startsWith(join(tmpdir(),'aved-design-test-')));await rm(root,{recursive:true,force:true});});
  const send=(res,status,data)=>{res.status=status;res.data=data;};
  const install=()=>installPlayerDesign({db,root,files:['public/player-terminal.html','public/player.js'],send,readBody:async req=>req.body,
    sessionEmployee:req=>req.actor,requireAdmin:(req,res)=>{if(req.actor?.role==='admin')return req.actor;send(res,req.actor?403:401,{error:'denied'});return null;}});
  let service=install();
  const request=async(path,body={},actor={id:1,role:'admin'},method='POST')=>{const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(bytes){this.bytes=bytes;}};assert.equal(await service.handle({method,body,actor},res,new URL(path,'http://localhost')),true);return res;};
  const edit=(path,body,actor)=>request('/api/admin/player-design/'+path,body,actor);
  return {root,db,request,edit,restart:()=>service=install(),render:async file=>(await service.render(file,await readFile(join(root,'public',file)))).toString()};
}

test('online authoring requires an admin; public design only exposes read data',async t=>{
  const f=await fixture(t);
  assert.equal((await f.edit('text/resolve',{text:'标题'},null)).status,401);
  assert.equal((await f.edit('text/resolve',{text:'标题'},{id:2,role:'employee'})).status,403);
  const publicView=await f.request('/api/player-design',{},null,'GET');assert.equal(publicView.data.canEdit,false);
  assert.equal((await f.request('/api/player-design',{}, {id:1,role:'admin'},'GET')).data.canEdit,true);
});
test('online text is escaped, survives service restart, and undo survives restart',async t=>{
  const f=await fixture(t),[c]=(await f.edit('text/resolve',{text:'标题'})).data.matches;
  const save=await f.edit('text/save',{...c,text:'<script>新标题</script>'});assert.equal(save.status,200);
  assert.match(await f.render('player-terminal.html'),/&lt;script&gt;新标题&lt;\/script&gt;/);
  assert.equal(await readFile(join(f.root,'public/player-terminal.html'),'utf8'),'<h1>标题</h1><p>说明</p>');
  f.restart();assert.match(await f.render('player-terminal.html'),/新标题/);
  assert.equal((await f.edit('text/save',{...c,text:'过期修改'})).status,400);
  assert.equal((await f.edit('text/undo',{undoId:save.data.undoId},{id:3,role:'admin'})).status,400);
  assert.equal((await f.edit('text/undo',{undoId:save.data.undoId})).status,200);
  assert.equal(await f.render('player-terminal.html'),'<h1>标题</h1><p>说明</p>');
});
test('duplicate JS literals remain individually editable; path escape and stale undo are rejected',async t=>{
  const f=await fixture(t),cs=(await f.edit('text/resolve',{text:'重复'})).data.matches;
  assert.equal((await f.edit('text/save',{...cs[0],file:'../server.mjs',text:'攻击'})).status,400);
  const first=await f.edit('text/save',{...cs[0],text:'第一'});assert.equal(first.status,200);
  const [remaining]=(await f.edit('text/resolve',{text:'重复'})).data.matches;
  assert.equal((await f.edit('text/save',{...remaining,text:'第二'})).status,200);
  assert.match(await f.render('player.js'),/第一/);assert.match(await f.render('player.js'),/第二/);
  assert.equal((await f.edit('text/undo',{undoId:first.data.undoId})).status,400);
});
test('font bytes and settings persist together, stale saves and non-font uploads fail',async t=>{
  const f=await fixture(t),current=(await f.request('/api/player-design',{},null,'GET')).data;
  const bytes=Buffer.alloc(16);bytes.write('wOF2');const font={id:'user_'+'a'.repeat(32),name:'测试.woff2',base64:bytes.toString('base64')};
  const settings=catalog.defaults();settings.meta.zh=font.id;settings.meta.mobile=15;
  const result=await f.edit('type',{settings,fonts:[font],revision:current.revision});assert.equal(result.status,200);assert.equal(result.data.settings.meta.mobile,15);
  f.restart();const shared=(await f.request('/api/player-design',{},null,'GET')).data;assert.equal(shared.settings.meta.zh,font.id);
  const loaded=await f.request(shared.fonts[0].url,{},null,'GET');assert.deepEqual(loaded.bytes,bytes);
  assert.equal((await f.edit('type',{settings,fonts:[{id:font.id}],revision:current.revision})).status,400);
  const invalid={...font,base64:Buffer.from('<script>evil</script>').toString('base64')};assert.equal((await f.edit('type',{settings,fonts:[invalid],revision:shared.revision})).status,400);
});

test('deleted text persists without shifting later edits and can be undone',async t=>{
  const f=await fixture(t),[c]=(await f.edit('text/resolve',{text:'标题'})).data.matches;
  const deletion=await f.edit('text/save',{...c,text:'\u2063'});assert.equal(deletion.status,200);
  f.restart();assert.equal(await f.render('player-terminal.html'),'<h1>\u2063</h1><p>说明</p>');
  const [next]=(await f.edit('text/resolve',{text:'说明'})).data.matches;
  const saved=await f.edit('text/save',{...next,text:'下一段'});assert.equal(saved.status,200);
  assert.equal(await f.render('player-terminal.html'),'<h1>\u2063</h1><p>下一段</p>');
  await f.edit('text/undo',{undoId:saved.data.undoId});
  assert.equal((await f.edit('text/undo',{undoId:deletion.data.undoId})).status,200);
  assert.equal(await f.render('player-terminal.html'),'<h1>标题</h1><p>说明</p>');
});
test('local font design writes deployable settings and content-addressed assets',async t=>{
  const f=await fixture(t),settings=catalog.defaults(),bytes=Buffer.alloc(16);bytes.write('wOF2');
  const font={id:'user_'+'b'.repeat(32),name:'本地.woff2',base64:bytes.toString('base64')};settings.meta.zh=font.id;
  const result=await saveProjectType(f.root,{settings,fonts:[font]});assert.ok(result.ok);
  const json=JSON.parse(await readFile(join(f.root,'public/player-type-design.json'),'utf8'));assert.equal(json.settings.meta.zh,font.id);
  assert.deepEqual(await readFile(join(f.root,'public',json.fonts[0].url.slice(1))),bytes);
  await saveProjectType(f.root,{settings,fonts:[{id:font.id}]});
});
