import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/bar-play.js',import.meta.url),'utf8');
const paint=source.slice(source.indexOf(' function paintAction(){'),source.indexOf(' function animateSips('));
function buttons({glass='beer-mug',bottle=500,inGlass=0,fixed=false,busy=false}={}){
 const elements=new Map(),querySelector=selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);};
 const data={menu:[],barPreferences:{glassId:glass},glassware:[{id:'beer-mug'},{id:'highball'}],myDrink:{drinkId:'beer',bottleMl:bottle,glassMl:inGlass,remainingMl:bottle+inGlass,volumeMl:500,canPour:!fixed,drinkFrom:'bottle'}};
 vm.runInNewContext(paint+';paintAction();',{getSnapshot:()=>data,action:{querySelector},root:{querySelector},busy,drunkStatus:()=>({levelLabel:'清醒'})});
 return selector=>elements.get(selector);
}

test('selected adaptive cups allow manual pouring without a capacity field',()=>{
 for(const glass of ['beer-mug','highball']){
  const get=buttons({glass});
  assert.equal(get('[data-bar-pour]').disabled,false);
  assert.equal(get('[data-bar-from-glass]').disabled,false);
 }
 // Old partially poured drinks can transfer all remaining bottle contents too.
 assert.equal(buttons({bottle:250,inGlass:250})('[data-bar-pour]').disabled,false);
});

test('pour remains disabled without a cup, after emptying the bottle, for native servings and while busy',()=>{
 for(const state of [{glass:null},{bottle:0,inGlass:500},{fixed:true},{busy:true}]){
  assert.equal(buttons(state)('[data-bar-pour]').disabled,true);
 }
});
