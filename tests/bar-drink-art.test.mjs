import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import sharp from 'sharp';
import {barDrinks} from '../server-bar-catalog.mjs';
import {servingRecipe} from '../server-bar-drinking.mjs';
test('each selectable jelly package retains its own transparent sprite',async()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 const jellies=barDrinks.filter(d=>d.container==='pouch'),images=new Set();assert.equal(jellies.length,5);
 for(const jelly of jellies){
  const image=window.AVEDBarDrinkArt.imageFor(jelly,{id:1});images.add(image);
  assert.equal(window.AVEDBarDrinkArt.imageFor(jelly,{id:29,remainingMl:60}),image);
  const file=fileURLToPath(new URL('../public'+image,import.meta.url)),meta=await sharp(file).metadata(),stats=await sharp(file).stats();
  assert.deepEqual([meta.width,meta.height,meta.hasAlpha],[128,204,true]);assert.equal(stats.channels[3].min,0);assert.ok(stats.channels[3].max>=250);
 }
 assert.equal(images.size,5);for(const jelly of jellies)assert.equal(window.AVEDBarDrinkArt.imageFor(jelly),jelly.image);
 const water=barDrinks.find(d=>d.id==='mineral-water');assert.equal(window.AVEDBarDrinkArt.imageFor(water,{id:8}),water.image);
});

test('whole bottles fill straight glasses and leave headroom in beer mugs; partial drinks keep their level',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 const m={width:80,height:80,fullWidth:80,fullHeight:80,x:0,y:0};
 const fill=(drink,glassId,volumeMl,glassMl)=>{
  const html=window.AVEDBarDrinkArt.render(drink,{id:1,volumeMl,remainingMl:glassMl,bottleMl:0,glassMl,drinkFrom:'glass'},m,String,1,drink.name,{glassId});
  return Number(html.match(/data-vessel="glass"[^>]*data-fill-ratio="([^"]+)"/)[1]);
 };
 for(const glass of ['highball','beer-mug'])for(const drink of barDrinks.filter(d=>d.orderable&&d.pourable)){
  const volume=servingRecipe(drink.id).volume,full=fill(drink,glass,volume,volume);
  assert.equal(volume,500);assert.ok(Math.abs(full-(glass==='highball'?.96:.9))<1e-12,drink.id+' must match the selected cup artwork');
  assert.equal(fill(drink,glass,volume,volume/2),full/2,'drinking or pouring half a bottle must not reset to full');
  assert.equal(fill(drink,glass,volume,0),0);
 }
 const water=barDrinks.find(d=>d.id==='mineral-water');
 for(const volume of [30,150,200,500,900])for(const glass of ['highball','beer-mug']){const full=glass==='highball'?.96:.9;assert.equal(fill(water,glass,volume,volume),full);assert.equal(fill(water,glass,volume,volume/2),full/2);}
 const palette=new Set();for(const drink of barDrinks.filter(d=>d.pourable)){assert.match(drink.liquidColor,/^#[a-f0-9]{6}$/i);palette.add(drink.liquidColor);const html=window.AVEDBarDrinkArt.render(drink,{id:1,volumeMl:500,remainingMl:500,bottleMl:0,glassMl:500,drinkFrom:'glass'},m,String,1,drink.name,{glassId:'highball'});assert.ok(html.includes('fill="'+drink.liquidColor+'"'),drink.id+' must render its configured liquid color');}assert.ok(palette.size<=9);
});

test('both pixel glasses have transparent centers; the beer mug handle has an open hole',async()=>{
 for(const [name,x,y] of [['highball',16,20],['beer-mug',18,20]]){
  const {data,info}=await sharp(fileURLToPath(new URL('../public/assets/bar/glass-'+name+'.svg',import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(y*info.width+x)*info.channels+3];assert.ok(alpha(x,y)>0&&alpha(x,y)<60);assert.ok(alpha(2,20)>100);
  if(name==='beer-mug')assert.equal(alpha(38,20),0);
 }
});

test('beer foam follows the remaining liquid and is absent from water, fizz and empty mugs',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 const m={width:80,height:80,fullWidth:80,fullHeight:80,x:0,y:0};
 const render=(id,ml)=>window.AVEDBarDrinkArt.render(barDrinks.find(d=>d.id===id),{id:1,volumeMl:500,remainingMl:ml,bottleMl:0,glassMl:ml,drinkFrom:'glass'},m,String,1,id,{glassId:'beer-mug'});
 const full=render('silver-brew',500),half=render('silver-brew',250),surface=html=>Number(html.match(/bar-drink-foam" style="transform:translateY\(([^p]+)/)[1]);
 assert.ok(full.includes('bar-drink-foam'));assert.ok(surface(half)>surface(full));
 for(const [id,ml]of [['silver-brew',0],['mineral-water',500],['lemon-fizz',330]])assert.ok(!render(id,ml).includes('bar-drink-foam'));
});

test('subtle ice follows the liquid in soft drinks and water, without adding ice to beer or empty glasses',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 const m={width:80,height:80,fullWidth:80,fullHeight:80,x:0,y:0};
 for(const glassId of ['highball','beer-mug']){
  const render=(id,ml)=>window.AVEDBarDrinkArt.render(barDrinks.find(d=>d.id===id),{id:1,volumeMl:500,remainingMl:ml,bottleMl:0,glassMl:ml,drinkFrom:'glass'},m,String,1,id,{glassId});
  for(const drink of ['mineral-water','lemon-fizz','grape-highball']){
   const full=render(drink,500),half=render(drink,250),surface=html=>Number(html.match(/bar-drink-ice" style="transform:translateY\(([^p]+)/)[1]);
   assert.ok(full.includes('bar-drink-ice'));assert.ok(surface(half)>surface(full));assert.ok(!render(drink,0).includes('bar-drink-ice'));
  }
  for(const drink of ['silver-brew','amber-brew','lemon-cocktail','amber-shot'])assert.ok(!render(drink,500).includes('bar-drink-ice'));
 }
});

test('spare glasses never take sipping or clinking away from fixed-cup drinks',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 const m={width:80,height:80,fullWidth:80,fullHeight:80,x:0,y:0},esc=s=>String(s);
 for(const id of ['mineral-water','lemon-cocktail','amber-shot']){
  const drink=barDrinks.find(d=>d.id===id),fixed=id!=='mineral-water',html=window.AVEDBarDrinkArt.render(drink,{id:1,volumeMl:500,remainingMl:500,bottleMl:300,glassMl:fixed?0:200,drinkFrom:fixed?'bottle':'glass'},m,esc,1,drink.name,{glassId:'beer-mug'});
  assert.equal((html.match(/data-drink-motion/g)||[]).length,1);assert.equal((html.match(/data-sip-motion/g)||[]).length,1);
  assert.equal(html.indexOf('data-drink-motion')<html.indexOf('bar-cup-position'),fixed);
  assert.equal(html.indexOf('data-sip-motion')<html.indexOf('bar-cup-position'),fixed);
  const spareLeft=Number(html.match(/bar-cup-position" style="left:([\d.]+)px/)[1]);
  if(fixed)assert.ok(spareLeft>=m.width+10,'fixed-cup drinks and spare glasses must have a visible gap');
  else assert.ok(spareLeft>=m.width+6,'bottles and drinking glasses must also have a visible gap');
 }
});

test('all author sprites use native vessels; separate glasses match spirits and keep cocktail spare cups empty',async()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 const art=window.AVEDBarDrinkArt,drinks=barDrinks.filter(d=>d.pixelArt),m={width:50,height:70,fullWidth:50,fullHeight:70,x:0,y:0};assert.equal(drinks.length,14);
 assert.equal(drinks.filter(d=>d.pourable).length,4);
 for(const drink of drinks){
  const file=fileURLToPath(new URL('../public'+drink.image,import.meta.url)),meta=await sharp(file).metadata();assert.deepEqual([meta.width,meta.height,meta.hasAlpha],[drink.width,drink.height,true]);
  const recipe=servingRecipe(drink.id);assert.ok(recipe.strength>0);assert.equal(art.canPour(drink),drink.pourable);
  const serving={id:101,volumeMl:recipe.volume,remainingMl:recipe.volume,bottleMl:recipe.volume,glassMl:0,drinkFrom:'bottle'};
  const native=art.render(drink,serving,m,String,1,drink.name);assert.ok(native.includes(drink.image));assert.ok(native.includes('bar-drink-liquid'));assert.ok(native.includes('data-sip-motion'));
  const empty=art.render(drink,{...serving,remainingMl:0,bottleMl:0},m,String,1,drink.name);assert.ok(empty.includes('clip-path:inset(100%'));
  for(const glassId of ['highball','beer-mug']){
   const html=art.render(drink,{...serving,bottleMl:drink.pourable?0:recipe.volume,glassMl:drink.pourable?recipe.volume:0,drinkFrom:drink.pourable?'glass':'bottle'},m,String,1,drink.name,{glassId});
   assert.equal((html.match(/data-sip-motion/g)||[]).length,1);assert.equal((html.match(/data-drink-motion/g)||[]).length,1);
   assert.equal(html.indexOf('data-sip-motion')<html.indexOf('bar-cup-position'),!drink.pourable);
   const fill=Number(html.match(/data-vessel="glass"[^>]*data-fill-ratio="([^"]+)"/)[1]);
   if(drink.pourable){assert.ok(fill>0);assert.ok(html.includes(drink.liquidColor));assert.ok(html.includes('bar-drink-ice'));}else assert.equal(fill,0);
  }
 }
 const jelly=barDrinks.find(d=>d.id==='energy-jelly');assert.equal(art.canPour(jelly),false);
 const html=art.render(jelly,{id:2,volumeMl:180,remainingMl:180,bottleMl:180,glassMl:0,drinkFrom:'bottle'},m,String,1,jelly.name,{glassId:'highball'});assert.ok(html.includes('data-vessel="glass"'));assert.match(html,/data-vessel="glass"[^>]*data-fill-ratio="0"/);
});

test('new paid variants inherit beer foam and highball ice without adding either to coffee',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});const m={width:40,height:80,fullWidth:40,fullHeight:80,x:0,y:0};
 const html=(id,ml=350)=>{const d=barDrinks.find(d=>d.id===id);return window.AVEDBarDrinkArt.render(d,{id:1,volumeMl:500,remainingMl:ml,glassMl:ml,bottleMl:0,drinkFrom:'glass'},m,String,1,d.name,{glassId:'beer-mug'});};
 assert.ok(html('meitei-25').includes('bar-drink-foam'));assert.ok(!html('meitei-25').includes('bar-drink-ice'));assert.ok(!html('meitei-25',0).includes('bar-drink-foam'));
 assert.ok(html('meitei-02').includes('bar-drink-ice'));assert.ok(html('deisui-11').includes('bar-drink-ice'));
 assert.ok(!html('meitei-28').includes('bar-drink-foam'));assert.ok(!html('meitei-28').includes('bar-drink-ice'));
});
