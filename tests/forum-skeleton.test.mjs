import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

class Element {
 constructor(){this.children=[];this.style={minBlockSize:''};this.attrs={};this.dataset={};this.nodes=new Map();this.hidden=false;this.textContent='';this.innerHTML='';this.tagName='DIV';}
 before(){} after(){} setAttribute(k,v){this.attrs[k]=v;}
 replaceChildren(...children){this.children=children;this.innerHTML='';}
 append(child){this.children.push(child);}
 contains(el){return this.children.includes(el);}
 querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key);}
 scrollIntoView(){} getBoundingClientRect(){return {height:118};}
}
function fixture(){
 const timers=new Map();let next=0;
 const elements=new Map(),document={activeElement:null,createElement:()=>new Element(),getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);}};
 const context={window:{},document,URLSearchParams,setTimeout(fn){timers.set(++next,fn);return next;},clearTimeout(id){timers.delete(id);}};
 runInNewContext(readFileSync(new URL('../public/forum-skeleton.js',import.meta.url),'utf8'),context);
 const tick=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}};
 return {context,document,timers,tick};
}

test('fast responses never flash; delayed placeholders end on completion, reset and cancellation',()=>{
 const {context,timers,tick}=fixture(),target=new Element(),placeholder=new Element();
 const ui=context.window.AVEDForumSkeleton({target,placeholder});
 target.style.minBlockSize='24px';
 ui.start();assert.equal(target.attrs['aria-busy'],'true');assert.equal(placeholder.hidden,true);
 ui.end();tick();assert.equal(placeholder.hidden,true);assert.equal(target.hidden,false);assert.equal(target.style.minBlockSize,'24px');
 ui.start();tick();assert.equal(placeholder.hidden,false);assert.equal(target.hidden,true);
 assert.equal((placeholder.innerHTML.match(/forum-skeleton-card /g)||[]).length,4);
 assert.equal(placeholder.attrs['aria-hidden'],'true');assert.ok(!/button|tabindex|<input/.test(placeholder.innerHTML));
 ui.start();assert.equal(target.hidden,false);assert.equal(timers.size,1);
 ui.end();tick();assert.equal(target.hidden,false);assert.equal(placeholder.hidden,true);assert.equal(target.attrs['aria-busy'],'false');
});

test('existing cards remain readable on refresh and keyboard focus is never hidden',()=>{
 const {context,document,tick}=fixture(),target=new Element(),placeholder=new Element(),article=new Element();article.tagName='ARTICLE';target.children=[article];target.textContent='Cached topic';
 const ui=context.window.AVEDForumSkeleton({target,placeholder});
 ui.start({replace:false});tick();assert.equal(target.hidden,false);assert.equal(placeholder.hidden,true);ui.end();
 document.activeElement=article;ui.start();tick();assert.equal(target.hidden,false);assert.equal(placeholder.hidden,true);ui.end();
 document.activeElement=null;ui.start();document.activeElement=article;tick();assert.equal(target.hidden,false);assert.equal(placeholder.hidden,true);ui.end();
 document.activeElement=null;ui.start();tick();assert.match(placeholder.innerHTML,/block-size:118px/);ui.end();
});

test('forum seeding, search failure and overlapping responses release only the current loading state',async()=>{
 const {context,document,tick}=fixture(),pending=[],errors=[];let dataCount=0;
 context.window.AVEDForumPager=()=>({el:new Element(),render(){}});
 runInNewContext(readFileSync(new URL('../public/forum-browser.js',import.meta.url),'utf8'),context);
 const ui=context.window.AVEDForumBrowser({api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),getUser:()=>({id:1}),onData:()=>dataCount++,onError:e=>errors.push(e)});
 const list=document.getElementById('forum-threads-list-container');
 ui.beginSeed();tick();assert.equal(list.hidden,true);ui.endSeed(Error('offline'));assert.equal(list.hidden,false);assert.equal(list.attrs['aria-busy'],'false');
 const older=ui.load({q:'old'}),newer=ui.load({q:'new'});tick();assert.equal(list.hidden,true);
 pending[0].resolve({items:[],total:0});await older;assert.equal(list.attrs['aria-busy'],'true');assert.equal(dataCount,0);
 pending[1].reject(Error('offline'));await newer;assert.equal(list.attrs['aria-busy'],'false');assert.equal(list.hidden,false);assert.deepEqual(errors,['offline']);
 const cancelled=ui.load();tick();ui.reset();pending[2].resolve({items:[{id:99}],total:1});await cancelled;assert.equal(dataCount,0);assert.equal(list.hidden,false);
 ui.beginSeed();ui.seed({items:[],total:0});assert.equal(ui.hasData(),true);assert.equal(dataCount,1);assert.equal(list.attrs['aria-busy'],'false');
});

test('reply request failures, navigation and cached refresh clean up their placeholders',async()=>{
 const {context,tick}=fixture(),container=new Element(),pending=[];let loading=false,errors=0;
 context.window.AVEDForumPager=()=>({el:new Element(),render(){}});
 const source=readFileSync(new URL('../public/forum-replies.js',import.meta.url),'utf8');runInNewContext(source.slice(source.indexOf('window.AVEDForumReplies=')),context);
 const ui=context.window.AVEDForumReplies({api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),container,count:new Element(),renderItem:r=>r.body,enabled:()=>true,onThread(){},onError(){errors++;},onLoading:b=>loading=b});
 const failed=ui.open(1);tick();assert.equal(container.hidden,true);assert.equal(loading,true);
 pending[0].reject(Error('offline'));await failed;assert.equal(container.hidden,false);assert.equal(loading,false);assert.equal(errors,1);assert.equal(container.children[0].textContent,'重新加载回复');
 const old=ui.open(2);tick();ui.reset();assert.equal(container.hidden,false);assert.equal(loading,false);
 pending[1].resolve({thread:{id:2},items:[],page:1,pages:1,total:0});await old;assert.equal(container.children.length,0);
 const opened=ui.open(3);pending[2].resolve({thread:{id:3},items:[{id:3,body:'cached reply'}],page:1,pages:1,total:1,changesCursor:1});await opened;
 const cached=container.children[0],refresh=ui.refresh();tick();assert.equal(container.hidden,false);assert.equal(container.children[0],cached);
 pending[3].reject(Error('offline'));await refresh;assert.equal(errors,2);assert.equal(container.children[0],cached);assert.equal(container.attrs['aria-busy'],'false');
});


test('forum category filter survives paging and sorting, restores on failure and resets per session',async()=>{
 const {context,document}=fixture(),pending=[];let bar;
 document.getElementById('new-forum-topic-form').before=el=>bar=el;
 context.window.AVEDForumPager=()=>({el:new Element(),render(){}});
 runInNewContext(readFileSync(new URL('../public/forum-browser.js',import.meta.url),'utf8'),context);
 const ui=context.window.AVEDForumBrowser({api:path=>new Promise((resolve,reject)=>pending.push({path,resolve,reject})),getUser:()=>({id:1}),onData(){},onError(){}});
 const categories=[{id:1,name:'员工日常'},{id:2,name:'组队招募'},{id:3,name:'出谋划策'}];
 ui.seed({items:[],total:0,categories,categoryId:0,sort:'activity'});
 const select=bar.querySelector('[aria-label=帖子分类]'),composer=document.getElementById('new-topic-category');
 assert.equal(select.children.length,4);assert.equal(composer.children.length,3);assert.equal(composer.value,'1');
 const first=ui.load({categoryId:2});assert.equal(new URLSearchParams(pending[0].path.split('?')[1]).get('category'),'2');
 pending[0].resolve({items:[],total:0,categories,categoryId:2,sort:'activity'});await first;assert.equal(select.value,'2');
 const page=ui.load({page:2,sort:'newest'}),query=new URLSearchParams(pending[1].path.split('?')[1]);assert.equal(query.get('category'),'2');assert.equal(query.get('page'),'2');assert.equal(query.get('sort'),'newest');
 pending[1].resolve({items:[],total:0,categories,categoryId:2,sort:'newest'});await page;
 select.value='3';const failed=ui.load({categoryId:3});pending[2].reject(Error('offline'));await failed;assert.equal(select.value,'2');
 const published=ui.published(3);assert.equal(new URLSearchParams(pending[3].path.split('?')[1]).get('category'),'3');pending[3].resolve({items:[],total:0,categories,categoryId:3});await published;
 ui.reset();assert.equal(select.value,'0');assert.equal(composer.disabled,true);
 const reset=ui.load();assert.equal(new URLSearchParams(pending[4].path.split('?')[1]).get('category'),'');pending[4].resolve({items:[],total:0,categories,categoryId:0,sort:'activity'});await reset;
});
