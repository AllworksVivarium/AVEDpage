import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function fixture(){
 let user={id:1},now=100000,consumed=false,blocked=false,appHidden=false;
 const cards=[],calls=[];
 const document={hidden:false,getElementById:()=>({classList:{contains:()=>appHidden}}),querySelector:selector=>selector==='dialog[open]'?(blocked||cards.some(c=>c.open)?{}:null):null,addEventListener(){},body:{append:node=>cards.push(node)},createElement:tag=>({tag,children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},remove(){cards.splice(cards.indexOf(this),1);}})};
 const context={window:{},document,Date:{now:()=>now}};
 vm.runInNewContext(readFileSync(new URL('../public/payroll-notices.js',import.meta.url),'utf8'),context);
 let responseGate=null,beforeClaim=()=>{};
 const notices=context.window.AVEDPayrollNotices.create({getUser:()=>user,api:async(path,options)=>{
  calls.push({path,options});if(responseGate)await responseGate;
  if(path.endsWith('/read')){beforeClaim();const claimed=!consumed;consumed=true;return {claimed};}
  return {items:consumed?[]:[{id:12,amount:200000,day:'2026-11-20'}]};
 }});
 return {notices,cards,calls,document,user:value=>user=value,block:value=>blocked=value,hideApp:value=>appHidden=value,advance:()=>now+=30000,consume:()=>consumed=true,gate:value=>responseGate=value,beforeClaim:fn=>beforeClaim=fn};
}

test('salary notice waits for login, visible page and other dialogs before claiming',async()=>{
 const f=fixture();f.user(null);await f.notices.ensure();assert.equal(f.calls.length,0);
 f.user({id:1});f.hideApp(true);await f.notices.ensure();assert.equal(f.calls.length,0);
 f.hideApp(false);f.document.hidden=true;await f.notices.ensure();assert.equal(f.calls.length,0);
 f.document.hidden=false;f.block(true);await f.notices.ensure();assert.equal(f.calls.length,0);
 f.block(false);await f.notices.ensure();assert.equal(f.cards.length,1);
 assert.equal(f.cards[0].children[0].textContent,'工资已到账');
 assert.equal(f.cards[0].children[1].textContent,'入账 200,000 元');
 f.cards[0].children[2].onclick();assert.equal(f.cards.length,0);
 await f.notices.ensure();assert.equal(f.cards.length,0);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/read')).length,1);
});

test('an account switch during fetch cannot claim or display another employee salary',async()=>{
 const f=fixture();let release;f.gate(new Promise(resolve=>release=resolve));
 const pending=f.notices.ensure();f.user({id:2});release();await pending;
 assert.equal(f.calls.length,1);assert.equal(f.cards.length,0);
});

test('a receipt already claimed on another device never displays again',async()=>{
 const f=fixture();f.beforeClaim(f.consume);await f.notices.ensure();
 assert.equal(f.cards.length,0);assert.equal(f.calls.filter(c=>c.path.endsWith('/read')).length,1);
 f.advance();await f.notices.ensure();assert.equal(f.cards.length,0);
});
