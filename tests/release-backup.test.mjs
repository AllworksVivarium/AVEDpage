import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {backupBeforeContainmentRelease,releaseId} from '../server-release-backup.mjs';

test('release snapshot is verified before migration and never replaced on restart',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'aved-release-backup-')),db=new DatabaseSync(join(folder,'test.db'));t.after(()=>{db.close();rmSync(folder,{recursive:true,force:true});});
 assert.equal((await backupBeforeContainmentRelease(db,folder,{production:true})).status,'not-required');
 db.exec('PRAGMA journal_mode=WAL;CREATE TABLE employees(id INTEGER PRIMARY KEY);CREATE TABLE balance_ledger(delta INTEGER);INSERT INTO employees VALUES(1);INSERT INTO balance_ledger VALUES(200000);');
 assert.equal((await backupBeforeContainmentRelease(db,folder,{production:false})).status,'development');
 const status=await backupBeforeContainmentRelease(db,folder,{production:true});assert.deepEqual(status,{status:'verified',integrity:'ok',foreignKeyViolations:0});
 db.exec('INSERT INTO balance_ledger VALUES(100000);');
 assert.deepEqual(await backupBeforeContainmentRelease(db,folder,{production:true}),status);
 const path=join(folder,'pre-'+releaseId+'-verified.sqlite'),copy=new DatabaseSync(path,{readOnly:true});assert.equal(copy.prepare('SELECT SUM(delta) n FROM balance_ledger').get().n,200000);copy.close();
 assert.equal(JSON.parse(readFileSync(path+'.json','utf8')).totals.balance_ledger.total,200000);
 assert.equal(db.prepare('SELECT SUM(delta) n FROM balance_ledger').get().n,300000);
});
