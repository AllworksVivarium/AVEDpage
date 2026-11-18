import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import sharp from 'sharp';
import {barDrinks} from '../server-bar-catalog.mjs';
import {servingRecipe} from '../server-bar-drinking.mjs';

test('normal pours look nearly full while partial servings still drain to an empty glass',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-drink-art.js',import.meta.url),'utf8'),{window});
 const m={width:80,height:80,fullWidth:80,fullHeight:80,x:0,y:0};
 const fill=(drink,glassId,volumeMl,glassMl)=>{
  const html=window.AVEDBarDrinkArt.render(drink,{id:1,volumeMl,remainingMl:glassMl,bottleMl:0,glassMl,drinkFrom:'glass'},m,String,1,drink.name,{glassId});
  return Number(html.match(/data-vessel="glass"[^>]*data-fill-ratio="([^"]+)"/)[1]);
 };
 for(const glass of ['highball','beer-mug'])for(const drink of barDrinks.filter(d=>d.orderable&&d.id!=='lemon-cocktail'&&!d.id.endsWith('-shot'))){
  const volume=servingRecipe(drink.id).volume,full=fill(drink,glass,volume,volume);
  assert.ok(full>=.9&&full<=.97,drink.id+' should leave a little headroom');
  assert.equal(fill(drink,glass,volume,volume/2),full/2,'drinking or pouring half a bottle must not reset to full');
  assert.equal(fill(drink,glass,volume,0),0);
 }
 const water=barDrinks.find(d=>d.id==='mineral-water');
 assert.ok(fill(water,'beer-mug',150,150)<.5,'unusually small servings should retain their smaller volume');
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
