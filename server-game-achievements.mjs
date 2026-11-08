// Only committed, server-created tickets contribute. No client achievement API.
const json=(t,key)=>`json_extract(${t}.result_json,'$.${key}')`;
const win=t=>`${t}.prize>${t}.cost+COALESCE(${json(t,'penalty')},0)`;
const safe=t=>`${json(t,'safe')}=1 AND COALESCE(${json(t,'expired')},0)=0 AND ${json(t,'depth')}>=100 AND ${json(t,'depth')}<=${json(t,'safetyLine')}`;
const manualWin=t=>`${win(t)} AND ${json(t,'autoOnly')}=0`;
const rule=(metric,label,game,condition,value=()=> '1',maximum=false)=>({metric,label,game,condition,value,maximum});
export const gameplayRules=[
 rule('sky_safe_count','安全开伞次数','sky',safe),
 rule('sky_edge10_count','距安全线 10 米内安全开伞次数','sky',t=>`${safe(t)} AND ${json(t,'safetyLine')}-${json(t,'depth')}<=10`),
 rule('sky_edge1_count','距安全线 1 米内安全开伞次数','sky',t=>`${safe(t)} AND ${json(t,'safetyLine')}-${json(t,'depth')}<=1`),
 rule('sky_depth_max','安全开伞最深米数','sky',safe,t=>json(t,'depth'),true),
 rule('scratch_win_count','刮刮乐盈利次数','scratch',win),
 rule('scratch_multiple_max','刮刮乐最高返还倍数（取整）','scratch',win,t=>`CAST(${t}.prize/${t}.cost AS INTEGER)`,true),
 rule('scratch_rare_count','刮刮乐隐藏大奖次数','scratch',t=>`${win(t)} AND ${json(t,'rarePrize')}=1`),
 rule('slot_five_count','异常回路五连次数','slot',t=>`EXISTS(SELECT 1 FROM json_each(${t}.result_json,'$.notes') WHERE value LIKE '% 5连')`),
 rule('slot_protocol_max','异常回路单局组合机制数','slot',t=>`json_type(${t}.result_json,'$.mechanisms')='array'`,t=>`json_array_length(${t}.result_json,'$.mechanisms')`,true),
 rule('derby_first_count','下班竞速押中第一名次数','derby',t=>`${win(t)} AND COALESCE(${json(t,'market')},'first')='first'`),
 rule('derby_last_count','下班竞速押中最后一名次数','derby',t=>`${win(t)} AND ${json(t,'market')}='last'`),
 rule('derby_both_count','下班竞速同场首尾双中次数','derby',t=>`${win(t)} AND ${json(t,'market')} IN ('first','last') AND EXISTS(SELECT 1 FROM game_tickets other WHERE other.game='derby' AND other.employee_id=${t}.employee_id AND json_extract(other.result_json,'$.round')=${json(t,'round')} AND other.id<${t}.id AND json_extract(other.result_json,'$.market') IN ('first','last') AND json_extract(other.result_json,'$.market')<>${json(t,'market')} AND other.cost>0 AND ${win('other')} AND COALESCE(json_extract(other.result_json,'$.cancelled'),0)=0 AND COALESCE(json_extract(other.result_json,'$.migrated'),0)=0)`),
 rule('cards_win_count','亲自出牌并获胜次数','cards',manualWin),
 rule('cards_landlord_count','亲自出牌并以太姥身份获胜次数','cards',t=>`${manualWin(t)} AND ${json(t,'seat')}=${json(t,'landlord')} AND ${json(t,'winner')}='landlord'`),
 rule('cards_partner_count','亲自出牌并以少姥身份获胜次数','cards',t=>`${manualWin(t)} AND ${json(t,'seat')}<>${json(t,'landlord')} AND ${json(t,'winner')}='farmers'`),
 rule('cards_multiplier_max','亲自出牌获胜的最高牌局倍率','cards',manualWin,t=>`COALESCE(${json(t,'multiplier')},0)`,true)
];

export const gameplayAchievementCatalog=[
 ['sky-safe','平安落地','完成一次安全开伞。','sky_safe_count',1],
 ['sky-extreme','极限开伞','在距离本场安全线 10 米以内成功开伞。','sky_edge10_count',1],
 ['sky-miracle','奇迹开伞','在距离本场安全线 1 米以内成功开伞。','sky_edge1_count',1],
 ['sky-deep','穿云而过','在 800 米或更深处安全开伞。','sky_depth_max',800],
 ['scratch-win','开门见彩','刮刮乐首次获得超过本局总支出的返还。','scratch_win_count',1],
 ['scratch-ten','纸上惊喜','刮刮乐单张返还达到投入的 10 倍。','scratch_multiple_max',10],
 ['scratch-rare','纸上奇迹','刮出一次隐藏大奖。','scratch_rare_count',1],
 ['slot-five','五连贯通','异常回路中，任意一条有效线路连出五个相同图案。','slot_five_count',1],
 ['slot-dual','双重共振','异常回路同一局触发至少两种组合机制。','slot_protocol_max',2],
 ['slot-full','全频共振','异常回路同一局触发三种组合机制。','slot_protocol_max',3],
 ['derby-first','先下班一步','下班竞速押中一次第一名。','derby_first_count',1],
 ['derby-last','压轴登场','下班竞速押中一次最后一名。','derby_last_count',1],
 ['derby-both','首尾通吃','下班竞速同一场的第一名与最后一名均押中。','derby_both_count',1],
 ['cards-win','初试牌锋','亲自出过牌，并赢下一局斗太姥。','cards_win_count',1],
 ['cards-landlord','当家做主','亲自出过牌，并以太姥身份获胜。','cards_landlord_count',1],
 ['cards-partner','少姥合伙人','亲自出过牌，并以少姥身份获胜。','cards_partner_count',1],
 ['cards-multiplier','翻倍时刻','亲自出过牌，并赢下一局至少 8 倍的牌局。','cards_multiplier_max',8]
].map(([code,title,description,metric,threshold])=>({code,title,description,metric,threshold}));

export const gameplayAwardsSQL=(where='')=>`INSERT OR IGNORE INTO earned_achievements(employee_id,code) SELECT g.employee_id,d.code FROM gameplay_achievement_metrics g JOIN achievement_definitions d ON d.metric=g.metric WHERE d.enabled=1 AND g.value>=d.threshold ${where};`;
const valid=t=>`${t}.cost>0 AND COALESCE(${json(t,'cancelled')},0)=0 AND COALESCE(${json(t,'migrated')},0)=0 AND COALESCE(${json(t,'demo')},0)=0`;
function accumulate(rule,t,extra=''){
 return `INSERT INTO gameplay_achievement_metrics(employee_id,metric,value)
 SELECT ${t}.employee_id,'${rule.metric}',${rule.maximum?'MAX':'SUM'}(${rule.value(t)}) FROM game_tickets ${t}
 WHERE ${t}.game='${rule.game}' AND ${valid(t)} AND (${rule.condition(t)}) ${extra} GROUP BY ${t}.employee_id
 ON CONFLICT(employee_id,metric) DO UPDATE SET value=${rule.maximum?'MAX(value,excluded.value)':'value+excluded.value'};`;
}
export function installGameplayAchievements(db){
 db.exec(`CREATE TABLE IF NOT EXISTS gameplay_achievement_metrics(employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,metric TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(employee_id,metric));
 CREATE INDEX IF NOT EXISTS gameplay_sky_flight ON game_tickets(json_extract(result_json,'$.flight'),id) WHERE game='sky';
 CREATE INDEX IF NOT EXISTS gameplay_derby_round ON game_tickets(employee_id,json_extract(result_json,'$.round'),id) WHERE game='derby';`);
 const hasSky=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sky_flights'").get();
 // Never reveal proximity through a profile achievement while the flight is still live.
 const revealed=t=>hasSky?`AND EXISTS(SELECT 1 FROM sky_flights f WHERE f.id=${json(t,'flight')} AND f.ended_at>0)`:'AND 0';
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='gameplay-achievements-v1'").get()){
  db.exec('SAVEPOINT gameplay_backfill');try{
   for(const r of gameplayRules)db.exec(accumulate(r,'t',r.game==='sky'?revealed('t'):''));
   db.exec("INSERT INTO economy_migrations VALUES('gameplay-achievements-v1');RELEASE gameplay_backfill");
  }catch(error){db.exec('ROLLBACK TO gameplay_backfill;RELEASE gameplay_backfill');throw error;}
 }
 db.exec('DROP TRIGGER IF EXISTS gameplay_achievement_ticket');
 db.exec(`CREATE TRIGGER gameplay_achievement_ticket AFTER INSERT ON game_tickets BEGIN
 ${gameplayRules.map(r=>accumulate(r,'t',`AND t.id=NEW.id ${r.game==='sky'?revealed('t'):''}`)).join('\n')}
 ${gameplayAwardsSQL('AND g.employee_id=NEW.employee_id')} END;`);
 if(hasSky){
  db.exec(`DROP TRIGGER IF EXISTS gameplay_achievement_sky;
   CREATE TRIGGER gameplay_achievement_sky AFTER UPDATE OF ended_at ON sky_flights WHEN OLD.ended_at=0 AND NEW.ended_at>0 BEGIN
   ${gameplayRules.filter(r=>r.game==='sky').map(r=>accumulate(r,'t',`AND ${json('t','flight')}=NEW.id`)).join('\n')}
   ${gameplayAwardsSQL("AND g.employee_id IN (SELECT employee_id FROM game_tickets WHERE game='sky' AND json_extract(result_json,'$.flight')=NEW.id)")} END;`);
 }
 db.exec(gameplayAwardsSQL());
}
