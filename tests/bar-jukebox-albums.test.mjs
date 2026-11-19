import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {groupMusicAlbums,musicMetadata} from '../bar-music-albums.mjs';
import {installBarExtras,JUKEBOX_PRICE} from '../server-bar-extras.mjs';
import {installBarMusic} from '../server-bar-music.mjs';

function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,display_name TEXT);INSERT INTO employees VALUES(1,'One'),(2,'Two');CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT);CREATE TABLE balance_ledger(employee_id INTEGER,delta INTEGER,reason TEXT);INSERT INTO balance_ledger VALUES(1,5000000,'fixture'),(2,5000000,'fixture');`);
 let now=100000;const music={enabled:true,tracks:[{id:3,title:'Third',artist:'Artist',album:'Album',trackNumber:3,durationSeconds:60},{id:1,title:'First',artist:'Artist',album:'Album',trackNumber:1,durationSeconds:30},{id:2,title:'Second',artist:'Artist',album:'Album',trackNumber:2,durationSeconds:45}]};
 const balanceFor=id=>db.prepare('SELECT SUM(delta) n FROM balance_ledger WHERE employee_id=?').get(id).n;
 const options={db,clock:()=>now,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger VALUES(?,?,?)').run(id,delta,reason),name:id=>'Alias '+id,isContainment:()=>false,getMusic:()=>music,drinking:{},dayFor:()=>''};
 let service=installBarExtras(options);return {db,music,balanceFor,get service(){return service;},advance:ms=>now+=ms,restart:()=>service=installBarExtras(options),album:groupMusicAlbums(music.tracks)[0].id};
}

test('albums group by artist, keep stable IDs and use server track order',()=>{
 const tracks=[{id:4,album:'Shared',artist:'B',trackNumber:1},{id:2,album:'Shared',artist:'A',trackNumber:2},{id:1,album:'Shared',artist:'A',trackNumber:1},{id:9,title:'Loose'}],albums=groupMusicAlbums(tracks);
 assert.equal(albums.length,2);assert.deepEqual(albums[1].tracks.map(t=>t.id),[1,2]);assert.equal(groupMusicAlbums([...tracks].reverse()).find(a=>a.artist==='A').id,albums[1].id);assert.notEqual(albums[0].id,albums[1].id);
});
test('music metadata rejects executable links, control characters and invalid ordering',()=>{
 assert.throws(()=>musicMetadata({sourceUrl:'javascript:alert(1)'}));assert.throws(()=>musicMetadata({artist:'a\nb'}));assert.throws(()=>musicMetadata({trackNumber:1.5}));
 assert.equal(musicMetadata({album:' New '},{artist:'Artist',license:'CC BY 4.0'}).artist,'Artist');
});
test('album request is atomic, ordered, charged per track once and idempotent after restart',t=>{
 const f=fixture(t),request={albumId:f.album,requestId:'album-request-00001',message:'A quiet night',price:1,trackIds:[3,2,1]};
 f.service.requestSong({id:1},request);f.restart();f.service.requestSong({id:1},request);
 const queue=f.service.queue().queue;assert.deepEqual(queue.map(t=>t.trackId),[1,2,3]);assert.equal(new Set(queue.map(t=>t.batchId)).size,1);assert.ok(queue.every(t=>t.albumRequest&&t.artist==='Artist'));
 assert.equal(queue[1].startsAt,queue[0].endsAt);assert.equal(queue[2].startsAt,queue[1].endsAt);assert.equal(f.balanceFor(1),5000000-3*JUKEBOX_PRICE);assert.doesNotMatch(JSON.stringify(queue),/employeeId|employee_id/);
 assert.throws(()=>f.service.requestSong({id:1},{...request,trackId:1}));assert.throws(()=>f.service.requestSong({id:1},{...request,message:'Changed'}),/凭据/);
});
test('single requests and albums share a two-request cap and never interleave albums',t=>{
 const f=fixture(t);f.service.requestSong({id:1},{albumId:f.album,requestId:'album-request-00001'});f.service.requestSong({id:2},{trackId:2,requestId:'single-request-0001'});f.service.requestSong({id:1},{trackId:1,requestId:'single-request-0002'});
 const queue=f.service.queue().queue;assert.deepEqual(queue.map(t=>t.trackId),[1,2,3,2,1]);assert.throws(()=>f.service.requestSong({id:1},{trackId:1,requestId:'single-request-0003'}),/队列/);
});
test('removed album tracks refund only their own charge once and close the queue gap',t=>{
 const f=fixture(t);f.service.requestSong({id:1},{albumId:f.album,requestId:'album-request-00001'});f.music.tracks=f.music.tracks.filter(t=>t.id!==2);
 const queue=f.service.queue().queue;assert.deepEqual(queue.map(t=>t.trackId),[1,3]);assert.equal(queue[1].startsAt,queue[0].endsAt);assert.equal(f.balanceFor(1),5000000-2*JUKEBOX_PRICE);f.service.queue();assert.equal(f.balanceFor(1),5000000-2*JUKEBOX_PRICE);
});
test('expired album tracks do not keep an entire completed request in the queue',t=>{
 const f=fixture(t);f.service.requestSong({id:1},{albumId:f.album,requestId:'album-request-00001'});f.advance(31000);assert.deepEqual(f.service.queue().queue.map(t=>t.trackId),[2,3]);f.advance(120000);assert.equal(f.service.queue().queue.length,0);
});
test('insufficient balance and failure midway through an album cannot leave partial paid requests',t=>{
 const f=fixture(t);f.db.exec("UPDATE balance_ledger SET delta=10000 WHERE employee_id=1");assert.throws(()=>f.service.requestSong({id:1},{albumId:f.album,requestId:'album-request-00001'}),/余额不足/);assert.equal(f.service.queue().queue.length,0);
 f.db.exec("CREATE TRIGGER fail_album BEFORE INSERT ON bar_jukebox_requests WHEN NEW.track_id=2 BEGIN SELECT RAISE(ABORT,'fixture'); END");assert.throws(()=>f.service.requestSong({id:2},{albumId:f.album,requestId:'album-request-00002'}),/fixture/);assert.equal(f.balanceFor(2),5000000);assert.equal(f.service.queue().queue.length,0);assert.equal(f.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
});
test('legacy music schema migrates, metadata roundtrips and album order reaches the playlist',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec("CREATE TABLE bar_music(id INTEGER PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL DEFAULT '',file_name TEXT NOT NULL DEFAULT '',mime TEXT NOT NULL DEFAULT '',byte_size INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,deleted_at TEXT NOT NULL DEFAULT '');INSERT INTO bar_music(title,url) VALUES('Legacy','https://example.com/legacy.mp3');");
 let body,result;const service=installBarMusic({db,send:(res,status,data)=>result={status,data},readBody:async()=>body,requireEmployee:()=>true,requireAdmin:()=>true,dataDir:'.'});
 async function call(path,value,method='POST'){body=value;await service.handle({method},{headersSent:false},new URL(path,'http://localhost'));return result;}
 assert.equal(service.playlist().tracks[0].artist,'');
 const added=await call('/api/admin/bar-music',{title:'One',url:'https://example.com/one.mp3',album:'Album',artist:'Artist',trackNumber:1,license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',sourceUrl:'https://example.com/album'});assert.equal(added.status,201);
 const id=added.data.id;assert.equal((await call('/api/admin/bar-music/'+id,{enabled:false},'PUT')).status,200);assert.equal(service.playlist().albums.length,0);
 await call('/api/admin/bar-music/'+id,{enabled:true},'PUT');assert.equal(service.playlist().tracks.find(t=>t.id===id).artist,'Artist');assert.deepEqual(service.playlist().albums[0].trackIds,[id]);
 assert.equal((await call('/api/admin/bar-music/'+id,{sourceUrl:'javascript:bad'},'PUT')).status,400);assert.equal(service.playlist().tracks.find(t=>t.id===id).sourceUrl,'https://example.com/album');
});
