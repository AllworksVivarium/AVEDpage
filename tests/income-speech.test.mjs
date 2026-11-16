import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {incomeEvents} from '../server-income-events.mjs';
const source=readFileSync(new URL('../public/income-speech.js',import.meta.url),'utf8');
const context=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval,Promise});
vm.runInContext(source,context);
const {createQueue,amountText,create}=context.AVEDIncomeSpeech;
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('ledger feed starts at current cursor and pages credits without crossing accounts',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER,delta INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);');
  const insert=db.prepare('INSERT INTO balance_ledger(employee_id,delta) VALUES(?,?)');
  insert.run(1,10000);insert.run(2,99999);
  assert.deepEqual(incomeEvents(db,1,null),{cursor:1,items:[],more:false});
  for(let i=0;i<55;i++)insert.run(1,i%2?-500:100);
  const first=incomeEvents(db,1,1),next=incomeEvents(db,1,first.cursor);
  assert.equal(first.more,true);assert.equal(next.more,false);
  assert.equal(first.items.length+next.items.length,28);
  assert.ok([...first.items,...next.items].every(x=>x.amount===100));
  assert.equal(incomeEvents(db,1,next.cursor).items.length,0);
  assert.throws(()=>incomeEvents(db,1,-1));assert.throws(()=>incomeEvents(db,1,NaN));
 }finally{db.close();}
});
test('spoken amounts cover Chinese zeros and large monetary units',()=>{
 for(const [amount,text] of [[1,'一'],[10,'十'],[101,'一百零一'],[10001,'一万零一'],[100000001,'一亿零一'],[100010000,'一亿零一万'],[100100000,'一亿零一十万'],[1000000000000,'一万亿']])assert.equal(amountText(amount),text);
});
function fixture(mode){
 let next=0,cancels=0;const jobs=new Map(),spoken=[],ends=[];
 const queue=createQueue({speak:text=>{spoken.push(text);return new Promise(resolve=>ends.push(resolve));},cancel:()=>{cancels++;},schedule:fn=>{jobs.set(++next,fn);return next;},unschedule:id=>jobs.delete(id)});
 queue.configure({enabled:true,mode});
 return {queue,spoken,ends,cancels:()=>cancels,async run(){const job=jobs.entries().next().value;if(job){jobs.delete(job[0]);job[1]();}await flush();}};
}
test('merge combines adjacent credits and combines pending credits after the current sentence',async()=>{
 const f=fixture('merge');f.queue.add(100);f.queue.add(200);await f.run();
 assert.deepEqual(f.spoken,['到账三百元']);
 f.queue.add(10);f.queue.add(20);f.ends.shift()();await flush();await f.run();
 assert.deepEqual(f.spoken,['到账三百元','到账三十元']);f.queue.clear();
});
test('queue keeps credit order and disabling clears pending playback',async()=>{
 const f=fixture('queue');f.queue.add(100);f.queue.add(200);await f.run();
 assert.deepEqual(f.spoken,['到账一百元']);f.ends.shift()();await flush();await f.run();
 assert.deepEqual(f.spoken,['到账一百元','到账二百元']);
 f.queue.add(300);f.queue.configure({enabled:false,mode:'queue'});f.ends.shift()();await flush();await f.run();
 assert.equal(f.spoken.length,2);
});
test('interrupt cancels current speech; stale completion cannot start an old queued sentence',async()=>{
 const f=fixture('interrupt');f.queue.add(100);await f.run();const before=f.cancels();f.queue.add(200);await f.run();
 assert.equal(f.cancels(),before+1);assert.deepEqual(f.spoken,['到账一百元','到账二百元']);
 f.ends.shift()();await flush();assert.equal(f.queue.state().current,200);f.queue.clear();
});
test('controller keeps settings, seeds ledger before announcing and isolates a changed account',async()=>{
 const storage=new Map(),listeners=new Map(),spoken=[],calls=[];let user={id:1},response={cursor:5,items:[],more:false};
 const doc={hidden:false,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 const recorded={available:true,unlock:async()=>{},cancel:()=>{},close:()=>{},speak:async amount=>{spoken.push(amount);}};
 const controller=create({api:async path=>{calls.push(path);return response;},getUser:()=>user,recorded,doc,storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
 try{
  controller.setSession(1,0);await controller.update({enabled:true,mode:'queue'});await new Promise(r=>setTimeout(r,30));
  assert.equal(calls[0],'/api/player/income-events');assert.equal(spoken.length,0);
  response={cursor:6,items:[{id:6,amount:123}],more:false};controller.changed();await new Promise(r=>setTimeout(r,550));
  assert.deepEqual(spoken,[123]);
  user={id:2};controller.setSession(2);response={cursor:100,items:[],more:false};await new Promise(r=>setTimeout(r,550));
  assert.equal(spoken.length,1);await controller.update({enabled:false});assert.ok(storage.get('aved_income_speech_v1').includes('"enabled":false'));
 }finally{controller.close();}
});
