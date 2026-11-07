import {stat,readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import {pipeline} from 'node:stream/promises';

const compress=promisify(gzip);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};

// Small text assets share a bounded cache; large fonts/images are streamed.
// The design revision participates in the key so online text edits invalidate it.
export function installStatic({publicDir,design,maxBytes=16*1024*1024}) {
  const cache=new Map(),pending=new Map();let used=0;
  function retain(key,value){
    const bytes=value.data.length+(value.zipped?.length||0);
    if(bytes>maxBytes)return;
    while(used+bytes>maxBytes&&cache.size){const first=cache.keys().next().value;used-=cache.get(first).bytes;cache.delete(first);}
    cache.set(key,{...value,bytes});used+=bytes;
  }
  async function asset(file,path,info){
    const key=file+':'+info.mtimeMs+':'+info.size+':'+design.revision(file);
    if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit;}
    if(!pending.has(key))pending.set(key,(async()=>{
      const data=await design.render(file,await readFile(path));
      const value={data,etag:'W/"'+createHash('sha256').update(data).digest('hex')+'"',zipped:data.length>1024?await compress(data,{level:4}):null};
      retain(key,value);return value;
    })().finally(()=>pending.delete(key)));
    return pending.get(key);
  }
  return async function serve(req,res,file){
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    const path=resolve(publicDir,file);
    if(!path.startsWith(resolve(publicDir)+sep)){res.writeHead(404);res.end();return;}
    try{
      const info=await stat(path);if(!info.isFile())throw Error('not a file');
      const ext=extname(file),text=['.html','.css','.js','.json','.svg'].includes(ext);
      const value=text&&info.size<=1024*1024?await asset(file,path,info):null;
      const etag=value?.etag||`W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
      const headers={'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':/\.[a-f0-9]{12}\./.test(file)?'public, max-age=31536000, immutable':['.jpg','.jpeg','.png','.webp','.woff','.woff2','.ttf'].includes(ext)?'public, max-age=3600, stale-while-revalidate=86400':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff',...(value?{Vary:'Accept-Encoding'}:{})};
      if(String(req.headers['if-none-match']||'').split(/\s*,\s*/).some(x=>x==='*'||x.replace(/^W\//,'')===etag.replace(/^W\//,''))){res.writeHead(304,headers);res.end();return;}
      const acceptsGzip=String(req.headers['accept-encoding']||'').split(',').some(x=>/^gzip(?:\s*;|$)/i.test(x.trim())&&!/;\s*q=0(?:\.0*)?\s*$/i.test(x));
      const zipped=value?.zipped&&acceptsGzip,body=value&&(zipped?value.zipped:value.data);
      res.writeHead(200,{...headers,...(zipped?{'Content-Encoding':'gzip'}:{}),'Content-Length':body?body.length:info.size});
      if(req.method==='HEAD')res.end();else if(body)res.end(body);else await pipeline(createReadStream(path),res);
    }catch(error){if(res.headersSent){res.destroy();return;}res.writeHead(error.code==='EACCES'?403:404);res.end('Not found');}
  };
}
