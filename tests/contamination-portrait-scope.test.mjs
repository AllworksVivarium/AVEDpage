import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';

test('portrait marks run only on the active personal page and are removed when the bar covers it',()=>{
 const listeners=new Map(),jobs=new Map(),layers=[],observers=[];let sequence=0;
 const classes=(...initial)=>{const values=new Set(initial);return {contains:name=>values.has(name),add:name=>values.add(name),remove:name=>values.delete(name)};};
 const element=()=>({dataset:{},classList:classes(),style:{setProperty(){}},isConnected:false,setAttribute(){},remove(){this.isConnected=false;},getBoundingClientRect:()=>({left:10,top:10,width:120,height:100,bottom:110}),checkVisibility:()=>true});
 const avatar=element();avatar.isConnected=true;const pane={classList:classes()},app={inert:false};
 const body={classList:classes('theme-inner'),append(el){el.isConnected=true;layers.push(el);}};
 const doc={body,hidden:false,addEventListener(name,fn){listeners.set(name,fn);},createElement:element,querySelector(selector){return selector==='#view-profile .hud-avatar'?avatar:selector==='#view-profile'?pane:selector==='#inner-app-view'?app:null;}};
 const root={document:doc,location:{hash:'#/profile'},innerHeight:800,innerWidth:1200,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},AVEDContamination:{enabled:()=>true,copy:{apparitions:{}},budget:{acquire:()=>()=>{}}}};
 vm.runInNewContext(readFileSync(new URL('../public/contamination-haunt.js',import.meta.url),'utf8'),{window:root,MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}},setTimeout:(fn,ms)=>{jobs.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>jobs.delete(id)});
 const preview=effect=>listeners.get('aved-contamination-preview')({effect}),count=()=>layers.filter(el=>el.isConnected).length;
 preview('portrait-scribble');assert.equal(count(),1);assert.equal(avatar.classList.contains('haunt-portrait-active'),true);
 body.classList.add('bar-room-open');app.inert=true;observers.forEach(fn=>fn());assert.equal(count(),0);assert.equal(avatar.classList.contains('haunt-portrait-active'),false);
 for(const effect of ['portrait-mask','portrait-scribble'])preview(effect);assert.equal(count(),0,'the underlying avatar must not count as visible in the bar');
 body.classList.remove('bar-room-open');app.inert=false;root.location.hash='#/forum';preview('portrait-scribble');assert.equal(count(),0);
 root.location.hash='#/profile';pane.classList.add('hidden');preview('portrait-scribble');assert.equal(count(),0);
 pane.classList.remove('hidden');preview('portrait-mask');assert.equal(count(),1,'the personal-page effect still works');
 root.location.hash='#/bar';const tracking=[...jobs.values()].findLast(job=>job.ms===150);assert.ok(tracking);tracking.fn();assert.equal(count(),0,'route changes also remove an already-running drawing');
});
