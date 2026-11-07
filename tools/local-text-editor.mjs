// Local authoring companion. Never imported by the production server.
import {createServer} from 'node:http';
import {readFile,writeFile,rename,mkdir,realpath,unlink} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from './vendor/acorn.mjs';
import {saveProjectType} from './local-type-design.mjs';

export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const sourceFiles=['player-terminal.html','player.js','player-community.js','personal-ui.js','page-headings.js','terminal-frame.js','terminal-preferences.js','window-style.js','print-signal.js','notices-ui.js','market-chart.js','sky-ui.js','economy-ui.js','welfare-ui.js','visual-style.js','rewards-ui.js','derby-ui.js','landing-sphere.js','personal-hud.js','ddz-ui.js','card-room-lobby.js','casino-switcher.js'].map(f=>'public/'+f);
const digest=s=>createHash('sha256').update(s).digest('hex');
export const normalize=s=>s.replace(/\s+/gu,' ').trim();
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
function decode(s){return s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(whole,key)=>{if(key[0]!=='#')return entities[key.toLowerCase()]||whole;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):whole;});}
const htmlText=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const templateText=s=>s.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${');

// Only text between markup tags is eligible; attributes, CSS and scripts are excluded.
function markupSpans(value){
  const spans=[],tags=/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;
  let previous=null,blocked='';
  for(const tag of value.matchAll(tags)){
    if(previous!==null&&!blocked){const raw=value.slice(previous,tag.index);if(!raw.includes('<')&&normalize(decode(raw)))spans.push({from:previous,to:tag.index,text:decode(raw),markup:true});}
    const name=/^<\s*(\/?)\s*(script|style|textarea)\b/i.exec(tag[0]);
    if(name)blocked=name[1]?'':name[2].toLowerCase();
    previous=tag.index+tag[0].length;
  }
  // A template interpolation may interrupt the next tag's attributes.
  if(previous!==null&&!blocked){const next=value.indexOf('<',previous);if(next>previous){const raw=value.slice(previous,next);if(normalize(decode(raw)))spans.push({from:previous,to:next,text:decode(raw),markup:true});}}
  return spans;
}
function textAssignment(parent,node,file){
  if(parent?.type==='AssignmentExpression'&&parent.right===node&&parent.left.type==='MemberExpression')return ['textContent','innerText','innerHTML'].includes(parent.left.property.name||parent.left.property.value);
  if(parent?.type==='Property'&&parent.value===node)return ['title','label','description','caption','message','text'].includes(parent.key.name||parent.key.value);
  return file==='public/page-headings.js'&&parent?.type==='ArrayExpression'&&parent.elements.indexOf(node)>0;
}
export function candidatesFor(source,file){
  const found=[];
  function add(container,span){
    const text=normalize(span.text);if(!text||text.length>4000)return;
    const line=source.slice(0,container.start).split('\n').length;
    found.push({...container,...span,file,line,text,revision:digest(source),id:digest(file+'\0'+container.start+'\0'+span.from+'\0'+text),context:normalize(container.value.slice(Math.max(0,span.from-65),span.to+65)).slice(0,240)});
  }
  if(file.endsWith('.html')){for(const span of markupSpans(source))add({start:0,end:source.length,value:source,kind:'html'},span);return found.map(c=>({...c,line:source.slice(0,c.from).split('\n').length}));}
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
  function walk(node,parent){
    if(!node||typeof node!=='object')return;
    if(node.type==='Literal'&&typeof node.value==='string'){
      const container={start:node.start,end:node.end,value:node.value,kind:'literal'};
      const markup=markupSpans(node.value);if(markup.length)markup.forEach(s=>add(container,s));
      else if(textAssignment(parent,node,file))add(container,{from:0,to:node.value.length,text:node.value,markup:!(parent?.type==='AssignmentExpression'&&['textContent','innerText'].includes(parent.left.property.name||parent.left.property.value))});
    }
    if(node.type==='TemplateElement'&&node.value.cooked!==null){
      const container={start:node.start,end:node.end,value:node.value.cooked,kind:'template'};
      markupSpans(node.value.cooked).forEach(s=>add(container,s));
    }
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>{if(child?.type)walk(child,node);});else if(value?.type)walk(value,node);
  }
  walk(ast,null);return found;
}
export function replaceCandidate(source,candidate,text){
  if(typeof text!=='string'||!text.trim()||text.length>4000||text.includes('\0'))throw Error('请输入 1–4000 字的文案。');
  const old=candidate.value.slice(candidate.from,candidate.to),leading=old.match(/^\s*/u)[0],trailing=old.match(/\s*$/u)[0];
  const content=leading+(candidate.markup?htmlText(text.trim()):text.trim())+trailing;
  const value=candidate.value.slice(0,candidate.from)+content+candidate.value.slice(candidate.to);
  const replacement=candidate.kind==='literal'?JSON.stringify(value):candidate.kind==='template'?templateText(value):value;
  const updated=source.slice(0,candidate.start)+replacement+source.slice(candidate.end);
  if(!candidate.file.endsWith('.html'))parse(updated,{ecmaVersion:'latest',sourceType:'script'});
  return updated;
}
export function createEditor({root=projectRoot,files=sourceFiles}={}){
  let queue=Promise.resolve();const undo=new Map();
  const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
  async function pathFor(file){if(!files.includes(file))throw Error('不在玩家端可编辑文件范围。');const path=resolve(root,file);if(await realpath(path)!==path)throw Error('不支持链接文件。');return path;}
  async function resolveText(text){
    if(typeof text!=='string'||text.length>4000)return [];
    const matches=[];for(const file of files){const source=await readFile(await pathFor(file),'utf8');matches.push(...candidatesFor(source,file).filter(c=>c.text===normalize(text)));}
    return matches.map(({id,file,line,text,revision,context})=>({id,file,line,text,revision,context}));
  }
  async function labels(){const all=[];for(const file of files){const source=await readFile(await pathFor(file),'utf8');all.push(...candidatesFor(source,file).map(c=>c.text));}return [...new Set(all)];}
  async function atomic(path,source){const temp=path+'.text-edit-'+randomBytes(5).toString('hex')+'.tmp';try{await writeFile(temp,source,{flag:'wx'});try{await rename(temp,path);}catch(e){if(process.platform!=='win32'||!['EPERM','EACCES'].includes(e.code))throw e;await writeFile(path,source);}}finally{await unlink(temp).catch(()=>{});}}
  const save=input=>serial(async()=>{
    const path=await pathFor(input.file),source=await readFile(path,'utf8');
    if(digest(source)!==input.revision)throw Error('源码已发生变化，请重新点选文字后再保存。');
    const candidate=candidatesFor(source,input.file).find(c=>c.id===input.id);if(!candidate)throw Error('未能重新定位这段源码。');
    const updated=replaceCandidate(source,candidate,input.text);if(updated===source)throw Error('文案没有变化。');
    const undoId=randomBytes(16).toString('hex'),history=resolve(root,'.local-text-history');await mkdir(history,{recursive:true});
    await writeFile(resolve(history,undoId+'.json'),JSON.stringify({file:input.file,before:source,afterHash:digest(updated),createdAt:new Date().toISOString()}),{flag:'wx'});
    await atomic(path,updated);undo.set(undoId,{file:input.file,before:source,afterHash:digest(updated)});
    return {ok:true,undoId,file:input.file,line:candidate.line,text:input.text.trim()};
  });
  const revert=undoId=>serial(async()=>{const item=undo.get(undoId);if(!item)throw Error('撤销记录不可用。');const path=await pathFor(item.file),current=await readFile(path,'utf8');if(digest(current)!==item.afterHash)throw Error('文件在保存后又有修改，已停止撤销以保留新改动。');await atomic(path,item.before);undo.delete(undoId);return {ok:true};});
  return {resolveText,labels,save,revert};
}
export function startEditor({port=4177,previewPort=4176,root=projectRoot,files=sourceFiles}={}){
  const token=randomBytes(32).toString('hex'),editor=createEditor({root,files});
  const origins=new Set(['127.0.0.1','localhost','[::1]'].map(h=>'http://'+h+':'+previewPort));
  const server=createServer(async(req,res)=>{
    const origin=req.headers.origin,local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{})});res.end(JSON.stringify(data));};
    if(!local||!origins.has(origin)||req.headers.host!=='127.0.0.1:'+port)return reply(403,{error:'仅允许本地预览页面访问。'});
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-AVED-Editor','Vary':'Origin'});return res.end();}
    if(req.url==='/session'&&req.method==='GET')return reply(200,{token});
    if(req.method!=='POST'||req.headers['x-aved-editor']!==token)return reply(403,{error:'本地编辑会话已失效，请重新打开文本编辑。'});
    try{
      let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>(req.url==='/type-design'?96*1024*1024:32000))throw Error('提交内容过大。');body+=chunk;}
      const input=JSON.parse(body);
      if(req.url==='/type-design')return reply(200,await saveProjectType(root,input));
      if(req.url==='/labels')return reply(200,{labels:await editor.labels()});
      if(req.url==='/resolve')return reply(200,{matches:await editor.resolveText(input.text)});
      if(req.url==='/save')return reply(200,await editor.save(input));
      if(req.url==='/undo')return reply(200,await editor.revert(input.undoId));
      reply(404,{error:'未知操作。'});
    }catch(e){reply(400,{error:e.message});}
  });
  server.listen(port,'127.0.0.1',()=>console.log('AVED 本地文本编辑已启动：http://127.0.0.1:'+port+'；仅接受本地预览 '+previewPort+'。'));
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startEditor({port:Number(process.env.AVED_EDITOR_PORT||4177),previewPort:Number(process.env.AVED_PREVIEW_PORT||4180)});
