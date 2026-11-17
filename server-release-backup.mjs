import {existsSync,mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

export const releaseId='containment-intranet-20261117';
// Runs before schema installation. The snapshot stays on the server data volume.
export function backupBeforeContainmentRelease(db,dataDir,{production=process.env.NODE_ENV==='production'}={}){
 if(!production)return {status:'development'};
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='employees'").get())return {status:'not-required'};
 const directory=join(dataDir,'release-backups'),target=join(directory,'pre-'+releaseId+'.sqlite');
 function verify(){const copy=new DatabaseSync(target,{readOnly:true});try{
  const integrity=copy.prepare('PRAGMA quick_check').get().quick_check;
  if(integrity!=='ok')throw Error('Release backup integrity check failed.');
  return {status:'verified',integrity,foreignKeyViolations:copy.prepare('PRAGMA foreign_key_check').all().length};
 }finally{copy.close();}}
 if(existsSync(target))return verify();
 db.exec('PRAGMA busy_timeout=15000');
 const integrity=db.prepare('PRAGMA quick_check').get().quick_check;
 if(integrity!=='ok')throw Error('Database integrity check failed before release.');
 mkdirSync(directory,{recursive:true});
 db.exec("VACUUM INTO '"+target.replaceAll("'","''")+"'");
 chmodSync(target,0o600);
 const result=verify(),snapshot=new DatabaseSync(target,{readOnly:true}),tables=snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('employees','balance_ledger','company_fund')").all();
 const totals=Object.fromEntries(tables.map(({name})=>[name,snapshot.prepare('SELECT COUNT(*) AS count'+(name==='balance_ledger'?',COALESCE(SUM(delta),0) AS total':name==='company_fund'?',COALESCE(SUM(amount),0) AS total':'')+' FROM '+name).get()]));
 snapshot.close();
 writeFileSync(target+'.json',JSON.stringify({release:releaseId,createdAt:new Date().toISOString(),...result,totals},null,2),{flag:'wx',mode:0o600});
 return result;
}
