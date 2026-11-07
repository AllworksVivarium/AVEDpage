// Bound expensive password work and bursts without imposing a global player cap.
export function workGate({concurrency=2,maxWaiting=48}={}){
 let active=0;const waiting=[];
 return async task=>{
  if(active>=concurrency){
   if(waiting.length>=maxWaiting)throw Object.assign(Error('接入繁忙，请稍后重试。'),{status:503});
   await new Promise(resolve=>waiting.push(resolve));
  }else active++;
  try{return await task();}finally{const next=waiting.shift();if(next)next();else active--;}
 };
}
export function burstLimiter({limit=20,windowMs=1000,clock=Date.now,maxEntries=2000}={}){
 const entries=new Map();
 return key=>{
  const now=clock();let entry=entries.get(key);
  if(!entry||now>=entry.until){
   if(entries.size>=maxEntries){for(const [k,v] of entries)if(v.until<=now)entries.delete(k);if(entries.size>=maxEntries)entries.delete(entries.keys().next().value);}
   entry={count:0,until:now+windowMs};entries.set(key,entry);
  }
  return ++entry.count>limit?Math.max(1,Math.ceil((entry.until-now)/1000)):0;
 };
}
