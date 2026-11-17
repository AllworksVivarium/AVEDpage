import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){
 let inside=false,errors=0,plays=0,stops=0;const media=[];
 class Audio{constructor(){media.push(this);}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}play(){this.paused=false;plays++;return Promise.resolve();}}
 const scope=vm.createContext({Audio,setTimeout,clearTimeout});scope.window=scope;vm.runInContext(readFileSync(new URL('../public/bar-audio.js',import.meta.url),'utf8'),scope);
 scope.AVEDBarPreviewAudio=()=>({volume(){},play(){plays++;return Promise.resolve();},stop(){stops++;}});
 const player=scope.AVEDBarAudio({canPlay:()=>inside,onError:()=>errors++});
 return {player,media,setInside:value=>inside=value,plays:()=>plays,stops:()=>stops,errors:()=>errors};
}
test('bar music remains silent outside the room, including when a playlist refresh arrives',async()=>{
 const f=fixture();try{
  f.player.configure({enabled:true,previewFallback:true,tracks:[]});await f.player.play();assert.equal(f.plays(),0);
  f.setInside(true);await f.player.play();assert.equal(f.plays(),1);
  f.setInside(false);f.player.configure({enabled:true,previewFallback:false,tracks:[{id:1,url:'/music.mp3'}]});assert.equal(f.plays(),1);assert.ok(f.media[0].paused);
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
  f.setInside(true);await f.player.play();f.player.configure({enabled:false,tracks:[]});assert.equal(f.plays(),1);
  f.player.configure({enabled:true,tracks:[]});assert.equal(f.plays(),1);await f.player.play();assert.equal(f.plays(),2);
 }finally{f.player.stop();}
});
test('requested music seeks to shared progress and heartbeat updates do not restart it or override mute',async()=>{
 const f=fixture();try{
  const now=Date.now(),request={id:'request-a',trackId:2,startsAt:now-20000,endsAt:now+60000},settings={enabled:true,tracks:[{id:1,url:'/one.mp3'},{id:2,url:'/two.mp3'}],request,serverTime:now};
  f.setInside(true);f.player.configure(settings);await f.player.play();assert.equal(f.media[0].src,'/two.mp3');f.media[0].duration=180;f.media[0].onloadedmetadata();assert.ok(f.media[0].currentTime>=20&&f.media[0].currentTime<21);
  f.player.configure({...settings,serverTime:now+1000});assert.equal(f.plays(),1);f.player.stop();f.player.configure({...settings,request:{...request,id:'request-b'}});assert.equal(f.plays(),1);
 }finally{f.player.stop();}
});
