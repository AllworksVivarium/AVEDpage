import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('both logged-out network lamps reflect health, overload, malformed data and connection errors',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const signals=Array.from({length:2},()=>{const classes=new Set();return {classList:{remove:(...names)=>names.forEach(n=>classes.delete(n)),add:n=>classes.add(n),contains:n=>classes.has(n)},attributes:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}};});
 let response={ok:true,json:async()=>({ok:true})},fail=false,lastPath;
 const ctx={document:{querySelectorAll:()=>signals},window:{addEventListener(){}},AbortController,setTimeout,clearTimeout,fetch:async path=>{lastPath=path;if(fail)throw new Error('offline');return response;}};
 vm.runInNewContext(source.slice(source.indexOf('const networkSignals'),source.indexOf('// 切换欢迎页')),ctx);
 await ctx.probeServerStatus();assert.equal(lastPath,'/api/health');assert.ok(signals.every(s=>s.classList.contains('online')));
 for(const status of [429,503]){response={ok:false,status};await ctx.probeServerStatus();assert.ok(signals.every(s=>s.classList.contains('offline')));}
 response={ok:true,json:async()=>({ok:false})};await ctx.probeServerStatus();assert.ok(signals.every(s=>s.classList.contains('offline')));
 response={ok:true,json:async()=>{throw new Error('invalid json');}};await ctx.probeServerStatus();assert.ok(signals.every(s=>s.classList.contains('offline')));
 fail=true;await ctx.probeServerStatus();assert.ok(signals.every(s=>s.classList.contains('offline')));
 fail=false;response={ok:true,json:async()=>({ok:true})};await ctx.probeServerStatus();assert.ok(signals.every(s=>s.classList.contains('online')));
});
