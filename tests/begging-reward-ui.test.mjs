import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/begging-ui.js',import.meta.url),'utf8'),paint=source.slice(source.indexOf(' function paint(){'),source.indexOf(' function show(){'));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(rewards){const list={},entry={};vm.runInNewContext(paint+';paint();',{dialog:{open:false,querySelectorAll:()=>[]},items:[],rewards,entry,$:()=>list,esc,money:n=>'¤ '+Number(n).toLocaleString('en-US')});return {html:list.innerHTML,label:entry.textContent};}
test('reward notices identify each giver and the actual paid amount, not the requested amount',()=>{
 const {html,label}=render([{id:1,recipientName:'夜班同事',amount:60000,requestedAmount:40000},{id:2,recipientName:'另一位同事',amount:1000000,requestedAmount:100}]);
 assert.match(html,/恭喜您得到大结果！/);assert.match(html,/向 <strong>夜班同事<\/strong> 乞讨成功，收到 <strong class="begging-reward-amount">¤ 60,000<\/strong>/);assert.match(html,/另一位同事/);assert.match(html,/¤ 1,000,000/);assert.doesNotMatch(html,/40,000/);assert.equal((html.match(/class="begging-reward-detail"/g)||[]).length,2);assert.equal(label,'乞讨消息 (2)');
});
test('public names are escaped and empty inboxes do not show a fabricated success',()=>{
 const {html}=render([{id:1,recipientName:'<img src=x onerror=alert(1)> & 同事',amount:1}]);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(html,/&amp; 同事/);assert.match(html,/¤ 1/);assert.doesNotMatch(render([]).html,/乞讨成功|恭喜/);
});
