import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('static selection, disabled effects, reduced motion and hidden tabs do not keep animation loops running',()=>{
 const frames=new Map(),events=new Map(),observerCallbacks=[];let id=0,painted=0,effects=true;
 const classes=new Set(['theme-inner']);const body={dataset:{terminalPattern:'phase'},classList:{contains:k=>classes.has(k)}};
 const canvas={dataset:{},style:{setProperty(){}},setAttribute(){},getContext:()=>({setTransform(){}})};
 const pane={prepend(){},getClientRects:()=>[{}],getBoundingClientRect:()=>({width:900,height:500}),classList:{toggle(){}},addEventListener(){}};
 const document={body,documentElement:{},hidden:false,querySelector:()=>pane,createElement:()=>canvas,addEventListener:(k,v)=>events.set(k,v)};
 const reduced={matches:false,addEventListener:(k,v)=>events.set('reduced',v)};
 const context={document,matchMedia:()=>reduced,innerHeight:600,devicePixelRatio:2,getComputedStyle:()=>({getPropertyValue:()=> '#aabbcc'}),requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),MutationObserver:class{constructor(fn){observerCallbacks.push(fn)}observe(){}},ResizeObserver:class{observe(){}},addEventListener:(k,v)=>events.set(k,v),AVEDTerminalPatternArt:{paint:()=>painted++},AVEDEffectsEnabled:()=>effects};context.window=context;
 vm.runInNewContext(readFileSync(new URL('../public/terminal-ascii.js',import.meta.url),'utf8'),context);
 assert.equal(frames.size,1);assert.equal(canvas.width,1125,'pixel ratio is capped');
 body.dataset.terminalPattern='grid';observerCallbacks[0]();assert.equal(frames.size,0);assert.ok(painted>=2);
 body.dataset.terminalPattern='rain';observerCallbacks[0]();assert.equal(frames.size,1);
 document.hidden=true;events.get('visibilitychange')();assert.equal(frames.size,0);
 document.hidden=false;events.get('visibilitychange')();assert.equal(frames.size,1);
 effects=false;events.get('aved-effects-change')();assert.equal(frames.size,0);assert.equal(canvas.hidden,false,'effects-off retains a still texture');
 effects=true;reduced.matches=true;events.get('reduced')();assert.equal(frames.size,0);
 body.dataset.terminalPattern='plain';observerCallbacks[0]();assert.equal(canvas.hidden,true);assert.equal(frames.size,0);
});
