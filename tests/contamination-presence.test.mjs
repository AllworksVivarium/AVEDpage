import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const scope=vm.createContext({});
vm.runInContext(readFileSync(new URL('../public/contamination-presence.js',import.meta.url),'utf8'),scope);
const {createVisits,elapsedText,pupilOffset}=scope.AVEDPresence;
test('visits count actual route entries and remember time away instead of time spent reading',()=>{
 const visits=createVisits();assert.equal(visits.enter('forum',1000).count,1);assert.equal(visits.enter('forum',9000),null);
 visits.enter('thread:1',10000);const back=visits.enter('forum',27000);assert.equal(back.count,2);assert.equal(back.away,17000);
 visits.reset();assert.equal(visits.enter('forum',29000).count,1);
});
test('visit history stays bounded and old discarded pages start fresh',()=>{
 const visits=createVisits(2);visits.enter('a',0);visits.enter('b',10);visits.enter('c',20);assert.equal(visits.enter('a',30).count,1);
 assert.equal(elapsedText(17000),'17 秒');assert.equal(elapsedText(125900),'2 分 5 秒');
});
test('eyes track mouse or touch coordinates with constrained pupil motion',()=>{
 const rect={left:100,top:100,width:110,height:44};assert.deepEqual({...pupilOffset(155,122,rect)},{x:0,y:0});
 assert.deepEqual({...pupilOffset(10000,-10000,rect)},{x:7,y:-4});
});
