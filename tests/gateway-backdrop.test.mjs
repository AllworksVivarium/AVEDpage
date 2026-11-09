import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('the sphere has one ASCII backdrop, a richer alphabet and the same tile density',()=>{
 const js=read('landing-sphere.js'),css=read('terminal-patterns.css');
 assert.match(js,/spherePattern='ascii'/);assert.doesNotMatch(js,/createElement\('label'\)|choosePattern|savedPattern/);
 assert.doesNotMatch(css,/sphere-backdrop-choice|data-sphere-pattern=(grid|dots|plain)/);
 const rule=css.split('\n').find(line=>line.startsWith('body.landing-sphere #landing-view[data-sphere-pattern=ascii]'));
 const svg=decodeURIComponent(rule.match(/data:image\/svg\+xml,([^"]+)/)[1]);
 assert.match(svg,/width="192" height="192"/);assert.equal((svg.match(/<text /g)||[]).length,24);
 const rows=[...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(m=>m[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
 assert.ok(rows.every(row=>row.length===40));assert.ok(new Set(rows.join('')).size>=85);
 assert.match(read('print-signal.js'),/landing\(\)&&!document.body.classList.contains\('landing-sphere'\)/);
});

test('the entry references the processed image and all newly versioned runtime files exist',()=>{
 const html=read('player-terminal.html');const image=html.match(/\/assets\/(entrance-clean\.[a-f0-9]+\.webp)/)[1];
 assert.ok(fs.existsSync(new URL('../public/assets/'+image,import.meta.url)));
 assert.doesNotMatch(html,/entrance\.2ac482a14a01/);
 for(const file of ['scratch-board.js','slot-effects.js','landing-sphere.js'])assert.ok(html.includes('/'+file+'?v='));
});
