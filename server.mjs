import {installBar} from './server-bar.mjs';
import {installBarMusic} from './server-bar-music.mjs';
import {installAchievementAlerts} from './server-achievement-alerts.mjs';
import {installGameTax} from './server-game-tax.mjs';
import {installDossierContent,normalizeDossierContent,dossierView} from './server-dossier-content.mjs';
import {installEmployeeAttributes,normalizeAttributes,attributeValues,employeeAttributes,handleEmployeeAttributes} from './server-employee-attributes.mjs';
import {installDossierImages,normalizeDossierImage} from './server-dossier-images.mjs';
import {installLogRetention} from './server-log-retention.mjs';
import {installAvatarPresets,storedAvatar,avatarPresets} from './server-default-avatar.mjs';
import {installRadioRetention} from './server-radio-retention.mjs';
import {installCompanyRobots} from './server-company-robots.mjs';
import {announcementPublicationTime} from './server-announcement-time.mjs';
import {installGameHighlights} from './server-game-highlights.mjs';
import {installPersonnel,personnelAssignment} from './server-personnel.mjs';
import {installPersonal} from './server-personal.mjs';
import {installPlayerDesign} from './server-player-design.mjs';
import {installDerby} from './server-derby.mjs';
import {mediaReference,installMedia} from './server-media.mjs';
import {normalizeAvatar} from './server-avatar.mjs';
import {installCardTables} from './server-card-table.mjs';
import {networkContext,sessionTokens,loginLimiter} from './server-auth.mjs';
import {promisify} from 'node:util';
import { installCommunity } from './server-community.mjs';
import { installPlayerService } from './player-service.mjs';
import {installEconomy,proofRandom} from './server-economy.mjs';
import {installSky} from './server-sky.mjs';
import {installWelfare} from './server-welfare.mjs';
import {installAppearance} from './server-appearance.mjs';
import {directoryDepartment} from './server-directory.mjs';
import { createServer } from 'node:http';
import {workGate,burstLimiter} from './server-load-control.mjs';
import {installStatic} from './server-static.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2, pbkdf2Sync, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(root, 'public');
const dataDir = resolve(process.env.DATA_DIR || root);
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, 'wanyehui.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  qq_number TEXT UNIQUE,
  department TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','admin')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dossiers (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '可查阅',
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  anonymous_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS balance_ledger (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS profiles (
  employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  anonymous_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS forum_threads (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  anonymous_name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  anonymous_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS checkins (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  checkin_date TEXT NOT NULL,
  reward INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(employee_id, checkin_date)
);
CREATE TABLE IF NOT EXISTS game_tickets (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  cost INTEGER NOT NULL,
  prize INTEGER NOT NULL,
  seed TEXT NOT NULL,
  seed_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
if(!db.prepare('PRAGMA table_info(announcements)').all().some(c=>c.name==='published_at'))db.exec("ALTER TABLE announcements ADD COLUMN published_at TEXT NOT NULL DEFAULT ''");
db.exec("UPDATE announcements SET published_at=created_at WHERE published_at=''");
const employeeColumns = new Set(db.prepare('PRAGMA table_info(employees)').all().map(column => column.name));
for(const [name,type] of [['position_title',"TEXT NOT NULL DEFAULT ''"],['is_npc','INTEGER NOT NULL DEFAULT 0'],['is_leadership','INTEGER NOT NULL DEFAULT 0']])if(!employeeColumns.has(name))db.exec('ALTER TABLE employees ADD COLUMN '+name+' '+type);
installPersonnel(db);
installEmployeeAttributes(db);installDossierContent(db);
if (!employeeColumns.has('qq_number')) db.exec('ALTER TABLE employees ADD COLUMN qq_number TEXT');
if (!employeeColumns.has('created_at')) db.exec("ALTER TABLE employees ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
for(const action of ['INSERT','UPDATE','DELETE'])db.exec('DROP TRIGGER IF EXISTS audit_employees_'+action);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS employees_qq_number_unique ON employees(qq_number)');
for (const [table,column] of [['forum_threads','status'],['forum_replies','status']]) {
  const columns=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(item=>item.name));
  if(!columns.has(column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT 'published'`);
}

const hashPassword = password => {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
};
const derivePassword=promisify(pbkdf2),passwordWork=workGate();
const hashPasswordAsync=password=>passwordWork(async()=>{const salt=randomBytes(16).toString('hex');return salt+':'+(await derivePassword(password,salt,310000,32,'sha256')).toString('hex');});
const verifyPassword = async (password, stored) => {
  try {
    const [salt, saved] = stored.split(':');
    const candidate = await passwordWork(()=>derivePassword(password, salt, 310000, 32, 'sha256'));
    const expected = Buffer.from(saved, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch(error) { if(error.status===503)throw error;return false; }
};

const employeeCount = db.prepare('SELECT COUNT(*) AS n FROM employees').get().n;
if (employeeCount === 0 && process.env.BOOTSTRAP_ADMIN_USERNAME && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
  if(process.env.BOOTSTRAP_ADMIN_PASSWORD.length<6)throw new Error('管理员初始密码至少 6 位。');
  db.prepare('INSERT INTO employees (username,password_hash,display_name,department,role) VALUES (?,?,?,?,?)')
    .run(process.env.BOOTSTRAP_ADMIN_USERNAME, hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD), process.env.BOOTSTRAP_ADMIN_NAME || '系统管理员', '管理部', 'admin');
}
db.exec('CREATE TABLE IF NOT EXISTS content_initializations(name TEXT PRIMARY KEY)');
if (!db.prepare("SELECT 1 FROM content_initializations WHERE name='dossiers'").get() && db.prepare('SELECT COUNT(*) AS n FROM dossiers').get().n === 0) {
  const add = db.prepare('INSERT INTO dossiers (code,title,department,status,summary) VALUES (?,?,?,?,?)');
  add.run('WY-001', '咖啡机', '设施维护部', '观察中', '需要混脸熟，不然会很难喝。');
  add.run('WY-002', '一个电话', '档案管理部', '待补充', '卷宗待核。');
}
db.prepare("INSERT OR IGNORE INTO content_initializations VALUES('dossiers')").run();
if (!db.prepare("SELECT 1 FROM content_initializations WHERE name='announcements'").get() && db.prepare('SELECT COUNT(*) AS n FROM announcements').get().n === 0) {
  db.prepare('INSERT INTO announcements (title,body,pinned) VALUES (?,?,1)')
    .run('员工终端已启用', '公司内部通讯已接通。请各部门员工核验个人档案，查阅通告，并依权限使用各项设施。');
}
db.prepare("INSERT OR IGNORE INTO content_initializations VALUES('announcements')").run();

db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
db.prepare("INSERT OR IGNORE INTO profiles(employee_id,anonymous_name) SELECT id,'匿名员工-'||id FROM employees").run();

const prod = process.env.NODE_ENV === 'production';
if (prod && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.error('生产环境必须设置至少 32 个字符的 SESSION_SECRET。');
  process.exit(1);
}
const secret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const sessionDigest = token => createHmac('sha256',secret).update(token).digest('hex');
const sessionsTtl = 8 * 60 * 60 * 1000;
// Enable only after HTTPS is working; HTTP IP/local previews keep working by default.
const cookieSecurity = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
if(!db.prepare('PRAGMA table_info(sessions)').all().some(c=>c.name==='issued_at'))db.exec('ALTER TABLE sessions ADD COLUMN issued_at INTEGER NOT NULL DEFAULT 0');
const attempts=loginLimiter();
const loginBursts=burstLimiter({limit:60,windowMs:60000}),actionBursts=burstLimiter();
const readBody = (req, maxBytes=32768) => new Promise((resolveBody, reject) => {
  const chunks = []; let size = 0;
  req.on('data', chunk => { size += chunk.length; if (size > maxBytes) { reject(new Error('too large')); req.destroy(); } else chunks.push(chunk); });
  req.on('end', () => { try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('bad json')); } });
  req.on('error', reject);
});
const send = (res, status, body, headers={}) => {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers });
  res.end(JSON.stringify(body));
};
const sessionEmployee = req => {
  const tokens=sessionTokens(req.headers.cookie),valid=[];
  for(const [position,token] of tokens.entries()) {
    const tokenHash=sessionDigest(token);
    const session=db.prepare(`SELECT e.id,e.username,e.display_name AS displayName,e.department,e.identity_kind AS identityKind,e.position_title AS positionTitle,e.role,e.enabled,s.expires_at,s.issued_at AS issuedAt FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.token_hash=?`).get(tokenHash);
    if(!session||session.expires_at<Date.now()||!session.enabled){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);continue;}
    valid.push({session,position});
  }
  return valid.sort((a,b)=>b.session.issuedAt-a.session.issuedAt||b.position-a.position)[0]?.session||null;
};
const requireEmployee = (req, res) => {
  const employee = sessionEmployee(req);
  if (!employee) send(res, 401, { error:'请先登录。',code:sessionTokens(req.headers.cookie).length?'SESSION_EXPIRED':'SESSION_MISSING' });
  return employee;
};
const requireAdmin = (req, res) => {
  const employee = requireEmployee(req, res);
  if (employee && employee.role !== 'admin') { send(res, 403, { error:'只有管理员可以执行此操作。' }); return null; }
  return employee;
};
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const balanceFor = employeeId => personal ? personal.balance(employeeId) : db.prepare('SELECT COALESCE(SUM(delta),0) AS balance FROM balance_ledger WHERE employee_id=?').get(employeeId).balance;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai' }).format(new Date());
const secureRoll = (seedHex, range) => {
  const seed = Buffer.from(seedHex, 'hex');
  const limit = Math.floor(0x100000000 / range) * range;
  for (let counter=0; counter<64; counter++) {
    const bytes=createHmac('sha256',seed).update(String(counter)).digest();
    for (let offset=0; offset+4<=bytes.length; offset+=4) {
      const n=bytes.readUInt32BE(offset);
      if (n<limit) return n%range;
    }
  }
  throw new Error('random generation failed');
};
const publicProfile = employeeId => {
  const profile=db.prepare('SELECT anonymous_name AS anonymousName,bio,avatar_url AS avatarUrl,avatar_preset AS avatarPreset FROM profiles WHERE employee_id=?').get(employeeId) || {};
  const prefs=db.prepare('SELECT ranking_identity AS rankingIdentity,forum_identity AS forumIdentity FROM employee_preferences WHERE employee_id=?').get(employeeId)||{rankingIdentity:'anonymous',forumIdentity:'anonymous'};return { anonymousName:profile.anonymousName||'',bio:profile.bio||'',avatarUrl:storedAvatar(employeeId,profile.avatarUrl,profile.avatarPreset,256),avatarPreset:profile.avatarUrl?'':profile.avatarPreset||'',...prefs,attributes:employeeAttributes(db,employeeId),appearance:appearance.snapshot(employeeId) };
};
const recordLedger = (employeeId, delta, reason) => db.prepare('INSERT INTO balance_ledger (employee_id,delta,reason) VALUES (?,?,?)').run(employeeId,delta,reason);
const appearance=installAppearance({db,send,readBody,requireEmployee,balanceFor,recordLedger});
const adminMutation = (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) { send(res, 403, { error:'请求来源校验失败。' }); return false; } }
    catch { send(res, 403, { error:'请求来源校验失败。' }); return false; }
  }
  return true;
};
installAvatarPresets(db);
let economy,personal,highlights,gameTax;
const playerService=installPlayerService({db,send,readBody,requireEmployee,requireAdmin,balanceFor,recordLedger,publicProfile,today,sessionEmployee,getEconomy:()=>economy,getPersonal:()=>personal,getHighlights:()=>highlights,getGameTax:()=>gameTax});
economy=installEconomy({db,send,readBody,requireAdmin,requireEmployee,balanceFor,recordLedger,log:playerService.log});
// Preserve legacy split ordering before migrating independent fills.
playerService.initializeStockLots();
const companyRobots=installCompanyRobots({db,send,readBody,requireAdmin,balanceFor,recordLedger,log:playerService.log});
const welfare=installWelfare({db,send,readBody,requireEmployee,balanceFor,recordLedger});
highlights=installGameHighlights({db,send,requireEmployee});
gameTax=installGameTax({db,recordLedger});
const sky=installSky({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,economy,highlights,companyRobots,gameTax});
personal=installPersonal({db,send,readBody,requireEmployee,requireAdmin,balanceFor,recordLedger,publicProfile,today,highlights});
const achievementAlerts=installAchievementAlerts({db,send,readBody,requireEmployee,sessionEmployee});
const barMusic=installBarMusic({db,send,readBody,requireEmployee,requireAdmin,dataDir,onChange:()=>bar.refresh()});
const bar=installBar({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,getMusic:()=>barMusic.playlist()});
const derby=installDerby({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,highlights,companyRobots,gameTax});
const community=installCommunity({db,send,readBody,requireEmployee,requireAdmin,publicProfile,balanceFor,log:playerService.log});
const radioRetention=installRadioRetention(db);
const logRetention=installLogRetention(db);
const dossierImages=installDossierImages({db,send,requireAdmin});
const media=installMedia({db,send,requireEmployee});
const cardTables=installCardTables({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,highlights,gameTax});
const playerDesign=installPlayerDesign({db,root,send,readBody,requireAdmin,sessionEmployee});
db.exec(`
 CREATE INDEX IF NOT EXISTS chat_room_active ON chat_messages(room,id) WHERE deleted_at='';
 CREATE INDEX IF NOT EXISTS replies_thread_active ON forum_replies(thread_id,id) WHERE status='published' AND deleted_at='';
 CREATE INDEX IF NOT EXISTS posts_notice_active ON posts(announcement_id,id) WHERE status='published' AND deleted_at='';
 CREATE INDEX IF NOT EXISTS dossier_comment_active ON dossier_comments(dossier_id,id) WHERE deleted_at='';
 CREATE INDEX IF NOT EXISTS orders_employee_open ON stock_orders(employee_id,id) WHERE status='open';
 CREATE INDEX IF NOT EXISTS sky_pending ON sky_passengers(flight_id) WHERE status='aboard';
 CREATE INDEX IF NOT EXISTS fund_employee_kind ON company_fund(employee_id,kind);
 CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
`);
const serveStatic=installStatic({publicDir,design:playerDesign});
const server = createServer({headersTimeout:15000,requestTimeout:30000},async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      db.prepare('SELECT 1').get();
      return send(res, 200, { ok:true, service:'aved' });
    }
    const network=networkContext(req);
    if(cookieSecurity&&!network.secure&&url.pathname!=='/api/health') {
      const hostname=(req.headers.host||'').split(':')[0].toLowerCase();
      const host=hostname==='authority.aved.space'||['/admin','/admin-terminal.html'].includes(url.pathname)?'authority.aved.space':'aved.space';
      if(req.method==='GET'||req.method==='HEAD'){res.writeHead(308,{Location:'https://'+host+url.pathname+url.search,'Cache-Control':'no-store'});res.end();}
      else send(res,400,{error:'请从 https://'+host+' 接入公司终端。',code:'HTTPS_REQUIRED'});
      return;
    }
    if(url.pathname.startsWith('/api/')&&['POST','PUT','PATCH','DELETE'].includes(req.method)&&!adminMutation(req,res))return;
    if(url.pathname.startsWith('/api/admin/')){const actor=sessionEmployee(req);if(actor)res.on('finish',()=>{if(res.statusCode<400)playerService.log(actor.id,req.method,url.pathname);});}
    if(await playerDesign.handle(req,res,url))return;
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const limited=loginBursts(network.address);if(limited)return send(res,429,{error:'接入请求过于频繁，请稍后重试。',code:'LOGIN_LIMITED'},{'Retry-After':String(limited)});
      const now=Date.now();
      const {identifier,username,password,remember}=await readBody(req);
      const loginName=typeof identifier==='string'?identifier.trim():(typeof username==='string'?username.trim():'');
      if(!loginName||loginName.length>80||typeof password!=='string'||password.length>1024)return send(res,400,{error:'请填写有效账号和密码。',code:'CREDENTIALS_REQUIRED'});
      const attemptKey=createHmac('sha256',secret).update(network.address+'\0'+loginName.normalize('NFKC').toLowerCase()).digest('hex');
      const retryAfter=attempts.blocked(attemptKey);
      if(retryAfter)return send(res,429,{error:'本次接入尝试过于频繁，请稍后重试。',code:'LOGIN_LIMITED',retryAfter},{'Retry-After':String(retryAfter)});
      let employee = loginName ? db.prepare('SELECT id,password_hash,enabled FROM employees WHERE username=?').get(loginName) : null;
      if (!employee && loginName) {
        const nameMatches = db.prepare('SELECT id,password_hash,enabled FROM employees WHERE display_name=? ORDER BY id').all(loginName);
        if (nameMatches.length === 1) employee = nameMatches[0];
        else if (nameMatches.length > 1) return send(res,400,{error:'存在同名员工，请使用唯一用户名登录。'});
      }
      const valid = employee && typeof password === 'string' && (await verifyPassword(password, employee.password_hash)) && employee.enabled === 1;
      if(!valid){attempts.fail(attemptKey);playerService.log(employee?.id||null,'login.failed','terminal',{reason:employee?.enabled===0?'disabled':'credentials'});return send(res,401,{error:'账号或密码不正确，或该员工账号尚未启用。',code:'INVALID_CREDENTIALS'});}
      attempts.clear(attemptKey);
      const token = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO sessions (token_hash,employee_id,expires_at,issued_at) VALUES (?,?,?,?)')
        .run(sessionDigest(token), employee.id, now + (remember ? 30*86400000 : sessionsTtl),now);
      playerService.log(employee.id,'login');
      const cookie = `wy_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${remember ? 2592000 : 28800}${cookieSecurity}`;
      return send(res, 200, { ok:true, employee:db.prepare('SELECT username,display_name AS displayName FROM employees WHERE id=?').get(employee.id) }, { 'Set-Cookie':cookie });
    }
    if(req.method==='POST'&&(url.pathname.startsWith('/api/player/games/')||url.pathname==='/api/player/stocks'||url.pathname==='/api/player/chat'||url.pathname==='/api/player/card-table'||url.pathname.startsWith('/api/games/'))){
      const actor=requireEmployee(req,res);if(!actor)return;const retry=actionBursts(actor.id);
      if(retry)return send(res,429,{error:'操作过于频繁，请稍后重试。',code:'ACTION_LIMITED'},{'Retry-After':String(retry)});
    }
    if(await handleEmployeeAttributes({db,send,readBody,requireAdmin},req,res,url))return;
    if(await media.handle(req,res,url))return;
    if(dossierImages.handle(req,res,url))return;
    if(await cardTables.handle(req,res,url))return;
    if(await highlights.handle(req,res,url))return;
    if(await achievementAlerts.handle(req,res,url))return;
    if(await barMusic.handle(req,res,url))return;
    if(await bar.handle(req,res,url))return;
    if(await personal.handle(req,res,url))return;
    if(await derby.handle(req,res,url))return;
    if(await companyRobots.handle(req,res,url))return;
    if(await welfare.handle(req,res,url))return;
    if(await appearance.handle(req,res,url))return;
    if(await economy.handle(req,res,url))return;
    if(await sky.handle(req,res,url))return;
    if(await community.handle(req,res,url))return;
    if(await playerService.handle(req,res,url))return;
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      const user=sessionEmployee(req);if(user)playerService.log(user.id,'logout');
      for(const token of sessionTokens(req.headers.cookie))db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sessionDigest(token));
      return send(res, 200, { ok:true }, { 'Set-Cookie':`wy_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${cookieSecurity}` });
    }
    if (url.pathname === '/api/me' && req.method === 'GET') {
      const employee = requireEmployee(req,res); if (!employee) return;
      return send(res, 200, { employee:{ id:employee.id, username:employee.username, displayName:employee.displayName, department:employee.department, role:employee.role }, balance:balanceFor(employee.id),serverTime:Date.now() });
    }
    if (url.pathname === '/api/profile' && req.method === 'PUT') {
      const employee=requireEmployee(req,res); if(!employee)return;
      const {anonymousName,bio,avatarUrl,avatarPreset}=await readBody(req,2500000);
      if(typeof anonymousName!=='string'||anonymousName.trim().length<1||anonymousName.trim().length>32||typeof bio!=='string'||bio.length>500) return send(res,400,{error:'请填写匿名名称（最多 32 字），简介最多 500 字。'});
      if(avatarUrl!==undefined&&typeof avatarUrl!=='string')return send(res,400,{error:'头像资料无效。'});
      const previous=db.prepare('SELECT avatar_url,avatar_preset FROM profiles WHERE employee_id=?').get(employee.id)||{};
      if(avatarPreset!==undefined&&avatarPreset!==''&&!avatarPresets.includes(avatarPreset))return send(res,400,{error:'请选择有效的默认头像底色。'});
      const previousAvatar=previous.avatar_url||'';let preset=avatarPreset===undefined?previous.avatar_preset||'':avatarPreset,avatar=avatarUrl===undefined?previousAvatar:'';if(avatarPreset)preset=avatarPreset,avatar='';
      if(typeof avatarUrl==='string'&&avatarUrl.trim()) {
        if(avatarUrl===storedAvatar(employee.id,previousAvatar,previous.avatar_preset,256))avatar=avatarPreset? '':previousAvatar;
        else if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatarUrl)&&avatarUrl.length<=2200000) {try{avatar=await normalizeAvatar(avatarUrl);preset='';}catch{return send(res,400,{error:'头像无法读取，请使用 1.5 MB 以内的有效图片。'});}}
        else { try { const parsed=new URL(avatarUrl); if(parsed.protocol!=='https:'||parsed.href.length>1000) throw new Error(); avatar=parsed.href;preset=''; } catch { return send(res,400,{error:'头像请使用 PNG/JPG/WEBP 图片，或填写有效的 HTTPS 图片链接。'}); } }
      }
      if(avatarUrl===''&&avatarPreset===undefined)preset='';
      db.prepare(`INSERT INTO profiles(employee_id,anonymous_name,bio,avatar_url,avatar_preset,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(employee_id) DO UPDATE SET anonymous_name=excluded.anonymous_name,bio=excluded.bio,avatar_url=excluded.avatar_url,avatar_preset=excluded.avatar_preset,updated_at=CURRENT_TIMESTAMP`)
        .run(employee.id,anonymousName.trim(),bio.trim(),avatar,preset);
      return send(res,200,{profile:publicProfile(employee.id)});
    }
    if (url.pathname === '/api/checkin' && req.method === 'POST') {
      const employee=requireEmployee(req,res); if(!employee)return;
      const date=today(), reward=10000;
      db.exec('BEGIN IMMEDIATE');
      try {
        if(db.prepare('SELECT employee_id FROM checkins WHERE employee_id=? AND checkin_date=?').get(employee.id,date)){db.exec('ROLLBACK');return send(res,409,{error:'今天已经签到。'});}
        db.prepare('INSERT INTO checkins(employee_id,checkin_date,reward) VALUES(?,?,?)').run(employee.id,date,reward);
        recordLedger(employee.id,reward,'每日签到');db.exec('COMMIT');
      } catch(error){db.exec('ROLLBACK');throw error;}
      return send(res,200,{reward,balance:balanceFor(employee.id)});
    }
    if (url.pathname === '/api/checkin' && req.method === 'GET') {
      const employee=requireEmployee(req,res);if(!employee)return;
      const date=today(); const row=db.prepare('SELECT reward FROM checkins WHERE employee_id=? AND checkin_date=?').get(employee.id,date);
      return send(res,200,{checkedIn:!!row,reward:row?.reward||0});
    }
    if (url.pathname === '/api/games/scratch' && req.method === 'POST') {
      const employee=requireEmployee(req,res);if(!employee)return;
      const cost=1000; if(balanceFor(employee.id)<cost)return send(res,400,{error:'余额不足，无法购买刮刮乐。'});
      const seed=randomBytes(32).toString('hex'), seedHash=createHash('sha256').update(seed).digest('hex');
      const roll=secureRoll(seed,100000); let prize=0,prizeName='未中奖';
      if(roll===0){prize=500000;prizeName='超级大奖';} else if(roll<10){prize=50000;prizeName='特等奖';} else if(roll<100){prize=5000;prizeName='大奖';} else if(roll<15100){prize=1000;prizeName='中奖';}
      db.exec('BEGIN IMMEDIATE');
      try { if(balanceFor(employee.id)<cost){db.exec('ROLLBACK');return send(res,400,{error:'余额不足，无法购买刮刮乐。'});}
        recordLedger(employee.id,-cost,'刮刮乐购券');if(prize)recordLedger(employee.id,prize,'刮刮乐奖金');
        const tax=gameTax.charge({employeeId:employee.id,game:'scratch',key:seedHash,cost,prize});const result={prizeName,tax};const row=db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(employee.id,'scratch',cost,prize,seed,seedHash,JSON.stringify(result));db.exec('COMMIT');
        return send(res,200,{ticketId:Number(row.lastInsertRowid),cost,prize,tax,prizeName,balance:balanceFor(employee.id),seed,seedHash,roll});
      } catch(error){db.exec('ROLLBACK');throw error;}
    }
    if (url.pathname === '/api/games/slot' && req.method === 'POST') {
      const employee=requireEmployee(req,res);if(!employee)return;
      const cost=500;if(balanceFor(employee.id)<cost)return send(res,400,{error:'余额不足，无法启动老虎机。'});
      const seed=randomBytes(32).toString('hex'),seedHash=createHash('sha256').update(seed).digest('hex');
      const symbols=['◆','●','▲','✚','★']; const rolls=[secureRoll(seed,5),secureRoll(createHash('sha256').update(seed+'b').digest('hex'),5),secureRoll(createHash('sha256').update(seed+'c').digest('hex'),5)];
      const result=rolls.map(n=>symbols[n]);let multiplier=0;
      if(result.every(x=>x===result[0]))multiplier=result[0]==='★'?25:5;else if(new Set(result).size===2)multiplier=.5;
      const prize=cost*multiplier;
      db.exec('BEGIN IMMEDIATE');
      try{if(balanceFor(employee.id)<cost){db.exec('ROLLBACK');return send(res,400,{error:'余额不足，无法启动老虎机。'});}
        recordLedger(employee.id,-cost,'老虎机');if(prize)recordLedger(employee.id,prize,'老虎机奖金');
        const tax=gameTax.charge({employeeId:employee.id,game:'slot',key:seedHash,cost,prize});const row=db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(employee.id,'slot',cost,prize,seed,seedHash,JSON.stringify({symbols:result,multiplier,tax}));db.exec('COMMIT');
        return send(res,200,{ticketId:Number(row.lastInsertRowid),cost,prize,tax,multiplier,symbols:result,balance:balanceFor(employee.id),seed,seedHash});
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
    if (url.pathname === '/api/games/history' && req.method === 'GET') {
      const employee=requireEmployee(req,res);if(!employee)return;
      // An early cashout must not reveal the shared flight's limit to other players.
      return send(res,200,{items:db.prepare(`SELECT id,game,cost,prize,seed_hash AS seedHash,
        CASE WHEN game='sky' AND EXISTS(SELECT 1 FROM sky_flights f WHERE f.id=json_extract(game_tickets.result_json,'$.flight') AND f.ended_at=0)
          THEN json_remove(result_json,'$.safetyLine') ELSE result_json END AS result,
        created_at AS createdAt FROM game_tickets WHERE employee_id=? ORDER BY id DESC LIMIT 30`).all(employee.id)});
    }
    if (url.pathname === '/api/forum' && req.method === 'GET') {
      if(!requireEmployee(req,res))return;
      const items=db.prepare(`SELECT f.id,f.title,f.body,f.created_at AS createdAt,p.anonymous_name AS anonymousName,
        (SELECT COALESCE(SUM(delta),0) FROM balance_ledger l WHERE l.employee_id=f.employee_id) AS balance,
        (SELECT COUNT(*) FROM forum_replies r WHERE r.thread_id=f.id AND r.status='published') AS replyCount
        FROM forum_threads f JOIN profiles p ON p.employee_id=f.employee_id WHERE f.status='published' ORDER BY f.id DESC LIMIT 100`).all();
      return send(res,200,{items});
    }
    if (url.pathname === '/api/forum' && req.method === 'POST') {
      const employee=requireEmployee(req,res);if(!employee)return;
      const {title,body}=await readBody(req),profile=publicProfile(employee.id);
      if(!validText(title,120)||!validText(body,3000))return send(res,400,{error:'标题最多 120 字，内容最多 3000 字。'});
      if(!profile.anonymousName)return send(res,400,{error:'请先在个人主页设置匿名名称。'});
      const row=db.prepare('INSERT INTO forum_threads(employee_id,anonymous_name,title,body) VALUES(?,?,?,?)').run(employee.id,profile.anonymousName,title.trim(),body.trim());
      return send(res,201,{id:Number(row.lastInsertRowid)});
    }
    if (url.pathname.startsWith('/api/forum/') && url.pathname.endsWith('/replies') && req.method === 'GET') {
      if(!requireEmployee(req,res))return;const id=Number(url.pathname.split('/')[3]);
      return send(res,200,{items:db.prepare(`SELECT r.id,COALESCE((SELECT anonymous_name FROM profiles WHERE employee_id=r.employee_id),r.anonymous_name) AS anonymousName,r.body,r.created_at AS createdAt,
        (SELECT COALESCE(SUM(delta),0) FROM balance_ledger l WHERE l.employee_id=r.employee_id) AS balance FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id WHERE r.thread_id=? AND r.status='published' AND r.deleted_at='' AND t.status='published' AND t.deleted_at='' ORDER BY r.id`).all(id)});
    }
    if (url.pathname.startsWith('/api/forum/') && url.pathname.endsWith('/replies') && req.method === 'POST') {
      const employee=requireEmployee(req,res);if(!employee)return;const id=Number(url.pathname.split('/')[3]);const {body}=await readBody(req),profile=publicProfile(employee.id);
      if(!db.prepare('SELECT id FROM forum_threads WHERE id=?').get(id))return send(res,404,{error:'帖子不存在。'});
      if(!validText(body,2000)||!profile.anonymousName)return send(res,400,{error:'请设置匿名名称，回复最多 2000 字。'});
      const row=db.prepare('INSERT INTO forum_replies(thread_id,employee_id,anonymous_name,body) VALUES(?,?,?,?)').run(id,employee.id,profile.anonymousName,body.trim());return send(res,201,{id:Number(row.lastInsertRowid)});
    }
    if (url.pathname === '/api/admin/forum' && req.method === 'GET') {
      if(!requireAdmin(req,res))return;
      const items=db.prepare(`SELECT 'thread' AS itemType,f.id,f.title,f.body,f.anonymous_name AS anonymousName,f.status,f.created_at AS createdAt,
        f.employee_id AS employeeId,e.username,e.display_name AS displayName,e.department,NULL AS parentTitle
        FROM forum_threads f JOIN employees e ON e.id=f.employee_id
        UNION ALL
        SELECT 'reply',r.id,t.title,r.body,r.anonymous_name,r.status,r.created_at,
        r.employee_id,e.username,e.display_name,e.department,t.title
        FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id JOIN employees e ON e.id=r.employee_id ORDER BY createdAt DESC`).all();
      return send(res,200,{items});
    }
    if (url.pathname === '/api/admin/posts' && req.method === 'GET') {
      if(!requireAdmin(req,res))return;
      const items=db.prepare(`SELECT p.id,'comment' AS itemType,a.title,p.body,p.anonymous_name AS anonymousName,p.status,p.created_at AS createdAt,
        p.employee_id AS employeeId,e.username,e.display_name AS displayName,e.department
        FROM posts p JOIN announcements a ON a.id=p.announcement_id JOIN employees e ON e.id=p.employee_id ORDER BY p.id DESC`).all();
      return send(res,200,{items});
    }
    if (url.pathname === '/api/admin/speech-records' && req.method === 'GET') {
      if(!requireAdmin(req,res))return;
      const employeeIdParam = url.searchParams.get('employeeId');
      const employeeId = employeeIdParam == null ? null : Number(employeeIdParam);
      if (employeeIdParam != null && (!Number.isInteger(employeeId) || employeeId < 1)) return send(res,400,{error:'employeeId 必须是正整数。'});
      const sourceType = url.searchParams.get('sourceType');
      if (sourceType != null && !['comment','thread','reply'].includes(sourceType)) return send(res,400,{error:'sourceType 仅支持 comment/thread/reply。'});
      const usernameParam = url.searchParams.get('username');
      const username = usernameParam == null ? null : usernameParam.trim();
      if (username != null && username.length > 40) return send(res,400,{error:'username 最多 40 个字符。'});
      const from = url.searchParams.get('from');
      if (from != null && !validDate(from)) return send(res,400,{error:'from 日期格式应为 YYYY-MM-DD。'});
      const to = url.searchParams.get('to');
      if (to != null && !validDate(to)) return send(res,400,{error:'to 日期格式应为 YYYY-MM-DD。'});
      const keywordParam = url.searchParams.get('keyword');
      const keyword = keywordParam == null ? null : keywordParam.trim();
      if (keyword != null && keyword.length > 120) return send(res,400,{error:'keyword 最多 120 个字符。'});
      const limitParam = Number(url.searchParams.get('limit') || 200);
      if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > 500) return send(res,400,{error:'limit 必须是 1 到 500 之间的整数。'});
      const keywordLike = keyword ? `%${keyword}%` : null;
      const usernameLike = username ? `%${username}%` : null;
      const items = db.prepare(`SELECT * FROM (
        SELECT 'comment' AS sourceType,p.id AS sourceId,p.created_at AS createdAt,p.anonymous_name AS anonymousName,
          p.body,NULL AS title,a.title AS parentTitle,p.employee_id AS employeeId,e.username,e.display_name AS displayName,e.department
        FROM posts p JOIN announcements a ON a.id=p.announcement_id JOIN employees e ON e.id=p.employee_id
        UNION ALL
        SELECT 'thread',f.id,f.created_at,f.anonymous_name,f.body,f.title,NULL,f.employee_id,e.username,e.display_name,e.department
        FROM forum_threads f JOIN employees e ON e.id=f.employee_id
        UNION ALL
        SELECT 'reply',r.id,r.created_at,r.anonymous_name,r.body,NULL,t.title,r.employee_id,e.username,e.display_name,e.department
        FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id JOIN employees e ON e.id=r.employee_id
      ) records
      WHERE (? IS NULL OR employeeId = ?)
        AND (? IS NULL OR sourceType = ?)
        AND (? IS NULL OR username LIKE ?)
        AND (? IS NULL OR date(createdAt) >= date(?))
        AND (? IS NULL OR date(createdAt) <= date(?))
        AND (? IS NULL OR (anonymousName LIKE ? OR body LIKE ? OR COALESCE(title,'') LIKE ? OR COALESCE(parentTitle,'') LIKE ? OR displayName LIKE ? OR username LIKE ?))
      ORDER BY createdAt DESC
      LIMIT ?`).all(
        employeeId, employeeId,
        sourceType, sourceType,
        usernameLike, usernameLike,
        from, from,
        to, to,
        keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike, keywordLike,
        limitParam
      );
      return send(res,200,{items});
    }
    if (url.pathname.startsWith('/api/admin/forum/threads/') && req.method === 'DELETE') {
      if(!requireAdmin(req,res))return;const result=db.prepare('DELETE FROM forum_threads WHERE id=?').run(Number(url.pathname.split('/').at(-1)));if(!result.changes)return send(res,404,{error:'帖子不存在。'});return send(res,200,{ok:true});
    }
    if (url.pathname.startsWith('/api/admin/forum/replies/') && req.method === 'DELETE') {
      if(!requireAdmin(req,res))return;const result=db.prepare('DELETE FROM forum_replies WHERE id=?').run(Number(url.pathname.split('/').at(-1)));if(!result.changes)return send(res,404,{error:'回复不存在。'});return send(res,200,{ok:true});
    }
    if (url.pathname === '/api/dossiers' && req.method === 'GET') {
      if (!requireEmployee(req,res)) return;
      return send(res, 200, { items:db.prepare('SELECT id,code,title,department,status,summary,classification,procedures,sections_json FROM dossiers ORDER BY id DESC').all().map(dossierView) });
    }
    if (url.pathname === '/api/announcements' && req.method === 'GET') {
      if (!requireEmployee(req,res)) return;
      return send(res, 200, { items:db.prepare(`SELECT a.id,a.title,a.body,a.pinned,a.recipient,CASE WHEN a.issuer_explicit=1 THEN a.issuer ELSE '' END AS issuer,a.drafter,a.issued_on AS issuedOn,COALESCE(NULLIF(a.published_at,''),a.created_at) AS createdAt,COALESCE(NULLIF(a.published_at,''),a.created_at) AS publishedAt,
        (SELECT COUNT(*) FROM posts p WHERE p.announcement_id=a.id AND p.status='published' AND p.deleted_at='') AS postCount
        FROM announcements a ORDER BY a.pinned DESC,datetime(COALESCE(NULLIF(a.published_at,''),a.created_at)) DESC,a.id DESC`).all() });
    }
    if (url.pathname === '/api/posts' && req.method === 'GET') {
      if (!requireEmployee(req,res)) return;
      const announcementId = Number(url.searchParams.get('announcementId'));
      if (!Number.isInteger(announcementId) || announcementId < 1) return send(res,400,{error:'公告编号无效。'});
      return send(res,200,{items:db.prepare(`SELECT p.id,p.anonymous_name AS anonymousName,p.body,p.created_at AS createdAt,
        (SELECT COALESCE(SUM(delta),0) FROM balance_ledger l WHERE l.employee_id=p.employee_id) AS balance
        FROM posts p WHERE p.announcement_id=? AND p.status='published' ORDER BY p.id DESC`).all(announcementId)});
    }
    if (url.pathname === '/api/posts' && req.method === 'POST') {
      const employee = requireEmployee(req,res); if (!employee) return;
      const { announcementId, anonymousName, body } = await readBody(req);
      const announcement = Number(announcementId);
      if (!Number.isInteger(announcement) || !db.prepare('SELECT id FROM announcements WHERE id=?').get(announcement)) return send(res,400,{error:'请选择有效公告。'});
      if (!validText(anonymousName,32) || !validText(body,2000)) return send(res,400,{error:'匿名名称最多 32 字，留言最多 2000 字。'});
      const result = db.prepare('INSERT INTO posts (announcement_id,employee_id,anonymous_name,body) VALUES (?,?,?,?)').run(announcement,employee.id,anonymousName.trim(),body.trim());
      return send(res,201,{id:Number(result.lastInsertRowid)});
    }
    if (url.pathname === '/api/admin/employees' && req.method === 'GET') {
      if (!requireAdmin(req,res)) return;
      return send(res,200,{items:db.prepare(`SELECT e.id,e.username,e.display_name AS displayName,e.qq_number AS qqNumber,e.department,e.identity_kind AS identityKind,e.position_title AS positionTitle,e.is_npc AS isNpc,e.is_leadership AS isLeadership,e.role,e.enabled,e.attributes_json AS attributes,
        COALESCE((SELECT SUM(delta) FROM balance_ledger l WHERE l.employee_id=e.id),0) AS balance,COALESCE((SELECT bio FROM profiles p WHERE p.employee_id=e.id),'') AS archiveBio FROM employees e WHERE NOT EXISTS(SELECT 1 FROM company_robots r WHERE r.employee_id=e.id) AND (?=0 OR e.identity_kind IN ('player_employee','player_containment','planning_member')) ORDER BY e.id`).all(url.searchParams.get('roster')==='personnel'?1:0).map(e=>({...e,attributes:attributeValues(e.attributes)}))});
    }
    if (url.pathname === '/api/admin/employees' && req.method === 'POST') {
      const admin = requireAdmin(req,res); if (!admin) return;
      const data=await readBody(req);
      const {username,password,displayName,qqNumber,role,initialBalance}=data;
      let attributes;try{attributes=data.attributes===undefined?'':normalizeAttributes(data.attributes);}catch(e){return send(res,400,{error:e.message});}
      let assignment;try{assignment=personnelAssignment(data);}catch(e){return send(res,400,{error:e.message});}
      const {identityKind,department,positionTitle,isNpc,isLeadership}=assignment;
      if(data.archiveBio!==undefined&&(typeof data.archiveBio!=='string'||data.archiveBio.length>500))return send(res,400,{error:'收容简介最多 500 字。'});
      if(typeof isNpc!=='boolean'||typeof isLeadership!=='boolean'||typeof positionTitle!=='string'||positionTitle.length>80||((isNpc||isLeadership)&&!positionTitle.trim()))return send(res,400,{error:'请填写有效职务名称（最多 80 字）。'});
      if(!validText(displayName,80))return send(res,400,{error:'请填写姓名或收容物名称（最多 80 字）。'});
      if (!isNpc&&(!validText(username,40)||typeof password!=='string'||password.length<6)) return send(res,400,{error:'请填写唯一用户名、员工姓名，并设置至少 6 位密码。'});
      if(initialBalance!==undefined&&(!Number.isSafeInteger(initialBalance)||Math.abs(initialBalance)>100000000))return send(res,400,{error:'初始余额必须是 -100,000,000 到 100,000,000 之间的整数，可为负数。'});
      const passwordHash=await hashPasswordAsync(isNpc?randomBytes(32).toString('hex'):password);
      try {
        db.exec('BEGIN IMMEDIATE');
        const result = db.prepare('INSERT INTO employees (username,password_hash,display_name,qq_number,department,role,position_title,is_npc,is_leadership,enabled,identity_kind,attributes_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(isNpc?'npc-'+randomBytes(8).toString('hex'):username.trim(),passwordHash,displayName.trim(),validText(qqNumber,30)?qqNumber.trim():null,department,!isNpc&&role==='admin'?'admin':'employee',positionTitle.trim(),isNpc?1:0,isLeadership?1:0,isNpc?0:1,identityKind,attributes);
        const id=Number(result.lastInsertRowid);db.prepare('INSERT INTO profiles(employee_id,anonymous_name,bio) VALUES(?,?,?)').run(id,`匿名员工-${id}`,data.archiveBio?.trim()||'');
        if(!isNpc&&initialBalance)db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason,created_by) VALUES(?,?,?,?)').run(id,initialBalance,'员工初始余额',admin.id);
        db.exec('COMMIT');return send(res,201,{id});
      } catch { if(db.isTransaction)db.exec('ROLLBACK');return send(res,409,{error:'账号或 QQ 号已存在，请检查后重试。'}); }
    }
    if (url.pathname.startsWith('/api/admin/employees/') && !url.pathname.endsWith('/balance') && req.method === 'PUT') {
      if(!requireAdmin(req,res))return;
      const employeeId=Number(url.pathname.split('/').at(-1));
      const data=await readBody(req),{displayName,qqNumber,password}=data;
      const previous=db.prepare('SELECT is_npc AS isNpc,identity_kind AS identityKind,department,position_title AS positionTitle,attributes_json AS attributesRaw FROM employees WHERE id=?').get(employeeId);
      if(!previous)return send(res,404,{error:'员工档案不存在。'});
      previous.isNpc=!!previous.isNpc;
      let attributes;try{attributes=data.attributes===undefined?previous.attributesRaw:normalizeAttributes(data.attributes);}catch(e){return send(res,400,{error:e.message});}
      let assignment;try{assignment=personnelAssignment(data,previous);}catch(e){return send(res,400,{error:e.message});}
      const {identityKind,department,positionTitle,isNpc,isLeadership}=assignment;
      if(data.archiveBio!==undefined&&(typeof data.archiveBio!=='string'||data.archiveBio.length>500))return send(res,400,{error:'收容简介最多 500 字。'});
      if(!Number.isInteger(employeeId)||!validText(displayName,80)||typeof department!=='string'||department.length>80)return send(res,400,{error:'员工姓名或部门无效。'});
      const qq=qqNumber==null||qqNumber===''?null:(validText(qqNumber,30)?qqNumber.trim():undefined);
      if(qq===undefined)return send(res,400,{error:'QQ 号最多 30 个字符。'});
      if(previous.isNpc&&!isNpc&&(!password||password.length<6))return send(res,400,{error:'开通玩家登录前请设置登录密码。'});
      if(password!==undefined&&password!==''&&(typeof password!=='string'||password.length<6))return send(res,400,{error:'新密码至少 6 位；不修改密码请留空。'});
      const passwordHash=typeof password==='string'&&password?await hashPasswordAsync(password):null;
      try{
        const result=db.prepare('UPDATE employees SET display_name=?,qq_number=?,department=?,enabled=?,position_title=?,is_npc=?,is_leadership=?,identity_kind=?,attributes_json=? WHERE id=?').run(displayName.trim(),qq,department,isNpc?0:1,positionTitle.trim(),isNpc?1:0,isLeadership?1:0,identityKind,attributes,employeeId);
        if(!result.changes)return send(res,404,{error:'员工账号不存在。'});
        if(data.archiveBio!==undefined)db.prepare('UPDATE profiles SET bio=? WHERE employee_id=?').run(data.archiveBio.trim(),employeeId);
        if(typeof password==='string'&&password)db.prepare('UPDATE employees SET password_hash=? WHERE id=?').run(passwordHash,employeeId);
        return send(res,200,{ok:true});
      }catch{return send(res,409,{error:'QQ 号已被其他员工使用，请检查后重试。'});}
    }
    if (url.pathname.startsWith('/api/admin/employees/') && req.method === 'DELETE') {
      if (!requireAdmin(req,res)) return;
      const employeeId = Number(url.pathname.split('/').at(-1));
      if (!Number.isInteger(employeeId) || employeeId < 1) return send(res,400,{error:'员工编号无效。'});
      const result = db.prepare('DELETE FROM employees WHERE id=?').run(employeeId);
      if (!result.changes) return send(res,404,{error:'员工账号不存在。'});
      return send(res,200,{ok:true});
    }
    if (url.pathname.startsWith('/api/admin/employees/') && url.pathname.endsWith('/balance') && req.method === 'POST') {
      const admin = requireAdmin(req,res); if (!admin) return;
      const employeeId = Number(url.pathname.split('/')[4]);
      const { delta,balance,expectedBalance,reason } = await readBody(req),setting=balance!==undefined;
      const employee = db.prepare('SELECT id FROM employees WHERE id=?').get(employeeId);
      if (!employee || !validText(reason,200) || (setting
        ? delta!==undefined || !Number.isSafeInteger(balance) || Math.abs(balance)>100000000 || !Number.isSafeInteger(expectedBalance)
        : !Number.isSafeInteger(delta) || delta===0 || Math.abs(delta)>100000000)) return send(res,400,{error:'请填写有效的整数余额和调整原因；余额可为负数。'});
      db.exec('BEGIN IMMEDIATE');
      try {
        const current=balanceFor(employeeId);
        if(setting&&current!==expectedBalance){db.exec('ROLLBACK');return send(res,409,{error:'余额已发生变化，请刷新员工名册后重新设置。'});}
        const change=setting?balance-current:delta;
        if(!Number.isSafeInteger(change)||!Number.isSafeInteger(current+change)){db.exec('ROLLBACK');return send(res,400,{error:'余额超出可处理的整数范围。'});}
        if(change)db.prepare('INSERT INTO balance_ledger (employee_id,delta,reason,created_by) VALUES (?,?,?,?)').run(employeeId,change,reason.trim(),admin.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return send(res,200,{balance:balanceFor(employeeId)});
    }
    if (url.pathname === '/api/admin/dossiers' && req.method === 'POST') {
      const admin = requireAdmin(req,res); if (!admin) return;
      const dossierData=await readBody(req,2500000);const { code,title,department,status,summary,imageData } = dossierData;
      let image,content;try{image=await normalizeDossierImage(imageData);content=normalizeDossierContent(dossierData);}catch(error){return send(res,400,{error:error.message});}
      if (!validText(code,30)||!validText(title,100)||!validText(summary,12000)) return send(res,400,{error:'请填写档案编号、名称和内容。'});
      try { const result=db.prepare('INSERT INTO dossiers (code,title,department,status,summary,image_data,classification,procedures,sections_json) VALUES (?,?,?,?,?,?,?,?,?)').run(code.trim(),title.trim(),String(department||'').slice(0,80),String(status||'可查阅').slice(0,40),summary.trim(),image,content.classification,content.procedures,content.sectionsJSON); return send(res,201,{id:Number(result.lastInsertRowid)}); }
      catch { return send(res,409,{error:'档案编号已存在。'}); }
    }
    if (url.pathname.startsWith('/api/admin/dossiers/') && req.method === 'DELETE') {
      if (!requireAdmin(req,res)) return;
      if(!db.prepare('DELETE FROM dossiers WHERE id=?').run(Number(url.pathname.split('/').at(-1))).changes)return send(res,404,{error:'卷宗不存在。'});
      return send(res,200,{ok:true});
    }
    if (url.pathname === '/api/admin/announcements' && req.method === 'GET') {
      if(!requireAdmin(req,res))return;
      const offset=Number(url.searchParams.get('offset')||0);
      if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return send(res,400,{error:'无效分页。'});
      const items=db.prepare(`SELECT id,title,substr(body,1,141) AS excerpt,pinned,COALESCE(NULLIF(published_at,''),created_at) AS createdAt FROM announcements ORDER BY pinned DESC,datetime(COALESCE(NULLIF(published_at,''),created_at)) DESC,id DESC LIMIT 11 OFFSET ?`).all(offset);
      const more=items.length>10;if(more)items.pop();
      return send(res,200,{items:items.map(x=>({...x,excerpt:Array.from(x.excerpt).length>140?Array.from(x.excerpt).slice(0,140).join('')+'…':x.excerpt})),next:more?offset+items.length:null});
    }
    if (/^\/api\/admin\/announcements\/\d+$/.test(url.pathname) && req.method === 'GET') {
      if(!requireAdmin(req,res))return;
      const item=db.prepare("SELECT id,title,body,pinned,recipient,CASE WHEN issuer_explicit=1 THEN issuer ELSE '' END AS issuer,drafter,issued_on AS issuedOn,COALESCE(NULLIF(published_at,''),created_at) AS createdAt FROM announcements WHERE id=?").get(Number(url.pathname.split('/').at(-1)));
      return send(res,item?200:404,item?{item}:{error:'公告不存在。'});
    }
    if (/^\/api\/admin\/announcements\/\d+\/comments$/.test(url.pathname) && req.method === 'GET') {
      if(!requireAdmin(req,res))return;
      const offset=Number(url.searchParams.get('offset')||0);
      if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return send(res,400,{error:'无效分页。'});
      const items=db.prepare("SELECT p.id,p.body,p.created_at AS createdAt,e.display_name AS displayName FROM posts p LEFT JOIN employees e ON e.id=p.employee_id WHERE p.announcement_id=? AND p.deleted_at='' ORDER BY julianday(p.created_at),p.id LIMIT 11 OFFSET ?").all(Number(url.pathname.split('/')[4]),offset);
      const more=items.length>10;if(more)items.pop();return send(res,200,{items,next:more?offset+items.length:null});
    }
    if (/^\/api\/admin\/posts\/\d+$/.test(url.pathname) && req.method === 'PUT') {
      if(!requireAdmin(req,res))return;
      const data=await readBody(req);let stamp;
      try{stamp=announcementPublicationTime(data.createdAt);if(!stamp)throw Error('请填写评论发布日期和时间。');}catch(error){return send(res,400,{error:error.message});}
      const id=Number(url.pathname.split('/').at(-1));
      if(!db.prepare("UPDATE posts SET created_at=? WHERE id=? AND deleted_at=''").run(stamp,id).changes)return send(res,404,{error:'评论不存在。'});
      return send(res,200,{ok:true,createdAt:stamp});
    }
    if (url.pathname === '/api/admin/announcements' && req.method === 'POST') {
      const admin = requireAdmin(req,res); if (!admin) return;
      const { title,body,pinned,publishedAt,recipient='',issuer='',drafter='',issuedOn='' } = await readBody(req);
      if(typeof recipient!=='string'||recipient.length>200||(typeof issuer!=='string'||issuer.length>80)||typeof drafter!=='string'||drafter.length>80||typeof issuedOn!=='string'||(issuedOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)||!Number.isFinite(Date.parse(issuedOn))||new Date(issuedOn).toISOString().slice(0,10)!==issuedOn)))return send(res,400,{error:'请核对发布单位、起草人及签发日期。'});
      if (!validText(title,150)||!validText(body,5000)) return send(res,400,{error:'公告标题最多 150 字，正文最多 5000 字。'});
      let publication;try{publication=announcementPublicationTime(publishedAt)||new Date().toISOString();}catch(error){return send(res,400,{error:error.message});}
      const result=db.prepare('INSERT INTO announcements (title,body,pinned,created_by,recipient,issuer,issuer_explicit,drafter,issued_on,published_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(title.trim(),body.trim(),pinned?1:0,admin.id,recipient.trim(),issuer.trim(),issuer.trim()?1:0,drafter.trim(),issuedOn,publication);
      return send(res,201,{id:Number(result.lastInsertRowid)});
    }
    if (/^\/api\/admin\/announcements\/\d+$/.test(url.pathname) && req.method === 'PUT') {
      if(!requireAdmin(req,res))return;const {title,body,pinned,publishedAt,recipient,issuer,drafter,issuedOn}=await readBody(req);
      if((recipient!==undefined&&(typeof recipient!=='string'||recipient.length>200))||(issuer!==undefined&&(typeof issuer!=='string'||issuer.length>80))||(drafter!==undefined&&(typeof drafter!=='string'||drafter.length>80))||(issuedOn!==undefined&&(typeof issuedOn!=='string'||(issuedOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)||!Number.isFinite(Date.parse(issuedOn))||new Date(issuedOn).toISOString().slice(0,10)!==issuedOn)))))return send(res,400,{error:'请核对发布单位、起草人及签发日期。'});
      if(!validText(title,150)||!validText(body,5000)||typeof pinned!=='boolean')return send(res,400,{error:'请填写公告标题、正文及置顶状态。'});
      let publication;try{publication=announcementPublicationTime(publishedAt);}catch(error){return send(res,400,{error:error.message});}
      if(!db.prepare("UPDATE announcements SET title=?,body=?,pinned=?,published_at=COALESCE(?,NULLIF(published_at,''),created_at),recipient=COALESCE(?,recipient),issuer=COALESCE(?,issuer),issuer_explicit=COALESCE(?,issuer_explicit),drafter=COALESCE(?,drafter),issued_on=COALESCE(?,issued_on) WHERE id=?").run(title.trim(),body.trim(),pinned?1:0,publication??null,recipient?.trim()??null,issuer?.trim()??null,issuer===undefined?null:(issuer.trim()?1:0),drafter?.trim()??null,issuedOn??null,Number(url.pathname.split('/').at(-1))).changes)return send(res,404,{error:'公告不存在。'});
      return send(res,200,{ok:true});
    }
    if (url.pathname.startsWith('/api/admin/announcements/') && req.method === 'DELETE') {
      if (!requireAdmin(req,res)) return;
      if(!db.prepare('DELETE FROM announcements WHERE id=?').run(Number(url.pathname.split('/').at(-1))).changes)return send(res,404,{error:'公告不存在。'});
      return send(res,200,{ok:true});
    }
    if (url.pathname.startsWith('/api/admin/posts/') && req.method === 'DELETE') {
      if (!requireAdmin(req,res)) return;
      const result=db.prepare('DELETE FROM posts WHERE id=?').run(Number(url.pathname.split('/').at(-1)));
      if(!result.changes)return send(res,404,{error:'帖子不存在。'});
      return send(res,200,{ok:true});
    }
    if (url.pathname.startsWith('/api/')) return send(res,404,{error:'未找到此接口。'});
    const hostname=(req.headers.host||'').split(':')[0].toLowerCase();
    const file=url.pathname==='/'||url.pathname==='/index.html'
      ? (['aved.space','www.aved.space','localhost','127.0.0.1'].includes(hostname)?'player-terminal.html':'admin-terminal.html')
      : url.pathname==='/admin'?'admin-terminal.html':url.pathname==='/player'?'player-terminal.html':url.pathname.slice(1);
    if (file.includes('..') || file.includes('\\')) return send(res,404,{error:'not found'});
    await serveStatic(req,res,file);
  } catch (error) {
    if (!res.headersSent) send(res,error.status===503?503:error.message==='too large'?413:400,{error:error.message==='too large'?'提交内容过大。':'请求暂时无法处理。'});
    else res.destroy();
    if (error.message !== 'bad json' && error.message !== 'too large') console.error('Request error:',error);
  }
});

server.on('close',()=>{bar.close();radioRetention.close();logRetention.close();achievementAlerts.close();});
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
server.listen(port,host,() => console.log(`万业携生收容公司服务已启动：${host}:${port}`));

