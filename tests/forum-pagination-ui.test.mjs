import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('reply paging only acknowledges visible floors and discards responses after navigation',async()=>{
 class Element{constructor(){this.dataset={};this.children=[];this.innerHTML='';}before(){}after(){}replaceChildren(...nodes){this.children=nodes;}append(n){this.children.push(n);}contains(n){return this.children.includes(n);}scrollIntoView(){}}
 const container=new Element(),requests=[],seen=[],topics=[];let observation;
 const context={window:{AVEDForumPager:()=>({el:new Element(),render(){}})},URLSearchParams,document:{createElement:()=>new Element()},IntersectionObserver:class{constructor(cb){observation=cb;}observe(){}disconnect(){}}};
 const source=readFileSync(new URL('../public/forum-replies.js',import.meta.url),'utf8');
 runInNewContext(source.slice(source.indexOf('window.AVEDForumReplies=')),context);
 const ui=context.window.AVEDForumReplies({api:path=>new Promise(resolve=>requests.push({path,resolve})),container,count:new Element(),renderItem:r=>r.body,enabled:()=>true,onThread:t=>topics.push(t.id),onSeen:ids=>seen.push([...ids]),onError:e=>assert.fail(e)});
 const first=ui.open(1);assert.match(requests[0].path,/page=1/);
 requests[0].resolve({thread:{id:1},items:Array.from({length:20},(_,i)=>({id:i+1,body:'reply '+i})),page:1,pages:3,total:45,changesCursor:45});await first;
 assert.equal(container.children.length,20);assert.equal(seen.length,0,'loading a page is not a read receipt');
 observation([{target:container.children[0],isIntersecting:true},{target:container.children[1],isIntersecting:false}]);assert.deepEqual(seen,[[1]]);
 const old=ui.reveal(45);assert.match(requests[1].path,/reply=45/);ui.reset();const next=ui.open(2);
 requests[1].resolve({thread:{id:1},items:[{id:45,body:'stale'}],page:3,pages:3,total:45,changesCursor:45});await old;assert.deepEqual(topics,[1]);
 requests[2].resolve({thread:{id:2},items:[{id:46,body:'new thread'}],page:1,pages:1,total:1,changesCursor:46});await next;
 assert.deepEqual(topics,[1,2]);assert.equal(ui.get(45),undefined);assert.equal(ui.get(46).body,'new thread');
 const target=ui.open(2,46);assert.match(requests[3].path,/reply=46/,'same-thread notifications still resolve their page');
 requests[3].resolve({thread:{id:2},items:[{id:46,body:'new thread'}],page:1,pages:1,total:1,changesCursor:46});await target;
});
