import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('market refresh stops outside the visible stock page and coalesces concurrent refreshes',async()=>{
 const source=readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
 const visible=source.match(/function marketVisible\(\)\{[^\n]+\}/)[0];
 const refresh=source.slice(source.indexOf('async function refreshMarket()'),source.indexOf('const byId=id=>document.getElementById(id);'));
 const hidden=new Set();let calls=0,release;
 const ctx={currentUser:{id:1},document:{hidden:false},byId:id=>({classList:{contains:()=>hidden.has(id)}}),marketBusy:false,marketCode:'A',marketPeriod:1,api:()=>{calls++;return new Promise(r=>release=r);},applyMarket(){},showToast(){}};
 vm.createContext(ctx);vm.runInContext(visible+'\n'+refresh,ctx);
 hidden.add('view-casino');await ctx.refreshMarket();assert.equal(calls,0);
 hidden.clear();hidden.add('game-panel-stocks');await ctx.refreshMarket();assert.equal(calls,0);
 hidden.clear();ctx.document.hidden=true;await ctx.refreshMarket();assert.equal(calls,0);
 ctx.document.hidden=false;const first=ctx.refreshMarket();await ctx.refreshMarket();assert.equal(calls,1);release({});await first;
 ctx.currentUser=null;await ctx.refreshMarket();assert.equal(calls,1);
});
