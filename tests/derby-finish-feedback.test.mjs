import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('only the actual first finisher triggers the ribbon and one cheer per race',()=>{
 const drawing=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});
 const canvas=()=>({getContext:()=>drawing}),context={window:{},document:{createElement:canvas}};
 vm.runInNewContext(readFileSync(new URL('../public/derby-scene.js',import.meta.url),'utf8'),context);
 const cheers=[],scene=context.window.AVEDDerbyScene(canvas(),{onFinish:id=>cheers.push(id)});
 const state={round:1,phase:'RACING',serverTime:1000,frameAt:1500,runners:Array.from({length:5},(_,id)=>({id,kind:'orange',progress:99,pose:'run',place:null}))};
 scene.paint(state,1000);assert.deepEqual(cheers,[]);state.runners[3].progress=100;state.runners[3].place=1;state.runners[3].pose='finished';
 scene.paint(state,1500);scene.paint(state,1800);assert.deepEqual(cheers,[3]);
 state.round=2;scene.paint(state,2000,false);assert.deepEqual(cheers,[3],'effects-off does not play a cheer');
 state.round=3;state.phase='RESULT';state.winner=3;scene.paint(state,2500);assert.deepEqual(cheers,[3],'late result views keep a crown without replaying the finish sound');
});
