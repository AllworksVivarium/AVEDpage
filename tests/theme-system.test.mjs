import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/terminal-preferences.js',import.meta.url),'utf8');
function browser(storage=new Map(),dark=false){
 const classes=new Set(),handlers=new Map(),media={matches:dark,addEventListener:(name,fn)=>handlers.set('system',fn)};
 const document={documentElement:{dataset:{},style:{}},body:{classList:{contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),add:c=>classes.add(c)}},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(name,fn)=>handlers.set(name,fn),dispatchEvent(){}};
 const window={matchMedia:()=>media},context={window,document,Event:class{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 vm.runInNewContext(script,context);handlers.get('DOMContentLoaded')();
 return {window,document,classes,storage,system(value){media.matches=value;handlers.get('system')();}};
}
test('system theme follows live OS changes and applies the correct first-paint color scheme',()=>{
 const b=browser(new Map(),true);assert.equal(b.window.AVEDTheme.mode,'system');assert.equal(b.document.documentElement.dataset.savedTheme,'night');assert.ok(b.classes.has('dark-mode'));
 b.system(false);assert.equal(b.document.documentElement.dataset.savedTheme,'day');assert.equal(b.document.documentElement.style.colorScheme,'only light');assert.ok(!b.classes.has('dark-mode'));
});
test('manual day/night choices persist, ignore system changes, and can return to system mode',()=>{
 const b=browser();b.window.AVEDTheme.setMode('night');b.system(false);assert.ok(b.classes.has('dark-mode'));
 const next=browser(b.storage,false);assert.equal(next.window.AVEDTheme.mode,'night');assert.ok(next.classes.has('dark-mode'));
 next.window.AVEDTheme.setMode('day');next.system(true);assert.ok(!next.classes.has('dark-mode'));
 next.window.AVEDTheme.setMode('system');assert.ok(next.classes.has('dark-mode'));next.system(false);assert.ok(!next.classes.has('dark-mode'));
 assert.equal(JSON.parse(next.storage.get('aved_appearance_v2')).themeMode,'system');
});
