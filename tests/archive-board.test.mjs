import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function api(){const module={exports:{}};vm.runInNewContext(readFileSync(new URL('../public/archive-board.js',import.meta.url),'utf8'),{module});return module.exports;}
test('random board samples four distinct entries without mutating the full search pool',()=>{
  const board=api(),items=Array.from({length:12},(_,i)=>i),before=[...items];
  const result=board.sample(items,4,()=>.37);assert.equal(result.length,4);assert.equal(new Set(result).size,4);assert.deepEqual(items,before);
  assert.equal(board.sample(items.slice(0,3)).length,3);assert.equal(board.sample([]).length,0);
});
test('names and summaries change twice and restore together at 50 ms',()=>{
  const board=api(),timers=[],nodes=['WY-001 咖啡机','一台需要混脸熟的异常咖啡机'].map((text,i)=>({textContent:text,getAttribute:k=>k==='data-scp-name'&&i===0?'咖啡机':null,setAttribute(){}}));
  const originals=nodes.map(n=>n.textContent);
  board.glitch({document:{querySelectorAll:()=>nodes},random:()=>0,setTimer:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimer(){}});
  assert.deepEqual(timers.map(t=>t.ms),[16,32,50]);assert.match(nodes[0].textContent,/^WY-001 /);
  assert.ok(nodes.every((n,i)=>n.textContent!==originals[i]));const first=nodes.map(n=>n.textContent);
  timers[0].fn();assert.ok(nodes.every((n,i)=>n.textContent!==first[i]));timers[1].fn();
  assert.ok(nodes.every((n,i)=>n.textContent!==originals[i]));timers[2].fn();assert.deepEqual(nodes.map(n=>n.textContent),originals);
});
test('turning effects off restores active text immediately and cancels its timers',()=>{
  const board=api(),cleared=[],node={textContent:'观察异常收容物',getAttribute:()=>null,setAttribute(){}};let timer=0;
  const options={document:{querySelectorAll:()=>[node]},random:()=>0,setTimer:()=>++timer,clearTimer:id=>cleared.push(id)};
  board.glitch(options);assert.notEqual(node.textContent,'观察异常收容物');board.glitch({...options,enabled:false});
  assert.equal(node.textContent,'观察异常收容物');assert.deepEqual(cleared,[1,2,3]);assert.equal(timer,3);
});
