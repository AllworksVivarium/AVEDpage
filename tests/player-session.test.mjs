import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const scope={setTimeout,clearTimeout};vm.runInNewContext(readFileSync(new URL('../public/player-session.js',import.meta.url),'utf8'),scope);
function setup(){
 let time=1800000000000,expired=0,returned=0,timer;const data=new Map(),calls=[];
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 let failure=null;
 const make=()=>scope.AVEDPlayerSession.create({storage,now:()=>time,request:async active=>{calls.push(active);if(failure)throw failure;return {expiresAt:time+5*3600000,serverTime:time};},onExpire:()=>expired++,onReturn:()=>returned++,setTimer:fn=>{timer=fn;return 1;},clearTimer:()=>{}});
 return {make,calls,data,advance:ms=>time+=ms,fail:e=>failure=e,get expired(){return expired},get returned(){return returned},tick:()=>timer()};
}
test('refresh retains route visit; a closed page returning after thirty minutes begins a new visit',async()=>{
 const f=setup(),first=f.make();assert.equal((await first.start(1)).newVisit,true);
 f.advance(60000);first.activity();first.leave();await first.check();first.stop();
 f.advance(29*60000);const refresh=f.make();assert.equal((await refresh.start(1)).newVisit,false);
 refresh.leave();await refresh.check();refresh.stop();f.advance(30*60000);
 assert.equal((await f.make().start(1)).newVisit,true);
});
test('visibility return happens once; continued use and background timers never request repeated arrivals',async()=>{
 const f=setup(),session=f.make();await session.start(1);session.leave();await session.check();
 f.advance(30*60000);await session.resume();assert.equal(f.returned,1);
 await session.resume();session.activity();await session.check();assert.equal(f.returned,1);
 f.calls.length=0;await session.check();assert.deepEqual(f.calls,[false]);
});
test('another active tab prevents a false long absence; accounts have independent visit clocks',async()=>{
 const f=setup(),one=f.make();await one.start(1);one.leave();await one.check();
 f.advance(29*60000);const two=f.make();await two.start(1);f.advance(2*60000);await one.resume();assert.equal(f.returned,0);
 assert.equal((await f.make().start(2)).newVisit,true);
});
test('seven-day remembered sessions are not subject to any local five-hour logout',async()=>{
 const f=setup(),session=f.make();await session.start(1);session.leave();await session.check();f.advance(6*86400000);
 await session.resume();assert.equal(f.expired,0);assert.equal(f.returned,1);
});
test('only a server 401 expires a session; network failures are recoverable and cannot mark an arrival complete',async()=>{
 const f=setup(),session=f.make();f.fail({status:503});await assert.rejects(session.start(1));assert.equal(f.expired,0);assert.equal(f.data.size,0);
 f.fail(null);assert.equal((await session.start(1)).newVisit,true);
 f.fail({status:401,code:'SESSION_EXPIRED'});await session.check();assert.equal(f.expired,1);assert.equal(session.active,false);
 f.fail(null);assert.equal((await session.start(1,{fresh:true})).newVisit,true);
});
test('background startup checks credentials without renewing them or consuming the pending arrival',async()=>{
 const f=setup(),session=f.make();await session.start(1,{active:false});assert.deepEqual(f.calls,[false]);assert.equal(f.data.size,0);
 await session.resume();assert.equal(f.returned,1);assert.equal(f.calls.at(-1),true);
});
