import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function scope(){const context=vm.createContext({Date,Set,JSON,setInterval:()=>0,localStorage:{getItem:()=>null,setItem(){}},document:{hidden:false,createElement:()=>({hidden:true,setAttribute(){}}),getElementById:()=>null,addEventListener(){}}});context.window=context;context.addEventListener=()=>{};vm.runInContext(readFileSync(new URL('../public/bar-notifications.js',import.meta.url),'utf8'),context);return context;}
const state=(ids=[])=>({selfId:1,serverTime:100,storedDrinks:{items:ids.map(id=>({id,direction:'incoming',recipientMode:id===2?'real':'anonymous',expiresAt:1000}))}});

test('incoming invitations coalesce, ignore outgoing and expired items, and never repeat on reconnect',()=>{
 const s=scope();let sounds=0;const alerts=s.AVEDBarInviteAlerts({play:()=>sounds++});alerts.receive(state([1]),{initial:true});assert.equal(sounds,0);
 alerts.receive(state([1,2,3]));assert.equal(sounds,1);alerts.receive(state([1,2,3]));assert.equal(sounds,1);
 const data=state([1,2,3]);data.cheersInvites=[{id:'a',recipientId:1,expiresAt:1000},{id:'out',recipientId:2,expiresAt:1000},{id:'expired',recipientId:1,expiresAt:10}];data.hospitality={gifts:[{id:1,direction:'incoming',expiresAt:1000},{id:2,direction:'outgoing',expiresAt:1000}]};alerts.receive(data);assert.equal(sounds,2);alerts.receive(data);assert.equal(sounds,2);alerts.receive(data,{initial:true});assert.equal(sounds,2);
});

test('sidebar red dot keeps unread bottles in the other identity inbox and excludes public drinks',()=>{
 const s=scope(),handlers={};let dot;const notification=s.AVEDBarNotifications({root:{addEventListener:(type,handler)=>handlers[type]=handler},nav:{append:element=>dot=element},api:async()=>({items:[]}),getUser:()=>({id:1}),isOpen:()=>true});notification.receive(state([1,2]),{initial:true});assert.equal(dot.hidden,false);
 handlers['aved-bar-kept-read']({detail:{ids:[1]}});assert.equal(dot.hidden,false);handlers['aved-bar-kept-read']({detail:{ids:[2]}});assert.equal(dot.hidden,true);
 notification.receive({...state([]),storedDrinks:{items:[{id:3,direction:'incoming',recipientMode:'public',expiresAt:1000}]}});assert.equal(dot.hidden,true);
 notification.receive(state([1,2,4]));assert.equal(dot.hidden,false);
});

test('invitation sound is brief, respects the sound switch and never queues a blocked old alert',()=>{
 const s=scope();let enabled=false,notes=0,resumes=0;const stops=[];
 s.localStorage.getItem=()=>enabled?'on':'off';
 s.AudioContext=class {state='running';currentTime=0;destination={};resume(){resumes++;return Promise.resolve();}createOscillator(){notes++;return {frequency:{},connect(){},start(){},stop(time){stops.push(time);},disconnect(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
 vm.runInContext(readFileSync(new URL('../public/bar-audio.js',import.meta.url),'utf8'),s);
 s.AVEDBarInviteSound();assert.equal(notes,0);enabled=true;s.AVEDBarInviteSound(true);assert.equal(notes,0);assert.equal(resumes,1);
 s.AVEDBarInviteSound();assert.equal(notes,2);assert.ok(Math.max(...stops)<.3);
});

test('door bell ignores initial guests and unchanged snapshots, then rings once for new arrivals',()=>{
 const s=scope();let bells=0;s.AVEDBarDoorSound=()=>bells++;const alerts=s.AVEDBarInviteAlerts();
 const data=state();data.guests=[{employeeId:1},{employeeId:2}];alerts.receive(data,{initial:true});assert.equal(bells,0);
 alerts.receive(data);assert.equal(bells,0);data.guests.push({employeeId:3},{employeeId:4});alerts.receive(data);assert.equal(bells,1);
 alerts.receive(data);assert.equal(bells,1);data.guests=[{employeeId:1},{employeeId:2}];alerts.receive(data);assert.equal(bells,1);
 data.guests.push({employeeId:3});alerts.receive(data);assert.equal(bells,2);
});

test('muting other guests and setting prompt volume to zero never mutes the user own clink',async()=>{
 const s=scope();let notes=0;const values=new Map([['aved_bar_sfx_others','off'],['aved_bar_sfx_volume','0']]);s.localStorage.getItem=key=>values.get(key)??null;s.setTimeout=()=>0;
 s.AudioContext=class {state='running';currentTime=0;destination={};resume(){return Promise.resolve();}close(){return Promise.resolve();}createOscillator(){notes++;return {type:'',frequency:{},connect(){},start(){},stop(){}};}createGain(){return {gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}};
 vm.runInContext(readFileSync(new URL('../public/bar-audio.js',import.meta.url),'utf8'),s);
 s.AVEDBarClink({own:false});await Promise.resolve();assert.equal(notes,0);
 s.AVEDBarClink({own:true});await Promise.resolve();assert.equal(notes,3);
});
