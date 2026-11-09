// Shared source-text parser for stored administrator customizations.
import {createHash} from 'node:crypto';
import {parse} from './vendor/acorn.mjs';

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
