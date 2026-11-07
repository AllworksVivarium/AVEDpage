import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/ddz-ui.js',import.meta.url),'utf8');

test('joker faces say small/big king and use a crown; J, Q and K remain separate ranks',()=>{
 const ctx={selected:new Set(),esc:String,suit:()=>'<svg data-suit></svg>'};
 vm.runInNewContext(source.slice(source.indexOf(' function card('),source.indexOf(' function portrait(')),ctx);
 for(const val of [11,12,13,16,17]){
  const label=({11:'J',12:'Q',13:'K',16:'小王',17:'大王'})[val],html=ctx.card({id:val,val,label,suit:val===17?'♥':'♠',red:val===17},true);
  assert.ok(!html.includes('JK'));assert.ok(html.includes(label));assert.equal(html.includes('ddz-joker-name'),val>=16);assert.equal(html.includes('ddz-red'),val===17);
  assert.ok(html.includes('aria-label="'+label+(val<16?' ♠':'')+'"'));
 }
});

test('a stale zero clock recovers server state with bounded reads and ignores local wall-clock skew',async()=>{
 let ticks=0,reads=0;const clockText={},ctx={state:{phase:'playing',deadline:130000},clockBase:{server:100000,local:0},performance:{now:()=>ticks},Date:{now:()=>9000000},$:()=>clockText,visible:()=>true,busy:false,lastRecovery:-Infinity,refresh:async()=>{reads++;}};
 vm.runInNewContext(source.slice(source.indexOf(' function clock()'),source.indexOf(' async function act(')),ctx);
 ctx.clock();assert.equal(clockText.textContent,'30');assert.equal(reads,0);
 ticks=31000;ctx.clock();assert.equal(clockText.textContent,'00');assert.equal(reads,0);
 ticks=31201;ctx.clock();assert.equal(reads,1);ticks+=1000;ctx.clock();assert.equal(reads,1);
 ticks+=3000;ctx.clock();assert.equal(reads,2);ctx.visible=()=>false;ticks+=5000;ctx.clock();assert.equal(reads,2);
 await Promise.resolve();
});
