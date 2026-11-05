import {createHash} from 'node:crypto';

const imagePattern=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
export function mediaReference(kind,id,value) {
  if(!value||!imagePattern.test(value))return value||'';
  const version=createHash('sha256').update(value).digest('hex').slice(0,20);
  return `/api/media/${kind}/${id}?v=${version}`;
}
export function installMedia({db,send,requireEmployee}) {
  return {handle(req,res,url) {
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
    const etag='"'+createHash('sha256').update(row.value).digest('hex')+'"';
    const headers={'Content-Type':image[1],'Cache-Control':'private, max-age=300','Vary':'Cookie','X-Content-Type-Options':'nosniff','ETag':etag};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return true;}
    const bytes=Buffer.from(image[2],'base64');
    res.writeHead(200,{...headers,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);return true;
  }};
}
