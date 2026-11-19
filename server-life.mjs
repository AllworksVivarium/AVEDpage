import {createHash} from 'node:crypto';
import sharp from 'sharp';
import content from './public/life-content.js';
import {mediaReference} from './server-media.mjs';
import {installLifeSocial} from './server-life-social.mjs';

export async function prepareLifeImage(value){
  if(value==='')return {image:'',thumbnail:'',width:0,height:0};
  const match=typeof value==='string'&&value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||value.length>2200000)throw Error('图片须为 1.5 MB 以内的 PNG、JPG 或 WEBP。');
  try{
    const bytes=Buffer.from(match[2],'base64'),image=sharp(bytes,{limitInputPixels:32000000}).rotate();
    const meta=await image.metadata();if(meta.pages>1)throw Error();
    const {data,info}=await image.resize({width:1600,height:24000,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer({resolveWithObject:true});
    if(data.length>1500000)throw Error();
    const thumb=await sharp(data).resize({width:600,height:12000,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();
    return {image:'data:image/webp;base64,'+data.toString('base64'),thumbnail:'data:image/webp;base64,'+thumb.toString('base64'),width:info.width,height:info.height};
  }catch{throw Error('无法读取图片，或图片过大；请缩小后重试。');}
}

export function installLife({db,send,readBody,log,clock,random}){
  const columns=new Set(db.prepare('PRAGMA table_info(life_records)').all().map(c=>c.name));
  for(const [name,type] of Object.entries({paper_tone:"TEXT NOT NULL DEFAULT 'ivory'",presentation:"TEXT NOT NULL DEFAULT ''"}))if(!columns.has(name))db.exec(`ALTER TABLE life_records ADD COLUMN ${name} ${type}`);
  for(const [name,type] of Object.entries({content_json:"TEXT NOT NULL DEFAULT ''",template:"TEXT NOT NULL DEFAULT 'plain'",excerpt:"TEXT NOT NULL DEFAULT ''",thumbnail_data:"TEXT NOT NULL DEFAULT ''",image_width:'INTEGER NOT NULL DEFAULT 0',image_height:'INTEGER NOT NULL DEFAULT 0',preview_position:'INTEGER NOT NULL DEFAULT 0',edited_at:"TEXT NOT NULL DEFAULT ''",revision:'INTEGER NOT NULL DEFAULT 1'}))if(!columns.has(name))db.exec(`ALTER TABLE life_records ADD COLUMN ${name} ${type}`);
  if(!columns.has('preview_position_set')){db.exec('ALTER TABLE life_records ADD COLUMN preview_position_set INTEGER NOT NULL DEFAULT 0');db.exec('UPDATE life_records SET preview_position_set=1 WHERE preview_position<>0');}
  db.function('life_rank',{deterministic:true},(id,seed)=>createHash('sha256').update(String(seed)+':'+id).digest().readUInt32BE(0));
  const social=installLifeSocial({db,send,readBody,clock,random});
  function view(r,user,detail=false){
    const own=r.employee_id===user.id;
    const imageData=mediaReference('life',r.id,r.image_data);
    const item={id:r.id,title:r.title,body:detail?r.body:r.body.slice(0,280),kind:r.kind,tags:JSON.parse(r.tags),imageData,thumbnail:r.thumbnail_data?imageData+'&preview=1':imageData,imageWidth:r.image_width,imageHeight:r.image_height,previewPosition:r.preview_position_set?r.preview_position:50,template:r.template,excerpt:r.excerpt||r.body.slice(0,220),displayName:r.displayName,createdAt:r.created_at,editedAt:r.edited_at,canEdit:own,revision:r.revision,...social.summary(r.id,user.id,own)};
    item.paperTone=r.paper_tone;item.presentation=content.presentation({...item,body:r.body,presentation:r.presentation});
    if(own||user.role==='admin')item.moderation=r.moderation;
    if(detail){item.content=r.content_json?JSON.parse(r.content_json):content.normalize(undefined,r.body);item.excerpt=r.excerpt;}
    return item;
  }
  const select='SELECT l.*,e.display_name AS displayName FROM life_records l JOIN employees e ON e.id=l.employee_id';
  return {sweep:social.sweep,async handle(req,res,url,user){
    if(await social.handle(req,res,url,user))return true;
    const match=url.pathname.match(/^\/api\/player\/life(?:\/(\d+))?$/),admin=url.pathname==='/api/admin/life';
    if(!match&&!admin)return false;
    const id=Number(match?.[1])||0,method=req.method;
    if(admin&&method!=='GET'){send(res,405,{error:'指令无效。'});return true;}
    if(method==='GET'&&id){
      const row=db.prepare(select+" WHERE l.id=? AND l.deleted_at='' AND (l.moderation='approved' OR l.employee_id=? OR ?='admin')").get(id,user.id,user.role);
      if(!row){send(res,404,{error:'作品不存在或尚未公开。'});return true;}send(res,200,view(row,user,true));return true;
    }
    if(method==='GET'){
      const params=url.searchParams,mine=!admin&&params.get('mine')==='1',q='%'+(params.get('q')||'').slice(0,120)+'%',kind=params.get('kind')||'',tag=(params.get('tag')||params.get('department')||'').slice(0,40),department=params.get('tag')?(params.get('department')||'').slice(0,40):'',order=params.get('order')||'newest';
      const random=order==='random'&&!admin&&!mine,seed=(params.get('seed')||'daily').slice(0,60),snapshot=Math.max(0,Number(params.get('snapshot'))||Number.MAX_SAFE_INTEGER),before=Math.max(0,Number(params.get('before'))||0),offset=random?Math.min(100000,Math.max(0,Math.floor(Number(params.get('offset'))||0))):0;
      const predicate="l.deleted_at='' AND (?=1 OR l.moderation='approved') AND (?=0 OR l.employee_id=?) AND (?='' OR l.kind=?) AND (l.title LIKE ? OR l.body LIKE ?) AND (?='' OR EXISTS(SELECT 1 FROM json_each(l.tags) WHERE value=?)) AND (?='' OR EXISTS(SELECT 1 FROM json_each(l.tags) WHERE value=?)) AND l.id<=?";
      const args=[admin||mine?1:0,mine?1:0,user.id,kind,kind,q,q,tag,tag,department,department,snapshot];
      const bound=db.prepare(`SELECT MAX(l.id) AS id FROM life_records l WHERE ${predicate}`).get(...args).id||0;
      let rows;
      if(random){rows=db.prepare(`WITH candidates AS (SELECT l.*,e.display_name AS displayName,life_rank(l.id,?) AS rank,ROW_NUMBER() OVER(PARTITION BY l.employee_id ORDER BY life_rank(l.id,?)) AS author_round FROM life_records l JOIN employees e ON e.id=l.employee_id WHERE ${predicate}) SELECT * FROM candidates ORDER BY author_round,rank,id LIMIT 21 OFFSET ?`).all(seed,seed,...args,offset);}
      else {const direction=order==='oldest'?'ASC':'DESC';rows=db.prepare(select+` WHERE ${predicate} AND (?=0 OR l.id${direction==='ASC'?'>':'<'}?) ORDER BY l.id ${direction} LIMIT 21`).all(...args,before,before);}
      send(res,200,{items:rows.slice(0,20).map(r=>view(r,user)),next:rows.length>20?(random?offset+20:rows[19].id):null,snapshot:Math.min(snapshot,bound),tags:social.catalog().map(t=>t.name),tagCatalog:social.catalog()});return true;
    }
    const previous=id?db.prepare("SELECT * FROM life_records WHERE id=? AND employee_id=? AND deleted_at=''").get(id,user.id):null;
    if(id&&!previous){send(res,404,{error:'作品不存在或不属于当前员工。'});return true;}
    if(id&&method==='DELETE'){db.prepare("UPDATE life_records SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),deleted_by=? WHERE id=?").run(user.id,id);log(user.id,'life.remove',String(id));send(res,200,{ok:true});return true;}
    if((!id&&method==='POST')||(id&&method==='PUT')){
      const d=await readBody(req,2500000);
      if(previous&&d.revision!==previous.revision){send(res,409,{error:'作品已在其他页面修改，请重新打开后编辑。'});return true;}
      const delta=content.normalize(d.content,d.body||''),body=content.text(delta),tags=Array.isArray(d.tags)?[...new Set(d.tags.map(t=>String(t).trim()).filter(Boolean))]:[];
      social.validateTags(tags,previous?JSON.parse(previous.tags):[]);
      if(typeof d.title!=='string'||!d.title.trim()||d.title.trim().length>120||!['article','art'].includes(d.kind)||tags.length>8||tags.some(t=>t.length>40)||!content.templates.includes(d.template||'plain')||typeof (d.excerpt||'')!=='string'||(d.excerpt||'').length>300)throw Error('请填写有效标题、类型与样式，标签最多八项，节选最多 300 字。');
      const changed=d.imageData!==undefined&&d.imageData!==previous?.image_data;
      const image=changed?await prepareLifeImage(d.imageData):{image:previous?.image_data||'',thumbnail:previous?.thumbnail_data||'',width:previous?.image_width||0,height:previous?.image_height||0};
      const paperTone=d.paperTone??previous?.paper_tone??'ivory';
      if(!content.paperTones.includes(paperTone)||d.presentation!==undefined&&!['text','image'].includes(d.presentation))throw Error('纸色或呈现方式无效。');
      const presentation=content.presentation({kind:d.kind,body,imageData:image.image,presentation:d.presentation??previous?.presentation});
      if(!image.image&&!body.trim())throw Error('请填写正文或上传作品图片。');
      if(d.kind==='art'&&!image.image)throw Error('图片作品需要上传图片。');
      if(presentation==='image'&&!image.image)throw Error('请上传作品图片。');
      if(presentation==='text'&&!body.trim())throw Error('请填写正文，或选择文字长图后上传图片。');
      const values=[d.title.trim(),body,d.kind,JSON.stringify(tags),JSON.stringify(delta),d.template||'plain',d.excerpt||'',Math.min(100,Math.max(0,Math.round(Number(d.previewPosition??(previous?.preview_position_set?previous.preview_position:50))||0))),image.image?'pending':'approved'];
      db.exec('BEGIN IMMEDIATE');
      try{
        let rid=id;
        if(previous){
          const stored=db.prepare('SELECT revision FROM life_records WHERE id=?').get(id);if(stored.revision!==d.revision)throw Error('作品已修改，请重新打开。');
          const snapshot=row=>({title:row.title,body:row.body,content:row.content_json,template:row.template,paperTone:row.paper_tone,presentation:row.presentation,tags:row.tags});
          db.prepare('INSERT INTO speech_revisions(source_type,source_id,employee_id,before_json,after_json) VALUES(?,?,?,?,?)').run('life',id,user.id,JSON.stringify(snapshot(previous)),JSON.stringify({title:values[0],body,content:delta,template:values[5],paperTone,presentation,tags}));
          db.prepare("UPDATE life_records SET title=?,body=?,kind=?,tags=?,content_json=?,template=?,excerpt=?,preview_position=?,moderation=?,edited_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revision=revision+1 WHERE id=?").run(...values,id);
          if(changed)db.prepare('UPDATE life_records SET image_data=?,thumbnail_data=?,image_width=?,image_height=? WHERE id=?').run(image.image,image.thumbnail,image.width,image.height,id);
        }else{rid=Number(db.prepare('INSERT INTO life_records(title,body,kind,tags,content_json,template,excerpt,preview_position,moderation,employee_id,image_data,thumbnail_data,image_width,image_height) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...values,user.id,image.image,image.thumbnail,image.width,image.height).lastInsertRowid);}
        db.prepare('UPDATE life_records SET paper_tone=?,presentation=?,preview_position_set=1 WHERE id=?').run(paperTone,presentation,rid);
        social.ensure(rid);
        log(user.id,previous?'life.edit':'life.submit',String(rid),{kind:d.kind,pending:!!image.image});db.exec('COMMIT');send(res,previous?200:201,{id:rid,pending:!!image.image});
      }catch(error){db.exec('ROLLBACK');throw error;}return true;
    }
    send(res,405,{error:'指令无效。'});return true;
  }};
}
