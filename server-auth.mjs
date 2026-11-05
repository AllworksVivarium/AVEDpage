import {isIP} from 'node:net';

const normalize=address=>String(address||'').replace(/^::ffff:/,'');
export function networkContext(req, trustedAddresses=process.env.TRUST_PROXY_IPS||'') {
  const peer=normalize(req.socket.remoteAddress);
  const trusted=new Set(['127.0.0.1','::1',...trustedAddresses.split(',').map(s=>normalize(s.trim())).filter(Boolean)]);
  const proxy=trusted.has(peer);
  const forwarded=String(req.headers['x-real-ip']||'').trim();
  const address=proxy&&isIP(forwarded)?normalize(forwarded):peer;
  const secure=!!req.socket.encrypted||(proxy&&req.headers['x-forwarded-proto']==='https');
  return {address:address||'unknown',secure};
}
export function sessionTokens(header) {
  return [...new Set(String(header||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('wy_session=')).map(s=>s.slice(11)).filter(s=>/^[A-Za-z0-9_-]{40,100}$/.test(s)))].slice(0,12);
}
export function loginLimiter({clock=()=>Date.now(),windowMs=600000,limit=10}={}) {
  const failures=new Map();
  function current(key){const entry=failures.get(key);if(entry&&entry.until>clock())return entry;failures.delete(key);return {count:0,until:clock()+windowMs};}
  return {
    blocked(key){const entry=current(key);return entry.count>=limit?Math.max(1,Math.ceil((entry.until-clock())/1000)):0;},
    fail(key){if(failures.size>10000){for(const [k,v] of failures)if(v.until<=clock())failures.delete(k);if(failures.size>10000)failures.delete(failures.keys().next().value);}const entry=current(key);entry.count++;failures.set(key,entry);},
    clear(key){failures.delete(key);}
  };
}
