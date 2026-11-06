import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function context(admin){
 const document={documentElement:{dataset:admin?{timeDisplay:'absolute'}:{}},body:{},querySelectorAll:()=>[],addEventListener:()=>{}};
 const result={Intl,Date,document,setInterval:()=>{},requestAnimationFrame:()=>{},MutationObserver:class{observe(){}},fetch:async()=>({ok:false})};result.window=result;return result;
}
test('admin dates retain Shanghai date and seconds while player dates stay relative',()=>{
 const source=readFileSync(new URL('../public/admin-time.js',import.meta.url),'utf8');
 const admin=context(true),player=context(false);vm.runInNewContext(source,admin);vm.runInNewContext(readFileSync(new URL('../public/terminal-time.js',import.meta.url),'utf8'),player);
 assert.match(admin.AVEDTime.markup('2026-11-06 12:34:56'),/>2026-11-06 20:34:56<\/time>/);
 assert.match(admin.AVEDTime.markup('2026-11-06T16:00:01Z'),/>2026-11-07 00:00:01<\/time>/);
 const record={created_at:'2026-11-06 12:34:56'};assert.equal(admin.AVEDTime.sanitize(record),record);
 player.AVEDTime.sync(Date.parse('2026-11-06T12:34:56Z'));
 assert.match(player.AVEDTime.markup('2026-11-06 12:34:56'),/>今天<\/time>/);
 assert.doesNotMatch(player.AVEDTime.sanitize(record).created_at,/2026-11-06/);
});
test('terminology replacement preserves exact dates only in the admin terminal',()=>{
 const source=readFileSync(new URL('../public/admin-terminology.js',import.meta.url),'utf8');
 const admin=context(true),player=context(false);vm.runInNewContext(source,admin);vm.runInNewContext(readFileSync(new URL('../public/terminology.js',import.meta.url),'utf8'),player);
 const text='归档：2026-11-06 12:34:56';
 assert.equal(admin.AVEDTerminology.transform(text),text);
 assert.doesNotMatch(player.AVEDTerminology.transform(text),/2026-11-06/);
});
