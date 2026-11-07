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
 root.AVEDStartup={within,route,restoreSession};
})(globalThis);
