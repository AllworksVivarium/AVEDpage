/* Bar sound effects and streamed music. */
window.AVEDBarSipSound=(()=>{
 let context=null;
 return function(warmup=false){
  try{if(localStorage.getItem('aved_sfx_v1')==='off')return;}catch{}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  try{context??=new C();context.resume().then(()=>{if(warmup)return;const now=context.currentTime;
   for(const [hz,volume] of [[620,.028],[930,.009]]){const wave=context.createOscillator(),gain=context.createGain();wave.type='sine';wave.frequency.setValueAtTime(hz,now);wave.frequency.exponentialRampToValueAtTime(hz*.88,now+.13);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.16);wave.connect(gain);gain.connect(window.AVEDWebSound?.output(context)||context.destination);wave.start(now);wave.stop(now+.18);wave.onended=()=>{wave.disconnect();gain.disconnect();};}
  }).catch(()=>{});}catch{}
 };
})();
window.AVEDBarClink=function(){
 const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
 const context=new C();context.resume().then(()=>{const now=context.currentTime;for(const [index,hz] of [1800,2650,3900].entries()){
  const wave=context.createOscillator(),gain=context.createGain();wave.type='sine';wave.frequency.value=hz;gain.gain.setValueAtTime(.035/(index+1),now);gain.gain.exponentialRampToValueAtTime(.0001,now+.3);wave.connect(gain);gain.connect(window.AVEDWebSound?.output(context)||context.destination);wave.start(now);wave.stop(now+.32);
 }setTimeout(()=>context.close().catch(()=>{}),500);}).catch(()=>context.close().catch(()=>{}));
};
/* Native audio URLs play directly, without routing remote hosts through Web Audio. */
window.AVEDBarAudio=function({onError=()=>{},canPlay=()=>true,onTrack=()=>{},getPreviewHost=()=>null}={}){
 const audio=new Audio();audio.preload='metadata';
 let settings={enabled:true,tracks:[]},key='',volume=.35,wanted=false,lastId=null,generation=0,timer=0,clockBase=0,clockAt=0,finishedRequest=null;const failed=new Set();let previewAudio=null,previewing=false;
 function reset(){generation++;clearTimeout(timer);audio.onended=audio.onerror=audio.oncanplay=audio.onloadedmetadata=null;audio.pause();audio.removeAttribute('src');audio.load();onTrack(null);}
 function unavailable(){wanted=false;reset();onError();}
 function advance(){
  if(previewing)return Promise.resolve();
  if(!wanted||!settings.enabled||!canPlay()){controller.stop();return Promise.resolve();}const choices=settings.tracks.filter(track=>!failed.has(track.id));if(!choices.length){unavailable();return Promise.resolve();}
  const time=clockBase+Date.now()-clockAt,request=settings.request&&settings.request.id!==finishedRequest&&settings.request.startsAt<=time&&settings.request.endsAt>time?settings.request:null,requested=request&&choices.find(t=>t.id===request.trackId),different=choices.filter(track=>track.id!==lastId),pool=different.length?different:choices,track=requested||pool[Math.floor(Math.random()*pool.length)],run=++generation;lastId=track.id;clearTimeout(timer);
  const skip=()=>{if(run!==generation||!wanted)return;failed.add(track.id);advance();};
  audio.onerror=skip;audio.onended=()=>{if(run===generation&&wanted){clearTimeout(timer);failed.clear();if(requested){finishedRequest=request.id;const remaining=request.endsAt-(clockBase+Date.now()-clockAt);if(remaining>0){timer=setTimeout(()=>{if(run===generation&&wanted)advance();},remaining+20);return;}}advance();}};audio.oncanplay=()=>{if(run!==generation)return;if(!canPlay()){controller.stop();return;}clearTimeout(timer);};audio.onloadedmetadata=()=>{if(run!==generation||!requested)return;const offset=Math.max(0,(clockBase+Date.now()-clockAt-request.startsAt)/1000);if(Number.isFinite(audio.duration)&&offset<audio.duration)audio.currentTime=offset;};
  audio.src=track.url;audio.volume=volume;timer=setTimeout(skip,15000);onTrack(track);
  return audio.play().catch(error=>{if(run!==generation)return;if(error.name==='NotAllowedError')unavailable();else skip();});
 }
 const controller={
  configure(value){const next=value&&typeof value==='object'?value:{enabled:true,tracks:[]};clockBase=Number(next.serverTime)||Date.now();clockAt=Date.now();const normalized={enabled:next.enabled!==false,tracks:Array.isArray(next.tracks)?next.tracks:[],request:next.request||null},nextKey=JSON.stringify(normalized);if(nextKey===key){if(!canPlay())controller.stop();return;}key=nextKey;const resume=wanted&&canPlay();reset();wanted=false;settings=normalized;failed.clear();if(resume)controller.play().catch(unavailable);},
  volume(value){volume=Math.max(0,Math.min(1,value/100));audio.volume=volume;if(previewAudio)previewAudio.volume=volume;},
  async play(){if(!canPlay()||!settings.enabled){controller.stop();return;}wanted=true;if(settings.tracks.length)return advance();unavailable();},
  async preview(track){
   if(!canPlay()||!track?.url)return;
   previewing=true;reset();
   if(previewAudio){previewAudio.pause();previewAudio.removeAttribute('src');previewAudio.load();previewAudio.remove?.();}
   const player=new Audio();previewAudio=player;player.preload='metadata';player.src=track.url;player.volume=volume;player.controls=true;player.setAttribute?.('data-bar-local-preview','');player.setAttribute?.('aria-label','本地播放 '+track.title);getPreviewHost()?.append(player);
   try{await player.play();}catch(error){if(previewAudio===player)controller.stopPreview();throw error;}
  },
  stopPreview({resume=true}={}){const wasPreviewing=previewing;previewing=false;if(previewAudio){previewAudio.pause();previewAudio.removeAttribute('src');previewAudio.load();previewAudio.remove?.();previewAudio=null;}if(wasPreviewing&&resume&&wanted&&canPlay())void advance();},
  stop(){wanted=false;controller.stopPreview({resume:false});reset();}
 };return controller;
};
