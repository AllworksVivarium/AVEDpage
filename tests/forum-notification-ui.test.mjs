import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('switching accounts clears the old inbox immediately and ignores late responses',async()=>{
 class Element{
  constructor(){this.children=[];this.dataset={};this.innerHTML='';this.textContent='';this.classList={contains:()=>false};}
  append(el){this.children.push(el);}prepend(el){this.children.unshift(el);}
  setAttribute(){}addEventListener(){}replaceChildren(){this.children=[];}
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
 requests[0].resolve({unread:3,items:[{threadId:1,title:'甲的私有提醒',count:3,replyId:1}]});await first;
 assert.equal(button.textContent,'回复提醒 (3)');
 await tick();assert.equal(requests.length,1,'same account polls are throttled');
 user={id:2};const second=tick();
 assert.equal(button.textContent,'回复提醒','switch clears the previous account before the new request resolves');
 assert.equal(requests.length,2,'the new account does not inherit the old throttle');
 user={id:3};await tick();assert.equal(button.textContent,'回复提醒');
 requests[1].resolve({unread:99,items:[{threadId:2,title:'乙的延迟提醒',count:99,replyId:2}]});await second;
 assert.equal(button.textContent,'回复提醒','a late response cannot restore another account inbox');
 assert.equal(requests.length,3,'the latest account is fetched once the pending request finishes');
 requests[2].resolve({unread:1,items:[]});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(button.textContent,'回复提醒 (1)');
 user=null;await tick();assert.equal(button.textContent,'回复提醒');
});
