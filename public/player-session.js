/* Authentication is server-owned; only deliberate user activity renews it. */
(function(root){
 const LIMIT=5*60*60*1000,VISIT_IDLE=30*60*1000;
 function create({storage,request,now=Date.now,onExpire,onReturn=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
  let owner=null,last=0,lastSent=0,timer=null,pending=null,epoch=0,away=false,lastError=null,returning=false,visibility=0;
  const key=()=>`aved-visit-activity-v2:${owner}`;
  const read=()=>{try{const value=Number(storage.getItem(key()));return Number.isFinite(value)&&value>0&&value<=now()?Math.max(value,last):last;}catch{return last;}};
  const write=()=>{last=now();try{storage.setItem(key(),String(last));}catch{}};
  const stale=()=>!read()||now()-read()>=VISIT_IDLE;
  function stop(){epoch++;owner=null;clearTimer(timer);timer=null;pending=null;}
  function sync(activity=false,force=false){
   if(owner===null)return Promise.resolve();
   if(pending)return pending;
   if(activity&&!force&&now()-lastSent<30000)return Promise.resolve();
   const generation=epoch;lastError=null;
   if(activity)lastSent=now();
   const task=request(activity).then(data=>{
    if(generation!==epoch)return;
    clearTimer(timer);
    // Validity checks cannot renew a session in a hidden tab.
    timer=setTimer(()=>{void sync(false);},Math.max(1000,data.expiresAt-data.serverTime+50));
    return data;
   }).catch(error=>{
    if(generation!==epoch)return;
    lastError=error;
    if(error?.status===401&&error.code!=='INVALID_RESPONSE'){stop();onExpire();}
    else{clearTimer(timer);timer=setTimer(()=>{void sync(false);},30000);}
   }).finally(()=>{if(generation===epoch)pending=null;});
   pending=task;return task;
  }
  async function resume(){
   if(owner===null||!away||returning)return;
   returning=true;const view=visibility,generation=epoch,newVisit=stale();
   try{
    const data=await sync(true,true);
    if(!data||view!==visibility||generation!==epoch)return;
    away=false;write();if(newVisit)onReturn();
   }finally{returning=false;}
  }
  return {
   async start(id,{fresh=false,active=true}={}){
    stop();owner=String(id);last=0;lastSent=0;away=!active;
    const newVisit=fresh||stale();
    const data=await sync(active,true);if(!data)throw lastError||new Error('Session check interrupted');
    if(active)write();return {newVisit,session:data};
   },
   activity(){if(owner===null)return;if(away){void resume();return;}write();void sync(true);},
   leave(){visibility++;if(owner===null||away)return;write();away=true;void sync(true,true);},
   resume,
   check:()=>sync(false),stop,
   get active(){return owner!==null;}
  };
 }
 root.AVEDPlayerSession={create,LIMIT,VISIT_IDLE};
})(globalThis);
