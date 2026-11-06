import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {candidatesFor,replaceCandidate,createEditor,startEditor} from '../tools/local-text-editor.mjs';

test('HTML editing targets visible text, preserves markup and escapes pasted tags',()=>{
  const source='<h1 title="标题">标题</h1><script>const x="标题";</script><style>.标题{}</style><!-- 标题 -->';
  const found=candidatesFor(source,'public/player-terminal.html');assert.equal(found.length,1);
  const changed=replaceCandidate(source,found[0],'<img src=x> & 新标题');
  assert.match(changed,/<h1 title="标题">&lt;img src=x&gt; &amp; 新标题<\/h1>/);
  assert.ok(changed.includes('<script>const x="标题";</script>'));
});
test('JS template and quoted markup stay valid with quotes, backticks and interpolation syntax',()=>{
  for(const source of ["el.innerHTML='<label>音乐音量<input type=range></label>';",'el.innerHTML=`<label>音乐音量<input value="${level}"></label>`;']){
    const c=candidatesFor(source,'public/player-community.js').find(c=>c.text==='音乐音量');assert.ok(c);
    const text='音量 "单引号\'" ` ${danger} <b> & \\';const changed=replaceCandidate(source,c,text);
    const after=candidatesFor(changed,'public/player-community.js').find(c=>c.text===text);assert.ok(after);
    if(source.includes('${level}'))assert.ok(changed.includes('${level}'));
  }
});
test('plain innerHTML is escaped; logic strings are not editable',()=>{
  const source="el.innerHTML='等待';el.textContent='状态';const selector='#状态';if(mode==='状态')go();";
  const cs=candidatesFor(source,'public/player.js');assert.equal(cs.length,2);
  assert.ok(replaceCandidate(source,cs[0],'<svg>').includes('&lt;svg&gt;'));
  assert.ok(replaceCandidate(source,cs[1],'<svg>').includes('textContent="<svg>"'));
});
async function fixture(t){const base=resolve(tmpdir()),root=await mkdtemp(join(base,'aved-text-test-'));await mkdir(join(root,'public'));const file='public/player-terminal.html';await writeFile(join(root,file),'<p>重复</p><p>重复</p><h1>独立</h1>');t.after(async()=>{assert.ok(root.startsWith(join(base,'aved-text-test-')));await rm(root,{recursive:true,force:true});});return {root,file,editor:createEditor({root,files:[file]})};}
test('duplicate selection, persisted save, revision conflict and safe undo',async t=>{
  const {root,file,editor}=await fixture(t);const cs=await editor.resolveText('重复');assert.equal(cs.length,2);assert.notEqual(cs[0].id,cs[1].id);
  const result=await editor.save({...cs[1],text:'已修改'});assert.equal(await readFile(join(root,file),'utf8'),'<p>重复</p><p>已修改</p><h1>独立</h1>');
  await assert.rejects(editor.save({...cs[0],text:'旧版本'}),/源码已发生变化/);
  await editor.revert(result.undoId);assert.equal((await editor.resolveText('重复')).length,2);
  await assert.rejects(editor.save({...cs[0],file:'../server.mjs',text:'逃逸'}),/可编辑文件范围/);
});
test('undo never overwrites later manual source edits',async t=>{
  const {root,file,editor}=await fixture(t);const [c]=await editor.resolveText('独立');const result=await editor.save({...c,text:'修改'});
  await writeFile(join(root,file),'<p>其他人的改动</p>');await assert.rejects(editor.revert(result.undoId),/又有修改/);assert.equal(await readFile(join(root,file),'utf8'),'<p>其他人的改动</p>');
});

test('paragraph deletion is persisted in source and undo restores it exactly',async t=>{
  const {root,file,editor}=await fixture(t),before=await readFile(join(root,file),'utf8');
  const [c]=await editor.resolveText('独立');const result=await editor.save({...c,text:'\u2063'});
  assert.equal(await readFile(join(root,file),'utf8'),'<p>重复</p><p>重复</p><h1>\u2063</h1>');
  assert.equal((await editor.resolveText('重复')).length,2);
  await editor.revert(result.undoId);assert.equal(await readFile(join(root,file),'utf8'),before);
});
test('HTTP service requires allowed Origin and session token',async t=>{
  const {root,file}=await fixture(t);const port=14177,server=startEditor({root,files:[file],port});await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const url='http://127.0.0.1:'+port,origin='http://127.0.0.1:4176';
  assert.equal((await fetch(url+'/session')).status,403);
  assert.equal((await fetch(url+'/session',{headers:{Origin:'https://evil.example'}})).status,403);
  const {token}=await (await fetch(url+'/session',{headers:{Origin:origin}})).json();assert.ok(token);
  assert.equal((await fetch(url+'/resolve',{method:'POST',headers:{Origin:origin},body:'{}'})).status,403);
  const response=await fetch(url+'/resolve',{method:'POST',headers:{Origin:origin,'X-AVED-Editor':token},body:JSON.stringify({text:'独立'})});assert.equal((await response.json()).matches.length,1);
});
