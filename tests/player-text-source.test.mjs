import test from 'node:test';
import assert from 'node:assert/strict';
import {candidatesFor,replaceCandidate} from '../tools/player-text-source.mjs';

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
