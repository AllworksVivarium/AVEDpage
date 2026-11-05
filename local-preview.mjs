import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root=fileURLToPath(new URL('.',import.meta.url));
const settings=join(root,'.env.local');
if(!existsSync(settings)){
  writeFileSync(settings,`BOOTSTRAP_ADMIN_USERNAME=localadmin\nBOOTSTRAP_ADMIN_NAME=本地管理员\nBOOTSTRAP_ADMIN_PASSWORD=${randomBytes(12).toString('base64url')}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\n`,{mode:0o600});
}
process.loadEnvFile(settings);
process.env.NODE_ENV='development';
process.env.HOST='127.0.0.1';
process.env.PORT='4173';
process.env.DATA_DIR=join(root,'data-local');
mkdirSync(process.env.DATA_DIR,{recursive:true});
console.log('\n本地预览，不连接 AWS 数据库。');
console.log('玩家页面：http://127.0.0.1:4173/');
console.log('管理页面：http://127.0.0.1:4173/admin-terminal.html');
console.log('本地初始用户名：'+process.env.BOOTSTRAP_ADMIN_USERNAME);
console.log('本地初始密码：'+process.env.BOOTSTRAP_ADMIN_PASSWORD);
console.log('修改过数据库中的密码后，请使用修改后的密码。关闭此窗口会停止预览。\n');
await import('./server.mjs');
