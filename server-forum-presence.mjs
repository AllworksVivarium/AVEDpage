import {createHmac,randomBytes} from 'node:crypto';
const secret=process.env.SESSION_SECRET||randomBytes(32);
export const presenceKey=(id,scope='anonymous')=>Number.isSafeInteger(Number(id))&&Number(id)>0?createHmac('sha256',secret).update(scope+':'+id).digest('hex').slice(0,24):'';
export const presenceLifetime=75000;
const activities=new Set(['forum','cards','sky','derby','stocks','slot','scratch','profile','news','departments','containment','life','home']);

// Ephemeral public activity only. No history, balance, IP address or database writes.
export function createForumPresence({clock=Date.now}={}){
 const people=new Map();
 function prune(now){for(const [key,tabs] of people){for(const [tab,state] of tabs)if(now-state.at>=presenceLifetime)tabs.delete(tab);if(!tabs.size)people.delete(key);}}
 return {sync(id,body={}){
  const {tab,activity,active,authors=[]}=body;
  if(typeof tab!=='string'||!/^[a-zA-Z0-9_-]{8,64}$/.test(tab)||typeof active!=='boolean'||!activities.has(activity)||!Array.isArray(authors)||authors.length>64||authors.some(key=>typeof key!=='string'||!/^[a-f0-9]{24}$/.test(key)))throw Error('无效的论坛在线状态。');
  const now=clock();prune(now);const keys=['anonymous','real'].map(scope=>presenceKey(id,scope));
  let tabs=people.get(keys[0])||people.get(keys[1]);
  if(active){if(!tabs){while(people.size>510)people.delete(people.keys().next().value);tabs=new Map();}for(const key of keys)people.set(key,tabs);tabs.delete(tab);tabs.set(tab,{activity,at:now});if(tabs.size>8)tabs.delete(tabs.keys().next().value);}
  else if(tabs){tabs.delete(tab);if(!tabs.size)for(const key of keys)people.delete(key);}
  return {ttl:presenceLifetime,items:[...new Set(authors)].map(key=>{const tabs=people.get(key),state=tabs?.size?[...tabs.values()].at(-1):null;return {key,online:!!state,activity:state?.activity||'',expiresIn:state?presenceLifetime-(now-state.at):0};})};
 }};
}
