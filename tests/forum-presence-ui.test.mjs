import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('one visible-author batch paints activity, expires offline and stops publishing hidden activity',()=>{
 let now=10000;const key='a'.repeat(24),dot={hidden:true},text={hidden:true,textContent:''};
 const author={dataset:{forumPresence:key},closest:()=>null,querySelector:s=>s==='.forum-online-dot'?dot:text};
 const document={hidden:false,addEventListener(){}},location={hash:'#/casino/doutailao'};
 const context={window:{addEventListener(){}},document,location,crypto:{randomUUID:()=> 'test-tab-id'},Date:{now:()=>now},MutationObserver:class{observe(){}}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/forum-presence.js',import.meta.url),'utf8'),context);
 const ui=context.window.AVEDForumPresence({view:{querySelectorAll:()=>[author,author]},onChange(){}});
 let body=ui.request();assert.equal(body.activity,'cards');assert.equal(body.authors.length,1);
 ui.receive({items:[{key,online:true,activity:'cards',expiresIn:2000}]});assert.equal(dot.hidden,false);assert.equal(text.textContent,'正在打牌');
 now+=2001;ui.request();assert.equal(dot.hidden,true);assert.equal(text.hidden,true);
 location.hash='#/casino/slots';assert.equal(ui.request().activity,'slot');
 document.hidden=true;body=ui.request();assert.equal(body.active,false);assert.equal(body.authors.length,0);
 document.hidden=false;ui.reset();assert.equal(dot.hidden,true);
});

test('own posts get a marker, personas do not; anonymous posts never borrow a real avatar',()=>{
 const source=fs.readFileSync(new URL('../public/player.js',import.meta.url),'utf8'),fn=source.match(/function forumAuthor\(item\)\{[^\n]+\}/)[0];
 const render=vm.runInNewContext('('+fn+')',{esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))});
 let html=render({anonymousName:'<员工>',canEdit:true,avatarUrl:'/private-avatar',presenceKey:'abc'});
 assert.match(html,/我的发言/);assert.match(html,/&lt;员工&gt;/);assert.doesNotMatch(html,/private-avatar/);assert.doesNotMatch(html,/NOINFO|forum-author-avatar/);assert.match(html,/forum-online-dot/);
 html=render({anonymousName:'机器人',canEdit:true,personaId:3});assert.doesNotMatch(html,/我的发言/);
 html=render({anonymousName:'员工',identityMode:'real',avatarUrl:'/avatar'});assert.match(html,/src="\/avatar"/);
});
