import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){
 let inside=false,errors=0,plays=0;const media=[],heard=[];
 class Audio{constructor(){media.push(this);}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}play(){this.paused=false;plays++;return Promise.resolve();}}
 const scope=vm.createContext({Audio,setTimeout,clearTimeout});scope.window=scope;vm.runInContext(readFileSync(new URL('../public/bar-audio.js',import.meta.url),'utf8'),scope);
 const player=scope.AVEDBarAudio({canPlay:()=>inside,onError:()=>errors++,onTrack:track=>heard.push(track)});
 return {player,media,heard,setInside:value=>inside=value,plays:()=>plays,hasSyntheticMusic:()=>typeof scope.AVEDBarPreviewAudio==='function',errors:()=>errors};
}
test('bar music remains silent outside the room, including when a playlist refresh arrives',async()=>{
 const f=fixture();try{
  f.player.configure({enabled:true,tracks:[{id:1,url:'/music.mp3'}]});await f.player.play();assert.equal(f.plays(),0);
  f.setInside(true);await f.player.play();assert.equal(f.plays(),1);
  f.setInside(false);f.player.configure({enabled:true,tracks:[{id:1,url:'/music.mp3'}]});assert.equal(f.plays(),1);assert.ok(f.media[0].paused);
  await f.player.play();assert.equal(f.plays(),1);
 }finally{f.player.stop();}
});
test('native music stops when the room becomes inactive before the next track or load completes',async()=>{
 const f=fixture();try{
  f.setInside(true);f.player.configure({enabled:true,tracks:[{id:1,url:'/one.mp3'},{id:2,url:'/two.mp3'}]});await f.player.play();assert.equal(f.plays(),1);
  const ended=f.media[0].onended;f.setInside(false);ended();assert.equal(f.plays(),1);assert.ok(f.media[0].paused);
  f.setInside(true);await f.player.play();const ready=f.media[0].oncanplay;f.setInside(false);ready();assert.ok(f.media[0].paused);assert.equal(f.errors(),0);
 }finally{f.player.stop();}
});
test('disabling music clears the playback intent so re-enabling does not unexpectedly start it',async()=>{
 const f=fixture();try{
  f.setInside(true);f.player.configure({enabled:true,tracks:[{id:1,url:'/one.mp3'}]});await f.player.play();f.player.configure({enabled:false,tracks:[]});assert.equal(f.plays(),1);
  f.player.configure({enabled:true,tracks:[{id:1,url:'/one.mp3'}]});assert.equal(f.plays(),1);await f.player.play();assert.equal(f.plays(),2);
 }finally{f.player.stop();}
});
test('requested music seeks to shared progress and heartbeat updates do not restart it or override mute',async()=>{
 const f=fixture();try{
  const now=Date.now(),request={id:'request-a',trackId:2,startsAt:now-20000,endsAt:now+60000},settings={enabled:true,tracks:[{id:1,url:'/one.mp3'},{id:2,url:'/two.mp3'}],request,serverTime:now};
  f.setInside(true);f.player.configure(settings);await f.player.play();assert.equal(f.media[0].src,'/two.mp3');f.media[0].duration=180;f.media[0].onloadedmetadata();assert.ok(f.media[0].currentTime>=20&&f.media[0].currentTime<21);
  f.player.configure({...settings,serverTime:now+1000});assert.equal(f.plays(),1);f.player.stop();f.player.configure({...settings,request:{...request,id:'request-b'}});assert.equal(f.plays(),1);
 }finally{f.player.stop();}
});
test('playing-track attribution follows the selected recording and clears when music stops',async()=>{
 const f=fixture();try{
  const tracks=[{id:1,title:'First',artist:'Artist',url:'/first.mp3'},{id:2,title:'Second',artist:'Artist',url:'/second.mp3'}];
  f.setInside(true);f.player.configure({enabled:true,tracks});await f.player.play();const first=f.heard.at(-1);assert.ok(first.artist==='Artist'&&first.title);
  f.media[0].onended();assert.notEqual(f.heard.at(-1).id,first.id);f.player.stop();assert.equal(f.heard.at(-1),null);
 }finally{f.player.stop();}
});

test('an early requested-track ending waits for the shared boundary instead of inserting a random song',async()=>{
 const f=fixture();try{
  const now=Date.now(),tracks=[{id:1,url:'/first.mp3'},{id:2,url:'/next.mp3'},{id:3,url:'/unrequested.mp3'}];
  f.setInside(true);f.player.configure({enabled:true,tracks,serverTime:now,request:{id:'first-request',trackId:1,startsAt:now-60000,endsAt:now+1000}});await f.player.play();
  f.media[0].onended();assert.equal(f.plays(),1);assert.equal(f.media[0].src,'/first.mp3');
  f.player.configure({enabled:true,tracks,serverTime:now+1000,request:{id:'next-request',trackId:2,startsAt:now+1000,endsAt:now+121000}});assert.equal(f.plays(),2);assert.equal(f.media[0].src,'/next.mp3');
 }finally{f.player.stop();}
});

test('an empty catalogue cannot start the retired synthetic music even with the legacy flag',async()=>{
 const f=fixture();try{f.setInside(true);f.player.configure({enabled:true,previewFallback:true,tracks:[]});await f.player.play();assert.equal(f.plays(),0);assert.equal(f.errors(),1);assert.equal(f.hasSyntheticMusic(),false);}finally{f.player.stop();}
});
