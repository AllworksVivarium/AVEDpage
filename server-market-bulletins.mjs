import {randomInt} from 'node:crypto';
import {companyDispatches} from './server-company-dispatches.mjs';

const dispatches={
 'AVED.VIV':[['收容预算追加申请获批，封条采购量上调。',1],['新一批安保门完成验收，收容区将分批更新。',1],['夜班巡查增设岗位，值守合同进入续签。',1],['例行盘点多出一间收容室，维护费用待核。',-1],['旧区封条消耗超出预估，采购计划待复核。',-1],['一份卷宗比值班员先到岗，暂不计入考勤。',0],['收容区走廊编号重新排列，导航仍称自己正常。',0]],
 'AVED.ANC':[['新一批装备完成验收，外勤订单增加。',1],['训练器材追加采购获批，外勤备勤席位扩充。',1],['外勤护具通过耐久复测，交付进度提前。',1],['训练场维修延期，装备损耗预算上调。',-1],['两批制服需重新核码，发放日期顺延。',-1],['武装部提醒：走廊内请勿进行战术翻滚。',0],['演习靶机申请列入优秀员工，审批尚未通过。',0]],
 'AVED.MEM':[['咖啡供应恢复，后勤采购合同续签。',1],['仓储盘点系统完成升级，调拨效率有所改善。',1],['深夜班车恢复运行，站点补给合同续签。',1],['仓库盘点出现缺口，补货成本上升。',-1],['电梯检修增加临时支出，后勤预算正在调整。',-1],['后勤部否认正在发行可兑换午休的纸券。',0],['茶水间失物招领处出现一台失物招领机。',0]],
 'AVED.RES':[['研究成果进入量产评估，项目预算增加。',1],['新型传感器完成盲测，试制资金获批。',1],['跨部门实验室开始试运行，设备需求增加。',1],['核心实验未能复现，验收日期延后。',-1],['样本冷库维护提前，实验排期暂缓。',-1],['科研部称，新设备暂时只会打印自己的说明书。',0],['一台原型机拒绝关机，理由是正在思考。',0]],
 'AVED.MED':[['新诊疗方案通过内部评估，服务额度增加。',1],['员工体检预约量上升，新增夜间门诊班次。',1],['新一批医疗设备完成标定，诊疗室扩容。',1],['医疗耗材供应延迟，临时采购价格上涨。',-1],['医务室扩建延期，临时诊室继续使用。',-1],['医务室提醒：心跳与行情同频不属于工伤。',0],['候诊屏显示下一位患者是候诊屏本身。',0]]
};

export const marketDispatches=[...Object.entries(dispatches).flatMap(([code,items])=>items.map(([headline,direction])=>({code,headline,direction}))),...companyDispatches];

export function installMarketBulletins(db,{random=()=>randomInt(0,1000000)/1000000}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS market_bulletins(id INTEGER PRIMARY KEY,code TEXT NOT NULL,headline TEXT NOT NULL,published_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,impulse REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS market_bulletin_clock(id INTEGER PRIMARY KEY CHECK(id=1),next_at INTEGER NOT NULL);
 INSERT OR IGNORE INTO market_bulletin_clock VALUES(1,0);`);
 const latest=db.prepare('SELECT published_at FROM market_bulletins ORDER BY id DESC LIMIT 1').get();
 if(latest)db.prepare('UPDATE market_bulletin_clock SET next_at=? WHERE id=1').run(latest.published_at+180000);
 function advance(at){
  if(db.prepare('SELECT next_at FROM market_bulletin_clock WHERE id=1').get().next_at>at)return;
  const recentHeadlines=new Set(db.prepare('SELECT headline FROM market_bulletins ORDER BY id DESC LIMIT 12').all().map(row=>row.headline));
  const unused=marketDispatches.filter(({headline})=>!recentHeadlines.has(headline));
  const choices=unused.length?unused:marketDispatches;
  const {code,headline,direction}=choices[Math.floor(random()*choices.length)];
  // Truth/impact stays server-side. Public headlines never promise a direction.
  const impulse=random()<.45?direction*.00018:0;
  db.prepare('INSERT INTO market_bulletins(code,headline,published_at,expires_at,impulse) VALUES(?,?,?,?,?)').run(code,headline,at,at+600000,impulse);
  db.prepare('UPDATE market_bulletin_clock SET next_at=? WHERE id=1').run(at+180000);
  db.prepare('DELETE FROM market_bulletins WHERE id NOT IN (SELECT id FROM market_bulletins ORDER BY id DESC LIMIT 200)').run();
 }
 function drift(code,at){
  const rows=db.prepare('SELECT impulse,published_at,expires_at FROM market_bulletins WHERE code=? AND published_at<=? AND expires_at>?').all(code,at,at);
  const sum=rows.reduce((s,r)=>s+r.impulse*(r.expires_at-at)/(r.expires_at-r.published_at),0);
  return Math.max(-.0005,Math.min(.0005,sum));
 }
 function recent(){return db.prepare('SELECT id,code,headline,published_at AS publishedAt FROM market_bulletins ORDER BY id DESC LIMIT 6').all();}
 return {advance,drift,recent};
}
