import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/sky-ui.js',import.meta.url),'utf8');
const person={id:7,alias:'测试乘员',status:'aboard',cost:100,depth:0,prize:0};
const initial=()=>({round:1,phase:'DROPPING',departAt:100000,serverTime:110000,speed:25,depth:350,passengers:[{...person},{...person,id:8}],self:{...person},balance:900,boardingSeconds:12});

test('local opening affects only the visual self and yields to authoritative failure, new rounds and account changes',()=>{
 const context={window:{}};vm.runInNewContext(source,context);const opening=context.window.AVEDSkyUI.createOpening(),s=initial(),saved=JSON.stringify(s);
 assert.equal(opening.begin(s,7,110000),true);assert.equal(opening.begin(s,7,110100),false);
 const visual=opening.view(s,7);assert.equal(visual.self.status,'landed');assert.equal(visual.self.depth,350);assert.equal(visual.passengers[1],s.passengers[1]);assert.equal(visual.balance,s.balance);assert.equal(visual.self.prize,0);
 assert.equal(JSON.stringify(s),saved,'prediction cannot mutate the settlement snapshot');
 opening.observe(s,7);assert.equal(opening.pending(1,7),true,'an in-flight old SSE snapshot cannot undo the button feedback');
 const failed={...s,phase:'LANDING',self:{...s.self,status:'crashed'}};opening.observe(failed,7);assert.equal(opening.view(failed,7),failed);
 assert.ok(opening.begin(s,7,110000));opening.observe({...s,round:2},7);assert.equal(opening.pending(1,7),false);
 assert.ok(opening.begin(s,7,110000));opening.observe(s,8);assert.equal(opening.pending(1,7),false);
 assert.equal(opening.begin({...s,phase:'BOARDING'},7,99999),false);assert.equal(opening.begin(s,8,110000),false);
});

function harness(){
 let state=initial(),now=1000,resolvePost,rejectPost;
 const elements=new Map(),frames=[],paints=[],calls=[],sounds=[],user={id:7,balance:900};
 function element(){return {dataset:{},style:{setProperty(){}},classList:{contains(){return false;}},hidden:false,children:[],textContent:'',append(el){this.children.push(el);},remove(){},setAttribute(){},querySelector(){return this.children[0]||null;},toDataURL(){return 'data:image/png;base64,cHJldmlldw==';},getContext(){return {fillText(){},getImageData(){return {data:new Uint8ClampedArray(4)};},putImageData(){}};}};}
 const byId=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const scene={paint(...args){paints.push(args);},preview(){},reset(){}};
 const api=async(path,options)=>{calls.push({path,options});if(path.endsWith('/current'))return state;return new Promise((resolve,reject)=>{resolvePost=resolve;rejectPost=reject;});};
 const document={hidden:false,createElement:element,addEventListener(){}};
 const window={AVEDSkyScene:()=>scene,AVEDSkyRules:{multiplier:d=>d/200}};window.AVEDSkyScene.landingDelay=()=>1000;
 vm.runInNewContext(readFileSync(new URL('../public/game-clock.js',import.meta.url),'utf8'),{window,performance:{now:()=>now}});
 vm.runInNewContext(source,{window,document,performance:{now:()=>now},matchMedia:()=>({matches:false}),MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},EventSource:class{close(){}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},console});
 const ui=window.AVEDSkyUI({api,esc:x=>x,byId,getUser:()=>user,onBalance:b=>{user.balance=b;},showToast(){},playSfx:s=>sounds.push(s)});
 ui.render(state);ui.ensure();
 return {ui,paints,calls,sounds,user,byId,frame(){frames.shift()?.();},setState(next){state=next;},resolve(next){resolvePost(next);},reject(error){rejectPost(error);},advance(ms){now+=ms;}};
}

test('a slow opening request immediately draws a canopy without waiting, sending client money or changing the balance',async()=>{
 const h=harness();await Promise.resolve();const pending=h.ui.jump();
 const visual=h.paints.at(-1)[0];assert.equal(visual.self.status,'landed');assert.equal(visual.self.prize,0);assert.equal(h.user.balance,900);
 assert.equal(h.ui.jump(),pending,'repeat clicks share a single request');
 const sent=h.calls.filter(x=>x.path.endsWith('/jump'));assert.equal(sent.length,1);assert.deepEqual(JSON.parse(JSON.stringify(sent[0].options.body)),{round:1});
 h.advance(600);h.frame();assert.equal(h.byId('flight-multiplier').textContent,'开伞确认中');assert.equal(h.paints.at(-1)[0].self.status,'landed');
 const confirmed={...initial(),serverTime:110600,balance:1080,self:{...person,status:'landed',prize:180,depth:365,settledAt:110600}};confirmed.passengers[0]=confirmed.self;
 h.resolve(confirmed);h.ui.render(await pending);assert.equal(h.user.balance,1080);assert.equal(h.sounds.filter(s=>s==='sky-open').length,1,'confirmation does not play the opening sound twice');
});

test('a server crash result replaces the provisional canopy and cannot produce a local win',async()=>{
 const h=harness();await Promise.resolve();const pending=h.ui.jump();
 const crashed={...initial(),phase:'LANDING',serverTime:110200,revealedAt:110000,safetyLine:350,balance:900,self:{...person,status:'crashed',prize:0,depth:350,settledAt:110000}};crashed.passengers[0]=crashed.self;
 h.resolve(crashed);h.ui.render(await pending);h.frame();assert.equal(h.paints.at(-1)[0].self.status,'crashed');assert.equal(h.user.balance,900);assert.ok(!h.byId('flight-multiplier').textContent.includes('已锁定'));
});

test('lost confirmation is reconciled with one read and never retries the monetary command',async()=>{
 const h=harness();await Promise.resolve();const pending=h.ui.jump();
 const confirmed={...initial(),serverTime:110600,balance:1080,self:{...person,status:'landed',prize:180,depth:365,settledAt:110600}};confirmed.passengers[0]=confirmed.self;h.setState(confirmed);
 h.reject(Object.assign(Error('timeout'),{code:'TIMEOUT'}));await assert.rejects(pending,/timeout/);h.frame();
 assert.equal(h.calls.filter(x=>x.path.endsWith('/jump')).length,1);assert.equal(h.user.balance,1080);assert.equal(h.paints.at(-1)[0].self.status,'landed');assert.equal(h.sounds.filter(s=>s==='sky-open').length,1);
});

test('pointer press submits immediately; release after an early reply does not submit again, keyboard still works',async()=>{
 const h=harness();await Promise.resolve();const button=h.byId('skydive-open-chute-btn'),event=detail=>({button:0,isPrimary:true,currentTarget:button,detail,preventDefault(){},stopPropagation(){}});
 button.onpointerdown(event(1));assert.equal(h.calls.filter(x=>x.path.endsWith('/jump')).length,1);
 const confirmed={...initial(),serverTime:110100,self:{...person,status:'landed',prize:180,depth:350}};confirmed.passengers[0]=confirmed.self;
 h.resolve(confirmed);await new Promise(resolve=>setImmediate(resolve));button.onclick(event(1));
 assert.equal(h.calls.filter(x=>x.path.endsWith('/jump')).length,1);
 const k=harness();await Promise.resolve();const kb=k.byId('skydive-open-chute-btn');kb.onclick({...event(0),currentTarget:kb});assert.equal(k.calls.filter(x=>x.path.endsWith('/jump')).length,1);k.resolve(confirmed);await new Promise(resolve=>setImmediate(resolve));
});

test('each received probe is acknowledged once, without client timing or money fields',async()=>{
 const h=harness();await Promise.resolve();const next={...initial(),inputProbe:{token:'server-probe'}};h.ui.render(next);h.ui.render(next);
 const sent=h.calls.filter(x=>x.path.endsWith('/input-sync'));assert.equal(sent.length,1);assert.deepEqual(JSON.parse(JSON.stringify(sent[0].options.body)),{round:1,token:'server-probe'});
 h.resolve({round:1,compensationMs:100,serverTime:110000});await new Promise(resolve=>setImmediate(resolve));
});
