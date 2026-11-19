import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {normalizeDossierContent} from '../server-dossier-content.mjs';
function runtime(){const context={window:{}};for(const file of ['dossier-content.js','dossier-reader.js'])vm.runInNewContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);context.AVEDDossierContent=context.window.AVEDDossierContent;return context.window;}

test('short abstracts do not replace the full text; attachment metadata survives unrelated edits',()=>{
 const data={abstract:'卡片摘要',summary:'完整正文',sections:[{type:'experiment',body:'实验结果',attachment:{imageUrl:'/assets/evidence.webp',caption:'现场图'}}]};
 const normalized=normalizeDossierContent(data);
 assert.equal(normalized.abstract,'卡片摘要');
 const inherited=normalizeDossierContent({}, {abstract:normalized.abstract,sections_json:normalized.sectionsJSON});
 assert.equal(JSON.parse(inherited.sectionsJSON)[0].attachment.caption,'现场图');
 assert.throws(()=>normalizeDossierContent({abstract:'字'.repeat(301)}));
 for(const imageUrl of ['javascript:alert(1)','//evil.test/a','/assets/../private.png'])assert.throws(()=>normalizeDossierContent({sections:[{body:'x',attachment:{imageUrl}}]}));
 const {AVEDDossierContent:content}=runtime(),item=content.map({...data,code:'A',title:'对象',status:'观察中'});
 assert.equal(item.summary,'卡片摘要');assert.equal(item.description,'完整正文');assert.match(content.render(item),/现场图/);
});

test('paper rendering supports tables, lists and interviews without executing markup',()=>{
 const {AVEDDossierContent:c}=runtime();
 const html=c.render(c.map({code:'A',title:'对象',summary:'## 观察记录\n- **重点**\n- <img src=x onerror=alert(1)>\n| 项目 | 结果 |\n| --- | --- |\n| A | 合格 |',sections:[{type:'interview',body:'记录员：请说明经过\n受访者：<script>bad</script>'}]}));
 assert.match(html,/<table>/);assert.match(html,/<ul>/);assert.match(html,/<strong>重点<\/strong>/);assert.match(html,/dossier-dialogue/);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!c.render(c.map({imageUrl:'javascript:alert(1)',summary:'正文'})).includes('<img'));
});

test('long archive pages preserve every character and stable links identify the same record',()=>{
 const {AVEDDossierContent:c,AVEDDossierReader:r}=runtime(),text=('观察🙂记录。\n\n').repeat(1800);
 const item=c.map({id:42,code:'AVED-A',title:'对象',summary:text});
 const pages=r.pages(item);assert.ok(pages.length>2);assert.equal(pages.flatMap(p=>p.map(x=>x.body)).join(''),item.description);
 assert.equal(r.route(r.path(42,2)).id,42);assert.equal(r.route(r.path(42,2)).page,2);
 assert.equal(r.route('#/containment/not-a-record'),null);assert.equal(r.route('#/containment/42?page=999999').page,999);
});
