import {randomBytes} from 'node:crypto';

export const MAX_INPUT_COMPENSATION_MS=250;
export const INPUT_REVEAL_GRACE_MS=300;

// No client timestamps. A server nonce measures the server->client->server trip.
// Retain the recent minimum, so a stalled acknowledgement cannot enlarge an
// established allowance. All allowances are bounded even on a first sample.
export function createInputTiming({clock=()=>Date.now()}={}){
 const probes=new Map(),samples=new Map();
 function prune(){const now=clock();for(const [id,p] of probes)if(now-p.at>120000)probes.delete(id);for(const [id,s] of samples)if(!s.some(p=>now-p.at<120000))samples.delete(id);while(probes.size>=2048)probes.delete(probes.keys().next().value);while(samples.size>=2048)samples.delete(samples.keys().next().value);}
 function issue(id,round){const now=clock(),old=probes.get(id);if(old?.round===round&&old.measured!==null)return null;if(old?.round===round&&now-old.at<6000)return {token:old.token};prune();const p={round,at:now,token:randomBytes(16).toString('hex'),measured:null};probes.set(id,p);return {token:p.token};}
 function allowance(id,at=clock()){const recent=(samples.get(id)||[]).filter(p=>at-p.at<120000);return recent.length?Math.min(MAX_INPUT_COMPENSATION_MS,Math.floor(Math.min(...recent.map(p=>p.rtt))/2)):0;}
 function acknowledge(id,round,token){const now=clock(),probe=probes.get(id);if(!probe||probe.round!==round||probe.token!==token||now-probe.at>6000)throw Error('校时请求已失效。');if(probe.measured===null){const rtt=Math.max(0,now-probe.at);probe.measured=rtt;const recent=(samples.get(id)||[]).filter(p=>now-p.at<120000).slice(-4);recent.push({at:now,rtt});samples.set(id,recent);}return {round,compensationMs:allowance(id,now),serverTime:now};}
 const effectiveAt=(id,receivedAt,departAt)=>Math.max(departAt,receivedAt-allowance(id,receivedAt));
 return {issue,acknowledge,allowance,effectiveAt,clear(){probes.clear();samples.clear();}};
}
