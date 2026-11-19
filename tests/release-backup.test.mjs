import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {backupBeforeContainmentRelease} from '../server-release-backup.mjs';

test('production starts and restarts without creating release backups or changing daily snapshots',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-daily-only-')),db=new DatabaseSync(':memory:');
 t.after(()=>{db.close();rmSync(folder,{recursive:true,force:true});});
 db.exec('CREATE TABLE employees(id INTEGER PRIMARY KEY);CREATE TABLE balance_ledger(delta INTEGER);INSERT INTO employees VALUES(1);INSERT INTO balance_ledger VALUES(200000);');
 const daily=join(folder,'daily-2026-11-19.sqlite');writeFileSync(daily,'existing daily snapshot');
 for(const production of [true,true,false]){
  assert.deepEqual(await backupBeforeContainmentRelease(db,folder,{production}),{status:'disabled',policy:'daily-and-five-day'});
 }
 assert.deepEqual(readdirSync(folder),['daily-2026-11-19.sqlite']);
 assert.equal(readFileSync(daily,'utf8'),'existing daily snapshot');
 assert.equal(db.prepare('SELECT SUM(delta) n FROM balance_ledger').get().n,200000);
});

test('startup does not require a writable backup directory or inspect the database',async()=>{
 const inaccessible=new Proxy({},{get(){throw Error('Unexpected database access');}});
 assert.deepEqual(await backupBeforeContainmentRelease(inaccessible,'',{production:true}),{status:'disabled',policy:'daily-and-five-day'});
});
