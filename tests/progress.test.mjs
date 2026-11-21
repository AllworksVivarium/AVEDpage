import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function setup(){
 const source=readFileSync(new URL('../public/progress.js',import.meta.url),'utf8'),context={};
 vm.runInNewContext(source,context);
 const node=()=>({attrs:new Map(),textContent:'',style:{setProperty(k,v){this[k]=v;},removeProperty(name){delete this[name];}},setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);}});
 const track=node(),fill=node(),output=node(),status=node(),element={dataset:{},querySelector:selector=>({'[role="progressbar"]':track,'[data-progress-fill]':fill,'[data-progress-output]':output,'[role="status"]':status})[selector]};
 return {controller:context.AVEDProgress.mount(element),mount:context.AVEDProgress.mount,element,track,fill,output,status};
}
test('unknown totals expose no percentage or aria-valuenow, including after a determinate phase',()=>{
 const p=setup();p.controller.update({value:2,total:8,label:'资源检查'});
 assert.equal(p.track.attrs.get('aria-valuenow'),'25');assert.equal(p.fill.style['--progress-ratio'],'0.25');
 assert.equal(p.output.textContent,'25%');
 for(const total of [undefined,0,-1,NaN,Infinity]){
  p.controller.update({value:2,total});
  assert.equal(p.element.dataset.mode,'indeterminate');assert.equal(p.track.attrs.has('aria-valuenow'),false);
  assert.equal(p.fill.style['--progress-ratio'],undefined);assert.equal(p.output.textContent,'CONNECTING');
 }
});
test('measured work is clamped, complete work remains loading until the caller reports the result',()=>{
 const p=setup();p.controller.update({value:-2,total:8});assert.equal(p.output.textContent,'0%');
 p.controller.update({value:9,total:8,label:'资源检查'});
 assert.equal(p.output.textContent,'100%');assert.equal(p.element.dataset.state,'loading');assert.equal(p.track.attrs.get('aria-busy'),'true');
 p.controller.update({state:'success',value:1,total:1,label:'连接完成'});
 assert.equal(p.output.textContent,'✓ 100%');assert.equal(p.status.textContent,'连接完成');assert.equal(p.track.attrs.get('aria-busy'),'false');
 p.controller.update({state:'error',label:'连接失败'});
 assert.equal(p.output.textContent,'× 连接失败');assert.equal(p.status.textContent,'连接失败');assert.equal(p.track.attrs.has('aria-valuenow'),false);
 p.controller.update();assert.equal(p.element.dataset.state,'loading');assert.equal(p.output.textContent,'CONNECTING');
 assert.equal(p.mount(p.element),p.controller,'boot fallback and login share one controller');
});
