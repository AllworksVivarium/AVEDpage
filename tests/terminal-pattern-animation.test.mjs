import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/terminal-ascii.js',import.meta.url),'utf8');
function fixture(pattern='ascii'){
 const frames=new Map(),events=new Map(),texts=[],rectangles=[],colors=[],classes=new Set(['theme-inner','dark-mode']);
 let serial=0,stateChanged,resized,effects=true;
 const on=(name,fn)=>events.set(name,fn),classList={contains:key=>classes.has(key),toggle:(key,value)=>value?classes.add(key):classes.delete(key)};
 const body={classList,dataset:{terminalPattern:pattern}},pane={width:720,height:1200,getClientRects:()=>[{}],getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};},classList:{toggle(){}},prepend(){},addEventListener:on};
 const ctx={clearRect(){texts.length=0;rectangles.length=0;colors.length=0;},fillText:text=>texts.push(text),fillRect(...args){rectangles.push([...args,this.globalAlpha]);},setTransform(){},createLinearGradient:()=>({addColorStop:(_,color)=>colors.push(color)}),measureText:()=>({width:7}),arc(){},beginPath(){},moveTo(){},lineTo(){},rect(){},stroke(){}};
 const canvas={dataset:{},getContext:()=>ctx,setAttribute(){},style:{setProperty(){}},remove(){}};
 const document={body,documentElement:{},hidden:false,querySelector:()=>pane,createElement:()=>canvas,addEventListener:on};
 const reduced={matches:false,addEventListener:(_,fn)=>reduced.changed=fn},palette={'--inner-text-main':'#dfd1b5','--inner-text-muted':'#92856c','--inner-crimson':'#81393d'};
 const window={AVEDEffectsEnabled:()=>effects,addEventListener:on};
 const artScope={};vm.runInNewContext(readFileSync(new URL('../public/terminal-pattern-art.js',import.meta.url),'utf8'),artScope);window.AVEDTerminalPatternArt=artScope.AVEDTerminalPatternArt;
 vm.runInNewContext(source,{window,document,innerHeight:844,devicePixelRatio:3,matchMedia:()=>reduced,getComputedStyle:()=>({getPropertyValue:key=>palette[key]||''}),MutationObserver:class{constructor(fn){stateChanged=fn;}observe(){}},ResizeObserver:class{constructor(fn){resized=fn;}observe(){}},requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 const tick=now=>{const entries=[...frames];frames.clear();for(const [,fn] of entries)fn(now);};
 return {frames,events,texts,rectangles,colors,canvas,body,pane,palette,reduced,tick,change:()=>stateChanged(),resize:()=>resized(),setEffects:value=>{effects=value;events.get('aved-effects-change')();},document};
}

test('ASCII field uses mostly digits, contains no Latin letters, and keeps the existing moving field',()=>{
 const f=fixture(),first=f.texts.join('');
 assert.ok(first.length>1000);assert.doesNotMatch(first,/[A-Za-z]/);
 assert.ok((first.match(/[0-9]/g)||[]).length/first.length>.8);
 assert.equal(f.canvas.dataset.pattern,'ascii');assert.equal(f.frames.size,1);
 f.tick(1000);f.tick(1150);assert.notEqual(f.texts.join(''),first);assert.equal(f.frames.size,1);
 const svg=readFileSync(new URL('../public/assets/profile-ascii-flow.svg',import.meta.url),'utf8'),glyphs=[...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(match=>match[1]).join('');
 assert.doesNotMatch(glyphs,/[A-Za-z]/);assert.ok(new Set(glyphs.match(/[0-9]/g)).size>=9);assert.ok((glyphs.match(/[0-9]/g)||[]).length/glyphs.length>.8);
});

test('phase matrix animates on the same canvas and stops for other textures, hidden pages and reduced effects',()=>{
 const f=fixture('phase');assert.equal(f.canvas.hidden,false);assert.equal(f.canvas.dataset.pattern,'phase');assert.equal(f.texts.length,0);
 const first=JSON.stringify(f.rectangles);f.tick(1000);f.tick(1150);assert.notEqual(JSON.stringify(f.rectangles),first);
 f.document.hidden=true;f.events.get('visibilitychange')();assert.equal(f.frames.size,0);
 f.document.hidden=false;f.events.get('visibilitychange')();assert.equal(f.frames.size,1);
 f.reduced.matches=true;f.reduced.changed();assert.equal(f.frames.size,0);assert.equal(f.canvas.hidden,false);assert.ok(f.rectangles.length>0);
 f.reduced.matches=false;f.reduced.changed();f.setEffects(false);assert.equal(f.frames.size,0);assert.equal(f.canvas.hidden,false);
 f.setEffects(true);assert.equal(f.frames.size,1);
 f.body.dataset.terminalPattern='grain';f.change();assert.equal(f.canvas.hidden,true);assert.equal(f.frames.size,0);
 f.body.dataset.terminalPattern='ascii';f.change();assert.equal(f.frames.size,1);assert.ok(f.texts.length>0);
});

test('palette changes and narrow layouts reuse one animation loop with capped canvas resolution',()=>{
 const f=fixture('phase');assert.equal(f.canvas.width,900);assert.equal(f.canvas.height,1055);
 for(const palette of [['#251b22','#776162','#822b43'],['#c8dce6','#77929f','#5489a3'],['#24362f','#748b72','#807958']]){
  Object.keys(f.palette).forEach((key,i)=>f.palette[key]=palette[i]);f.change();
  assert.ok(f.colors.includes(palette[0])&&f.colors.includes(palette[2]));assert.ok(f.colors.every(color=>/^#[0-9a-f]{6}$/i.test(color)));assert.equal(f.frames.size,1);
 }
 f.pane.width=390;f.resize();assert.equal(f.canvas.width,488);assert.equal(f.frames.size,1);
 assert.ok(f.rectangles.flat().every(Number.isFinite));
});
