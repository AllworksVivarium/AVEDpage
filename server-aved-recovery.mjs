// A second credential held in server configuration, independent of account edits.
export function installAvedRecovery({verifyPassword,employeeId=process.env.AVED_RECOVERY_EMPLOYEE_ID,passwordHash=process.env.AVED_RECOVERY_PASSWORD_HASH}){
 const id=typeof employeeId==='number'?employeeId:Number(employeeId),hash=typeof passwordHash==='string'?passwordHash:'';
 const configured=Number.isSafeInteger(id)&&id>0&&/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash);
 return {async verify(loginName,employee,password){
  if(!configured||loginName!=='AVED'||!employee||employee.id!==id||employee.username!=='AVED'||employee.role!=='admin'||employee.enabled!==1)return false;
  if(typeof password!=='string'||password.length<6||password.length>1024)return false;
  return verifyPassword(password,hash);
 }};
}
