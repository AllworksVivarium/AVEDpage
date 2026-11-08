import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={setTimeout,clearTimeout};vm.runInNewContext(readFileSync(new URL('../public/player-startup.js',import.meta.url),'utf8'),context);const {within,route}=context.AVEDStartup;
test('a stalled font cannot block entry; fast resources retain their result',async()=>{let calls=0;const stalled=new Promise(()=>{});assert.equal(await within(stalled,10,()=>{calls++;return 'fallback';}),'fallback');assert.equal(calls,1);assert.equal(await within(Promise.resolve('font'),10,()=>{calls++;return 'fallback';}),'font');await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);await assert.rejects(within(Promise.reject(Error('network')),10,()=>null),/network/);});
test('only known pages can be restored; links do not accept account IDs or QQ numbers',()=>{const allowed=['profile','forum','casino'];assert.equal(route('#/forum',allowed),'forum');assert.equal(route('#/casino',allowed),'casino');for(const hash of ['#/123456789','?qq=123456789','#/admin','#/profile?employeeId=2'])assert.equal(route(hash,allowed),'profile');});

test('game deep links survive refresh and invalid children return to the lobby',()=>{
 const allowed=['profile','forum','casino'],routing=context.AVEDStartup;
 for(const game of ['skydive','slots','scratch','derby','doudizhu','stocks']){
  const hash='#/casino/'+game,parsed=routing.resolveRoute(hash,allowed);
  assert.equal(parsed.page,'casino');assert.equal(parsed.game,game);assert.equal(parsed.hash,hash);
  assert.equal(routing.gamePath(game),hash);assert.equal(route(hash,allowed),'casino');
 }
 for(const hash of ['#/casino','#/casino/home','#/casino/unknown','#/casino/derby?employeeId=2','#/casino/../admin']){
  const parsed=routing.resolveRoute(hash,allowed);assert.equal(parsed.page,'casino');assert.equal(parsed.game,'home');assert.equal(parsed.hash,'#/casino');
 }
 assert.equal(routing.gamePath('__proto__'),null);assert.equal(routing.gamePath('invalid'),null);
 assert.equal(routing.resolveRoute('#/casino/derby',['profile']).page,'profile');
 const html=readFileSync(new URL('../public/player-terminal.html',import.meta.url),'utf8');
 for(const game of ['skydive','slots','scratch','derby','doudizhu','stocks'])assert.ok(html.includes('href="'+routing.gamePath(game)+'" data-game="'+game+'"'),'game links also work when opened in a new tab');
});

test('critical art is decoded in a bounded queue; cold entry is paced and cached entry skips the delay',async()=>{
 const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},delays=[],urls=Array.from({length:9},(_,i)=>'/assets/icon-'+i+'.webp');
 let active=0,peak=0,calls=0;
 const load=async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return true;};
 const cold=context.AVEDStartup.assetCache({urls:[...urls,urls[0],'/api/me','https://example.invalid/image'],storage,load,delay:async ms=>delays.push(ms)});
 assert.equal(cold.cached,false);const first=cold.prepare();assert.equal(cold.prepare(),first);
 const result=await first;assert.equal(result.complete,true);assert.equal(result.cached,false);assert.equal(peak,3);assert.equal(calls,9);assert.deepEqual(delays,[1600]);assert.equal(cold.cached,true);
 await cold.prepare();assert.equal(calls,9,'same-page entry reuses decoded assets');
 const warm=context.AVEDStartup.assetCache({urls,storage,load,delay:()=>assert.fail('cached entry should not have a minimum delay')});
 assert.equal(warm.cached,true);assert.equal((await warm.prepare()).cached,true);assert.equal(calls,18,'a cache marker still checks that images can load');
 const updated=context.AVEDStartup.assetCache({urls:[...urls,'/assets/new-hash.webp'],storage,load,delay:async()=>{}});assert.equal(updated.cached,false,'changed art invalidates the marker');
});

test('failed art and blocked storage never prevent entry or create a false cache marker',async()=>{
 const storage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');},removeItem:()=>{throw Error('blocked');}};
 const failed=context.AVEDStartup.assetCache({urls:['/assets/a.webp'],storage,load:async()=>{throw Error('offline');},coldMinMs:0});
 assert.equal((await failed.prepare()).complete,false);assert.equal(failed.cached,false);
 const stalled=context.AVEDStartup.assetCache({urls:['/assets/a.webp'],storage,load:()=>new Promise(()=>{}),deadlineMs:5,coldMinMs:0});
 assert.equal((await stalled.prepare()).complete,false);
 const ok=context.AVEDStartup.assetCache({urls:['/assets/a.webp'],storage,load:async()=>true,coldMinMs:0});assert.equal((await ok.prepare()).complete,true);assert.equal(ok.cached,true);
});

test('refresh restores only after the server session and page initialization succeed',async()=>{
 let resolveSession;const session=new Promise(resolve=>{resolveSession=resolve;}),seen=[];
 const pending=context.AVEDStartup.restoreSession({load:()=>session,enter:async employee=>{seen.push(employee.id);},signedOut:()=>assert.fail('a valid session must not show the gateway'),unavailable:()=>assert.fail('a valid session must restore')});
 await Promise.resolve();assert.deepEqual(seen,[]);
 resolveSession({id:42});assert.equal(await pending,'ready');assert.deepEqual(seen,[42]);
});

test('temporary failures keep the restore screen; only a confirmed 401 opens the gateway',async()=>{
 for(const error of [{status:401,code:'SESSION_EXPIRED'},{status:401,code:'SESSION_MISSING'},{status:503},{code:'TIMEOUT'},{status:200,code:'INVALID_RESPONSE'},{status:401,code:'INVALID_RESPONSE'}]){
  const events=[];
  const state=await context.AVEDStartup.restoreSession({load:async()=>{throw error;},enter:()=>assert.fail('a failed session lookup cannot enter an account'),signedOut:()=>events.push('landing'),unavailable:()=>events.push('checking')});
  const expected=error.status===401&&error.code!=='INVALID_RESPONSE'?'landing':'checking';
  assert.equal(state,expected);assert.deepEqual(events,[expected]);
 }
 const state=await context.AVEDStartup.restoreSession({load:async()=>({id:42}),enter:async()=>{throw Error('page initialization failed');},signedOut:()=>assert.fail('a render error is not a logout'),unavailable:()=>{}});
 assert.equal(state,'checking');
});
