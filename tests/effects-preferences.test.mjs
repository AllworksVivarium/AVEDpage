import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('effects switch works without a sidebar control and persists the global state',()=>{
 const flags=new Set(),saved=new Map(),handlers=new Map(),events=[];
 const classList={contains:name=>flags.has(name),toggle(name,force){const next=force??!flags.has(name);if(next)flags.add(name);else flags.delete(name);return next;},add(...names){names.forEach(x=>flags.add(x));}};
 const document={body:{classList},documentElement:{dataset:{},style:{}},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(name,fn)=>handlers.set(name,fn),dispatchEvent:event=>{events.push(event.type);}};
 const window={};vm.runInNewContext(readFileSync(new URL('../public/terminal-preferences.js',import.meta.url),'utf8'),{window,document,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},Event:class{constructor(type){this.type=type;}}});
 assert.equal(window.AVEDEffectsEnabled(),true);
 window.AVEDSetEffects(false);assert.equal(window.AVEDEffectsEnabled(),false);assert.equal(saved.get('aved_effects_v1'),'off');assert.equal(events.at(-1),'aved-effects-change');
 window.AVEDSetEffects(true);assert.equal(window.AVEDEffectsEnabled(),true);assert.equal(saved.get('aved_effects_v1'),'on');
 handlers.get('click')({target:{closest:()=>({})}});assert.equal(window.AVEDEffectsEnabled(),false,'legacy buttons share the same toggle');
 handlers.get('DOMContentLoaded')();assert.equal(window.AVEDEffectsEnabled(),false,'initial preference application restores the saved choice');
});


test('saved effects apply at body creation before DOMContentLoaded',()=>{
 const flags=new Set(),handlers=new Map();
 const classList={contains:name=>flags.has(name),toggle(name,on){if(on)flags.add(name);else flags.delete(name);},add:name=>flags.add(name)};
 const document={body:null,documentElement:{dataset:{},style:{}},addEventListener:(name,fn)=>handlers.set(name,fn),dispatchEvent(){},querySelectorAll:()=>[],querySelector:()=>null};
 const window={};
 vm.runInNewContext(readFileSync(new URL('../public/terminal-preferences.js',import.meta.url),'utf8'),{window,document,localStorage:{getItem:key=>key==='aved_effects_v1'?'off':null,removeItem(){},setItem(){}},Event:class{}});
 assert.equal(document.body,null,'preferences load safely in the head');
 document.body={classList};window.AVEDApplyPreferences();
 assert.ok(flags.has('effects-off'),'disabled effects are restored before later content is parsed');
 handlers.get('DOMContentLoaded')();assert.ok(flags.has('effects-off'));
});
