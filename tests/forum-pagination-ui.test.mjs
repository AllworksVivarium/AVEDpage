import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('reply paging has no automatic read observer and discards responses after navigation',async()=>{
 class Element{constructor(){this.dataset={};this.children=[];this.innerHTML='';}before(){}after(){}setAttribute(name,value){this[name]=value;}replaceChildren(...nodes){this.children=nodes;}append(n){this.children.push(n);}contains(n){return this.children.includes(n);}scrollIntoView(){}}
 const container=new Element(),requests=[],seen=[],topics=[];let observed=false;
 const context={window:{AVEDForumPager:()=>({el:new Element(),render(){}})},URLSearchParams,document:{createElement:()=>new Element()},IntersectionObserver:class{constructor(){observed=true;}observe(){}disconnect(){}}};
 const source=readFileSync(new URL('../public/forum-replies.js',import.meta.url),'utf8');
 runInNewContext(source.slice(source.indexOf('window.AVEDForumReplies=')),context);
 const ui=context.window.AVEDForumReplies({api:path=>new Promise(resolve=>requests.push({path,resolve})),container,count:new Element(),renderItem:r=>r.body,enabled:()=>true,onThread:t=>topics.push(t.id),onSeen:ids=>seen.push([...ids]),onError:e=>assert.fail(e)});
 const first=ui.open(1);assert.match(requests[0].path,/page=1/);
 requests[0].resolve({thread:{id:1},items:Array.from({length:20},(_,i)=>({id:i+1,body:'reply '+i})),page:1,pages:3,total:45,changesCursor:45});assert.equal(await first,true,'navigation reports successful loading before an explicit receipt');
 assert.equal(container.children.length,20);assert.equal(seen.length,0,'loading a page is not a read receipt');
 assert.equal(observed,false,'paging never installs an automatic read observer');assert.equal(seen.length,0);
 const old=ui.reveal(45);assert.match(requests[1].path,/reply=45/);ui.reset();const next=ui.open(2);
 requests[1].resolve({thread:{id:1},items:[{id:45,body:'stale'}],page:3,pages:3,total:45,changesCursor:45});await old;assert.deepEqual(topics,[1]);
 requests[2].resolve({thread:{id:2},items:[{id:46,body:'new thread'}],page:1,pages:1,total:1,changesCursor:46});await next;
 assert.deepEqual(topics,[1,2]);assert.equal(ui.get(45),undefined);assert.equal(ui.get(46).body,'new thread');
 const target=ui.open(2,46);assert.match(requests[3].path,/reply=46/,'same-thread notifications still resolve their page');
 requests[3].resolve({thread:{id:2},items:[{id:46,body:'new thread'}],page:1,pages:1,total:1,changesCursor:46});await target;
});


test('pager keeps previous-page text when a text effect adds a span before the page count',()=>{
 const prev={textContent:'上一页'},next={textContent:'下一页'},select={innerHTML:'',value:''},pageCount={textContent:''};
 let wrapped=false;
 const wrapper={get textContent(){return prev.textContent;},set textContent(value){prev.textContent=value;}};
 const nav={className:'',innerHTML:'',setAttribute(){},querySelector(selector){
  return {'select':select,'[data-prev]':prev,'[data-next]':next,'[data-page-count]':pageCount,'span':wrapped?wrapper:pageCount}[selector];
 }};
 const context={window:{},document:{createElement:()=>nav}},visited=[];
 const source=readFileSync(new URL('../public/forum-replies.js',import.meta.url),'utf8');
 runInNewContext(source.slice(0,source.indexOf('window.AVEDForumReplies=')),context);
 const pager=context.window.AVEDForumPager({label:'帖子翻页',onPage:p=>visited.push(p)});
 pager.render({page:1,pages:6});wrapped=true;
 pager.render({page:2,pages:6});
 assert.equal(prev.textContent,'上一页');assert.equal(next.textContent,'下一页');assert.equal(pageCount.textContent,' / 6 页');
 assert.equal(prev.disabled,false);prev.onclick();next.onclick();assert.deepEqual(visited,[1,3]);
 pager.render({page:1,pages:6});assert.equal(prev.disabled,true);assert.equal(prev.textContent,'上一页');
 pager.render({page:6,pages:6});assert.equal(next.disabled,true);assert.equal(prev.disabled,false);
});
