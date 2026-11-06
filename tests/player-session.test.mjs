import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('activity, refresh and idle expiration share a persistent clock',()=>{
 let time=100000,expired=0;const data=new Map();
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const scope={setTimeout,clearTimeout};vm.runInNewContext(readFileSync(new URL('../public/player-session.js',import.meta.url),'utf8'),scope);
 const create=()=>scope.AVEDPlayerSession.create({storage,now:()=>time,onExpire:()=>expired++,setTimer:()=>1,clearTimer:()=>{}});
 const first=create();first.start(true);time+=60*60*1000;first.activity();
 time+=119*60*1000;first.check();assert.equal(expired,0);
 const afterReload=create();assert.equal(afterReload.stale(),false);afterReload.start();
 time+=60001;afterReload.activity();assert.equal(expired,1);assert.equal(afterReload.stale(),true);
 afterReload.start(true);assert.equal(afterReload.stale(),false);
 time+=2*60*60*1000;afterReload.check();assert.equal(expired,2);
});
