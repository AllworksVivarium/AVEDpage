import { installMarket } from './server-market.mjs';
import { newCards, cardsAction, publicCards } from './server-cards.mjs';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { scratchTiers, scratchGameTypes, slot5x3Symbols, slot5x3Lines, departmentsData, stocksData } from './server-content.mjs';
import { generateSealedTicket } from './server-ticket.mjs';

export function installPlayerService({db,send,readBody,requireEmployee,requireAdmin,balanceFor,recordLedger,publicProfile,today,sessionEmployee}) {
  const chatStreams=new Map();
  const chatItems=room=>db.prepare(`SELECT c.id,COALESCE(p.anonymous_name,c.alias) AS alias,c.body,c.created_at AS createdAt FROM chat_messages c LEFT JOIN profiles p ON p.employee_id=c.employee_id WHERE room=? AND c.deleted_at='' ORDER BY c.id DESC LIMIT 80`).all(room).reverse();
  function emitChat(room){const payload='data: '+JSON.stringify({items:chatItems(room)})+'\n\n';for(const response of chatStreams.get(room)||[])response.write(payload);}
  const addColumn=(table,name,definition)=>{
    if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  for(const table of ['forum_threads','forum_replies']) {
    addColumn(table,'image_data',"TEXT NOT NULL DEFAULT ''");
    addColumn(table,'moderation',"TEXT NOT NULL DEFAULT 'approved'");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs(id INTEGER PRIMARY KEY,employee_id INTEGER,username TEXT NOT NULL DEFAULT '',action TEXT NOT NULL,target TEXT NOT NULL DEFAULT '',details TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS earned_achievements(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,code TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,code));
    CREATE TABLE IF NOT EXISTS player_daily(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,day TEXT NOT NULL,action TEXT NOT NULL,PRIMARY KEY(employee_id,day,action));
    CREATE TABLE IF NOT EXISTS dossier_comments(id INTEGER PRIMARY KEY,dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,room TEXT NOT NULL,alias TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS player_rounds(id INTEGER PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,game TEXT NOT NULL,state_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS stock_prices(code TEXT PRIMARY KEY,name TEXT NOT NULL,price INTEGER NOT NULL,change REAL NOT NULL DEFAULT 0,tick INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_holdings(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,code TEXT REFERENCES stock_prices(code),quantity INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(employee_id,code));
    CREATE TABLE IF NOT EXISTS company_departments(code TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,motto TEXT NOT NULL);
  `);
  const log=(id,action,target='',details={})=>{
    const name=db.prepare('SELECT username FROM employees WHERE id=?').get(id)?.username||'';
    db.prepare('INSERT INTO activity_logs(employee_id,username,action,target,details) VALUES(?,?,?,?,?)').run(id,name,action,String(target),JSON.stringify(details));
  };
  // Database snapshots survive deletion of the original account or post. Passwords and session tokens are excluded.
  for(const table of ['employees','profiles','balance_ledger','checkins','game_tickets','forum_threads','forum_replies','posts','dossiers','announcements','dossier_comments','chat_messages','stock_holdings']) {
    const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name).filter(n=>!['password_hash','seed'].includes(n));
    for(const action of ['INSERT','UPDATE','DELETE']) {
      const row=action==='DELETE'?'OLD':'NEW';
      const who=table==='employees'?`${row}.id`:columns.includes('employee_id')?`${row}.employee_id`:'NULL';
      const snapshot=columns.flatMap(n=>[`'${n}'`,`${row}.${n}`]).join(',');
      db.exec(`CREATE TRIGGER IF NOT EXISTS audit_${table}_${action} AFTER ${action} ON ${table} BEGIN
        INSERT INTO activity_logs(employee_id,username,action,target,details) VALUES(${who},COALESCE((SELECT username FROM employees WHERE id=${who}),''),'${action.toLowerCase()}','${table}',json_object(${snapshot})); END;`);
    }
  }
  const award=id=>{
    const b=balanceFor(id);const add=db.prepare('INSERT OR IGNORE INTO earned_achievements(employee_id,code) VALUES(?,?)');
    if(b===0)add.run(id,'zero');if(b>100000)add.run(id,'100k');if(b>1000000)add.run(id,'1m');
    if(db.prepare('SELECT id FROM game_tickets WHERE employee_id=? AND prize>=500000 LIMIT 1').get(id))add.run(id,'jackpot');
  };
  db.exec(`CREATE TRIGGER IF NOT EXISTS award_balance AFTER INSERT ON balance_ledger BEGIN
    INSERT OR IGNORE INTO earned_achievements(employee_id,code) SELECT NEW.employee_id,'zero' WHERE (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=NEW.employee_id)=0;
    INSERT OR IGNORE INTO earned_achievements(employee_id,code) SELECT NEW.employee_id,'100k' WHERE (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=NEW.employee_id)>100000;
    INSERT OR IGNORE INTO earned_achievements(employee_id,code) SELECT NEW.employee_id,'1m' WHERE (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=NEW.employee_id)>1000000;
    END;`);
  for(const d of departmentsData)db.prepare('INSERT OR IGNORE INTO company_departments(code,name,description,motto) VALUES(?,?,?,?)').run(d.code,d.name,d.desc,d.motto);
  for(const s of stocksData)db.prepare('INSERT OR IGNORE INTO stock_prices(code,name,price,tick) VALUES(?,?,?,?)').run(s.code,s.name,s.price,Math.floor(Date.now()/60000));
  db.prepare('INSERT OR IGNORE INTO dossiers(code,title,department,status,summary) VALUES(?,?,?,?,?)').run('AVED-007','法棍','收容部','观察中','法棍是一只法斗，当前列入观察序列。');
  for(const [code,name] of [['AVED.VIV','收容部'],['AVED.ANC','武装部'],['AVED.MEM','后勤部'],['AVED.RES','科研部'],['AVED.MED','医疗部']]){db.prepare('INSERT OR IGNORE INTO stock_prices(code,name,price,tick) VALUES(?,?,3200,?)').run(code,name,Math.floor(Date.now()/60000));db.prepare('UPDATE stock_prices SET name=? WHERE code=?').run(name,code);}
  const valid=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=n;
  const image=s=>{if(!s)return '';if(typeof s!=='string'||s.length>2200000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s))throw new Error('图片请使用不超过 1.5 MB 的 PNG、JPG 或 WEBP。');return s;};
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
  function rng(seed) {let counter=0;return ()=>createHmac('sha256',Buffer.from(seed,'hex')).update(String(counter++)).digest().readUInt32BE(0)/4294967296;}
  const random=()=>{const seed=randomBytes(32).toString('hex');return {seed,seedHash:createHash('sha256').update(seed).digest('hex'),random:rng(seed)};};
  function settle(id,game,cost,prize,result,proof) {
    return transaction(()=>{
      if(balanceFor(id)<cost)throw new Error('余额不足。');
      if(cost)recordLedger(id,-cost,game+'投入');if(prize)recordLedger(id,prize,game+'奖金');
      const row=db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(id,game,cost,prize,proof.seed,proof.seedHash,JSON.stringify(result));
      award(id);return {ticketId:Number(row.lastInsertRowid),cost,prize,balance:balanceFor(id),result,seed:proof.seed,seedHash:proof.seedHash};
    });
  }
  const bet=n=>{if(!Number.isSafeInteger(n)||n<100||n>1000000)throw new Error('投入应为 100 至 1,000,000 的整数。');return n;};
  // Only replace the exact system-generated starter copy; preserve authored notices.
  db.prepare('UPDATE announcements SET body=? WHERE title=? AND body=?').run('公司内部通讯已接通。请各部门员工核验个人档案，查阅通告，并依权限使用各项设施。','员工终端已启用','这里发布的公告会保存在服务器数据库中。员工可以在公告下方匿名留言。');
  db.prepare('UPDATE dossiers SET summary=? WHERE code=? AND summary=?').run('卷宗待核。','WY-002','档案内容由管理人员录入。');
  db.prepare('UPDATE dossiers SET summary=? WHERE code=? AND summary=?').run('法棍是一只法斗，当前列入观察序列。','AVED-007','法棍是一只法斗。具体收容措施与异常特征由管理员补充。');
  const marketService=installMarket(db);
  const market=id=>marketService.items(id);
  function forum(before=Number.MAX_SAFE_INTEGER,viewer=0) {
    const rows=db.prepare(`SELECT f.id,f.title,f.body,f.image_data AS imageData,p.anonymous_name AS anonymousName,f.created_at AS createdAt,f.edited_at AS editedAt,(f.employee_id=?) AS canEdit,
      (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=f.employee_id) AS balance,
      (SELECT COUNT(*) FROM forum_replies WHERE thread_id=f.id AND status='published' AND deleted_at='') AS replyCount
      FROM forum_threads f JOIN profiles p ON p.employee_id=f.employee_id WHERE f.status='published' AND f.deleted_at='' AND f.id<? ORDER BY f.id DESC LIMIT 11`).all(viewer,before);
    return {items:rows.slice(0,10),next:rows.length>10?rows[9].id:null};
  }
  const replies=(id,viewer=0)=>db.prepare(`SELECT r.id,r.body,r.image_data AS imageData,p.anonymous_name AS anonymousName,r.created_at AS createdAt,r.edited_at AS editedAt,(r.employee_id=?) AS canEdit,
    (SELECT COALESCE(SUM(delta),0) FROM balance_ledger WHERE employee_id=r.employee_id) AS balance FROM forum_replies r JOIN forum_threads f ON f.id=r.thread_id JOIN profiles p ON p.employee_id=r.employee_id WHERE r.thread_id=? AND r.status='published' AND r.deleted_at='' AND f.status='published' AND f.deleted_at='' ORDER BY r.id`).all(viewer,id);
  const saveRound=(id,game,state)=>Number(db.prepare('INSERT INTO player_rounds(employee_id,game,state_json) VALUES(?,?,?)').run(id,game,JSON.stringify(state)).lastInsertRowid);
  const loadRound=(id,round,game)=>{const r=db.prepare('SELECT state_json FROM player_rounds WHERE id=? AND employee_id=? AND game=?').get(round,id,game);if(!r)throw new Error('该局不存在，请重新开始。');return JSON.parse(r.state_json);};
  const updateRound=(round,state)=>db.prepare('UPDATE player_rounds SET state_json=? WHERE id=?').run(JSON.stringify(state),round);
  function skyState(s) {
    const elapsed=Math.max(0,Date.now()-s.startedAt-20000),depth=s.settled?s.jumpDepth:Math.min(1600,Math.round(100+elapsed*.035));
    const phase=Date.now()<s.startedAt+20000?'BOARDING':depth>=s.crashDepth||s.settled?'SETTLED':'DROPPING';
    return {phase,depth,remaining:Math.max(0,Math.ceil((s.startedAt+20000-Date.now())/1000)),cost:s.cost,prize:s.prize||0,seedHash:s.seedHash, ...(phase==='SETTLED'?{seed:s.seed,crashDepth:s.crashDepth}:{})};
  }
  return {log,close:marketService.close, async handle(req,res,url) {
    const path=url.pathname;
    if(!path.startsWith('/api/player/')&&!path.startsWith('/api/admin/moderation')&&path!=='/api/admin/activity')return false;
    const employee=path.startsWith('/api/admin/')?requireAdmin(req,res):requireEmployee(req,res);if(!employee)return true;
    const id=employee.id;let data={};
    try {
      if(req.method==='POST'||req.method==='PUT')data=await readBody(req,2500000);
      if(path==='/api/player/state'&&req.method==='GET') {
        award(id);const profile=publicProfile(id);
        send(res,200,{employee,balance:balanceFor(id),profile,serverTime:Date.now(),market:marketService.history(),
          checkin:!!db.prepare('SELECT 1 FROM checkins WHERE employee_id=? AND checkin_date=?').get(id,today()),
          streak:db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE employee_id=?').get(id).n,
          achievements:db.prepare('SELECT code,created_at AS createdAt FROM earned_achievements WHERE employee_id=?').all(id),
          history:db.prepare('SELECT id,game,cost,prize,seed_hash AS seedHash,created_at AS createdAt FROM game_tickets WHERE employee_id=? ORDER BY id DESC LIMIT 30').all(id),
          employees:db.prepare('SELECT e.id,e.display_name AS displayName,e.department,p.avatar_url AS avatarUrl FROM employees e LEFT JOIN profiles p ON p.employee_id=e.id WHERE enabled=1').all(),
          departments:db.prepare('SELECT code,name,description AS desc,motto FROM company_departments').all(),
          announcements:db.prepare('SELECT id,title,body,pinned,created_at AS createdAt FROM announcements ORDER BY pinned DESC,datetime(created_at) DESC,id DESC').all(),
          dossiers:db.prepare('SELECT id,code,title,department,status,summary FROM dossiers ORDER BY id').all(),
          forum:forum(Number.MAX_SAFE_INTEGER,id),stocks:market(id),music:db.prepare('SELECT id,title,url,kind FROM music_tracks WHERE enabled=1 ORDER BY id').all()});return true;
      }
      if(path==='/api/player/view'&&req.method==='POST'){if(valid(data.page,40))log(id,'view',data.page);send(res,200,{ok:true});return true;}
      if(path==='/api/player/forum'&&req.method==='GET'){send(res,200,forum(Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER,id));return true;}
      const thread=path.match(/^\/api\/player\/forum\/(\d+)$/);
      if(thread&&req.method==='GET'){const row=db.prepare("SELECT id FROM forum_threads WHERE id=? AND status='published'").get(thread[1]);if(!row)throw new Error('帖子不存在或未通过审核。');send(res,200,{items:replies(Number(thread[1]),id)});return true;}
      if((path==='/api/player/forum'||thread)&&req.method==='POST') {
        if(!valid(data.body,3000)||(!thread&&!valid(data.title,120)))throw new Error('请填写标题与正文，正文最多 3000 字。');
        const img=image(data.imageData),status=img?'hidden':'published',moderation=img?'pending':'approved',alias=publicProfile(id).anonymousName;
        if(!alias)throw new Error('请先保存匿名名称。');
        let row;
        if(thread){if(!db.prepare("SELECT id FROM forum_threads WHERE id=? AND status='published'").get(thread[1]))throw new Error('帖子不存在。');row=db.prepare('INSERT INTO forum_replies(thread_id,employee_id,anonymous_name,body,image_data,status,moderation) VALUES(?,?,?,?,?,?,?)').run(thread[1],id,alias,data.body.trim(),img,status,moderation);}
        else row=db.prepare('INSERT INTO forum_threads(employee_id,anonymous_name,title,body,image_data,status,moderation) VALUES(?,?,?,?,?,?,?)').run(id,alias,data.title.trim(),data.body.trim(),img,status,moderation);
        send(res,201,{id:Number(row.lastInsertRowid),pending:!!img});return true;
      }
      if(path==='/api/admin/moderation'&&req.method==='GET') {
        const items=db.prepare(`SELECT 'thread' AS kind,f.id,f.title,f.body,f.image_data AS imageData,f.employee_id AS employeeId,e.username,e.display_name AS displayName,f.created_at AS createdAt FROM forum_threads f JOIN employees e ON e.id=f.employee_id WHERE f.moderation='pending'
          UNION ALL SELECT 'reply',r.id,t.title,r.body,r.image_data,r.employee_id,e.username,e.display_name,r.created_at FROM forum_replies r JOIN forum_threads t ON t.id=r.thread_id JOIN employees e ON e.id=r.employee_id WHERE r.moderation='pending' ORDER BY createdAt`).all();send(res,200,{items});return true;
      }
      const moderation=path.match(/^\/api\/admin\/moderation\/(thread|reply)\/(\d+)$/);
      if(moderation&&req.method==='POST') {
        if(!['approve','reject'].includes(data.action))throw new Error('审核操作无效。');
        const table=moderation[1]==='thread'?'forum_threads':'forum_replies';
        const result=db.prepare(`UPDATE ${table} SET status=?,moderation=? WHERE id=? AND moderation='pending'`).run(data.action==='approve'?'published':'hidden',data.action==='approve'?'approved':'rejected',moderation[2]);
        if(!result.changes)throw new Error('内容已处理或已删除。');log(id,'moderation',table+'/'+moderation[2],{decision:data.action});send(res,200,{ok:true});return true;
      }
      if(path==='/api/admin/activity'&&req.method==='GET'){const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;send(res,200,{items:db.prepare('SELECT * FROM activity_logs WHERE id<? ORDER BY id DESC LIMIT 100').all(before)});return true;}
      const dossier=path.match(/^\/api\/player\/dossiers\/(\d+)\/comments$/);
      if(dossier){if(!db.prepare('SELECT id FROM dossiers WHERE id=?').get(dossier[1]))throw new Error('档案不存在。');
        if(req.method==='POST'){if(!valid(data.body,2000))throw new Error('评议最多 2000 字。');db.prepare('INSERT INTO dossier_comments(dossier_id,employee_id,body) VALUES(?,?,?)').run(dossier[1],id,data.body.trim());}
        send(res,200,{items:db.prepare(`SELECT c.id,c.body,e.display_name AS displayName,e.department,c.created_at AS createdAt FROM dossier_comments c JOIN employees e ON e.id=c.employee_id WHERE dossier_id=? AND c.deleted_at='' ORDER BY c.id`).all(dossier[1])});return true;}
      if(path==='/api/player/balance/zero'&&req.method==='POST'){transaction(()=>{const b=balanceFor(id);if(b)recordLedger(id,-b,'主动归零');award(id);});send(res,200,{balance:balanceFor(id)});return true;}
      if(path==='/api/player/relief'&&req.method==='POST'){transaction(()=>{if(balanceFor(id)>=10000)throw new Error('余额低于 10,000 才能领取。');if(db.prepare('SELECT 1 FROM player_daily WHERE employee_id=? AND day=? AND action=?').get(id,today(),'relief'))throw new Error('今日已经领取。');db.prepare('INSERT INTO player_daily VALUES(?,?,?)').run(id,today(),'relief');recordLedger(id,25000,'应急低保');award(id);});send(res,200,{balance:balanceFor(id)});return true;}
      if(path==='/api/player/games/scratch'&&req.method==='POST') {
        const tier=scratchTiers.find(t=>t.id===data.tier),game=scratchGameTypes.find(g=>g.type===data.type);if(!tier||!game)throw new Error('请选择有效票种。');
        const proof=random(),ticket=generateSealedTicket(tier,game,proof.seed,proof.random);
        send(res,200,settle(id,'scratch',tier.cost,ticket.totalPayout,ticket,proof));return true;
      }
      if(path==='/api/player/games/slot'&&req.method==='POST') {
        const cost=bet(data.bet),proof=random(),pool=slot5x3Symbols.flatMap((s,i)=>Array(i+1).fill(s));
        const board=Array.from({length:3},()=>Array.from({length:5},()=>pool[Math.floor(proof.random()*pool.length)]));
        const winningCells=[],notes=[],mechanisms=[];let prize=0;
        for(const line of slot5x3Lines){const first=board[line.rows[0]][0];let n=1;while(n<5&&board[line.rows[n]][n].id===first.id)n++;
          if(n>=3){prize+=first['m'+n]*Math.max(1,Math.round(cost/5));notes.push(line.name+' '+n+'连');for(let c=0;c<n;c++)winningCells.push(`${line.rows[c]}_${c}`);}}
        if(board.flat().filter(s=>s.id==='eye').length>=3){prize+=cost*5;mechanisms.push(0);}
        if(board.some(row=>row[0].id==='rad')&&board.some(row=>row[4].id==='rad')){prize+=cost;mechanisms.push(1);}
        if(new Set(board[1].map(s=>s.id)).size===5){prize+=cost*3;mechanisms.push(2);}
        send(res,200,settle(id,'slot',cost,prize,{board,winningCells,notes,mechanisms},proof));return true;
      }
      if(path==='/api/player/games/derby'&&req.method==='POST') {
        const cost=bet(data.bet);if(!Number.isInteger(data.runner)||data.runner<0||data.runner>3)throw new Error('请选择跑道。');
        const proof=random(),r=proof.random(),winner=r<.42?0:r<.70?1:r<.88?2:3,prize=winner===data.runner?Math.round(cost*[2.2,3.5,5,8.5][winner]):0;
        send(res,200,settle(id,'derby',cost,prize,{winner},proof));return true;
      }
      if(path==='/api/player/games/sky/start'&&req.method==='POST') {
        const cost=bet(data.bet),proof=random(),state={cost,startedAt:Date.now(),seed:proof.seed,seedHash:proof.seedHash,crashDepth:150+Math.floor(proof.random()*1300),settled:false};
        const round=transaction(()=>{if(balanceFor(id)<cost)throw new Error('余额不足。');const active=db.prepare("SELECT state_json FROM player_rounds WHERE employee_id=? AND game='sky' ORDER BY id DESC LIMIT 1").get(id);if(active&&skyState(JSON.parse(active.state_json)).phase!=='SETTLED')throw new Error('已有一局空投进行中。');if(active){const previous=JSON.parse(active.state_json);if(!previous.settled){previous.settled=true;previous.prize=0;previous.jumpDepth=previous.crashDepth;db.prepare("UPDATE player_rounds SET state_json=? WHERE employee_id=? AND game='sky' AND id=(SELECT MAX(id) FROM player_rounds WHERE employee_id=? AND game='sky')").run(JSON.stringify(previous),id,id);db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(id,'sky',previous.cost,0,previous.seed,previous.seedHash,JSON.stringify({crashDepth:previous.crashDepth,expired:true}));}}recordLedger(id,-cost,'空投登机');const rid=saveRound(id,'sky',state);log(id,'sky.start',rid,{cost,seedHash:proof.seedHash});return rid;});send(res,200,{round,...skyState(state),balance:balanceFor(id)});return true;
      }
      if(path==='/api/player/games/sky/current'&&req.method==='GET') {
        const row=db.prepare("SELECT id,state_json FROM player_rounds WHERE employee_id=? AND game='sky' ORDER BY id DESC LIMIT 1").get(id);
        if(!row){send(res,200,{round:null});return true;}data.round=row.id;
      }
      if(path==='/api/player/games/sky/current'||path==='/api/player/games/sky/jump') {
        const state=loadRound(id,Number(data.round),'sky'),view=skyState(state);
        if(path.endsWith('/jump')&&req.method!=='POST')throw new Error('无效操作。');
        if(path.endsWith('/jump')&&view.phase==='BOARDING')throw new Error('尚未开始下降。');
        if(!state.settled&&(view.phase==='SETTLED'||path.endsWith('/jump')))transaction(()=>{
          state.settled=true;state.prize=view.phase==='DROPPING'?Math.floor(state.cost*(view.depth/200)):0;state.jumpDepth=view.depth;
          if(state.prize)recordLedger(id,state.prize,'空投开伞结算');
          db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(id,'sky',state.cost,state.prize,state.seed,state.seedHash,JSON.stringify({depth:view.depth,crashDepth:state.crashDepth}));updateRound(data.round,state);award(id);
        });
        send(res,200,{round:data.round,...skyState(state),jumpDepth:state.jumpDepth,balance:balanceFor(id)});return true;
      }
      if(path==='/api/player/games/cards'&&req.method==='POST') {
        const action=data.action;
        if(action==='start'){
          const existing=db.prepare("SELECT id,state_json FROM player_rounds WHERE employee_id=? AND game='cards' ORDER BY id DESC LIMIT 1").get(id);
          if(existing){const state=JSON.parse(existing.state_json);if(state.phase!=='ended'){send(res,200,{...publicCards(state,existing.id),balance:balanceFor(id)});return true;}}
          const proof=random(),state={...newCards(proof.random),seed:proof.seed,seedHash:proof.seedHash};
          const round=saveRound(id,'cards',state);log(id,'cards.start',round,{seedHash:proof.seedHash});send(res,200,{...publicCards(state,round),balance:balanceFor(id)});return true;
        }
        const state=loadRound(id,Number(data.round),'cards');
        transaction(()=>{cardsAction(state,action,data.cards);if(state.phase==='ended'&&!state.settled){state.settled=true;const prize=state.winner===0?20000:0;if(prize)recordLedger(id,prize,'牌桌获胜');db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(id,'cards',0,prize,state.seed,state.seedHash,JSON.stringify({winner:state.winner}));award(id);}updateRound(data.round,state);log(id,'cards.'+action,data.round,{cards:data.cards||[],winner:state.winner});});
        send(res,200,{...publicCards(state,data.round),balance:balanceFor(id)});return true;
      }
      if(path==='/api/player/stocks') {
        if(!['GET','POST'].includes(req.method)){send(res,405,{error:'交易指令无效。'});return true;}
        const code=url.searchParams.get('code')||'KARMA',period=Number(url.searchParams.get('period')||1);
        // Validate chart selection before committing any trade.
        marketService.history(code,period);
        if(req.method==='POST')transaction(()=>{
          market(id);const stock=db.prepare('SELECT * FROM stock_prices WHERE code=?').get(data.code);
          const quantity=data.quantity??1;
          if(!stock||!['buy','sell'].includes(data.action)||!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)throw new Error('交易指令无效。');
          const held=db.prepare('SELECT quantity FROM stock_holdings WHERE employee_id=? AND code=?').get(id,stock.code)?.quantity||0;
          const amount=stock.price*quantity;
          if(!Number.isSafeInteger(amount))throw new Error('委托金额超出限额。');
          if(data.action==='buy'&&balanceFor(id)<amount)throw new Error('可用余额不足。');
          if(data.action==='sell'&&held<quantity)throw new Error('可出售持仓不足。');
          const next=held+(data.action==='buy'?quantity:-quantity);
          if(!Number.isSafeInteger(next))throw new Error('持仓超出限额。');
          recordLedger(id,data.action==='buy'?-amount:amount,(data.action==='buy'?'买入 ':'卖出 ')+stock.code+' × '+quantity);
          db.prepare('INSERT INTO stock_holdings VALUES(?,?,?) ON CONFLICT(employee_id,code) DO UPDATE SET quantity=excluded.quantity').run(id,stock.code,next);
          marketService.trade(stock.code,quantity,stock.price);award(id);
          log(id,'stock.'+data.action,stock.code,{quantity,price:stock.price,amount});
        });
        send(res,200,{items:market(id),balance:balanceFor(id),market:marketService.history(code,period),serverTime:Date.now()});return true;
      }
      if(path==='/api/player/chat/stream'&&req.method==='GET') {
        const room=url.searchParams.get('room');if(!['sky','derby'].includes(room))throw new Error('聊天室不存在。');
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
        if(!chatStreams.has(room))chatStreams.set(room,new Set());chatStreams.get(room).add(res);
        res.write('data: '+JSON.stringify({items:chatItems(room)})+'\n\n');
        const timer=setInterval(()=>{if(!sessionEmployee(req)){res.end();return;}res.write(': heartbeat\n\n');emitChat(room);},20000);
        res.on('close',()=>{clearInterval(timer);chatStreams.get(room)?.delete(res);});return true;
      }
      if(path==='/api/player/chat') {
        const room=req.method==='POST'?data.room:url.searchParams.get('room');if(!['sky','derby'].includes(room))throw new Error('聊天室不存在。');
        if(req.method==='POST'){if(!valid(data.body,500))throw new Error('消息最多 500 字。');db.prepare('INSERT INTO chat_messages(employee_id,room,alias,body) VALUES(?,?,?,?)').run(id,room,publicProfile(id).anonymousName,data.body.trim());emitChat(room);}
        send(res,200,{items:db.prepare(`SELECT c.id,COALESCE(p.anonymous_name,c.alias) AS alias,c.body,c.created_at AS createdAt FROM chat_messages c LEFT JOIN profiles p ON p.employee_id=c.employee_id WHERE room=? AND c.deleted_at='' ORDER BY c.id DESC LIMIT 80`).all(room).reverse()});return true;
      }
      send(res,404,{error:'接口不存在。'});return true;
    }catch(error){send(res,400,{error:error.message});return true;}
  }};
}
