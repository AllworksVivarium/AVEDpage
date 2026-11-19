import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('switching accounts clears the old inbox immediately and ignores late responses',async()=>{
 class Element{
  constructor(){this.children=[];this.dataset={};this.innerHTML='';this.textContent='';this.classList={contains:()=>false};}
  append(el){this.children.push(el);}prepend(el){this.children.unshift(el);}
  after(){}setAttribute(){}addEventListener(){}replaceChildren(){this.children=[];}
  close(){}querySelector(selector){if(selector==='.forum-persona-row')return null;return this.parts?.[selector]||(this.parts??={},this.parts[selector]=new Element());}
 }
 const elements=new Map(),get=id=>elements.get(id)||(elements.set(id,new Element()),elements.get(id));
 const tools=get('view-forum').querySelector('.forum-action-toolbar'),timers=[],requests=[];
 let user={id:1};
 const context={window:{},MutationObserver:class{observe(){}},setInterval:callback=>timers.push(callback),document:{hidden:false,getElementById:get,querySelector:()=>get('nav'),createElement:()=>new Element(),addEventListener(){}}};
 runInNewContext(readFileSync(new URL('../public/forum-social.js',import.meta.url),'utf8'),context);
 context.window.AVEDForumSocial({api:path=>new Promise(resolve=>requests.push({id:user.id,path,resolve})),esc:String,getUser:()=>user,getThread:()=>null,getReply:()=>null,openThread(){},showToast(){},refreshForum(){}});
 const button=tools.children[0],tick=timers[0];
 const first=tick();assert.equal(requests.length,1);
 requests[0].resolve({unread:3,items:[{threadId:1,title:'甲的私有提醒',count:3,replyId:1}],reactions:{unread:2,items:[{notificationId:7,threadId:1,replyId:0,title:'甲的反应提醒',reaction:'fan',unread:1}]}});await first;
 assert.equal(button.textContent,'消息提醒 (5)');
 await tick();assert.equal(requests.length,1,'same account polls are throttled');
 user={id:2};const second=tick();
 assert.equal(button.textContent,'消息提醒','switch clears the previous account before the new request resolves');
 assert.equal(requests.length,2,'the new account does not inherit the old throttle');
 user={id:3};await tick();assert.equal(button.textContent,'消息提醒');
 requests[1].resolve({unread:99,items:[{threadId:2,title:'乙的延迟提醒',count:99,replyId:2}]});await second;
 assert.equal(button.textContent,'消息提醒','a late response cannot restore another account inbox');
 assert.equal(requests.length,3,'the latest account is fetched once the pending request finishes');
 requests[2].resolve({unread:0,items:[],reactions:{unread:1,items:[]}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(button.textContent,'消息提醒 (1)');
 user=null;await tick();assert.equal(button.textContent,'消息提醒');
});

function inboxFixture(){
 const elements=new Map(),targets=new Map(),calls=[],timers=[],warnings=[];
 class Element{
  constructor(){this.children=[];this.dataset={};this.listeners={};this.open=false;this.innerHTML='';this.textContent='';this.classList={contains:()=>false,add(){},remove(){}};}
  append(el){this.children.push(el);}prepend(el){this.children.unshift(el);}after(){}setAttribute(){}replaceChildren(){}
  addEventListener(type,callback){this.listeners[type]=callback;}
  showModal(){this.open=true;}close(){this.open=false;}scrollIntoView(){}
  querySelector(selector){if(selector==='.forum-persona-row')return null;if(selector.startsWith('[data-reply-id='))return targets.get(Number(selector.match(/\d+/)[0]))||null;return (this.parts??={})[selector]??=(new Element());}
 }
 const get=id=>elements.get(id)||(elements.set(id,new Element()),elements.get(id));
 let user={id:1},thread=null,notices={unread:3,items:[
  {notificationId:12,unread:1,kind:'thread',threadId:7,replyId:20,through:12,count:10,title:'合并的帖子'},
  {notificationId:13,unread:1,kind:'reply',threadId:7,replyId:21,through:13,count:1,title:'合并的帖子',authorName:'甲',excerpt:'第一条直接回复',floor:21},
  {notificationId:14,unread:1,kind:'reply',threadId:7,replyId:22,through:14,count:1,title:'合并的帖子',authorName:'乙',excerpt:'第二条直接回复',floor:22}
 ]};
 const control={openResult:true,missingTarget:false,onOpen:null};
 const context={window:{},MutationObserver:class{observe(){}},setInterval:cb=>timers.push(cb),requestAnimationFrame:cb=>cb(),document:{hidden:false,getElementById:get,querySelector:()=>get('nav'),createElement:()=>new Element(),addEventListener(){}}};
 runInNewContext(readFileSync(new URL('../public/forum-social.js',import.meta.url),'utf8'),context);
 const api=async(path,options)=>{calls.push({path,body:options?.body});return path.endsWith('/notifications')?notices:{ok:true};};
 const ui=context.window.AVEDForumSocial({api,esc:String,getUser:()=>user,getThread:()=>thread,getReply:()=>null,getContext:()=>null,
  openThread:async(id,reply)=>{await control.onOpen?.();thread={id};if(reply&&!control.missingTarget)targets.set(reply,new Element());return control.openResult;},showToast:message=>warnings.push(message),refreshForum(){}});
 const view=get('view-forum'),dialog=view.children.at(-1),button=view.querySelector('.forum-action-toolbar').children[0];
 const click=async item=>{const b=new Element();b.dataset={noticeThread:String(item.threadId),noticeReply:String(item.replyId),commentKind:item.kind,noticeThrough:String(item.through)};b.closest=()=>b;await dialog.listeners.click({target:b});return b;};
 return {ui,context,dialog,button,calls,warnings,control,click,tick:()=>timers[0](),items:notices.items,setUser:value=>{user=value;},receipts:()=>calls.filter(c=>c.path.endsWith('/read'))};
}

test('inbox stays unread on opening and only acknowledges the clicked reply after successful navigation',async()=>{
 const f=inboxFixture();await f.tick();assert.equal(f.receipts().length,0);
 f.button.onclick();await new Promise(r=>setImmediate(r));assert.equal(f.dialog.open,true);assert.equal(f.receipts().length,0);
 const html=f.dialog.querySelector('.forum-inbox-list').innerHTML;
 assert.match(html,/你的帖子有新回复了/);assert.match(html,/新增 10 条回复/);assert.match(html,/未读/);
 await f.click(f.items[1]);
 assert.equal(f.dialog.open,false);assert.equal(f.receipts().length,1);
 assert.equal(f.receipts()[0].path,'/api/player/forum/7/read');assert.deepEqual(JSON.parse(JSON.stringify(f.receipts()[0].body)),{replyIds:[21]});
 assert.equal(f.calls.some(c=>c.body?.replyIds?.includes(22)),false,'adjacent direct replies are never acknowledged together');
});

test('thread summary uses the clicked snapshot and failed, hidden or switched-account navigation never acknowledges',async()=>{
 const f=inboxFixture();await f.tick();
 const clicked={...f.items[0]};f.control.onOpen=()=>{f.items[0].through=99;f.items[0].count=11;};
 await f.click(clicked);assert.deepEqual(JSON.parse(JSON.stringify(f.receipts()[0].body)),{through:12});
 const failed=inboxFixture();await failed.tick();failed.control.openResult=false;await failed.click(failed.items[1]);assert.equal(failed.receipts().length,0);assert.ok(failed.warnings.length);
 const missing=inboxFixture();await missing.tick();missing.control.missingTarget=true;await missing.click(missing.items[1]);assert.equal(missing.receipts().length,0);assert.ok(missing.warnings.length);
 const hidden=inboxFixture();await hidden.tick();hidden.control.onOpen=()=>{hidden.context.document.hidden=true;};await hidden.click(hidden.items[1]);assert.equal(hidden.receipts().length,0);
 const switched=inboxFixture();await switched.tick();switched.control.onOpen=()=>switched.setUser({id:2});await switched.click(switched.items[1]);assert.equal(switched.receipts().length,0);
});
