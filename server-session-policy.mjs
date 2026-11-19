import {sessionTokens} from './server-auth.mjs';
export const NORMAL_IDLE_MS=5*60*60*1000;
export const REMEMBER_MS=7*24*60*60*1000;

// Only explicit activity renews ordinary sessions. Reads and polling never do.
export function installSessionPolicy({db,digest,secure='',clock=Date.now}){
 if(!db.prepare('PRAGMA table_info(sessions)').all().some(c=>c.name==='remembered')){
  db.exec('ALTER TABLE sessions ADD COLUMN remembered INTEGER NOT NULL DEFAULT 0');
  db.prepare('UPDATE sessions SET remembered=CASE WHEN issued_at>0 AND expires_at-issued_at>? THEN 1 ELSE 0 END').run(86400000);
  db.prepare('UPDATE sessions SET expires_at=MIN(expires_at,CASE WHEN issued_at>0 THEN issued_at ELSE ? END+CASE WHEN remembered=1 THEN ? ELSE ? END)').run(clock(),REMEMBER_MS,NORMAL_IDLE_MS);
 }
 const cookie=(token,expires)=>`wy_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.max(0,Math.ceil((expires-clock())/1000))}${secure}`;
 function resolve(req){
  const valid=[];
  for(const [position,token] of sessionTokens(req.headers.cookie).entries()){
   const tokenHash=digest(token);
   const session=db.prepare(`SELECT e.id,e.username,e.display_name AS displayName,e.department,e.identity_kind AS identityKind,e.containment_classification AS containmentClassification,e.position_title AS positionTitle,e.role,e.enabled,s.expires_at,s.issued_at AS issuedAt,s.remembered FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.token_hash=?`).get(tokenHash);
   if(!session||session.expires_at<=clock()||!session.enabled){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);continue;}
   valid.push({session,position,tokenHash,token});
  }
  return valid.sort((a,b)=>b.session.issuedAt-a.session.issuedAt||b.position-a.position)[0]||null;
 }
 function issue(id,token,remember){
  const time=clock(),expires=time+(remember===true?REMEMBER_MS:NORMAL_IDLE_MS);
  db.prepare('INSERT INTO sessions(token_hash,employee_id,expires_at,issued_at,remembered) VALUES(?,?,?,?,?)').run(digest(token),id,expires,time,remember===true?1:0);
  return cookie(token,expires);
 }
 function inspect(req,{activity=false}={}){
  const record=resolve(req);if(!record)return null;
  const {session,tokenHash,token}=record;
  if(activity&&!session.remembered){session.expires_at=clock()+NORMAL_IDLE_MS;db.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').run(session.expires_at,tokenHash);}
  return {data:{employeeId:session.id,expiresAt:session.expires_at,remembered:!!session.remembered,serverTime:clock()},cookie:activity&&!session.remembered?cookie(token,session.expires_at):null};
 }
 return {issue,inspect,employee:req=>resolve(req)?.session||null};
}
