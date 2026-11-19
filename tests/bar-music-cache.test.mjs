import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installBarMusic} from '../server-bar-music.mjs';

test('uploaded music reuses a private week-long cache and validates full and partial audio',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'aved-music-cache-')),db=new DatabaseSync(':memory:');
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const authenticated=(req,res)=>{if(req.headers.cookie==='session=test')return true;send(res,401,{error:'Login required'});return false;};
 const music=installBarMusic({db,send,readBody:async()=>({}),requireEmployee:authenticated,requireAdmin:authenticated,dataDir:directory});
 mkdirSync(join(directory,'bar-music'));
 const bytes=Buffer.from('ID3 music cache fixture'),file='fixture.mp3';
 writeFileSync(join(directory,'bar-music',file),bytes);
 db.prepare('INSERT INTO bar_music(id,title,file_name,mime,byte_size) VALUES(1,?,?,?,?)').run('Track',file,'audio/mpeg',bytes.length);
 const server=createServer((req,res)=>{music.handle(req,res,new URL(req.url,'http://localhost')).then(handled=>{if(!handled)send(res,404,{});});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();rmSync(directory,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port+'/api/player/bar-music/files/1';
 const get=(headers={},method='GET')=>fetch(url,{method,headers:{cookie:'session=test',...headers}});
 const full=await get(),etag=full.headers.get('etag');
 assert.equal(full.status,200);assert.equal(full.headers.get('cache-control'),'private, max-age=604800');
 assert.match(etag,/^"[a-f0-9]{64}"$/);assert.equal(full.headers.get('accept-ranges'),'bytes');
 assert.deepEqual(Buffer.from(await full.arrayBuffer()),bytes);
 for(const value of [etag,'W/'+etag,'"older", '+etag,'*']){
  const cached=await get({'if-none-match':value});assert.equal(cached.status,304);assert.equal(await cached.text(),'');assert.equal(cached.headers.get('etag'),etag);
 }
 const stale=await get({'if-none-match':'"older"'});assert.equal(stale.status,200);await stale.arrayBuffer();
 const partial=await get({range:'bytes=4-8','if-range':etag});
 assert.equal(partial.status,206);assert.equal(partial.headers.get('etag'),etag);assert.equal(partial.headers.get('content-range'),`bytes 4-8/${bytes.length}`);
 assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(4,9));
 for(const value of ['"older"','W/'+etag]){
  const replaced=await get({range:'bytes=4-8','if-range':value});assert.equal(replaced.status,200);assert.deepEqual(Buffer.from(await replaced.arrayBuffer()),bytes);
 }
 const head=await get({range:'bytes=4-8'},'HEAD');assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal(head.headers.get('etag'),etag);assert.equal(await head.text(),'');
 const invalid=await get({range:'bytes=999-'});assert.equal(invalid.status,416);await invalid.arrayBuffer();
 const denied=await get({cookie:'','if-none-match':etag});assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'no-store');await denied.arrayBuffer();
 db.prepare('UPDATE bar_music SET title=? WHERE id=1').run('Renamed');
 assert.equal((await get({'if-none-match':etag})).status,304);
 const replacement=Buffer.from('ID3 different and longer music fixture');writeFileSync(join(directory,'bar-music',file),replacement);
 const changed=await get({'if-none-match':etag});assert.equal(changed.status,200);assert.notEqual(changed.headers.get('etag'),etag);assert.deepEqual(Buffer.from(await changed.arrayBuffer()),replacement);
});
