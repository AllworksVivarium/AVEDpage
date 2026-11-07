import {createHash} from 'node:crypto';
import {avatarBytes} from './server-avatar.mjs';

const imagePattern=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
export function mediaReference(kind,id,value,size) {
  if(!value||!imagePattern.test(value))return value||'';
  const version=createHash('sha256').update(value).digest('hex').slice(0,20);
  return `/api/media/${kind}/${id}?v=${version}`+(kind==='avatar'&&size?`&size=${size}`:'');
}
export function installMedia({db,send,requireEmployee}) {
  db.exec('CREATE TABLE IF NOT EXISTS avatar_thumbnails(employee_id INTEGER NOT NULL,version TEXT NOT NULL,size INTEGER NOT NULL,image BLOB NOT NULL,PRIMARY KEY(employee_id,version,size))');
  const pending=new Map();
  return {async handle(req,res,url) {
    const match=url.pathname.match(/^\/api\/media\/(avatar|thread|reply|life)\/(\d+)$/);
    if(!match)return false;
    const employee=requireEmployee(req,res);if(!employee)return true;
    if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'影像读取指令无效。'});return true;}
    const [,kind,id]=match;
    let row;
    if(kind==='avatar')row=db.prepare('SELECT avatar_url AS value,1 AS public FROM profiles WHERE employee_id=?').get(id);
    if(kind==='thread')row=db.prepare("SELECT image_data AS value,(status='published' AND moderation='approved' AND deleted_at='') AS public FROM forum_threads WHERE id=?").get(id);
    if(kind==='reply')row=db.prepare("SELECT r.image_data AS value,(r.status='published' AND r.moderation='approved' AND r.deleted_at='' AND t.status='published' AND t.moderation='approved' AND t.deleted_at='') AS public FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id WHERE r.id=?").get(id);
    if(kind==='life')row=db.prepare("SELECT image_data AS value,(moderation='approved' AND deleted_at='') AS public FROM life_records WHERE id=?").get(id);
    if(!row||(!row.public&&employee.role!=='admin')){send(res,404,{error:'影像不存在或尚未开放。'});return true;}
    const image=String(row.value||'').match(imagePattern);
    if(!image){send(res,404,{error:'影像不存在。'});return true;}
    if(kind==='avatar'&&url.searchParams.has('size')){
      const size=Number(url.searchParams.get('size'));if(![64,256].includes(size)){send(res,400,{error:'头像尺寸无效。'});return true;}
      const version=createHash('sha256').update(row.value).digest('hex').slice(0,20),etag=`"${version}-${size}"`;
      const headers={'Content-Type':'image/webp','Cache-Control':'private, max-age=86400','Vary':'Cookie','X-Content-Type-Options':'nosniff','ETag':etag};
      if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return true;}
      const key=id+':'+version+':'+size;
      try{
        let bytes=db.prepare('SELECT image FROM avatar_thumbnails WHERE employee_id=? AND version=? AND size=?').get(id,version,size)?.image;
        if(!bytes){if(!pending.has(key))pending.set(key,avatarBytes(row.value,size).then(image=>{db.prepare('DELETE FROM avatar_thumbnails WHERE employee_id=? AND version<>?').run(id,version);db.prepare('INSERT OR REPLACE INTO avatar_thumbnails VALUES(?,?,?,?)').run(id,version,size,image);return image;}).finally(()=>pending.delete(key)));bytes=await pending.get(key);}
        res.writeHead(200,{...headers,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
      }catch{send(res,422,{error:'头像暂时无法生成缩略图。'});}return true;
    }
    const etag='"'+createHash('sha256').update(row.value).digest('hex')+'"';
    const headers={'Content-Type':image[1],'Cache-Control':'private, max-age=300','Vary':'Cookie','X-Content-Type-Options':'nosniff','ETag':etag};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return true;}
    const bytes=Buffer.from(image[2],'base64');
    res.writeHead(200,{...headers,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);return true;
  }};
}
