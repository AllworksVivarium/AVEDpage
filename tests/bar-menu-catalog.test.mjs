import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import sharp from 'sharp';import {fileURLToPath} from 'node:url';
import {barDrinks} from '../server-bar-catalog.mjs';import {servingRecipe} from '../server-bar-drinking.mjs';
const window={};vm.runInNewContext(readFileSync(new URL('../public/bar-menu-catalog.js',import.meta.url),'utf8'),{window});
test('compact families expose every orderable drink once, ordered by server price, without creating purchasable family IDs',()=>{
 const api=window.AVEDBarMenuCatalog,sale=barDrinks.filter(d=>d.orderable),main=api.entries(barDrinks),seen=[];
 assert.equal(sale.length,106);assert.equal(main.length,11);assert.equal(main[0].id,'mineral-water');
 assert.deepEqual(Array.from(main.slice(0,3),d=>d.groupId||d.id),['mineral-water','jelly','soft']);
 assert.deepEqual(Array.from(main.slice(3),d=>d.price),Array.from(main.slice(3),d=>d.price).sort((a,b)=>a-b));
 for(const entry of main){
  if(!entry.groupId){seen.push(entry.id);continue;}
  const options=api.entries(barDrinks,entry.groupId);assert.equal(options.length,entry.choices);assert.ok(options.length>1);assert.ok(!barDrinks.some(d=>d.id===entry.id));
  assert.equal(entry.minPrice,options[0].price);assert.equal(entry.maxPrice,options.at(-1).price);
  assert.deepEqual(Array.from(options,d=>d.price),Array.from(options,d=>d.price).sort((a,b)=>a-b));seen.push(...options.map(d=>d.id));
 }
 assert.equal(new Set(seen).size,106);assert.deepEqual(seen.sort(),sale.map(d=>d.id).sort());assert.equal(api.entries(barDrinks,'not-a-family').length,0);
 const jellies=api.entries(barDrinks,'jelly');assert.equal(jellies.length,5);assert.equal(new Set(jellies.map(d=>d.image)).size,5);
 for(const d of jellies){assert.equal(d.price,800);assert.equal(d.pourable,false);assert.equal(servingRecipe(d.id).strength,0);assert.equal(servingRecipe(d.id).volume,180);}
});
test('the complete paid drink collection and author pack have valid transparent sprites and serving configuration',async()=>{
 assert.equal(barDrinks.filter(d=>['meitei','deisui','familiar'].includes(JSON.parse(readFileSync(new URL('../public/assets/bar/catalog.json',import.meta.url),'utf8')).find(raw=>raw.id===d.id)?.sourcePack)&&d.orderable).length,86);
 for(const drink of barDrinks){
  const meta=await sharp(fileURLToPath(new URL('../public'+drink.image,import.meta.url))).metadata();assert.deepEqual([meta.width,meta.height,meta.hasAlpha],[drink.width,drink.height,true],drink.id);
  const [x,y,w,h]=drink.contentBox;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=drink.width&&y+h<=drink.height,drink.id);
  if(drink.orderable){const recipe=servingRecipe(drink.id);assert.ok(recipe.volume>0&&recipe.sips>0&&recipe.strength>=0,drink.id);assert.equal(drink.pourable,drink.container==='bottle');}
 }
});

test('larger bottle servings keep their whole-serving alcohol dose with shorter spirit servings',()=>{
 for(const [id,sips,units] of [['amber-brew',3,16500],['lemon-fizz',4,9900],['familiar-small-A',4,20000],['white-rum',5,80000],['agave-tequila',5,76000]]){const recipe=servingRecipe(id);assert.equal(recipe.volume,500);assert.equal(recipe.sips,sips);assert.equal(recipe.volume*recipe.strength,units);}
});

test('fizz and highball variants each share one server-owned price',()=>{
 const fizz=barDrinks.filter(d=>d.menuGroup?.id==='fizz'),highball=barDrinks.filter(d=>d.menuGroup?.id==='highball');assert.equal(fizz.length,4);assert.equal(highball.length,14);for(const d of fizz)assert.equal(d.price,450);for(const d of highball)assert.equal(d.price,1100);
});

test('every orderable serving finishes in at most five sips',()=>{for(const drink of barDrinks.filter(d=>d.orderable)){const recipe=servingRecipe(drink.id);assert.ok(recipe.sips>=1&&recipe.sips<=5,drink.id);}});


test('gift menu exposes drinks without the personal cup picker and refuses cup navigation',()=>{
 const source=readFileSync(new URL('../public/bar-ui.js',import.meta.url),'utf8'),code=source.slice(source.indexOf(' function renderMenu(){'),source.indexOf(' function paintPayment(){'));
 for(const giftTarget of [null,{employeeId:2}]){
  const nodes=new Map(),get=key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);};
  const ctx={window,drinks:barDrinks,activeGroup:null,giftTarget,familyBar:{hidden:false,querySelector:()=>({})},$:get,snapshot:{},esc:String,money:n=>String(n),selection:null,pendingOrder:null,menu:{scrollTop:0}};vm.createContext(ctx);vm.runInContext(code+';renderMenu();',ctx);
  const html=get('[data-bar-menu-grid]').innerHTML;assert.equal(html.includes('data-drink-group="cups"'),!giftTarget);assert.match(html,/data-drink="mineral-water"/);
  if(giftTarget){vm.runInContext("showGroup('cups')",ctx);assert.equal(ctx.activeGroup,null);assert.equal(get('[data-bar-cups-menu]').hidden,true);}
 }
});
