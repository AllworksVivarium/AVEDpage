import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('background visibility leaves the current recording intact; next songs and private playback remain available until leaving the bar',async()=>{
 const source=readFileSync(new URL('../public/bar-ui.js',import.meta.url),'utf8'),listeners={},audio=[];
 class Audio{constructor(){audio.push(this);this.plays=0;}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}play(){this.paused=false;this.plays++;return Promise.resolve();}}
 const context=vm.createContext({Audio,setTimeout,clearTimeout,open:true,muted:false,root:{hidden:false},location:{hash:'#/bar'},document:{hidden:false,addEventListener:(event,fn)=>listeners[event]=fn},paintMusic(){}});
 context.window=context;context.addEventListener=(event,fn)=>listeners[event]=fn;
 vm.runInContext(readFileSync(new URL('../public/bar-audio.js',import.meta.url),'utf8'),context);
 const gate=source.match(/const mayPlayMusic=\(\)=>[^;]+;/)?.[0];assert.ok(gate);
 vm.runInContext(gate+'const music=AVEDBarAudio({canPlay:mayPlayMusic});globalThis.player=music;',context);
 const start=source.indexOf(' function syncMusic()'),end=source.indexOf(' const sceneObserver=',start);assert.ok(start>=0&&end>start);
 vm.runInContext(source.slice(start,end),context);
 const player=context.player;try{
  player.configure({enabled:true,tracks:[{id:1,url:'/one.mp3'},{id:2,url:'/two.mp3'}]});await player.play();const first=audio[0].src;
  context.document.hidden=true;listeners.visibilitychange?.();assert.equal(audio[0].paused,false);assert.equal(audio[0].plays,1);assert.equal(audio[0].src,first);
  audio[0].onended();assert.equal(audio[0].plays,2);assert.notEqual(audio[0].src,first,'the next recording must start while the page is in the background');
  await player.preview({id:3,url:'/private.mp3'});assert.equal(audio[1].paused,false);
  context.document.hidden=false;listeners.visibilitychange?.();assert.equal(audio[1].paused,false);assert.equal(audio[1].plays,1,'returning to the tab must not restart private playback');
  context.location.hash='#/profile';listeners.hashchange();assert.equal(audio[0].paused,true);assert.equal(audio[1].paused,true);
  context.location.hash='#/bar';context.root.hidden=true;await player.play();assert.equal(audio[0].plays,2,'a closed bar cannot restart playback');
 }finally{player.stop();}
});
