import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
const path=resolve(process.argv[2]||'data/wanyehui.db');
if(!existsSync(path))throw new Error('Database does not exist: '+path);
const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=10000');
const keep="action='insert' AND target IN ('balance_ledger','forum_threads','forum_replies','posts','dossier_comments','chat_messages')";
const count=()=>db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN ${keep} THEN 1 ELSE 0 END) AS retained FROM activity_logs`).get();
console.log('Before:',count());
if(process.argv.includes('--apply')){
 const backup=path+'.activity-backup-'+new Date().toISOString().replace(/[:.]/g,'-');
 db.prepare('VACUUM INTO ?').run(backup);console.log('Backup:',backup);
 db.exec('BEGIN IMMEDIATE');
 try{const result=db.prepare(`DELETE FROM activity_logs WHERE NOT (${keep})`).run();db.exec('COMMIT');console.log('Deleted:',result.changes,'After:',count());}catch(e){db.exec('ROLLBACK');throw e;}
}else console.log('Dry run only. Add --apply after deploying result-only activity rules.');
db.close();
