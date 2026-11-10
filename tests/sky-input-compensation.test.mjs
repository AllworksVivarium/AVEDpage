import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputTiming} from '../server-input-timing.mjs';

test('server probes are bound to round and user; replay cannot inflate the recent-minimum allowance',()=>{
 let now=1000;const i=createInputTiming({clock:()=>now});assert.equal(i.allowance(1),0);
 const p=i.issue(1,10);assert.deepEqual(i.issue(1,10),p);now+=400;
 for(const [id,round,token] of [[2,10,p.token],[1,11,p.token],[1,10,'invented']])assert.throws(()=>i.acknowledge(id,round,token));
 assert.equal(i.acknowledge(1,10,p.token).compensationMs,200);now+=1000;assert.equal(i.acknowledge(1,10,p.token).compensationMs,200);assert.equal(i.issue(1,10),null);
 const q=i.issue(1,11);now+=100;assert.equal(i.acknowledge(1,11,q.token).compensationMs,50);
 const delayed=i.issue(1,12);now+=3000;assert.equal(i.acknowledge(1,12,delayed.token).compensationMs,50);
 assert.equal(i.effectiveAt(1,now,now-10),now-10,'never before departure');
 now+=120001;assert.equal(i.allowance(1),0);
 const capped=i.issue(1,13);now+=3000;assert.equal(i.acknowledge(1,13,capped.token).compensationMs,250);
 const expired=i.issue(1,14);now+=6001;assert.throws(()=>i.acknowledge(1,14,expired.token));i.clear();assert.equal(i.allowance(1),0);
});
