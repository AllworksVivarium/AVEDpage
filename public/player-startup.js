/* Nonessential resources must never hold the login screen indefinitely. */
(function(root){
 function within(task,ms,fallback){return new Promise((resolve,reject)=>{
  let done=false;const timer=setTimeout(()=>{if(done)return;done=true;try{resolve(fallback());}catch(e){reject(e);}},ms);
  Promise.resolve(task).then(value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);},error=>{if(done)return;done=true;clearTimeout(timer);reject(error);});
 });}
 function route(hash,allowed){const value=String(hash||'').replace(/^#\/?/,'');return allowed.includes(value)?value:'profile';}
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
 function assetCache({urls,storage,load=imageAsset,clock=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),deadlineMs=4500,coldMinMs=1600}={}){
  if(storage===undefined)try{storage=root.localStorage;}catch{storage=null;}
  const assets=[...new Set(urls||[])].filter(url=>typeof url==='string'&&url.startsWith('/assets/'));
  const key='aved_ui_art_ready_v1',version=assets.join('|');let pending=null,ready=false;
  function cached(){if(ready)return true;try{return !!assets.length&&storage?.getItem(key)===version;}catch{return false;}}
  function prepare(){
   if(pending)return pending;if(ready)return Promise.resolve({cached:true,complete:true});
   const warm=cached();
   pending=(async()=>{
    const end=clock()+deadlineMs;let cursor=0,complete=assets.length>0;
    async function worker(){while(cursor<assets.length){const url=assets[cursor++],remaining=end-clock();if(remaining<=0){complete=false;continue;}try{if(!await within(load(url,Math.min(1800,remaining)),remaining,()=>false))complete=false;}catch{complete=false;}}}
    await Promise.all([Promise.all(Array.from({length:Math.min(3,assets.length)},worker)),warm?Promise.resolve():delay(coldMinMs)]);
    if(complete){ready=true;try{storage?.setItem(key,version);}catch{}}
    else {try{storage?.removeItem(key);}catch{}}
    return {cached:warm,complete};
   })().finally(()=>{pending=null;});return pending;
  }
  return {get cached(){return cached();},prepare};
 }
 root.AVEDStartup={within,route,restoreSession,assetCache};
})(globalThis);
