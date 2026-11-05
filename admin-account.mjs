// Run inside the existing web container; never print/store plaintext passwords.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

const file = resolve(process.env.DATA_DIR || '.', 'wanyehui.db');
if (!existsSync(file)) throw new Error('数据库不存在。请先启动网站，或核对 DATA_DIR。');
const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
const action = process.argv[2];
if (action === 'list') {
  console.table(db.prepare('SELECT id,username,display_name,enabled FROM employees WHERE role=?').all('admin'));
  db.close();
} else if (action === 'reset') {
  if (!process.stdin.isTTY) throw new Error('请使用 docker compose exec web node admin-account.mjs reset，不要加 -T。');
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk); done(); } });
  const rl = createInterface({ input:process.stdin, output, terminal:true });
  try {
    const username = (await rl.question('管理员用户名：')).trim();
    const account = db.prepare('SELECT id,username FROM employees WHERE username=? AND role=?').get(username, 'admin');
    if (!account) throw new Error('未找到该管理员。请先用 list 查看用户名；不会创建或提升普通员工权限。');
    muted = true;
    process.stdout.write('新密码（至少 6 位，输入不显示）：');
    const password = await rl.question('');
    process.stdout.write('\n再次输入新密码：');
    const repeated = await rl.question('');
    process.stdout.write('\n');
    if (password.length < 6) throw new Error('密码至少 6 位。');
    if (password !== repeated) throw new Error('两次密码不一致，没有修改。');
    const salt = randomBytes(16).toString('hex');
    const hash = salt + ':' + pbkdf2Sync(password,salt,310000,32,'sha256').toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE employees SET password_hash=?,enabled=1 WHERE id=?').run(hash, account.id);
      db.prepare('DELETE FROM sessions WHERE employee_id=?').run(account.id);
      db.prepare('INSERT INTO activity_logs(employee_id,username,action,target,details) VALUES(?,?,?,?,?)')
        .run(account.id,account.username,'admin_password_reset','server_console',JSON.stringify({ source:'SSH console' }));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    process.stdout.write('已重置密码、启用账号并退出此账号的旧会话。请在网站重新登录。\n');
  } catch (error) {
    process.stderr.write(error.message+'\n');
    process.exitCode=1;
  } finally { muted=false; rl.close(); db.close(); }
} else {
  console.log('用法：node admin-account.mjs list 或 node admin-account.mjs reset');
  db.close();
  process.exitCode=1;
}
