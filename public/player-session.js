/* User activity only: polling requests never extend the idle period. */
(function(root){
 const LIMIT=2*60*60*1000,KEY='aved_last_activity_v1';
 function create({storage,now=Date.now,onExpire,setTimer=setTimeout,clearTimer=clearTimeout}){
  let timer,last=0,enabled=false,expired=false;
  const read=()=>{try{return Number(storage.getItem(KEY))||0}catch{return last}};
  const write=value=>{last=value;try{storage.setItem(KEY,String(value))}catch{}};
  function check(){if(!enabled||expired)return;const remaining=LIMIT-(now()-(read()||last));if(remaining<=0){expired=true;enabled=false;clearTimer(timer);onExpire();return;}clearTimer(timer);timer=setTimer(check,Math.min(remaining,30000));}
  return {stale:()=>{const stamp=read();return !!stamp&&now()-stamp>=LIMIT},start(fresh=false){enabled=true;expired=false;if(fresh||!read())write(now());else last=read();check();},activity(){if(!enabled)return;check();if(!enabled)return;if(now()-(read()||last)>10000)write(now());},check,stop(){enabled=false;clearTimer(timer);}};
 }
 root.AVEDPlayerSession={create,LIMIT};
})(globalThis);
