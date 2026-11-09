import {randomInt} from 'node:crypto';

const dispatches={
 'AVED.VIV':[['收容预算追加申请获批，封条采购量上调。',1],['例行盘点多出一间收容室，维护费用待核。',-1],['夜班报告称，某份卷宗开始自行填写。',0]],
 'AVED.ANC':[['新一批装备完成验收，外勤订单增加。',1],['训练场维修延期，装备损耗预算上调。',-1],['武装部提醒：走廊内请勿进行战术翻滚。',0]],
 'AVED.MEM':[['咖啡供应恢复，后勤采购合同续签。',1],['仓库盘点出现缺口，补货成本上升。',-1],['后勤部否认正在发行可兑换午休的纸券。',0]],
 'AVED.RES':[['研究成果进入量产评估，项目预算增加。',1],['核心实验未能复现，验收日期延后。',-1],['科研部称，新设备暂时只会打印自己的说明书。',0]],
 'AVED.MED':[['新诊疗方案通过内部评估，服务额度增加。',1],['医疗耗材供应延迟，临时采购价格上涨。',-1],['医务室提醒：心跳与行情同频不属于工伤。',0]]
};

export function installMarketBulletins(db,{random=()=>randomInt(0,1000000)/1000000}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS market_bulletins(id INTEGER PRIMARY KEY,code TEXT NOT NULL,headline TEXT NOT NULL,published_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,impulse REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS market_bulletin_clock(id INTEGER PRIMARY KEY CHECK(id=1),next_at INTEGER NOT NULL);
 INSERT OR IGNORE INTO market_bulletin_clock VALUES(1,0);`);
 function advance(at){
  if(db.prepare('SELECT next_at FROM market_bulletin_clock WHERE id=1').get().next_at>at)return;
  const stocks=db.prepare("SELECT code,name FROM stock_prices WHERE code<>'KARMA' ORDER BY code").all();if(!stocks.length)return;
  const stock=stocks[Math.floor(random()*stocks.length)];
  const options=dispatches[stock.code]||[[stock.name+'获得新增预算，项目扩展提案流转中。',1],[stock.name+'成本复核启动，部分采购计划延后。',-1],[stock.name+'提交例行简报，附件暂未找到。',0]];
  const [headline,direction]=options[Math.floor(random()*options.length)];
  // Truth/impact stays server-side. Public headlines never promise a direction.
  const impulse=random()<.45?direction*.00018:0;
  db.prepare('INSERT INTO market_bulletins(code,headline,published_at,expires_at,impulse) VALUES(?,?,?,?,?)').run(stock.code,headline,at,at+600000,impulse);
  db.prepare('UPDATE market_bulletin_clock SET next_at=? WHERE id=1').run(at+120000+Math.floor(random()*120000));
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
