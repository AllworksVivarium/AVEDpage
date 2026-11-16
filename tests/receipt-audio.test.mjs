import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const context=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval,Promise,Float32Array,AbortController});
for(const file of ['income-speech','receipt-audio'])vm.runInContext(readFileSync(new URL('../public/'+file+'.js',import.meta.url),'utf8'),context);
const {sequence,stitch,create}=context.AVEDReceiptAudio;

test('recorded phrases contain a neutral prefix and valid clips for small and large amounts',()=>{
 for(const amount of [1,10,101,2000,10001,100000001,1000000000000,Number.MAX_SAFE_INTEGER]){
  const names=Array.from(sequence(amount));assert.equal(names[0],'arrived');assert.match(names.at(-1),/^clip-/);
  for(const name of names){assert.ok(existsSync(new URL('../public/assets/income-voice/receipt-v2/'+name+'.mp3',import.meta.url)));assert.doesNotMatch(name,/9001|success|prefix|chime|wx|ali/);}
 }
 assert.throws(()=>sequence(-1));
 assert.deepEqual(Array.from(sequence(110)),['arrived','clip-113','clip-1302','clip-112','clip-1237']);
 assert.deepEqual(Array.from(sequence(10000)),['arrived','clip-9003']);
});
test('joining removes long silences, keeps a final tail and avoids a hard splice',()=>{
 const part=()=>Float32Array.from([...Array(100).fill(0),...Array(100).fill(.4),...Array(100).fill(0)]);
 const audio=stitch([part(),part()],1000);
 assert.equal(audio.length,253);assert.equal(audio[0],0);assert.equal(audio.at(-1),0);
 assert.ok(Array.from(audio).every(x=>Number.isFinite(x)&&Math.abs(x)<=.4+.000001));
 assert.equal(stitch([new Float32Array(100)],1000).length,0);
});
test('cancelling while clips load prevents stale playback and reuses decoded clips',async()=>{
 let resolveFetch,starts=0,fetches=0;
 const fetchWait=new Promise(resolve=>{resolveFetch=resolve;});
 const buffer={getChannelData:()=>Float32Array.from([0,.5,.5,0])};
 class AudioContext{
  state='running';sampleRate=24000;destination={};
  resume(){return Promise.resolve();}decodeAudioData(){return Promise.resolve(buffer);}
  createBuffer(){return {copyToChannel(){},duration:.01};}createGain(){return {gain:{},connect(){},disconnect(){}};}
  createBufferSource(){return {connect(){},disconnect(){},playbackRate:{},start(){starts++;},stop(){}};}
  close(){return Promise.resolve();}
 }
 const player=create({AudioContext,fetcher:async()=>{fetches++;await fetchWait;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};}});
 const stale=player.speak(11);await new Promise(r=>setImmediate(r));player.cancel();resolveFetch();await stale;
 assert.equal(starts,0);assert.equal(fetches,4);
 const next=player.speak(11);await new Promise(r=>setImmediate(r));assert.equal(starts,1);assert.equal(fetches,4);
 player.cancel();await next;player.close();
});
test('controller migrates a saved device voice to the single recorded voice',async()=>{
 const amounts=[],events=new Map();let cancels=0;
 const recorded={available:true,unlock:async()=>{},speak:async n=>{amounts.push(n);},cancel:()=>{cancels++;},close(){}};
 const controller=context.AVEDIncomeSpeech.create({recorded,api:async()=>({cursor:0,items:[]}),getUser:()=>null,storage:{getItem:()=>JSON.stringify({voice:'old-device-voice',volume:.5})},doc:{hidden:false,addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)}});
 try{assert.equal('voice' in controller.settings(),false);assert.equal(await controller.preview(),true);assert.deepEqual(amounts,[110]);assert.equal(controller.status().ready,true);
  const before=cancels;controller.clear();assert.ok(cancels>before);
 }finally{controller.close();}
});

test('receipt speech starts 200 ms after the coin and overlap stays within audio range',()=>{
 const rate=1000,chime=new Float32Array(2000).fill(.8),voice=new Float32Array(1000).fill(.9);
 const audio=context.AVEDReceiptAudio.mixReceipt(chime,voice,rate);
 assert.ok(audio[200]>audio[199]+.5,'speech overlaps the coin tail at 200 ms');
 assert.ok(Array.from(audio).every(x=>Number.isFinite(x)&&Math.abs(x)<=1));
 const voiceOnly=context.AVEDReceiptAudio.mixReceipt(new Float32Array(2000),voice,rate);
 assert.equal(voiceOnly[199],0);assert.ok(voiceOnly[200]>.8);
});
