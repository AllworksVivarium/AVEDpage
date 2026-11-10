import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/stock-risk-notice.js',import.meta.url),'utf8');
const risk=(level='warning',lotId=1)=>({count:1,criticalCount:level==='critical'?1:0,items:[{lotId,riskLevel:level,equityPercent:45}]});
function harness(){const data=new Map(),window={sessionStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};vm.runInNewContext(source,{window});return {create:window.AVEDStockRiskNotice.create,window};}
const state=(model,id,value)=>JSON.parse(JSON.stringify(model.update(id,value)));

test('read and dismiss are independent; price updates do not revive a dismissed warning',()=>{
 const {create}=harness(),m=create();assert.deepEqual(state(m,1,risk()),{unread:true,visible:true});m.seen();assert.deepEqual(state(m,1,risk()),{unread:false,visible:true});m.dismiss();
 const moved=risk();moved.items[0].equityPercent=43;
 assert.deepEqual(state(m,1,moved),{unread:false,visible:false});
 assert.deepEqual(state(m,1,risk('critical')),{unread:true,visible:true});
 m.dismiss();assert.deepEqual(state(m,1,risk('critical',2)),{unread:true,visible:true});
});
test('dismissal survives refresh and notification initialization, but not a resolved risk episode',()=>{
 const {create}=harness();let m=create();m.update(1,risk());m.dismiss();m=create();m.update(1,null);
 assert.deepEqual(state(m,1,risk()),{unread:false,visible:false});
 m.update(1,{count:0,items:[]});assert.deepEqual(state(m,1,risk()),{unread:true,visible:true});
 m.dismiss();m=create();m.update(1,{count:0,items:[]});assert.deepEqual(state(m,1,risk()),{unread:true,visible:true});
});
test('accounts are isolated and unavailable storage is harmless',()=>{
 const {create,window}=harness(),m=create();m.update(1,risk());m.dismiss();assert.deepEqual(state(m,2,risk()),{unread:true,visible:true});assert.deepEqual(state(m,1,risk()),{unread:false,visible:false});
 window.sessionStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 const n=create();n.update(3,risk());n.dismiss();assert.deepEqual(state(n,3,risk()),{unread:false,visible:false});
});
