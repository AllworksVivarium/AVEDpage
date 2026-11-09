import {gameplayAwardsSQL} from './server-game-achievements.mjs';

export const socialAchievementCatalog=[
 ['forum-first','茶水间开张','发布第一篇通过审核的主题帖。','forum_topics',1],
 ['forum-five','话题供应商','累计发布 5 篇通过审核的主题帖。','forum_topics',5],
 ['forum-twenty','本栏常驻撰稿','累计发布 20 篇通过审核的主题帖。','forum_topics',20],
 ['reply-first','路过留个字','发布第一条通过审核的回复。','forum_replies',1],
 ['reply-twenty','茶水间熟客','累计发布 20 条通过审核的回复。','forum_replies',20],
 ['reply-hundred','键盘已热身','累计发布 100 条通过审核的回复。','forum_replies',100],
 ['forum-water','一直在水贴','在 60 秒内连续发布 3 条通过审核的回复。','forum_rapid',1],
 ['forum-self','我补充一句','在自己的主题帖下回复一次。','forum_self_thread',1],
 ['forum-self-reply','内部讨论','使用回复功能，回复自己的评论一次。','forum_self_reply',1],
 ['forum-talk','这句我接了','使用回复功能，回复其他员工的评论一次。','forum_conversation',1],
 ['forum-talk-ten','接话专业户','累计回复其他员工的评论 10 次。','forum_conversation',10],
 ['forum-image','有图有交代','发表一次通过审核的附图主题或回复。','forum_image',1],
 ['forum-long','附件见正文','发表一次不少于 300 字符的主题或回复。','forum_long',1],
 ['forum-night','夜班茶水间','在北京时间 0 点至 5 点之间发表一次主题或回复。','forum_night',1],
 ['forum-real','工牌摆桌上','使用实名身份发表一次主题或回复。','forum_real',1],
 ['forum-response','有人接话了','自己的主题帖第一次收到其他员工的回复。','forum_received',1],
 ['forum-response-ten','这桌挺热闹','自己的主题帖累计收到其他员工的回复 10 条。','forum_received',10],
 ['forum-response-fifty','茶水间中心桌','自己的主题帖累计收到其他员工的回复 50 条。','forum_received',50],
 ['forum-direct','收到，接着聊','自己的评论第一次收到其他员工的直接回复。','forum_direct_received',1],
 ['forum-direct-ten','对话还没结束','自己的评论累计收到其他员工的直接回复 10 条。','forum_direct_received',10],
 ['stock-first','第一张成交单','完成第一笔股票或指数交易。','stock_trades',1],
 ['stock-ten','交易窗口熟面孔','累计完成 10 笔股票或指数交易。','stock_trades',10],
 ['stock-fifty','回单请订成册','累计完成 50 笔股票或指数交易。','stock_trades',50],
 ['stock-close','落袋这一步','完成第一次平仓成交。','stock_closes',1],
 ['stock-profit','账面变现','完成一笔实现盈利的平仓成交。','stock_wins',1],
 ['stock-profit-ten','十张好回单','累计完成 10 笔实现盈利的平仓成交。','stock_wins',10],
 ['stock-flat','原路返回','完成一笔实现盈亏恰好为零的平仓成交。','stock_flat',1],
 ['stock-loss','学费已签收','完成一笔实现亏损的平仓成交。','stock_losses',1]
].map(([code,title,description,metric,threshold])=>({code,title,description,metric,threshold}));
export const socialMetrics=Object.entries({
 forum_topics:'通过审核的主题帖数',forum_replies:'通过审核的回复数',forum_rapid:'触发一分钟三条回复的次数',
 forum_self_thread:'回复自己主题帖的次数',forum_self_reply:'直接回复自己评论的次数',forum_conversation:'直接回复其他员工评论的次数',
 forum_image:'通过审核的附图发言数',forum_long:'不少于 300 字符的发言数',forum_night:'北京时间 0 至 5 点的发言数',forum_real:'实名发言数',
 forum_received:'主题帖收到其他员工回复数',forum_direct_received:'评论收到其他员工直接回复数',
 stock_trades:'股票及指数成交笔数',stock_closes:'平仓成交笔数',stock_wins:'盈利平仓笔数',stock_flat:'零盈亏平仓笔数',stock_losses:'亏损平仓笔数'
}).map(([metric,label])=>({metric,label}));

// Increment on committed publication/trade events. No polling, online clock, or body copies.
export function installSocialAchievements(db){
 const columns=table=>new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name));
 const employeeColumns=columns('employees');
 const human=id=>employeeColumns.has('is_npc')?`EXISTS(SELECT 1 FROM employees WHERE id=${id} AND is_npc=0)`:`EXISTS(SELECT 1 FROM employees WHERE id=${id})`;
 const inc=(metric,id='NEW.employee_id',condition='1')=>`INSERT INTO gameplay_achievement_metrics(employee_id,metric,value) SELECT ${id},'${metric}',1 WHERE (${condition}) AND ${human(id)} ON CONFLICT(employee_id,metric) DO UPDATE SET value=value+1;`;
 const visible=a=>`${a}.status='published' AND ${a}.moderation='approved' AND ${a}.deleted_at='' AND ${a}.persona_id IS NULL`;
 db.exec(`CREATE TABLE IF NOT EXISTS social_achievement_events(source TEXT NOT NULL,source_id INTEGER NOT NULL,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,happened_at INTEGER NOT NULL,PRIMARY KEY(source,source_id));
 CREATE INDEX IF NOT EXISTS social_achievement_recent ON social_achievement_events(employee_id,source,happened_at DESC);`);
 for(const table of ['forum_threads','forum_replies']){
  if(!['status','moderation','deleted_at','persona_id','identity_mode','image_data'].every(c=>columns(table).has(c)))continue;
  const reply=table==='forum_replies',source=reply?'reply':'topic';
  const thread=`SELECT employee_id FROM forum_threads WHERE id=NEW.thread_id AND ${visible('forum_threads')} AND employee_id<>NEW.employee_id AND ${human('forum_threads.employee_id')}`;
  const target=`SELECT employee_id FROM forum_replies WHERE id=NEW.reply_to_id AND thread_id=NEW.thread_id AND ${visible('forum_replies')} AND employee_id<>NEW.employee_id AND ${human('forum_replies.employee_id')}`;
  const parentVisible=reply?`AND EXISTS(SELECT 1 FROM forum_threads WHERE id=NEW.thread_id AND status='published' AND moderation='approved' AND deleted_at='')`:'';
  const body=`
   INSERT INTO social_achievement_events VALUES('${source}',NEW.id,NEW.employee_id,unixepoch());
   ${inc(reply?'forum_replies':'forum_topics')}
   ${inc('forum_image','NEW.employee_id',"NEW.image_data<>''")}
   ${inc('forum_long','NEW.employee_id','length(NEW.body)>=300')}
   ${inc('forum_night','NEW.employee_id',"CAST(strftime('%H','now','+8 hours') AS INTEGER)<5")}
   ${inc('forum_real','NEW.employee_id',"NEW.identity_mode='real'")}
   ${reply?[
    inc('forum_rapid','NEW.employee_id',"(SELECT COUNT(*) FROM (SELECT 1 FROM social_achievement_events WHERE employee_id=NEW.employee_id AND source='reply' AND happened_at>=unixepoch()-60 LIMIT 3))=3"),
    inc('forum_self_thread','NEW.employee_id',`EXISTS(SELECT 1 FROM forum_threads WHERE id=NEW.thread_id AND employee_id=NEW.employee_id AND persona_id IS NULL)`),
    inc('forum_self_reply','NEW.employee_id',`EXISTS(SELECT 1 FROM forum_replies WHERE id=NEW.reply_to_id AND thread_id=NEW.thread_id AND employee_id=NEW.employee_id AND ${visible('forum_replies')})`),
    inc('forum_conversation','NEW.employee_id',`EXISTS(${target})`),
    inc('forum_received',`(${thread})`,`EXISTS(${thread})`),
    inc('forum_direct_received',`(${target})`,`EXISTS(${target})`)
   ].join('\n'):''}
   ${gameplayAwardsSQL(`AND g.employee_id IN (NEW.employee_id${reply?`,(${thread}),(${target})`:''})`)}
  `;
  for(const event of ['insert','publish']){
   db.exec(`DROP TRIGGER IF EXISTS social_achievement_${source}_${event};
   CREATE TRIGGER social_achievement_${source}_${event} AFTER ${event==='insert'?'INSERT':'UPDATE OF status,moderation,deleted_at'} ON ${table}
   WHEN ${visible('NEW')} AND ${human('NEW.employee_id')} ${parentVisible}
    ${event==='publish'?`AND NOT (${visible('OLD')})`:''}
    AND NOT EXISTS(SELECT 1 FROM social_achievement_events WHERE source='${source}' AND source_id=NEW.id)
   BEGIN ${body} END;`);
  }
  // Source ids may be reused after deletion; counters are historical, dedup rows are not.
  db.exec(`CREATE TRIGGER IF NOT EXISTS social_achievement_${source}_delete AFTER DELETE ON ${table} BEGIN DELETE FROM social_achievement_events WHERE source='${source}' AND source_id=OLD.id; END;`);
 }
 if(columns('stock_trades').has('realized_pnl_change')){
  const closing="NEW.holding_before<>0 AND ((NEW.holding_before>0 AND NEW.action='sell') OR (NEW.holding_before<0 AND NEW.action='buy'))";
  db.exec(`DROP TRIGGER IF EXISTS social_achievement_trade;
   CREATE TRIGGER social_achievement_trade AFTER INSERT ON stock_trades WHEN ${human('NEW.employee_id')} BEGIN
    ${inc('stock_trades')}${inc('stock_closes','NEW.employee_id',closing)}
    ${inc('stock_wins','NEW.employee_id',closing+' AND NEW.realized_pnl_change>0')}
    ${inc('stock_flat','NEW.employee_id',closing+' AND NEW.realized_pnl_change=0')}
    ${inc('stock_losses','NEW.employee_id',closing+' AND NEW.realized_pnl_change<0')}
    ${gameplayAwardsSQL('AND g.employee_id=NEW.employee_id')}
   END;`);
 }
 db.exec(gameplayAwardsSQL());
}
