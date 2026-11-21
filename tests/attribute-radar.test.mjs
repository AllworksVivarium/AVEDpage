import test from 'node:test';import assert from 'node:assert/strict';import radar from '../public/attribute-radar.js';import {normalizeAttributes,attributeValues} from '../server-employee-attributes.mjs';
test('containment keeps its full numeric values while normal employees remain bounded by 100',()=>{
 const values=[150,95,100,2500,0,60];assert.throws(()=>normalizeAttributes(values),/100/);assert.equal(normalizeAttributes([95,90,80,70,60,50]),'[95,90,80,70,60,50]');
 for(const identityKind of ['player_containment','company_containment'])assert.deepEqual(attributeValues(normalizeAttributes(values,{identityKind})),values);
 for(const v of [-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>normalizeAttributes([v,1,2,3,4,5],{identityKind:'company_containment'}));
});
test('radar retains a 100 scale, clamps overflow geometry and displays real overflow values',()=>{
 const values=[150,95,100,2500,0,60],points=radar.points(values);assert.deepEqual(points[0],[70,18]);assert.deepEqual(points[3],[70,122]);assert.deepEqual(points[4],[70,70]);
 const html=radar.render(values);assert.match(html,/力量 150/);assert.match(html,/2500/);assert.equal((html.match(/class="hud-radar-over-limit"/g)||[]).length,2);assert.match(html,/超出 100 基准/);
 assert.ok(!radar.render([100,95,100,100,0,60]).includes('hud-radar-overflow'));assert.match(radar.render(null),/未录入/);
});
