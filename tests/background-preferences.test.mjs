import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
function browser(storage=new Map(),blocked=false){
 const classes=new Set(['theme-landing']),listeners=new Map();
 const document={documentElement:{dataset:{}},body:null,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent(){},querySelector:()=>null,querySelectorAll:()=>[]};
 const context=vm.createContext({document,Event:class{constructor(type){this.type=type;}},localStorage:{getItem:key=>{if(blocked)throw Error('blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(blocked)throw Error('blocked');storage.set(key,value);},removeItem:key=>storage.delete(key)},addEventListener:(name,fn)=>listeners.set(name,fn),queueMicrotask:fn=>fn()});context.window=context;
 vm.runInContext(read('gateway-preferences.js'),context);
 const firstScene=document.documentElement.dataset.landingScene;
 document.body={dataset:{},classList:{contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),add:(...cs)=>cs.forEach(c=>classes.add(c)),remove:(...cs)=>cs.forEach(c=>classes.delete(c))},insertAdjacentHTML(){}};
 context.AVEDGateway.apply();
 return {context,document,classes,firstScene,listeners};
}
const ownership={owned:['oxblood'],backgrounds:{owned:['image','sphere']},patterns:{owned:['plain','grain']}};
test('paid gateway selection survives logout, reload and pre-body boot; old free preference is ignored',()=>{
 const storage=new Map([['aved_landing_scene_v1','sphere']]),first=browser(storage);
 assert.equal(first.firstScene,'image');assert.equal(first.context.AVEDGateway.select('sphere'),false);
 first.context.AVEDGateway.setEntitlements(ownership);assert.ok(first.context.AVEDGateway.select('sphere').saved);
 assert.ok(first.classes.has('landing-sphere'));
 // A fresh unauthenticated page has no account snapshot but retains this browser's selection.
 const returned=browser(storage);assert.equal(returned.firstScene,'sphere');assert.ok(returned.classes.has('landing-sphere'));
 returned.context.AVEDGateway.setEntitlements(ownership);assert.equal(returned.context.AVEDGateway.selected,'sphere');
 returned.context.AVEDGateway.select('image');assert.equal(browser(storage).firstScene,'image');
 returned.context.AVEDGateway.select('sphere');returned.context.AVEDGateway.setEntitlements({backgrounds:{owned:['image']}});
 assert.equal(browser(storage).firstScene,'image');
});
test('blocked storage safely defaults to building and reports that a new selection cannot be remembered',()=>{
 const {context,firstScene}=browser(new Map(),true);assert.equal(firstScene,'image');
 context.AVEDGateway.setEntitlements(ownership);assert.equal(context.AVEDGateway.select('sphere').saved,false);
 assert.equal(context.AVEDGateway.selected,'sphere');assert.equal(context.AVEDGateway.select('__proto__'),false);
});
test('personal textures default to plain; paid textures persist and are validated against the signed-in account',()=>{
 const storage=new Map([['aved_terminal_pattern_v1','halftone']]);
 const init=()=>{const b=browser(storage);vm.runInContext(read('visual-style.js'),b.context);b.context.AVEDVisualStyle({byId:id=>id==='left-sidebar'?{querySelector:()=>null}:null});return b;};
 const first=init();assert.equal(first.document.body.dataset.terminalPattern,'plain');
 first.context.AVEDAppearance.setEntitlements(ownership);first.context.AVEDAppearance.setPattern('halftone');assert.equal(first.document.body.dataset.terminalPattern,'plain');
 first.context.AVEDAppearance.setPattern('grain');assert.equal(first.document.body.dataset.terminalPattern,'grain');
 const next=init();next.context.AVEDAppearance.setEntitlements(ownership);assert.equal(next.document.body.dataset.terminalPattern,'grain');
 next.context.AVEDAppearance.setEntitlements({owned:['oxblood'],patterns:{owned:['plain']}});assert.equal(next.document.body.dataset.terminalPattern,'plain');
});
