import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const classes=new Set(),stored=new Map([['aved_contamination_v1','on']]);
const root={localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},document:{body:{classList:{contains:k=>classes.has(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)}},dispatchEvent(){}}};
vm.runInNewContext(readFileSync(new URL('../public/interface-contamination.js',import.meta.url),'utf8'),{window:root,Event,setTimeout,clearTimeout});
const {zalgo,animateBurst,animateGrowth,TIMING,MARKS,createMarkPlan}=root.AVEDContamination;

test('saved preferences require an owned effect before enabling',()=>{
 assert.equal(root.AVEDContamination.enabled(),false);assert.equal(root.AVEDContamination.setEnabled(true),false);
 root.AVEDContamination.setEntitled(true);assert.equal(root.AVEDContamination.enabled(),true);
 root.AVEDContamination.setEntitled(false);assert.equal(root.AVEDContamination.enabled(),false);assert.equal(classes.has('signal-contaminated'),false);
});
test('Zalgo variants grow upper and lower combining marks while preserving base letters',()=>{
 const text='身份档案 / LINK',variants=[0,1,2].map(stage=>zalgo(text,stage,()=>.5));
 for(const result of variants){assert.match(result,/\p{M}/u);assert.equal(result.replace(/\p{M}/gu,''),text);}
 assert.ok(variants[0].length<variants[1].length&&variants[1].length<variants[2].length);
});
test('short geometry frame leads into two or three noise frames and restores at 700ms',()=>{
 for(const changes of [2,3]){
  const jobs=new Map(),painted=[];let next=0,restored=false;
  const cancel=animateBurst(stage=>painted.push(stage),()=>{restored=true;},{changes,schedule:(fn,ms)=>{jobs.set(++next,{fn,ms});return next;},unschedule:id=>jobs.delete(id)});
  assert.deepEqual(painted,[0]);assert.deepEqual([...jobs.values()].map(x=>x.ms),changes===3?[90,290,490,700]:[90,395,700]);
  const frames=[...jobs.values()];for(const frame of frames.slice(0,-1))frame.fn();assert.deepEqual(painted,changes===3?[0,1,2,3]:[0,1,2]);assert.equal(restored,false);frames.at(-1).fn();assert.equal(restored,true);assert.equal(TIMING.glitch,700);cancel();assert.equal(jobs.size,0);
 }
});

test('Zalgo grows for five seconds, holds six seconds, and fades over five seconds',()=>{
 const jobs=new Map(),painted=[];let next=0,restored=false;
 const cancel=animateGrowth((progress,phase)=>painted.push([progress,phase]),()=>{restored=true;},{schedule:(fn,ms)=>{jobs.set(++next,{fn,ms});return next;},unschedule:id=>jobs.delete(id)});
 assert.deepEqual(painted,[[0,'grow']]);
 const frames=[...jobs.values()].sort((a,b)=>a.ms-b.ms);
 frames.find(x=>x.ms===5000).fn();assert.deepEqual(painted.at(-1),[1,'hold']);
 frames.find(x=>x.ms===11000).fn();assert.deepEqual(painted.at(-1),[1,'fade']);assert.equal(restored,false);
 assert.equal(frames.at(-1).ms,16000);frames.at(-1).fn();assert.equal(restored,true);cancel();assert.equal(jobs.size,0);
});

test('Zalgo uses varied upper, middle, and lower marks with dense per-character plans',()=>{
 const pools=Object.values(MARKS).flat();assert.ok(new Set(pools).size>=100);
 const plan=createMarkPlan(()=>.5);
 assert.ok(plan.above.length>=32);assert.ok(plan.below.length>=30);assert.ok(plan.middle.length>=6);
 assert.ok(new Set(plan.above).size>=30);assert.ok(new Set(plan.below).size>=28);
 for(const mark of [...plan.above,...plan.middle,...plan.below])assert.match(mark,/^\p{M}$/u);
});


test('refresh restores the saved on state after ownership loads, and an explicit off survives refresh',()=>{
 const storage=new Map([['aved_contamination_v1','on']]);
 const source=readFileSync(new URL('../public/interface-contamination.js',import.meta.url),'utf8');
 function reload(){const flags=new Set(),page={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{body:{classList:{contains:k=>flags.has(k),toggle:(k,on)=>on?flags.add(k):flags.delete(k)}},dispatchEvent(){}}};vm.runInNewContext(source,{window:page,Event,setTimeout,clearTimeout});page.AVEDContamination.setEntitled(true);return page.AVEDContamination;}
 assert.equal(reload().enabled(),true);assert.equal(reload().enabled(),true);
 reload().setEnabled(false);assert.equal(reload().enabled(),false);
 reload().setEnabled(true);assert.equal(reload().enabled(),true);
});

function dialogHarness(){
 const storage=new Map([['aved_contamination_v1','on']]),flags=new Set();let dialog;
 const doc={body:{classList:{contains:k=>flags.has(k),toggle:(k,on)=>on?flags.add(k):flags.delete(k)},append(){}},dispatchEvent(){},activeElement:{focus(){}},createElement(){
  const listeners={},copy={textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:200})},heading={textContent:''},confirm={textContent:'',focus(){}},echoes=[];
  const base={querySelector:selector=>selector==='p'?copy:selector==='#pollution-dialog-title'?heading:confirm,cloneNode:()=>({className:'',setAttribute(){},style:{setProperty(){}},querySelectorAll:()=>[],remove(){echoes.splice(echoes.indexOf(this),1);}})};
  dialog={dataset:{},style:{setProperty(){}},setAttribute(){},set innerHTML(value){this.markup=value;copy.textContent=value.match(/<p>(.*?)<\/p>/)[1];},querySelector:selector=>selector==='p'?copy:selector==='#pollution-dialog-title'?heading:selector==='.pollution-window'?base:confirm,querySelectorAll:()=>echoes,addEventListener:(event,fn)=>listeners[event]=fn,showModal(){},close:()=>listeners.close?.(),remove(){},prepend:el=>echoes.unshift(el),click(action='confirm'){listeners.click({target:{closest:selector=>selector==='[data-pollution-'+action+']'?{}:null}});},copy,echoes};return dialog;
 }};
 const page={document:doc,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 const randomMath=Object.create(Math);randomMath.random=()=>.99;
 vm.runInNewContext(readFileSync(new URL('../public/interface-contamination.js',import.meta.url),'utf8'),{window:page,Math:randomMath,Event,setTimeout,clearTimeout});page.AVEDContamination.setEntitled(true);
 return {effect:page.AVEDContamination,get dialog(){return dialog;},storage};
}

test('logout confirmation keeps looping and preserves the signed-in pollution state',async()=>{
 const h=dialogHarness();let settled=false;const result=h.effect.beforeLogout().then(value=>{settled=true;return value;});
 for(let n=0;n<30;n++)h.dialog.click();await Promise.resolve();
 assert.equal(settled,false);assert.equal(h.effect.enabled(),true);assert.equal(h.storage.get('aved_contamination_v1'),'on');assert.equal(h.dialog.echoes.length,16);assert.match(h.dialog.markup,/data-pollution-cancel>好<\/button>/);
 h.dialog.click('cancel');assert.equal(await result,false);assert.equal(h.effect.enabled(),true);
 h.effect.setEnabled(false);assert.equal(await h.effect.beforeLogout(),true);
});

test('only the last explicit closing confirmation turns the saved mode off',async()=>{
 const h=dialogHarness(),result=h.effect.requestDisable();
 for(let n=0;n<10;n++)h.dialog.click();
 assert.equal(h.dialog.copy.textContent,'你真的确定要关闭吗？');assert.equal(h.effect.enabled(),true);assert.equal(h.storage.get('aved_contamination_v1'),'on');
 h.dialog.click();assert.equal(await result,true);assert.equal(h.effect.enabled(),false);assert.equal(h.storage.get('aved_contamination_v1'),'off');
});
