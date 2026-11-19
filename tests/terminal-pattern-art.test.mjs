import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const scope={};vm.runInNewContext(readFileSync(new URL('../public/terminal-pattern-art.js',import.meta.url),'utf8'),scope);
function draw(pattern,time,pointer){
 const calls=[],c=new Proxy({createLinearGradient:(...args)=>({addColorStop:(...values)=>calls.push(['stop',...values])})},{get:(obj,key)=>key in obj?obj[key]:(...args)=>calls.push([key,...args]),set:(obj,key,value)=>{calls.push([key,typeof value==='object'?'gradient':value]);obj[key]=value;return true;}});
 scope.AVEDTerminalPatternArt.paint(c,{width:600,height:400,time,pattern,pointer,ink:'#d4c6a9',muted:'#806b50',accent:'#8b2727'});return calls;
}
test('waterfall falls in fixed columns, evolves over time and ignores pointer position',()=>{
 const a=draw('rain',4,null),b=draw('rain',4,{x:.9,y:.2}),later=draw('rain',4.1,null);
 assert.deepEqual(a,b);assert.notDeepEqual(a,later);
 for(const calls of [a,later])for(const glyph of calls.filter(x=>x[0]==='fillText'))assert.equal(glyph[2]%9,0,'columns stay on the same fixed lattice even as individual trails enter and leave');
 const start=a.find(x=>x[0]==='fillText'),end=later.find(x=>x[0]==='fillText');assert.ok(end[3]>start[3]);
});
test('drafting grid is truly static while character field and phase matrix retain their motion',()=>{
 assert.deepEqual(draw('grid',0,null),draw('grid',200,{x:.2,y:.9}));
 for(const pattern of ['ascii','phase'])assert.notDeepEqual(draw(pattern,0,null),draw(pattern,2,null));
 for(const pattern of ['ascii','phase','rain','grid']){
  const calls=draw(pattern,7,null);assert.ok(calls.some(x=>x[0]==='stop'&&x[2]==='#8b2727'));
  for(const call of calls)for(const arg of call.slice(1))if(typeof arg==='number')assert.ok(Number.isFinite(arg));
 }
});

test('flow measures the actual monospace advance and covers the full viewport width',()=>{
 const runs=[],c=new Proxy({measureText:()=>({width:5.3}),fillText:(text)=>runs.push(text),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 scope.AVEDTerminalPatternArt.paint(c,{width:600,height:400,pattern:'ascii'});assert.ok(runs.length>0);for(const line of runs)assert.ok(line.length*5.3>=600);
});
