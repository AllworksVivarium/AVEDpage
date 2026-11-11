import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync,statSync,createReadStream} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';

const formats={'.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.wav':'audio/wav'};
function audioUrl(value){
 if(typeof value!=='string'||value.length>2048)throw Error('请填写 HTTPS 音频直链。');let url;try{url=new URL(value.trim());}catch{throw Error('请填写有效音频链接。');}
 if(url.protocol!=='https:'||url.username||url.password)throw Error('音频直链须使用 HTTPS，且不能包含账号密码。');
 if(/(^|\.)(spotify\.com|spotify\.link|music\.163\.com|163cn\.tv|y\.music\.163\.com)$/.test(url.hostname))throw Error('这是音乐平台页面链接。请上传音频文件，或使用 HTTPS 音频直链。');
 if(/\.(html?|php|aspx?)$/i.test(url.pathname))throw Error('这个链接指向网页，请改用音频文件链接。');return url.href;
}
const title=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>100)throw Error('请填写曲名，最多 100 字。');return value.trim();};
export function installBarMusic({db,send,readBody,requireEmployee,requireAdmin,dataDir,onChange=()=>{}}){
 db.exec(`CREATE TABLE IF NOT EXISTS bar_music(id INTEGER PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL DEFAULT '',file_name TEXT NOT NULL DEFAULT '',mime TEXT NOT NULL DEFAULT '',byte_size INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,deleted_at TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS bar_music_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 1,preview_fallback INTEGER NOT NULL DEFAULT 1);
 INSERT OR IGNORE INTO bar_music_settings(id) VALUES(1);`);
 const directory=resolve(dataDir,'bar-music');
 const settings=()=>{const row=db.prepare('SELECT enabled,preview_fallback AS previewFallback FROM bar_music_settings WHERE id=1').get();return {enabled:!!row.enabled,previewFallback:!!row.previewFallback};};
 const tracks=(admin=false)=>db.prepare(`SELECT id,title,url,file_name AS fileName,mime,byte_size AS byteSize,enabled,created_at AS createdAt FROM bar_music WHERE deleted_at='' ${admin?'':'AND enabled=1'} ORDER BY id`).all().map(({fileName,...row})=>({...row,enabled:!!row.enabled,source:fileName?'upload':'url',url:fileName?'/api/player/bar-music/files/'+row.id:row.url}));
 const playlist=()=>({...settings(),tracks:tracks()});
 return {playlist,async handle(req,res,url){
  const file=url.pathname.match(/^\/api\/player\/bar-music\/files\/(\d+)$/),admin=url.pathname.startsWith('/api/admin/bar-music');if(!file&&!admin)return false;
  if(!(admin?requireAdmin(req,res):requireEmployee(req,res)))return true;
  try{
   if(file){
    if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'指令无效。'});return true;}
    const row=db.prepare('SELECT file_name AS fileName,mime FROM bar_music WHERE id=?').get(file[1]);if(!row?.fileName){send(res,404,{error:'音频不存在。'});return true;}
    const path=resolve(directory,row.fileName);if(!existsSync(path)){send(res,404,{error:'音频文件未找到。'});return true;}
    const size=statSync(path).size,range=req.headers.range;let start=0,end=size-1,status=200;
    if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2]){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return true;}
     if(!match[1]){start=Math.max(0,size-Number(match[2]));}else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
     if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return true;}status=206;
    }
    res.writeHead(status,{'Content-Type':row.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600','Accept-Ranges':'bytes','Content-Length':end-start+1,...(status===206?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
    if(req.method==='HEAD')res.end();else{const stream=createReadStream(path,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}return true;
   }
   const path=url.pathname,method=req.method;
   if(path==='/api/admin/bar-music'&&method==='GET'){send(res,200,{settings:settings(),items:tracks(true)});return true;}
   if(path==='/api/admin/bar-music/settings'&&method==='PUT'){
    const data=await readBody(req);if(typeof data.enabled!=='boolean'||typeof data.previewFallback!=='boolean')throw Error('音乐开关设置无效。');db.prepare('UPDATE bar_music_settings SET enabled=?,preview_fallback=? WHERE id=1').run(data.enabled?1:0,data.previewFallback?1:0);onChange();send(res,200,{ok:true});return true;
   }
   if(path==='/api/admin/bar-music/upload'&&method==='POST'){
    const data=await readBody(req,29*1024*1024),name=title(data.title),extension=extname(String(data.fileName||'')).toLowerCase(),mime=formats[extension];
    if(!mime||typeof data.data!=='string'||data.data.length>28*1024*1024||! /^[A-Za-z0-9+/]+={0,2}$/.test(data.data))throw Error('请选择 MP3、M4A、AAC、OGG 或 WAV 音频。');
    const buffer=Buffer.from(data.data,'base64');if(buffer.length<16||buffer.length>20*1024*1024)throw Error('音频大小须在 16 字节至 20 MB 之间。');
    const prefix=buffer.subarray(0,16),signature=extension==='.wav'?prefix.toString('ascii',0,4)==='RIFF'&&prefix.toString('ascii',8,12)==='WAVE':extension==='.ogg'?prefix.toString('ascii',0,4)==='OggS':extension==='.m4a'?prefix.toString('ascii',4,8)==='ftyp':prefix.toString('ascii',0,3)==='ID3'||prefix[0]===255&&(prefix[1]&224)===224;
    if(!signature)throw Error('文件内容与音频格式不符。');
    const fileName=createHash('sha256').update(buffer).digest('hex')+extension;await mkdir(directory,{recursive:true});await writeFile(resolve(directory,fileName),buffer,{flag:'w'});
    const result=db.prepare('INSERT INTO bar_music(title,file_name,mime,byte_size) VALUES(?,?,?,?)').run(name,fileName,mime,buffer.length);onChange();send(res,201,{id:Number(result.lastInsertRowid)});return true;
   }
   if(path==='/api/admin/bar-music'&&method==='POST'){
    const data=await readBody(req),name=title(data.title),link=audioUrl(data.url);const result=db.prepare('INSERT INTO bar_music(title,url) VALUES(?,?)').run(name,link);onChange();send(res,201,{id:Number(result.lastInsertRowid)});return true;
   }
   const record=path.match(/^\/api\/admin\/bar-music\/(\d+)$/);
   if(record&&method==='PUT'){
    const row=db.prepare("SELECT * FROM bar_music WHERE id=? AND deleted_at=''").get(record[1]);if(!row){send(res,404,{error:'曲目不存在。'});return true;}
    const data=await readBody(req);if(data.enabled!==undefined&&typeof data.enabled!=='boolean')throw Error('播放开关无效。');
    db.prepare('UPDATE bar_music SET title=?,url=?,enabled=? WHERE id=?').run(data.title===undefined?row.title:title(data.title),data.url===undefined||row.file_name?row.url:audioUrl(data.url),data.enabled===undefined?row.enabled:data.enabled?1:0,row.id);onChange();send(res,200,{ok:true});return true;
   }
   if(record&&method==='DELETE'){db.prepare("UPDATE bar_music SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),enabled=0 WHERE id=? AND deleted_at=''").run(record[1]);onChange();send(res,200,{ok:true});return true;}
   send(res,405,{error:'指令无效。'});return true;
  }catch(error){if(!res.headersSent)send(res,400,{error:error.message});else res.destroy();return true;}
 }};
}
