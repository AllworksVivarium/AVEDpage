import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/bar-personal.js',import.meta.url),'utf8');
function fixture(api){
 const node=()=>({dataset:{},textContent:'',hidden:true,disabled:false}),make=()=>{const nodes=new Map(),dialog={open:false,className:'',setAttribute(){},addEventListener(){},querySelector(s){if(s==='.bar-personal-error,.bar-play-error')return this.querySelector('.bar-personal-error');if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];},showModal(){this.open=true;},close(){this.open=false;}};return dialog;};
 const action=make(),error=node();action.open=true;action.querySelector=s=>s==='.bar-personal-error,.bar-play-error'||s==='.bar-play-error'?error:null;
 const clicks=[],root={hidden:false,append(){},querySelector:()=>node(),querySelectorAll:()=>[],addEventListener(type,fn){if(type==='click')clicks.push(fn);}},applied=[],window={};
 vm.runInNewContext(source,{window,document:{createElement:make}});const personal=window.AVEDBarPersonal({root,api,esc:String,onChange:d=>applied.push(d)});
 personal.receive({barPreferences:{glassId:'highball',toleranceId:'high'},features:{glassware:true},toleranceOptions:[],glassware:[]});
 const button={},target={closest:s=>s==='[data-bar-stow-glass]'?button:s==='dialog'?action:null};
 return {personal,action,error,applied,click(){clicks.forEach(fn=>fn({target}));}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('stow from My Drink reaches preferences, applies empty-glass state and closes the action dialog',async()=>{
 const calls=[],result={barPreferences:{glassId:null,toleranceId:'high'},myDrink:{remainingMl:0,glassMl:0,drinkFrom:'bottle'}};
 const f=fixture(async(path,options)=>{calls.push([path,options]);return result;});f.click();f.click();await flush();
 assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/player/bar/preferences');assert.equal(calls[0][1].body.glassId,null);assert.equal(f.applied.length,1);assert.equal(f.applied[0],result);assert.equal(f.action.open,false);
});
test('a rejected stow shows the actual server error in My Drink and remains retryable',async()=>{
 let fail=true,count=0;const f=fixture(async()=>{count++;if(fail)throw Error('先喝完杯中的饮品，再换杯或收起杯子。');return {barPreferences:{glassId:null}};});
 f.click();await flush();assert.equal(f.action.open,true);assert.equal(f.error.hidden,false);assert.match(f.error.textContent,/先喝完/);assert.equal(f.applied.length,0);
 fail=false;f.click();await flush();assert.equal(count,2);assert.equal(f.action.open,false);assert.equal(f.applied.length,1);
});
