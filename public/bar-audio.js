/* Original preview music. Replace with supplied BGM files when available. */
window.AVEDBarClink=function(){
 const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
 const context=new C();context.resume().then(()=>{const now=context.currentTime;for(const [index,hz] of [1800,2650,3900].entries()){
  const wave=context.createOscillator(),gain=context.createGain();wave.type='sine';wave.frequency.value=hz;gain.gain.setValueAtTime(.035/(index+1),now);gain.gain.exponentialRampToValueAtTime(.0001,now+.3);wave.connect(gain);gain.connect(context.destination);wave.start(now);wave.stop(now+.32);
 }setTimeout(()=>context.close().catch(()=>{}),500);}).catch(()=>context.close().catch(()=>{}));
};
window.AVEDBarPreviewAudio=function(){
 let context=null,gain=null,playing=null,alive=false,last=-1,generation=0,volume=.35;const cache=new Map();
 function track(index){
  if(cache.has(index))return cache.get(index);const rate=22050,seconds=24,buffer=context.createBuffer(1,rate*seconds,rate),out=buffer.getChannelData(0),chords=[[57,60,64],[53,57,60],[50,53,57],[55,59,62]],melodies=[[0,4,7,11,7,4,2,4],[7,4,2,0,2,4,7,4],[4,7,11,14,11,7,4,2]],notes=melodies[index];
  const note=(midi,start,length,level)=>{const hz=440*2**((midi-69)/12),offset=Math.floor(start*rate),count=Math.min(Math.floor(length*rate),out.length-offset);for(let i=0;i<count;i++){const t=i/rate,envelope=Math.min(t/.025,1)*Math.exp(-t*3/length)*Math.min((length-t)/.06,1);out[offset+i]+=level*envelope*(Math.sin(2*Math.PI*hz*t)+.12*Math.sin(4*Math.PI*hz*t));}};
  for(let beat=0;beat<32;beat++){const time=beat*.75,chord=chords[Math.floor(beat/8)%4];if(beat%4===0){chord.forEach((n,i)=>note(n,time+i*.05,2.6,.07));note(chord[0]-24,time,2.8,.12);}if(beat%2===0)note(chord[0]+12+notes[(beat/2)%8],time,1,.065);}
  cache.set(index,buffer);return buffer;
 }
 function next(){if(!alive)return;const index=(last+1+Math.floor(Math.random()*2))%3;last=index;const node=context.createBufferSource();node.buffer=track(index);node.connect(gain);node.onended=()=>{if(playing===node&&alive)next();};playing=node;node.start();}
 return {volume(value){volume=Math.max(0,Math.min(1,value/100));if(gain)gain.gain.value=volume;},async play(){const ticket=++generation,C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Audio unavailable');context??=new C();if(!gain){gain=context.createGain();gain.connect(context.destination);}gain.gain.value=volume;await context.resume();if(ticket!==generation||alive)return;alive=true;next();},stop(){generation++;alive=false;if(playing){playing.onended=null;try{playing.stop();}catch{}playing.disconnect();playing=null;}context?.suspend().catch(()=>{});}};
};

/* Native audio URLs play directly, without routing remote hosts through Web Audio. */
window.AVEDBarAudio=function({onError=()=>{}}={}){
 const preview=AVEDBarPreviewAudio(),audio=new Audio();audio.preload='metadata';
 let settings={enabled:true,previewFallback:true,tracks:[]},key='',volume=.35,wanted=false,lastId=null,generation=0,timer=0;const failed=new Set();
 function reset(){generation++;clearTimeout(timer);audio.onended=audio.onerror=audio.oncanplay=null;audio.pause();audio.removeAttribute('src');audio.load();preview.stop();}
 function unavailable(){wanted=false;reset();onError();}
 function advance(){
  if(!wanted||!settings.enabled)return Promise.resolve();const choices=settings.tracks.filter(track=>!failed.has(track.id));if(!choices.length){unavailable();return Promise.resolve();}
  const different=choices.filter(track=>track.id!==lastId),pool=different.length?different:choices,track=pool[Math.floor(Math.random()*pool.length)],run=++generation;lastId=track.id;clearTimeout(timer);
  const skip=()=>{if(run!==generation||!wanted)return;failed.add(track.id);advance();};
  audio.onerror=skip;audio.onended=()=>{if(run===generation&&wanted){failed.clear();advance();}};audio.oncanplay=()=>{if(run===generation)clearTimeout(timer);};
  audio.src=track.url;audio.volume=volume;timer=setTimeout(skip,15000);
  return audio.play().catch(error=>{if(run!==generation)return;if(error.name==='NotAllowedError')unavailable();else skip();});
 }
 const controller={
  configure(value){const next=value&&typeof value==='object'?value:{enabled:true,previewFallback:true,tracks:[]},nextKey=JSON.stringify(next);if(nextKey===key)return;key=nextKey;const resume=wanted;reset();settings={enabled:next.enabled!==false,previewFallback:next.previewFallback!==false,tracks:Array.isArray(next.tracks)?next.tracks:[]};failed.clear();if(resume)controller.play().catch(unavailable);},
  volume(value){volume=Math.max(0,Math.min(1,value/100));audio.volume=volume;preview.volume(value);},
  async play(){wanted=true;if(!settings.enabled)return;if(settings.tracks.length)return advance();if(settings.previewFallback)return preview.play();},
  stop(){wanted=false;reset();}
 };return controller;
};
