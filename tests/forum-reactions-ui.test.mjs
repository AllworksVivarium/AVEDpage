import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {forumReactionCatalog} from '../server-forum-reactions.mjs';

test('empty posts have no reaction add button; body click and keyboard open the picker without charging',async()=>{
 const make=()=>({dataset:{},listeners:{},nodes:new Map(),setAttribute(){},append(){},addEventListener(type,fn){this.listeners[type]=fn;},querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,make());return this.nodes.get(selector);},showModal(){this.open=true;},close(){this.open=false;}});
 const view=make(),dialog=make(),window={},calls=[];
 const context={window,document:{getElementById:()=>view,createElement:()=>dialog}};
 vm.runInNewContext(readFileSync(new URL('../public/forum-reaction-art.js',import.meta.url),'utf8'),context);
 vm.runInNewContext(readFileSync(new URL('../public/forum-reactions.js',import.meta.url),'utf8'),context);
 window.getSelection=()=>({toString:()=>''});
 const ui=window.AVEDForumReactions({api:async(path,options)=>{calls.push({path,options});return {items:forumReactionCatalog};},esc:String,getUser:()=>({id:1}),getThread:()=>({id:10}),onBalance(){throw Error('Picker must not change balance');},showToast(){}});
 const empty=ui.markup('reply',11,[]);assert.ok(!empty.includes('<button'));assert.ok(!empty.includes('＋'));
 const populated=ui.markup('reply',11,[{id:'pig',count:3,mine:0}]);assert.ok(populated.includes('<span>3</span>'));assert.ok(populated.includes('猪'));assert.ok(!populated.includes('forum-reaction-add'));
 const post={dataset:{replyId:'11'},closest(selector){return selector==='.forum-reply-entry'?this:null;}};
 view.listeners.click({target:post});await new Promise(setImmediate);assert.equal(dialog.open,true);assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/player/forum/reactions');assert.equal(calls[0].options,undefined);
 assert.ok(dialog.querySelector('.forum-reaction-options').innerHTML.includes('满分！'));assert.ok(dialog.querySelector('.forum-reaction-options').innerHTML.includes('猪'));assert.ok(!dialog.querySelector('.forum-reaction-options').innerHTML.includes('异常共鸣'));
 const menu=dialog.querySelector('.forum-reaction-options').innerHTML;
 for(const item of forumReactionCatalog)assert.ok(menu.includes('aria-label="'+item.name+'"'),item.name+' remains accessible');
 assert.equal((menu.match(/<b(?:\s|>)/g)||[]).length,1);assert.ok(menu.includes('>我扇<span class="forum-fan-punctuation" aria-hidden="true">！</span></b>'));assert.ok(!menu.includes('>满分！<'));assert.ok(!populated.includes('title='));
 assert.ok(!menu.includes('forum-reaction-group'));assert.ok(!menu.includes('小黄脸'));assert.ok(menu.indexOf('data-pick-reaction="brokenHeart"')>menu.indexOf('data-pick-reaction="heart"'));
 assert.ok(!menu.includes('动态'));assert.ok(!menu.includes('静态'));
 dialog.close();const keyboardPost={dataset:{replyId:'11'},closest:()=>keyboardPost};let prevented=false;
 view.listeners.keydown({key:'Enter',target:keyboardPost,preventDefault(){prevented=true;}});await Promise.resolve();assert.equal(prevented,true);assert.equal(dialog.open,true);assert.equal(calls.length,1,'the catalog is reused; opening the picker never purchases');
});
