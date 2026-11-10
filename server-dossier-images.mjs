import {dossierView} from './server-dossier-content.mjs';
import sharp from 'sharp';

export async function normalizeDossierImage(value){
 if(value===undefined||value==='')return '';
 const match=typeof value==='string'&&value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||value.length>2100000)throw Error('请选择 1.5 MB 以内的 PNG、JPG 或 WEBP 图片。');
 const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>1500000)throw Error('图片不能超过 1.5 MB。');
 try{
  const output=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  return 'data:image/webp;base64,'+output.toString('base64');
 }catch{throw Error('无法读取图片，请选择有效的 PNG、JPG 或 WEBP 文件。');}
}

export function installDossierImages({db,send,requireAdmin}){
 if(!db.prepare('PRAGMA table_info(dossiers)').all().some(c=>c.name==='image_data'))db.exec("ALTER TABLE dossiers ADD COLUMN image_data TEXT NOT NULL DEFAULT ''");
 return {handle(req,res,url){
  const image=url.pathname.match(/^\/api\/admin\/dossiers\/(\d+)\/image$/),list=url.pathname==='/api/admin/dossiers'&&req.method==='GET';
  if(!image&&!list)return false;
  if(!requireAdmin(req,res))return true;
  if(list){const items=db.prepare("SELECT id,code,title,department,status,summary,classification,procedures,sections_json,(image_data<>'') AS hasImage FROM dossiers ORDER BY id DESC").all();send(res,200,{items:items.map(item=>({...dossierView(item),imageUrl:item.hasImage?'/api/admin/dossiers/'+item.id+'/image':''}))});return true;}
  if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'影像读取指令无效。'});return true;}
  const row=db.prepare('SELECT image_data FROM dossiers WHERE id=?').get(image[1]),match=row?.image_data.match(/^data:(image\/webp);base64,(.+)$/);
  if(!match){send(res,404,{error:'此卷宗暂无图片。'});return true;}
  const bytes=Buffer.from(match[2],'base64');res.writeHead(200,{'Content-Type':match[1],'Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);return true;
 }};
}
