(function(root){
 const KEY='aved_income_speech_v1',modes=['merge','queue','interrupt'];
 const defaults={enabled:false,mode:'merge',volume:.8};
 function amountText(amount){
  if(!Number.isSafeInteger(amount)||amount<=0)return '';
  const digits='零一二三四五六七八九',units=['','十','百','千'],groups=['','万','亿','万亿'];
  let value=amount,result='',zero=false,index=0;
  while(value){
   const group=value%10000;value=Math.floor(value/10000);
   if(group){let part='',lastZero=false;
    for(let p=3;p>=0;p--){const digit=Math.floor(group/10**p)%10;if(digit){if(lastZero)part+='零';part+=digits[digit]+units[p];lastZero=false;}else if(part)lastZero=true;}
    result=part+groups[index]+(result&&zero?'零':'')+result;
    // A lower group below 1000 needs a zero between the two group names.
    zero=group<1000;
   }else if(result)zero=true;
   index++;
  }
  return result.replace(/^一十/,'十');
 }
 function createQueue({speak,cancel,schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id),onError=()=>{},allowed=()=>true}){
  let items=[],current=null,serial=0,timer=null,mode='merge',enabled=false;
  function clear(){serial++;items=[];current=null;if(timer!==null)unschedule(timer);timer=null;cancel();}
  function drain(){timer=null;if(!enabled||current||!items.length)return;if(!allowed()){timer=schedule(drain,250);return;}
   const amount=items.shift(),token=++serial;current=amount;
   Promise.resolve().then(()=>{if(token===serial)return speak('到账'+amountText(amount)+'元',amount);}).catch(error=>{if(token===serial){items=[];onError(error);}}).finally(()=>{if(token!==serial)return;current=null;if(items.length)timer=schedule(drain,80);});
  }
  return {
   configure(next){if(next.mode!==mode||next.enabled!==enabled)clear();mode=next.mode;enabled=next.enabled;},
   add(amount){if(!enabled||!Number.isSafeInteger(amount)||amount<=0)return;
    if(mode==='interrupt'){clear();items=[amount];timer=schedule(drain,60);return;}
    if(mode==='merge'&&items.length&&Number.isSafeInteger(items[0]+amount))items[0]+=amount;
    else if(items.length<100)items.push(amount);
    else if(Number.isSafeInteger(items.at(-1)+amount))items[items.length-1]+=amount;
    if(!current&&timer===null)timer=schedule(drain,mode==='merge'?150:0);
   },wake(){if(timer!==null)unschedule(timer);timer=null;drain();},clear,
   state:()=>({items:[...items],current})
  };
 }
 function create({api,getUser,canSpeak=()=>true,recorded=root.AVEDReceiptAudio?.create(),storage,doc=root.document}){
  if(storage===undefined)try{storage=root.localStorage;}catch{storage=null;}
  let saved={};try{saved=JSON.parse(storage.getItem(KEY)||'{}')||{};}catch{}
  let settings={...defaults,...Object.fromEntries(Object.entries(saved).filter(([key])=>key in defaults))};
  settings.enabled=settings.enabled===true;if(!modes.includes(settings.mode))settings.mode='merge';settings.volume=Math.min(1,Math.max(0,Number(settings.volume)||0));
  let ready=false,activated=false,error='',owner=null,cursor=null,busy=false,pollTimer=null,version=0,lastPoll=0,seedAfterFlight=false,repoll=false;
  const seen=new Set();
  const listeners=new Set(),notify=()=>listeners.forEach(fn=>fn());
  function stopEngine(){recorded?.cancel();}
  function speak(text,amount){return recorded.speak(amount,settings.volume);}
  const queue=createQueue({speak,cancel:stopEngine,allowed:()=>active()&&canSpeak(),onError:e=>{error=e.message||'语音播放失败，请点击试听重试。';activated=false;notify();}});
  function configureQueue(){queue.configure({...settings,enabled:settings.enabled&&activated&&ready});}
  async function initialize(){ready=!!recorded?.available;error=ready?'':'请使用支持音频播放的浏览器。';configureQueue();notify();return ready;}
  function unlock(){return recorded?.unlock()||Promise.reject(Error('请使用支持音频播放的浏览器。'));}
  function setSession(id,initialCursor=null){if(owner===id)return;owner=id;cursor=Number.isSafeInteger(initialCursor)?initialCursor:null;version++;seen.clear();queue.clear();if(settings.enabled)requestPoll();}
  function active(){return settings.enabled&&activated&&ready&&!doc.hidden&&!!getUser()?.id&&getUser().id===owner;}
  async function poll(){pollTimer=null;if(!active())return;if(busy){repoll=true;return;}busy=true;const id=owner,token=version;
   try{const seeded=cursor!==null,data=await api('/api/player/income-events'+(seeded?'?after='+cursor:''),{retries:0});if(token!==version||id!==getUser()?.id||!settings.enabled)return;
    const after=cursor;
    if(!Number.isSafeInteger(data.cursor)||data.cursor<0)return;
    cursor=seeded?Math.max(after,data.cursor):data.cursor;
    if(seeded&&active()){
     const enqueue=()=>{
      if(token!==version||id!==owner||!active())return;
      const key=KEY+':receipts:'+id;let shared=[];
      try{const saved=JSON.parse(storage?.getItem(key)||'[]');if(Array.isArray(saved))shared=saved.filter(Number.isSafeInteger);}catch{}
      const claimed=new Set(shared);
      for(const row of data.items||[]){
       if(!Number.isSafeInteger(row.id)||row.id<=after||row.id>cursor||!Number.isSafeInteger(row.amount)||row.amount<=0||seen.has(row.id)||claimed.has(row.id))continue;
       seen.add(row.id);claimed.add(row.id);shared.push(row.id);
       try{storage?.setItem(key,JSON.stringify(shared.slice(-200)));}catch{}
       queue.add(row.amount);
      }
      if(seen.size>200)for(const entry of [...seen].slice(0,seen.size-200))seen.delete(entry);
     };
     if(root.navigator?.locks?.request)await root.navigator.locks.request('aved-income-receipts:'+id,enqueue);else enqueue();
    }
    if(data.more)requestPoll(250);
   }catch{}finally{busy=false;lastPoll=Date.now();if(seedAfterFlight){seedAfterFlight=false;cursor=null;requestPoll();}else if(repoll){repoll=false;requestPoll(0);}}
  }
  function requestPoll(delay=100){if(!active())return;if(pollTimer!==null){if(delay>0)return;clearTimeout(pollTimer);}pollTimer=setTimeout(poll,delay);}
  async function update(next){
   const wasEnabled=settings.enabled;settings={...settings,...Object.fromEntries(Object.entries(next).filter(([key])=>key in defaults))};settings.enabled=settings.enabled===true;if(!modes.includes(settings.mode))settings.mode='merge';settings.volume=Math.min(1,Math.max(0,Number(settings.volume)||0));
   try{storage.setItem(KEY,JSON.stringify(settings));}catch{}
   if(settings.enabled!==wasEnabled){version++;queue.clear();cursor=null;if(busy)seedAfterFlight=true;}
   configureQueue();notify();
   if(settings.enabled){const unlocked=unlock();try{await unlocked;activated=await initialize();}catch(e){error=e.message;activated=false;notify();}configureQueue();requestPoll(0);}
   else{clearTimeout(pollTimer);pollTimer=null;}
  }
  async function preview(){queue.clear();const unlocked=unlock();try{await unlocked;activated=true;if(!await initialize())return false;error='';configureQueue();await speak('到账一百一十元',110);notify();requestPoll();return true;}catch(e){error=e.message;activated=false;configureQueue();notify();return false;}}
  function gesture(){if(!settings.enabled||activated)return;unlock().then(async()=>{activated=await initialize();configureQueue();requestPoll();}).catch(e=>{error=e.message;notify();});}
  doc.addEventListener('pointerdown',gesture);doc.addEventListener('keydown',gesture);
  const visibility=()=>{if(doc.hidden)queue.clear();else requestPoll();};doc.addEventListener('visibilitychange',visibility);
  const timer=setInterval(()=>{const id=getUser()?.id??null;if(id!==owner)setSession(id);if(!canSpeak())return;configureQueue();if(active()&&Date.now()-lastPoll>=15000)requestPoll();},1000);
  if(settings.enabled)initialize();
  return {settings:()=>({...settings}),status:()=>({ready,activated,error}),update,preview,
   subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},prepare:initialize,setSession,
   changed(){if(canSpeak()){queue.wake();requestPoll(0);}},clear(){queue.clear();},
   close(){clearInterval(timer);clearTimeout(pollTimer);queue.clear();recorded?.close();doc.removeEventListener('pointerdown',gesture);doc.removeEventListener('keydown',gesture);doc.removeEventListener('visibilitychange',visibility);}
  };
 }
 root.AVEDIncomeSpeech={create,createQueue,amountText};
})(globalThis);
