import {loginLimiter} from './server-auth.mjs';

const key=value=>value.trim().normalize('NFKC').toLowerCase();
const fail=(message,code,status=400)=>{throw Object.assign(Error(message),{code,status});};
export function assertAccountNameAvailable(db,id,username){
 if(typeof username!=='string'||!username.trim()||username.trim().length>40||/[\u0000-\u001f\u007f]/u.test(username))fail('登录用户名须为 1 至 40 个字符。','INVALID_USERNAME');
 const normalized=key(username);
 for(const row of db.prepare('SELECT id,username,display_name FROM employees WHERE id<>?').all(id)){
  if(key(row.username)===normalized)fail('这个登录用户名已被使用。','USERNAME_TAKEN',409);
  if(key(row.display_name)===normalized)fail('登录用户名不能与其他人的真名相同。','USERNAME_REALNAME_CONFLICT',409);
 }
 return username.trim();
}
export function installSelfAccount({db,verifyPassword,hashPassword}){
 const attempts=loginLimiter();
 return {
  async prepare(employee,data){
   if(['displayName','display_name','realName'].some(field=>data[field]!==undefined&&data[field]!==employee.displayName))fail('真名不可自行修改。','REALNAME_IMMUTABLE');
   const previous=db.prepare('SELECT username,password_hash FROM employees WHERE id=? AND enabled=1').get(employee.id);
   if(!previous)fail('当前身份连接已结束。','SESSION_EXPIRED',401);
   const username=data.username===undefined||data.username===previous.username?previous.username:assertAccountNameAvailable(db,employee.id,data.username);
   const password=data.password===undefined?'':data.password;
   if(typeof password!=='string'||password.length>1024||password!==''&&password.length<6)fail('新密码至少 6 位；不修改密码请留空。','INVALID_PASSWORD');
   if(password&&password!==data.passwordConfirmation)fail('两次输入的新密码不一致。','PASSWORD_MISMATCH');
   if(username===previous.username&&!password)return null;
   if(attempts.blocked(employee.id))fail('当前密码验证过于频繁，请稍后重试。','ACCOUNT_LIMITED',429);
   if(typeof data.currentPassword!=='string'||!data.currentPassword||data.currentPassword.length>1024)fail('修改登录信息前，请填写当前密码。','CURRENT_PASSWORD_REQUIRED');
   if(!await verifyPassword(data.currentPassword,previous.password_hash)){attempts.fail(employee.id);fail('当前密码不正确。','INVALID_CURRENT_PASSWORD');}
   attempts.clear(employee.id);
   return {previous,username,passwordHash:password?await hashPassword(password):previous.password_hash};
  },
  // Called synchronously inside the same transaction as the profile update.
  apply(employee,change,sessionHashes){
   if(!change)return;
   const now=db.prepare('SELECT username,password_hash FROM employees WHERE id=? AND enabled=1').get(employee.id);
   if(!now||now.username!==change.previous.username||now.password_hash!==change.previous.password_hash)fail('登录信息已经变更，请刷新后重新填写。','ACCOUNT_CHANGED',409);
   if(change.username!==now.username)assertAccountNameAvailable(db,employee.id,change.username);
   db.prepare('UPDATE employees SET username=?,password_hash=? WHERE id=?').run(change.username,change.passwordHash,employee.id);
   db.prepare('DELETE FROM sessions WHERE employee_id=? AND token_hash NOT IN ('+sessionHashes.map(()=>'?').join(',')+')').run(employee.id,...sessionHashes);
  }
 };
}
