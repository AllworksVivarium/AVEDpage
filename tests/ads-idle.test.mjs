import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function harness(){
 const elements=[],listeners=new Map(),timers=new Map(),calls=[];let timerId=0,atHome=true,protectedUntil=0,available=true;
 class Element{
  constructor(){this.dataset={};this.open=false;this.children=new Map();this.events=new Map();this.classList={contains:()=>!atHome};}
  setAttribute(){} append(){} after(){} before(){}
  querySelector(s){if(!this.children.has(s))this.children.set(s,new Element());return this.children.get(s);}
  querySelectorAll(){return [];}
  addEventListener(type,fn){this.events.set(type,fn);}
  close(){const was=this.open;this.open=false;if(was)this.events.get('close')?.();}
  showModal(){this.open=true;}
 }
 const fallback=new Element();
 const document={hidden:false,documentElement:{dataset:{entryState:'ready'}},body:fallback,
  createElement:()=>{const e=new Element();elements.push(e);return e;},getElementById:()=>fallback,
  querySelector:s=>s==='dialog[open]'?elements.find(e=>e.open)||null:fallback,
  addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}};
 const window={addEventListener(){}};
 vm.runInNewContext(readFileSync(new URL('../public/ads-ui.js',import.meta.url),'utf8'),{window,document,Intl,Date,Image:class{},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),clearInterval(){}});
 const ads=window.AVEDAds({esc:String,getUser:()=>({id:1}),onBalance(){},api:async(path,options)=>{calls.push(options.body.popup);return {serverTime:Date.now(),endsAt:Date.now()+86400000,protectionUntil:protectedUntil,items:[],popup:options.body.popup&&available?{body:'测试广告'}:null};}});
 return {ads,calls,document,elements,get popup(){return elements.find(e=>e.className==='ad-popup-dialog');},set home(v){atHome=v;},set protected(v){protectedUntil=v?Date.now()+86400000:0;},set available(v){available=v;},fire:type=>{for(const fn of listeners.get(type)||[])fn({});},flush:async()=>{for(const [id,t] of [...timers])if(t.ms===500){timers.delete(id);t.fn();}await new Promise(setImmediate);}};
}
test('ordinary entry and frequent interaction never request a popup; explicit long-return arrival shows one on the homepage',async()=>{
 const h=harness();h.ads.enter({popup:false});await h.flush();assert.deepEqual(h.calls,[false]);
 for(let i=0;i<20;i++)h.fire('pointerdown');await h.flush();assert.deepEqual(h.calls,[false]);assert.equal(h.popup.open,false);
 h.ads.arrival();await h.flush();assert.deepEqual(h.calls,[false,true]);assert.equal(h.popup.open,true);
 h.popup.onclick();for(let i=0;i<20;i++)h.fire('scroll');await h.flush();assert.equal(h.popup.open,false);assert.deepEqual(h.calls,[false,true]);
});
test('arrival ads wait for homepage and respect protection, missing creatives and hidden tabs',async()=>{
 for(const mode of ['other-page','hidden','protected','no-creative']){
  const h=harness();if(mode==='other-page')h.home=false;if(mode==='hidden')h.document.hidden=true;if(mode==='protected')h.protected=true;if(mode==='no-creative')h.available=false;
  h.ads.enter({popup:true});await h.flush();assert.equal(h.popup.open,false,mode);
 }
});
