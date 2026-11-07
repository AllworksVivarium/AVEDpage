import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {candidatesFor,replaceCandidate,sourceFiles,normalize} from './tools/local-text-editor.mjs';
import {decodeDesignFont,sanitizeDesign,designHash} from './player-design-core.mjs';

export function installPlayerDesign({db,root,send,readBody,requireAdmin,sessionEmployee,files=sourceFiles}){
  db.exec(`CREATE TABLE IF NOT EXISTS player_design_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS player_design_fonts(hash TEXT PRIMARY KEY,format TEXT NOT NULL,bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS player_design_undo(id TEXT PRIMARY KEY,actor_id INTEGER NOT NULL,file TEXT NOT NULL,before_json TEXT NOT NULL,after_hash TEXT NOT NULL);`);
  const get=(key,fallback)=>{const row=db.prepare('SELECT value FROM player_design_state WHERE key=?').get(key);return row?JSON.parse(row.value):fallback;};
  const put=(key,value)=>db.prepare('INSERT INTO player_design_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
  let queue=Promise.resolve();const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
  async function typeState(){let base={settings:null,fonts:[]};try{base=JSON.parse(await readFile(resolve(root,'public/player-type-design.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}const type=get('type',base);return {...type,revision:designHash(JSON.stringify(type))};}
  async function describe(file){
    if(!files.includes(file))throw Error('不在玩家端可编辑文件范围。');
    const source=await readFile(resolve(root,file),'utf8'),base=candidatesFor(source,file),edits=get(file,[]);
    let rendered=source;
    const changes=[];
    for(const edit of edits){let match=base.find(c=>c.id===edit.baseId);if(!match){const found=base.filter(c=>c.text===edit.original&&c.context===edit.context);if(found.length===1)match=found[0];}if(match)changes.push({match,text:edit.text});}
    for(const {match,text} of changes.sort((a,b)=>b.match.start-a.match.start||b.match.from-a.match.from)){
      // Several visible strings may share one JS literal; reparse after each edit.
      const current=candidatesFor(rendered,file),index=base.indexOf(match);if(!current[index])throw Error('文案结构已变化，请更新页面。');rendered=replaceCandidate(rendered,current[index],text);
    }
    return {source,base,rendered,candidates:candidatesFor(rendered,file),edits};
  }
  const summary=c=>({id:c.id,file:c.file,line:c.line,text:c.text,revision:c.revision,context:c.context});
  async function labels(){const values=[];for(const file of files)values.push(...(await describe(file)).candidates.map(c=>c.text));return [...new Set(values)];}
  const save=(input,actor)=>serial(async()=>{
    const state=await describe(input.file);if(designHash(state.rendered)!==input.revision)throw Error('源码已发生变化，请重新点选文字后再保存。');
    const index=state.candidates.findIndex(c=>c.id===input.id);if(index<0||state.base.length!==state.candidates.length)throw Error('未能定位这段源码。');
    const candidate=state.candidates[index],original=state.base[index];replaceCandidate(state.rendered,candidate,input.text);
    const text=input.text.trim();if(text===candidate.text)throw Error('文案没有变化。');
    const edits=state.edits.filter(e=>e.baseId!==original.id&&!(!state.base.some(c=>c.id===e.baseId)&&e.original===original.text&&e.context===original.context));
    if(text!==original.text)edits.push({baseId:original.id,original:original.text,context:original.context,text});
    const undoId=randomBytes(16).toString('hex');
    db.exec('BEGIN IMMEDIATE');try{put(input.file,edits);db.prepare('INSERT INTO player_design_undo VALUES(?,?,?,?,?)').run(undoId,actor.id,input.file,JSON.stringify(state.edits),designHash(JSON.stringify(edits)));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    return {ok:true,undoId,file:input.file,line:candidate.line,text};
  });
  async function handle(req,res,url){
    if(url.pathname==='/api/player-design'&&req.method==='GET'){send(res,200,{...(await typeState()),canEdit:sessionEmployee(req)?.role==='admin'});return true;}
    const font=/^\/api\/player-design\/fonts\/([a-f0-9]{64})$/.exec(url.pathname);
    if(font&&req.method==='GET'){const row=db.prepare('SELECT format,bytes FROM player_design_fonts WHERE hash=?').get(font[1]);if(!row)send(res,404,{error:'字体不存在。'});else{res.writeHead(200,{'Content-Type':'font/'+row.format,'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});res.end(Buffer.from(row.bytes));}return true;}
    if(!url.pathname.startsWith('/api/admin/player-design/'))return false;
    const actor=requireAdmin(req,res);if(!actor)return true;
    if(req.method!=='POST'){send(res,405,{error:'不支持此操作。'});return true;}
    try{
      const input=await readBody(req,url.pathname.endsWith('/type')?96*1024*1024:32768),action=url.pathname.slice('/api/admin/player-design/'.length);
      if(action==='type'){
        const result=await serial(async()=>{
          if(!Array.isArray(input.fonts)||input.fonts.length>48)throw Error('字体清单无效。');
          const prior=await typeState(),fonts=[],uploads=[];
          for(const item of input.fonts){if(item.base64){const font=decodeDesignFont(item);uploads.push(font);fonts.push({id:font.id,name:font.name,languages:font.languages,url:'/api/player-design/fonts/'+font.hash});}
            else{const font=prior.fonts.find(f=>f.id===item.id);if(!font)throw Error('请重新导入缺失的字体。');fonts.push(font);}}
          const settings=sanitizeDesign(input.settings,fonts);
          if(input.revision!==prior.revision)throw Error('服务器设计已更新，请刷新后再保存。');
          db.exec('BEGIN IMMEDIATE');try{for(const font of uploads)db.prepare('INSERT OR IGNORE INTO player_design_fonts VALUES(?,?,?)').run(font.hash,font.format,font.bytes);put('type',{settings,fonts});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
          return {ok:true,...await typeState()};
        });send(res,200,result);
      }else if(action==='text/labels')send(res,200,{labels:await labels()});
      else if(action==='text/resolve'){const matches=[];if(typeof input.text!=='string'||input.text.length>4000)throw Error('文案无效。');for(const file of files)matches.push(...(await describe(file)).candidates.filter(c=>c.text===normalize(input.text)).map(summary));send(res,200,{matches});}
      else if(action==='text/save')send(res,200,await save(input,actor));
      else if(action==='text/undo'){await serial(async()=>{const item=db.prepare('SELECT * FROM player_design_undo WHERE id=? AND actor_id=?').get(input.undoId,actor.id);if(!item)throw Error('撤销记录不可用。');if(designHash(JSON.stringify(get(item.file,[])))!==item.after_hash)throw Error('保存后又有修改，已停止撤销。');db.exec('BEGIN IMMEDIATE');try{put(item.file,JSON.parse(item.before_json));db.prepare('DELETE FROM player_design_undo WHERE id=?').run(item.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}});send(res,200,{ok:true});}
      else send(res,404,{error:'未知操作。'});
    }catch(e){send(res,e.message==='too large'?413:400,{error:e.message==='too large'?'提交内容过大。':e.message});}
    return true;
  }
  return {handle,revision:file=>files.includes('public/'+file)?designHash(JSON.stringify(get('public/'+file,[]))):'',render:async(file,data)=>files.includes('public/'+file)&&get('public/'+file,[]).length?Buffer.from((await describe('public/'+file)).rendered):data};
}
