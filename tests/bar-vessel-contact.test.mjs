import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {barDrinks} from '../server-bar-catalog.mjs';

function fixture(){
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 return window.AVEDBarDrinkArt;
}
const metrics={width:40,height:56,fullWidth:40,fullHeight:56,x:0,y:0};
const serving={id:12,volumeMl:180,remainingMl:120,bottleMl:120,glassMl:0,drinkFrom:'bottle'};
const element=html=>({dataset:{clinkSound:html.match(/data-clink-sound="([^"]+)"/)?.[1]}});

test('soft packaging keeps its own clink and sip motion even beside a spare glass, without a glass impact sound',()=>{
 const art=fixture(),glass={dataset:{}};
 for(const drink of [...barDrinks.filter(d=>d.container==='pouch'),{...barDrinks.find(d=>d.id==='energy-jelly'),id:'soft-carton',container:'carton'}]){
  for(const glassId of [null,'highball','beer-mug']){
   const html=art.render(drink,serving,metrics,String,1,drink.name,{glassId});
   assert.equal((html.match(/data-drink-motion/g)||[]).length,1);
   assert.equal((html.match(/data-sip-motion/g)||[]).length,1);
   assert.match(html,/data-vessel="pouch" data-clink-sound="muted"/);
   if(glassId)assert.ok(html.indexOf('data-drink-motion')<html.indexOf('bar-cup-position'));
   assert.equal(art.clinkSound([element(html),glass]),false);
   assert.equal(art.clinkSound([glass,element(html)]),false);
  }
 }
 assert.equal(art.clinkSound([glass,glass]),true);
 assert.equal(art.clinkSound([glass]),false,'a missing partner must not produce a glass sound');
 const water=barDrinks.find(d=>d.id==='mineral-water');
 assert.equal(art.clinkSound([element(art.render(water,serving,metrics,String,1,'水',{glassId:'highball'})),glass]),true);
});

test('received cheers use the actual lifted pair, stay silent for a mixed pouch pair, and never replay on SSE retry',()=>{
 const art=fixture(),source=readFileSync(new URL('../public/bar-ui.js',import.meta.url),'utf8');
 const animate=source.slice(source.indexOf(' function animateCheers('),source.indexOf(' const messageStore='));assert.ok(animate.length>100);
 for(const muted of [false,true]){
  let sounds=0;const cups=[{dataset:{}},{dataset:{clinkSound:muted?'muted':'glass'}}];
  const context=vm.createContext({window:{AVEDBarDrinkArt:art,AVEDBarClink:()=>sounds++},seenCheers:new Set(),snapshot:{selfId:1},stored:()=> 'on',matchMedia:()=>({matches:true}),$:selector=>cups[selector.includes('"1"')?0:1]});
  vm.runInContext(animate+';animateCheers([{id:"cheer-1",senderId:1,recipientId:2}]);animateCheers([{id:"cheer-1",senderId:1,recipientId:2}]);',context);
  assert.equal(sounds,muted?0:1);
 }
});

test('small-bottle crop touches its visible base and preserves its original on-screen artwork scale',async()=>{
 const bottles=barDrinks.filter(d=>d.id.startsWith('familiar-small-'));assert.equal(bottles.length,7);
 for(const drink of bottles){
  const {data,info}=await sharp(new URL('../public'+drink.image,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const [x,y,w,h]=drink.contentBox;let lowest=-1;
  for(let row=0;row<info.height;row++)for(let col=0;col<info.width;col++)if(data[(row*info.width+col)*4+3]>24)lowest=Math.max(lowest,row);
  assert.equal(y+h,lowest+1,drink.id+' base must have no transparent bottom margin');
  assert.ok(x>=0&&x+w<=info.width&&y>=0&&y+h<=info.height);
  assert.ok(Math.abs(drink.displayScale/h-.65/190)<1e-12,'cropping must preserve the original pixel scale');
 }
});

test('empty and filled cups place the visible SVG base on the same tabletop as their bottle',()=>{
 const art=fixture();
 for(const unit of [46,64,80])for(const glassId of ['highball','beer-mug'])for(const drink of [null,barDrinks.find(d=>d.id==='familiar-small-A')]){
  const html=art.render(drink,serving,metrics,String,1,'杯具',{glassId,unit});
  const match=html.match(/bar-cup-position" style="left:[^;]+;width:[^;]+;height:([^p]+)px;bottom:([^p]+)px/);assert.ok(match);
  const height=Number(match[1]),bottom=Number(match[2]),viewHeight=glassId==='beer-mug'?54:48;
  assert.ok(Math.abs(bottom+height*2/viewHeight)<1e-9,'transparent SVG rows must sit below the anchor');
 }
});
