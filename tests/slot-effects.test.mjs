import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('hidden slot cleanup does not retrigger its class observer indefinitely',()=>{
 const observers=[];let mutations=0;
 const classes=new Set(['hidden','slot-power-up']);
 const panel={classList:{contains:c=>classes.has(c),remove(...names){mutations++;names.forEach(c=>classes.delete(c));}}};
 const ctx={window:{},document:{hidden:false,getElementById:()=>({classList:{contains:()=>false}}),addEventListener(){}},matchMedia:()=>({matches:false,addEventListener(){}}),clearTimeout(){},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}};
 vm.runInNewContext(readFileSync(new URL('../public/slot-effects.js',import.meta.url),'utf8'),ctx);
 ctx.window.AVEDSlotEffects({panel,grid:{}});
 observers[0]();assert.equal(mutations,1);
 observers[0]();observers[1]();assert.equal(mutations,1);
});

test('repeated awards replace one overlay inside the reels and can be dismissed',()=>{
 const children=[],buttons=[];const classes=new Set();
 const panel={classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:(...names)=>names.forEach(c=>classes.delete(c))}};
 const grid={append(node){children.push(node);}};
 const context={window:{},Number,document:{hidden:false,getElementById:()=>({classList:{contains:()=>false}}),addEventListener(){},createElement(){const button={};buttons.push(button);return {dataset:{},setAttribute(){},querySelector:()=>button,remove(){children.splice(children.indexOf(this),1);}};}},matchMedia:()=>({matches:true,addEventListener(){}}),setTimeout:()=>1,clearTimeout(){},MutationObserver:class{observe(){}}};
 vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),context);context.window.AVEDGameResults=context.AVEDGameResults;
 vm.runInNewContext(readFileSync(new URL('../public/slot-effects.js',import.meta.url),'utf8'),context);
 const effects=context.window.AVEDSlotEffects({panel,grid});
 effects.show({cost:1000,prize:100000,tax:2970});assert.equal(children.length,1);assert.equal(children[0].className,'slot-award-layer');assert.match(children[0].innerHTML,/100,000/);assert.doesNotMatch(children[0].innerHTML,/97,030/);assert.match(children[0].innerHTML,/<small class="game-tax-note">已扣税 ¤ 2,970<\/small>/);
 effects.show({cost:1000,prize:2000,penalty:100});assert.equal(children.length,1);assert.match(children[0].innerHTML,/额外维修费/);
 buttons.at(-1).onclick();assert.equal(children.length,0);
});


function confettiFixture(){
 const observers=[],listeners=new Map(),reduced={matches:false,addEventListener(fnName,fn){this.change=fn;}},classes=new Set();let enabled=true;
 function element(){return {children:[],dataset:{},style:{},classList:{add(){},remove(){}},setAttribute(){},querySelector:()=>({}),append(node){node.parent=this;this.children.push(node);},remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}};}
 const body=element(),grid=element(),panel={classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:(...values)=>values.forEach(c=>classes.delete(c))}};
 const document={hidden:false,body,getElementById:()=>({classList:{contains:()=>false}}),createElement:element,addEventListener(name,fn){listeners.set(name,fn);}};
 const context={window:{AVEDEffectsEnabled:()=>enabled},document,matchMedia:()=>reduced,innerWidth:390,innerHeight:844,setTimeout:()=>1,clearTimeout(){},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}};
 vm.runInNewContext(readFileSync(new URL('../public/game-results.js',import.meta.url),'utf8'),context);context.window.AVEDGameResults=context.AVEDGameResults;
 for(const file of ['scratch-feedback','slot-effects'])vm.runInNewContext(readFileSync(new URL('../public/'+file+'.js',import.meta.url),'utf8'),context);
 const effects=context.window.AVEDSlotEffects({panel,grid});
 return {effects,body,grid,reduced,document,classes,observers,listeners,off(){enabled=false;listeners.get('aved-effects-change')();}};
}

test('slot awards use side confetti from 5x and add top ribbons from the existing 50x supreme tier',()=>{
 const f=confettiFixture(),show=(prize,penalty=0)=>f.effects.show({cost:1000,prize,penalty});
 show(4999);assert.equal(f.body.children.length,0);
 show(5000);assert.equal(f.body.children.length,1);assert.equal(f.body.children[0].className,'scratch-electronic-confetti');
 const particles=f.body.children[0].children;assert.ok(particles.some(p=>p.style.cssText.startsWith('left:')));assert.ok(particles.some(p=>p.style.cssText.startsWith('right:')));
 show(49999);assert.equal(f.body.children.length,1);
 show(50000);assert.equal(f.body.children.length,2);assert.ok(f.body.children.some(x=>x.className.includes('scratch-rain')));
 show(100000,100);assert.equal(f.body.children.length,0,'overload never celebrates a large gross return');
});

test('slot confetti clears on effects changes, leaving the game and result dismissal',()=>{
 const f=confettiFixture(),win=()=>f.effects.show({cost:1000,prize:100000});
 win();assert.equal(f.body.children.length,2);f.off();assert.equal(f.body.children.length,0);
 win();assert.equal(f.body.children.length,0);
 const reduced=confettiFixture();reduced.reduced.matches=true;reduced.effects.show({cost:1000,prize:100000});assert.equal(reduced.body.children.length,0);assert.equal(reduced.grid.children.length,1,'static result remains available');
 const active=confettiFixture();active.effects.show({cost:1000,prize:100000});active.listeners.get('keydown')({key:'Escape'});assert.equal(active.body.children.length,0);
 active.effects.show({cost:1000,prize:100000});active.classes.add('hidden');active.observers[0]();assert.equal(active.body.children.length,0);
});
