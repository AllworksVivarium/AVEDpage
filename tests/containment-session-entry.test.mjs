import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('restoring a containment identity preserves its appearance without replaying the login ceremony',async()=>{
 const waits=[],nodes=new Map();
 const node=()=>{const classes=new Set();return {dataset:{},textContent:'',isConnected:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,v)=>v?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},querySelector(){return null;}};};
 const document={body:node(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},querySelectorAll:()=>[],createElement:node,createTextNode:text=>({nodeValue:text})};
 const window={document,matchMedia:()=>({matches:false})};
 const context={window,MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:(fn,ms)=>{waits.push(ms);fn();}};
 vm.runInNewContext(readFileSync(new URL('../public/containment-access.js',import.meta.url),'utf8'),context);
 await window.AVEDContainmentAccess.identify({identityKind:'player_containment',name:'测试'},{animate:false});
 assert.deepEqual(waits,[]);assert.equal(document.body.classList.contains('containment-access'),true);
 assert.equal(document.getElementById('signal-Connecting-overlay').dataset.containment,undefined);
 window.AVEDContainmentAccess.reset();await window.AVEDContainmentAccess.identify({identityKind:'player_containment',name:'测试'});
 assert.deepEqual(waits,[420,620,850]);assert.equal(document.getElementById('signal-Connecting-overlay').dataset.containment,'true');
});
