/* Nonessential resources must never hold the login screen indefinitely. */
(function(root){
 function within(task,ms,fallback){return new Promise((resolve,reject)=>{
  let done=false;const timer=setTimeout(()=>{if(done)return;done=true;try{resolve(fallback());}catch(e){reject(e);}},ms);
  Promise.resolve(task).then(value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);},error=>{if(done)return;done=true;clearTimeout(timer);reject(error);});
 });}
 const gamePaths=Object.freeze({home:'#/casino',skydive:'#/casino/skydive',slots:'#/casino/slots',scratch:'#/casino/scratch',derby:'#/casino/derby',doudizhu:'#/casino/doutailao',stocks:'#/casino/stocks'});
 function gamePath(game){return Object.hasOwn(gamePaths,game)?gamePaths[game]:null;}
 function resolveRoute(hash,allowed){
  const value=String(hash||'').replace(/^#\/?/,'');
  const dossier=value.match(/^containment\/(\d+)(?:\?page=(\d+))?$/);
  if(allowed.includes('containment')&&dossier)return {page:'containment',game:null,dossierId:Number(dossier[1]),dossierPage:Math.max(0,Math.min(999,Number(dossier[2]||1)-1)),hash:'#/'+value};
  if(allowed.includes('casino')&&(value==='casino'||value.startsWith('casino/'))){
   const child=value.slice(7),game=Object.keys(gamePaths).find(key=>gamePaths[key]==='#/casino/'+child)||'home';
   return {page:'casino',game,hash:gamePath(game)};
  }
  const page=allowed.includes(value)?value:'profile';
  return {page,game:null,hash:'#/'+page};
 }
 function route(hash,allowed){return resolveRoute(hash,allowed).page;}
 async function restoreSession({load,enter,signedOut,unavailable}){
  try{await enter(await load());return 'ready';}
  catch(error){
   // A broken response or temporary outage does not prove that the session ended.
   if(error?.status===401&&error.code!=='INVALID_RESPONSE'){await signedOut(error);return 'landing';}
   await unavailable(error);return 'checking';
  }
 }
 function imageAsset(url,timeoutMs){return new Promise(resolve=>{
  const image=new Image();let done=false;
  function finish(ok){if(done)return;done=true;clearTimeout(timer);image.onload=image.onerror=null;resolve(ok);}
  const timer=setTimeout(()=>finish(false),timeoutMs);
  image.decoding='async';image.onload=()=>Promise.resolve(image.decode?.()).then(()=>finish(true),()=>finish(image.naturalWidth>0));image.onerror=()=>finish(false);image.src=url;
 });}
 async function fontAsset(spec,timeoutMs){
  if(!root.document?.fonts?.load)return false;
  try{return await within(root.document.fonts.load(spec,'AVED 0123456789'),timeoutMs,()=>[]).then(faces=>faces.length>0);}catch{return false;}
 }
 function assetCache({urls,fonts=[],storage,load=imageAsset,loadFont=fontAsset,clock=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),deadlineMs=4500,coldMinMs=1600,onProgress=()=>{}}={}){
  if(storage===undefined)try{storage=root.localStorage;}catch{storage=null;}
  const assets=[...new Set(urls||[])].filter(url=>typeof url==='string'&&url.startsWith('/assets/'));
  const fontSpecs=[...new Set(fonts)].filter(spec=>typeof spec==='string'&&spec.length<120);
  const tasks=[...assets.map(url=>ms=>load(url,ms)),...fontSpecs.map(spec=>ms=>loadFont(spec,ms))];
  const key='aved_ui_art_ready_v1',version=[...assets,...fontSpecs].join('|');let pending=null,ready=false;
  function cached(){if(ready)return true;try{return !!tasks.length&&storage?.getItem(key)===version;}catch{return false;}}
  function prepare(){
   if(pending)return pending;if(ready){onProgress({completed:tasks.length,total:tasks.length});return Promise.resolve({cached:true,complete:true});}
   const warm=cached();
   pending=(async()=>{
    const end=clock()+deadlineMs;let cursor=0,completed=0,complete=tasks.length>0;
    onProgress({completed,total:tasks.length});
    async function worker(){while(cursor<tasks.length){const task=tasks[cursor++],remaining=end-clock();if(remaining<=0){complete=false;continue;}try{if(!await within(task(Math.min(1800,remaining)),remaining,()=>false))complete=false;}catch{complete=false;}finally{onProgress({completed:++completed,total:tasks.length});}}}
    await Promise.all([Promise.all(Array.from({length:Math.min(3,tasks.length)},worker)),warm?Promise.resolve():delay(coldMinMs)]);
    if(complete){ready=true;try{storage?.setItem(key,version);}catch{}}
    else {try{storage?.removeItem(key);}catch{}}
    return {cached:warm,complete};
   })().finally(()=>{pending=null;});return pending;
  }
  return {get cached(){return cached();},prepare};
 }
 root.AVEDStartup={within,route,resolveRoute,gamePath,restoreSession,assetCache};
})(globalThis);
