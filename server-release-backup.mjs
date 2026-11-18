import {existsSync,mkdirSync,writeFileSync,chmodSync,copyFileSync,unlinkSync,constants} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';

export const releaseId='scratch-ordinary-prizes-20261119';
// Runs before schema installation. The snapshot stays on the server data volume.
export async function backupBeforeContainmentRelease(db,dataDir,{production=process.env.NODE_ENV==='production'}={}){
 if(!production)return {status:'development'};
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='employees'").get())return {status:'not-required'};
 const directory=dataDir,target=join(directory,'pre-'+releaseId+'-verified.sqlite');
 function verify(path=target){const copy=new DatabaseSync(path,{readOnly:true});try{
  if(!copy.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='employees'").get())throw Error('Release backup is missing the employee table.');
  const integrity=copy.prepare('PRAGMA quick_check').get().quick_check;
  if(integrity!=='ok')throw Error('Release backup integrity check failed.');
  return {status:'verified',integrity,foreignKeyViolations:copy.prepare('PRAGMA foreign_key_check').all().length};
 }finally{copy.close();}}
 if(existsSync(target))return verify();
 db.exec('PRAGMA busy_timeout=15000');
 const integrity=db.prepare('PRAGMA quick_check').get().quick_check;
 if(integrity!=='ok')throw Error('Database integrity check failed before release.');
 mkdirSync(directory,{recursive:true});
 const pending=target+'.'+process.pid+'.'+Date.now()+'.pending';
 writeFileSync(pending,'',{flag:'wx',mode:0o600});
 await backup(db,pending);
 verify(pending);
 chmodSync(pending,0o600);
 copyFileSync(pending,target,constants.COPYFILE_EXCL);unlinkSync(pending);
 const result=verify(),snapshot=new DatabaseSync(target,{readOnly:true}),tables=snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('employees','balance_ledger','company_fund')").all();
 const totals=Object.fromEntries(tables.map(({name})=>[name,snapshot.prepare('SELECT COUNT(*) AS count'+(name==='balance_ledger'?',COALESCE(SUM(delta),0) AS total':name==='company_fund'?',COALESCE(SUM(amount),0) AS total':'')+' FROM '+name).get()]));
 snapshot.close();
 writeFileSync(target+'.json',JSON.stringify({release:releaseId,createdAt:new Date().toISOString(),...result,totals},null,2),{flag:'wx',mode:0o600});
 return result;
}
