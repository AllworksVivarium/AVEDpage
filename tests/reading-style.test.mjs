import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8');
const context={AVEDTime:{markup:(value,mode)=>`<time data-mode="${mode}">${value}</time>`}};
vm.runInNewContext(source('public/notices-ui.js'),context);

test('notice excerpt keeps Unicode characters whole and adds ellipsis only when needed',()=>{
  assert.equal(context.AVEDNotices.excerpt('  甲\n乙  '),'甲 乙');
  assert.equal(context.AVEDNotices.excerpt('甲😀乙',2),'甲😀…');
  assert.equal(context.AVEDNotices.excerpt('甲😀乙',3),'甲😀乙');
});
test('notice prose preserves each nonempty line without making saved text executable',()=>{
  const html=context.AVEDNotices.article({title:'标题',category:'通告',code:'A1',createdAt:'今天',fullContent:'甲行\n乙行\n\n&lt;script&gt;'});
  assert.equal((html.match(/<p>/g)||[]).length,3);
  assert.ok(html.includes('<p>甲行</p><p>乙行</p>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
test('real-name comments expose role separately and escape names and prose',()=>{
  const html=context.AVEDNotices.comments([{displayName:'<员工>',department:'医疗部',positionTitle:'值班医师',createdAt:'今天',body:'<img>\n\n第二段'}]);
  assert.ok(html.includes('&lt;员工&gt;'));assert.ok(html.includes('医疗部 值班医师'));assert.ok(html.includes('&lt;img&gt;'));assert.ok(html.includes('relative-clock'));
  assert.equal((html.match(/<p class="whitespace-pre-wrap">/g)||[]).length,2);
});

test('planning member comments display only the custom title, never the management category',()=>{
 for(const department of ['公司直属','公司直属部','公司直属领导']){
  const html=context.AVEDNotices.comments([{displayName:'署名',department,identityKind:'planning_member',positionTitle:'人工智能',createdAt:'今天',body:'正文'}]);
  assert.ok(html.includes('人工智能'));assert.ok(!html.includes('公司直属'));assert.ok(!html.includes('企划组成员'));
 }
});
test('reading size and leading tokens are paired and reduced motion keeps keys static',()=>{
  const css=source('public/terminal-reading.css');
  for(const [kind,leading] of [['display','1.15'],['heading','1.3'],['small-heading','1.3'],['body','1.65'],['prose','1.7'],['meta','1.4']]){
    assert.ok(css.includes(`--type-${kind}-size:`));assert.ok(css.includes(`--type-${kind}-leading:${leading};`));
  }
  assert.match(css,/--type-paragraph-gap:\.8em/);assert.match(css,/scale\(\.96\)/);assert.match(css,/transition-duration:80ms/);assert.match(css,/transform 150ms/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  const html=source('public/player-terminal.html');const form=html.match(/<form id="news-detail-comment-form"[\s\S]*?<\/form>/)[0];
  assert.ok(!form.includes('magnetic-cta'));assert.ok(!form.includes('签署留言'));assert.match(form,/>\s*留言\s*</);
  assert.ok(source('public/print-signal.js').includes("document.addEventListener('touchstart'"));
});
test('signal particles stop for reduced motion and hidden documents without changing text',()=>{
  const classes=new Set(['theme-landing']);let animations=0,cancellations=0;
  const media={matches:true,addEventListener(_event,callback){this.change=callback;}};
  const listeners={};
  const canvasContext={setTransform(){},clearRect(){},createPattern(){return {};},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};
  const element=()=>({classList:{add(){}},setAttribute(){},append(){},getContext:()=>canvasContext});
  const app={querySelectorAll:()=>[]};
  const document={hidden:false,body:{classList:{contains:value=>classes.has(value)},append(){}},getElementById:()=>app,createElementNS:element,createElement:element,addEventListener:(event,callback)=>listeners[event]=callback};
  vm.runInNewContext(source('public/print-signal.js'),{document,matchMedia:()=>media,innerWidth:390,innerHeight:844,devicePixelRatio:1,performance:{now:()=>100},requestAnimationFrame:()=>++animations,cancelAnimationFrame:()=>++cancellations,MutationObserver:class{observe(){}},addEventListener(){},Uint8ClampedArray});
  assert.equal(animations,0,'reduced motion never starts a particle loop');
  media.matches=false;media.change();assert.equal(animations,1);
  document.hidden=true;listeners.visibilitychange();assert.equal(cancellations,1);
  document.hidden=false;listeners.visibilitychange();assert.equal(animations,2);
});
