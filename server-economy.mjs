import {skyRules} from './server-sky-rules.mjs';
import {randomBytes,createHash,createHmac} from 'node:crypto';
import {scratchTiers,scratchGameTypes,scratchBombRules,scratchSuperJackpot,scratchClimbMultipliers,scratchReturnPercent} from './server-content.mjs';
import {slotRules} from './server-slot.mjs';

export function proofRandom(){const seed=randomBytes(32).toString('hex');let counter=0;return {seed,seedHash:createHash('sha256').update(seed).digest('hex'),random:()=>createHmac('sha256',Buffer.from(seed,'hex')).update(String(counter++)).digest().readUInt32BE(0)/4294967296};}
export function weighted(items,random){const sum=items.reduce((s,x)=>s+x.weight,0);let n=random()*sum;for(const item of items){n-=item.weight;if(n<0)return item;}return items.at(-1);}
export const expectedReturn=items=>items.reduce((s,x)=>s+x.weight*(x.multiplier-(x.penaltyMultiplier||0)*(x.sealMultiplier||1)),0)/items.reduce((s,x)=>s+x.weight,0);
export const scratchPrizeMultipliers=Object.fromEntries(scratchTiers.map(t=>[t.id,[5,10,20,30,50,100]]));
export const MAX_RETURN_PERCENT=150;
function withSuperJackpot(pool){
 const total=pool.reduce((sum,outcome)=>sum+outcome.weight,0);
 const ordinary=pool.find(x=>x.multiplier===5&&!x.penaltyMultiplier&&(x.sealMultiplier||1)===1);
 const empty=pool.find(x=>x.multiplier===0&&!x.penaltyMultiplier&&(x.sealMultiplier||1)===1);
 // Fund the rare award from a small portion of 5x wins. Reallocating within
 // seal=1 preserves exact total weight, payout expectation and seal/bomb odds.
 const units=scratchSuperJackpot.multiplier/ordinary.multiplier;
 const weight=Math.min(Math.round(total*scratchSuperJackpot.chance),Math.floor(ordinary.weight/units));
 ordinary.weight-=units*weight;empty.weight+=(units-1)*weight;
 return [...pool,{multiplier:scratchSuperJackpot.multiplier,baseMultiplier:scratchSuperJackpot.multiplier,sealMultiplier:1,superJackpot:true,weight}];
}
// Lucky seals multiply both payouts and extra deductions.
function withClimbFloors(pool){
 const floors=scratchClimbMultipliers.map(multiplier=>({multiplier,weight:0}));
 const specials=pool.filter(x=>x.penaltyMultiplier||x.superJackpot);
 const ordinary=pool.filter(x=>!x.penaltyMultiplier&&!x.superJackpot);
 for(const outcome of ordinary){
  const high=floors.findIndex(x=>x.multiplier>=outcome.multiplier),upper=floors[high],lower=floors[Math.max(0,high-1)];
  if(upper.multiplier===outcome.multiplier){upper.weight+=outcome.weight;continue;}
  const weight=Math.round(outcome.weight*(outcome.multiplier-lower.multiplier)/(upper.multiplier-lower.multiplier));
  upper.weight+=weight;lower.weight+=outcome.weight-weight;
 }
 // Adjacent-floor rounding preserves the distribution's shape. Correct its
 // tiny integer-weight remainder using 0, 0.5 and 1.2 awards (50/120 cents).
 const cents=items=>items.reduce((sum,x)=>sum+Math.round(x.multiplier*100)*x.weight,0);
 const difference=cents(ordinary)-cents(floors),nearest=Math.round(difference/10);
 let corrected=false;
 for(const offset of [0,1,-1,2,-2,3,-3,4,-4]){
  const units=nearest+offset,a0=((units*3)%5+5)%5,b0=(units-7*a0)/5;
  const min=Math.max(Math.ceil((b0-floors[0].weight)/7),Math.ceil((-floors[2].weight-a0)/5));
  const max=Math.floor((floors[1].weight+b0-a0)/12);
  if(min>max)continue;
  const k=Math.min(max,Math.max(min,0)),a=a0+5*k,b=b0-7*k;
  floors[0].weight-=b;floors[1].weight+=b-a;floors[2].weight+=a;corrected=true;break;
 }
 if(!corrected)throw Error('巡签奖池无法保持整数权重。');
 return [...floors,...specials];
}
// Concentrate outcomes in ordinary prizes while preserving the configured effective RTP.
// Bomb multiplier is the EXTRA deduction; total loss also includes the paid stake.
export function returnRatePool(percent,tierId='t1',type='three_match'){
 const sealMean=1.44,nominal=percent;
 if(type==='lucky_num')percent/=sealMean;
 if(!Number.isFinite(nominal)||nominal<0||nominal>MAX_RETURN_PERCENT)throw Error('返还率应为 0% 至 150%。');
 if(!scratchPrizeMultipliers[tierId])throw Error('票种编号无效。');
 const rows=[[.03,3],[.05,3],[.08,3],[.14,3],[.26,5],[.38,5],[.55,6.5],[.72,5],[.9,4.9],[1.05,15.76],[1.12,15],[1.2,7.54],[1.68,10],[2.2,5],[2.8,3],[4,1],[5,1.8],[10,.6],[20,.2],[30,.08],[50,.015],[100,.005]];
 const scale=Math.min(percent/scratchReturnPercent,1);
 const pool=rows.map(([multiplier,p])=>({multiplier,weight:Math.round(p*1000000*scale*(multiplier>=5?.8:1))}));
 if(percent>scratchReturnPercent)pool.at(-1).weight+=Math.round((percent-scratchReturnPercent)/100/100*1e8);
 pool.push(...scratchBombRules.outcomes.map(({penaltyMultiplier,chance})=>({multiplier:0,penaltyMultiplier,weight:Math.round(chance*1e8*(nominal>0?1:0))})));
 if(percent<.01){for(const x of pool)x.weight=0;pool[0].weight=Math.round(percent/100*1e8/.03);}
 // Keep the advertised bomb odds fixed. Shift small wins to 5x awards instead
 // of raising jackpots or scaling fees with a player's account balance.
 const overflow=Math.max(0,pool.reduce((n,x)=>n+x.weight,0)-1e8);pool[0].weight-=overflow;
 const base=[{multiplier:0,weight:1e8-pool.reduce((s,x)=>s+x.weight,0)},...pool];
 let missing=percent/100*1e8-base.reduce((n,x)=>n+(x.multiplier-(x.penaltyMultiplier||0))*x.weight,0);
 const award=multiplier=>base.find(x=>x.multiplier===multiplier&&!x.penaltyMultiplier);
 const transfer=(from,to)=>{const difference=to.multiplier-from.multiplier,count=Math.min(from.weight,Math.max(0,Math.floor(missing/difference)));from.weight-=count;to.weight+=count;missing-=count*difference;};
 if(missing>0){transfer(award(1.05),award(5));transfer(award(0),award(5));}
 // Fine correction keeps integer weights, exact total mass and <1e-8 RTP error.
 const correction=Math.round(missing/(1.05-.03));award(.03).weight-=correction;award(1.05).weight+=correction;
 if(type==='step_climb')return withClimbFloors(withSuperJackpot(base));
 if(type!=='lucky_num')return withSuperJackpot(base);
 return withSuperJackpot(base.flatMap(x=>[[1,70],[2,20],[3,8],[5,2]].map(([sealMultiplier,weight])=>({...x,baseMultiplier:x.multiplier,multiplier:x.multiplier*sealMultiplier,sealMultiplier,weight:x.weight*weight}))));
}
export function defaultEconomy(){return {scratch:scratchTiers.map(x=>({id:x.id,name:'刮刮乐',cost:x.cost,returnPercent:scratchReturnPercent,variants:Object.fromEntries(scratchGameTypes.map(g=>[g.type,returnRatePool(scratchReturnPercent,x.id,g.type)]))})),sky:skyRules()};}
function checkPool(items){if(!Array.isArray(items)||items.length<2||items.length>128)throw Error('奖池需包含 2 至 128 档。');let sum=0;for(const x of items){if(!Number.isFinite(x.multiplier)||x.multiplier<0||x.multiplier>10000||!Number.isSafeInteger(x.weight)||x.weight<0||x.weight>10000000000)throw Error('倍率应为 0 至 10,000，权重应为非负整数。');if(x.penaltyMultiplier!==undefined&&(!scratchBombRules.outcomes.some(b=>b.penaltyMultiplier===x.penaltyMultiplier)||x.multiplier!==0))throw Error('炸弹追加倍率无效。');sum+=x.weight;}if(!sum)throw Error('奖池总权重必须大于零。');}
export function validateEconomy(c){
 if(!c||!Array.isArray(c.scratch)||c.scratch.length!==scratchTiers.length)throw Error('票种配置不完整。');
 for(const tier of c.scratch){tier.name='刮刮乐';if(tier.returnPercent===undefined){for(const g of scratchGameTypes)checkPool(tier.variants?.[g.type]);tier.returnPercent=Object.values(tier.variants).reduce((sum,p)=>sum+expectedReturn(p),0)/Object.keys(tier.variants).length*100;}tier.variants=Object.fromEntries(scratchGameTypes.map(g=>[g.type,returnRatePool(tier.returnPercent,tier.id,g.type)]));}
 for(const t of scratchTiers){const matches=c.scratch.filter(x=>x.id===t.id);if(matches.length!==1)throw Error('票种编号无效。');const x=matches[0];if(!Number.isSafeInteger(x.cost)||x.cost<100||x.cost>1000000||typeof x.name!=='string'||!x.name.trim()||x.name.length>32)throw Error('票价应为 100 至 1,000,000，名称最多 32 字。');for(const g of scratchGameTypes)checkPool(x.variants?.[g.type]);}
 if(c.scratch.some(t=>t.returnPercent!==c.scratch[0].returnPercent))throw Error('所有票价档必须使用同一返还率。');
 const s=c.sky;if(s&&s.lossFraction!==1)throw Error('越过安全线固定损失全部本金，不能修改。');if(!s||!Number.isInteger(s.boardingSeconds)||s.boardingSeconds<10||s.boardingSeconds>120||!Number.isFinite(s.speed)||s.speed<10||s.speed>100||!Array.isArray(s.ranges)||s.ranges.length<1||s.ranges.length>20)throw Error('空投参数无效。');let sum=0;for(const x of s.ranges){if(!Number.isInteger(x.min)||!Number.isInteger(x.max)||x.min<100||x.max>x.min+2000||x.max>2200||x.max<x.min||!Number.isSafeInteger(x.weight)||x.weight<0||x.weight>100000000)throw Error('安全线须在 100 至 2,200 米，权重为非负整数。');sum+=x.weight;}if(!sum)throw Error('安全线总权重必须大于零。');
 return c;
}
export function installEconomy({db,send,readBody,requireAdmin,requireEmployee,balanceFor,recordLedger,log}){
 db.exec(`CREATE TABLE IF NOT EXISTS economy_config(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,config_json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS economy_migrations(code TEXT PRIMARY KEY);`);
 db.prepare('INSERT OR IGNORE INTO economy_config VALUES(1,1,?)').run(JSON.stringify(defaultEconomy()));
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='affordable-shares'").get()){
  db.exec('BEGIN IMMEDIATE');try{
   for(const s of db.prepare("SELECT code,price FROM stock_prices WHERE code<>'KARMA'").all()){const price=Math.max(1,Math.floor(s.price/10));for(const h of db.prepare('SELECT employee_id,quantity FROM stock_holdings WHERE code=? AND quantity>0').all(s.code)){const remainder=(s.price-price*10)*h.quantity;if(remainder)recordLedger(h.employee_id,remainder,'拆股零差结余 '+s.code);}db.prepare('UPDATE stock_prices SET price=? WHERE code=?').run(price,s.code);db.prepare('UPDATE stock_holdings SET quantity=quantity*10 WHERE code=?').run(s.code);db.prepare('UPDATE stock_market_bases SET price=price/10.0 WHERE code=?').run(s.code);db.prepare('UPDATE stock_candles SET open=MAX(1,ROUND(open/10.0)),high=MAX(1,ROUND(high/10.0)),low=MAX(1,ROUND(low/10.0)),close=MAX(1,ROUND(close/10.0)),volume=volume*10 WHERE code=?').run(s.code);}
   db.prepare("INSERT INTO economy_migrations VALUES('affordable-shares')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='sky-rules-v2'").get()){db.exec('BEGIN IMMEDIATE');try{const c=JSON.parse(db.prepare('SELECT config_json FROM economy_config WHERE id=1').get().config_json);delete c.risk;c.sky=defaultEconomy().sky;db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));db.prepare("INSERT INTO economy_migrations VALUES('sky-rules-v2')").run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='scratch-percent-and-full-sky-loss'").get()){
  db.exec('BEGIN IMMEDIATE');try{
   const c=JSON.parse(db.prepare('SELECT config_json FROM economy_config WHERE id=1').get().config_json);
   for(const tier of c.scratch){tier.name='刮刮乐';tier.returnPercent=Math.min(100,Number((Object.values(tier.variants).reduce((sum,p)=>sum+expectedReturn(p),0)/Object.keys(tier.variants).length*100).toFixed(2)));tier.variants=Object.fromEntries(scratchGameTypes.map(g=>[g.type,returnRatePool(tier.returnPercent,tier.id)]));}
   c.sky.lossFraction=1;db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));
   db.prepare("INSERT INTO economy_migrations VALUES('scratch-percent-and-full-sky-loss')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 // Preserve configured ticket prices and RTP; only replace the prize structure.
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='tiered-scratch-prizes-v2'").get()){
  db.exec('BEGIN IMMEDIATE');try{
   const c=JSON.parse(db.prepare('SELECT config_json FROM economy_config WHERE id=1').get().config_json);
   for(const tier of c.scratch){tier.variants=Object.fromEntries(scratchGameTypes.map(g=>[g.type,returnRatePool(tier.returnPercent,tier.id,g.type)]));}
   db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));
   db.prepare("INSERT INTO economy_migrations VALUES('tiered-scratch-prizes-v2')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 // Apply the requested new baseline once; later administrator changes survive restarts.
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='varied-returns-102-v1'").get()){
  db.exec('BEGIN IMMEDIATE');try{
   const c=JSON.parse(db.prepare('SELECT config_json FROM economy_config WHERE id=1').get().config_json);
   for(const tier of c.scratch){tier.returnPercent=102;const p=returnRatePool(102,tier.id);tier.variants=Object.fromEntries(scratchGameTypes.map(g=>[g.type,p.map(x=>({...x}))]));}
   c.sky.ranges=defaultEconomy().sky.ranges;c.sky.lossFraction=1;
   db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));
   db.prepare("INSERT INTO economy_migrations VALUES('varied-returns-102-v1')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='unified-scratch-odds-v1'").get()){
  db.exec('BEGIN IMMEDIATE');try{
   const c=JSON.parse(db.prepare('SELECT config_json FROM economy_config WHERE id=1').get().config_json);
   for(const t of c.scratch){t.returnPercent=102;t.variants=Object.fromEntries(scratchGameTypes.map(g=>[g.type,returnRatePool(102,t.id)]));}
   db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));
   db.prepare("INSERT INTO economy_migrations VALUES('unified-scratch-odds-v1')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 const get=()=>({...structuredClone(defaultEconomy()),revision:db.prepare('SELECT revision FROM economy_config WHERE id=1').get().revision});
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='scratch-generous-v2'").get()){
  db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT config_json FROM economy_config WHERE id=1').get(),c=JSON.parse(row.config_json);
   for(const t of c.scratch){t.returnPercent=150;t.variants=Object.fromEntries(scratchGameTypes.map(g=>[g.type,returnRatePool(150,t.id)]));}
   db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));
   db.prepare("INSERT INTO economy_migrations VALUES('scratch-generous-v2')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='scratch-balanced-130-v3'").get()){
  db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT config_json FROM economy_config WHERE id=1').get(),c=JSON.parse(row.config_json);
   for(const t of c.scratch){t.returnPercent=130;t.variants=Object.fromEntries(scratchGameTypes.map(g=>[g.type,returnRatePool(130,t.id)]));}
   db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));
   db.prepare("INSERT INTO economy_migrations VALUES('scratch-balanced-130-v3')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 // Persist the agreed rules; stored legacy admin edits are no longer authoritative.
 const fixedConfig=JSON.stringify(defaultEconomy());
 if(db.prepare('SELECT config_json FROM economy_config WHERE id=1').get().config_json!==fixedConfig)db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(fixedConfig);
 const publicRules=()=>{const c=get();return {revision:c.revision,scratchBombs:scratchBombRules,scratchClimbMultipliers,tiers:c.scratch.map(x=>({id:x.id,name:x.name,cost:x.cost,topPrizes:Object.fromEntries(Object.entries(x.variants).map(([key,pool])=>[key,Math.floor(x.cost*Math.max(...pool.filter(p=>p.weight>0).map(p=>p.multiplier)))]))})),slot:slotRules,sky:{boardingSeconds:c.sky.boardingSeconds,speed:c.sky.speed,breakEvenDepth:c.sky.breakEvenDepth,lossFraction:c.sky.lossFraction}};};
 return {get,publicRules,async handle(req,res,url){const path=url.pathname;if(path==='/api/admin/economy'||path.startsWith('/api/admin/economy/')){send(res,404,{error:'此功能已移除。'});return true;}if(!['/api/player/economy','/api/player/games/risk'].includes(path))return false;const actor=requireEmployee(req,res);if(!actor)return true;try{
  if(path==='/api/player/economy'&&req.method==='GET'){send(res,200,publicRules());return true;}
  if(path==='/api/player/games/risk'){send(res,410,{error:'该设施已撤销。'});return true;}
  send(res,405,{error:'指令无效。'});return true;
 }catch(e){send(res,400,{error:e.message,...(e.code?{code:e.code}:{})});return true;}}};
}
