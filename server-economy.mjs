import {randomBytes,createHash,createHmac} from 'node:crypto';
import {scratchTiers,scratchGameTypes} from './server-content.mjs';

export function proofRandom(){const seed=randomBytes(32).toString('hex');let counter=0;return {seed,seedHash:createHash('sha256').update(seed).digest('hex'),random:()=>createHmac('sha256',Buffer.from(seed,'hex')).update(String(counter++)).digest().readUInt32BE(0)/4294967296};}
export function weighted(items,random){const sum=items.reduce((s,x)=>s+x.weight,0);let n=random()*sum;for(const item of items){n-=item.weight;if(n<0)return item;}return items.at(-1);}
export const expectedReturn=items=>items.reduce((s,x)=>s+x.weight*x.multiplier,0)/items.reduce((s,x)=>s+x.weight,0);
function pool(target){const factor=target/.62;const positive=[{multiplier:.2,weight:.15},{multiplier:1,weight:.18},{multiplier:2,weight:.08},{multiplier:10,weight:.015},{multiplier:100,weight:.001}].map(x=>({...x,weight:Math.round(x.weight*factor*1000000)}));return [{multiplier:0,weight:1000000-positive.reduce((s,x)=>s+x.weight,0)},...positive];}
export function defaultEconomy(){return {scratch:scratchTiers.map((x,i)=>({id:x.id,name:x.name,cost:x.cost,variants:Object.fromEntries(scratchGameTypes.map((g,j)=>[g.type,pool(.58+i*.06+j*.025)]))})),sky:{boardingSeconds:20,speed:25,lossFraction:1,ranges:[{min:200,max:340,weight:8000},{min:341,max:440,weight:1800},{min:441,max:800,weight:150},{min:801,max:2000,weight:50}]}};}
function checkPool(items){if(!Array.isArray(items)||items.length<2||items.length>24)throw Error('奖池需包含 2 至 24 档。');let sum=0;for(const x of items){if(!Number.isFinite(x.multiplier)||x.multiplier<0||x.multiplier>10000||!Number.isSafeInteger(x.weight)||x.weight<0||x.weight>100000000)throw Error('倍率应为 0 至 10,000，权重应为非负整数。');sum+=x.weight;}if(!sum)throw Error('奖池总权重必须大于零。');}
export function validateEconomy(c){
 if(!c||!Array.isArray(c.scratch)||c.scratch.length!==scratchTiers.length)throw Error('票种配置不完整。');
 for(const t of scratchTiers){const matches=c.scratch.filter(x=>x.id===t.id);if(matches.length!==1)throw Error('票种编号无效。');const x=matches[0];if(!Number.isSafeInteger(x.cost)||x.cost<100||x.cost>1000000||typeof x.name!=='string'||!x.name.trim()||x.name.length>32)throw Error('票价应为 100 至 1,000,000，名称最多 32 字。');for(const g of scratchGameTypes)checkPool(x.variants?.[g.type]);}
 const s=c.sky;if(!s||!Number.isInteger(s.boardingSeconds)||s.boardingSeconds<10||s.boardingSeconds>120||!Number.isFinite(s.speed)||s.speed<10||s.speed>100||![0,.5,1].includes(s.lossFraction)||!Array.isArray(s.ranges)||s.ranges.length<1||s.ranges.length>20)throw Error('空投参数无效。');let sum=0;for(const x of s.ranges){if(!Number.isInteger(x.min)||!Number.isInteger(x.max)||x.min<100||x.max>x.min+2000||x.max>2000||x.max<x.min||!Number.isSafeInteger(x.weight)||x.weight<0||x.weight>100000000)throw Error('安全线须在 100 至 2,000 米，权重为非负整数。');sum+=x.weight;}if(!sum)throw Error('安全线总权重必须大于零。');
 return c;
}
export function installEconomy({db,send,readBody,requireAdmin,requireEmployee,balanceFor,recordLedger,log}){
 db.exec(`CREATE TABLE IF NOT EXISTS economy_config(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,config_json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS economy_migrations(code TEXT PRIMARY KEY);`);
 db.prepare('INSERT OR IGNORE INTO economy_config VALUES(1,1,?)').run(JSON.stringify(defaultEconomy()));
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='affordable-shares'").get()){
  db.exec('BEGIN IMMEDIATE');try{
   for(const s of db.prepare('SELECT code,price FROM stock_prices').all()){const price=Math.max(1,Math.floor(s.price/10));for(const h of db.prepare('SELECT employee_id,quantity FROM stock_holdings WHERE code=? AND quantity>0').all(s.code)){const remainder=(s.price-price*10)*h.quantity;if(remainder)recordLedger(h.employee_id,remainder,'拆股零差结余 '+s.code);}db.prepare('UPDATE stock_prices SET price=? WHERE code=?').run(price,s.code);db.prepare('UPDATE stock_holdings SET quantity=quantity*10 WHERE code=?').run(s.code);db.prepare('UPDATE stock_market_bases SET price=price/10.0 WHERE code=?').run(s.code);db.prepare('UPDATE stock_candles SET open=MAX(1,ROUND(open/10.0)),high=MAX(1,ROUND(high/10.0)),low=MAX(1,ROUND(low/10.0)),close=MAX(1,ROUND(close/10.0)),volume=volume*10 WHERE code=?').run(s.code);}
   db.prepare("INSERT INTO economy_migrations VALUES('affordable-shares')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 if(!db.prepare("SELECT 1 FROM economy_migrations WHERE code='sky-rules-v2'").get()){db.exec('BEGIN IMMEDIATE');try{const c=JSON.parse(db.prepare('SELECT config_json FROM economy_config WHERE id=1').get().config_json);delete c.risk;c.sky=defaultEconomy().sky;db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1').run(JSON.stringify(c));db.prepare("INSERT INTO economy_migrations VALUES('sky-rules-v2')").run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 const get=()=>{const row=db.prepare('SELECT * FROM economy_config WHERE id=1').get();return {...JSON.parse(row.config_json),revision:row.revision};};
 const publicRules=()=>{const c=get();return {revision:c.revision,tiers:c.scratch.map(x=>({id:x.id,name:x.name,cost:x.cost,topPrizes:Object.fromEntries(Object.entries(x.variants).map(([key,pool])=>[key,Math.floor(x.cost*Math.max(...pool.filter(p=>p.weight>0).map(p=>p.multiplier)))]))})),sky:{boardingSeconds:c.sky.boardingSeconds,speed:c.sky.speed,lossFraction:c.sky.lossFraction}};};
 return {get,publicRules,async handle(req,res,url){const path=url.pathname;if(!['/api/admin/economy','/api/admin/economy/generate','/api/player/economy','/api/player/games/risk'].includes(path))return false;const actor=path.startsWith('/api/admin/')?requireAdmin(req,res):requireEmployee(req,res);if(!actor)return true;try{
  if(path==='/api/player/economy'&&req.method==='GET'){send(res,200,publicRules());return true;}
  if(path==='/api/admin/economy'&&req.method==='GET'){send(res,200,get());return true;}
  if(path==='/api/admin/economy/generate'&&req.method==='POST'){const c=get(),p=proofRandom();for(const t of c.scratch)for(const key of Object.keys(t.variants))t.variants[key]=pool(.5+p.random()*.45);send(res,200,c);return true;}
  if(path==='/api/admin/economy'&&req.method==='PUT'){const body=await readBody(req),c=validateEconomy(body);const result=db.prepare('UPDATE economy_config SET config_json=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify({scratch:c.scratch,sky:c.sky}),body.revision);if(!result.changes){send(res,409,{error:'配置已由其他终端修订，请重新调阅。'});return true;}log(actor.id,'economy.configure','economy',{revision:body.revision+1,config:c});send(res,200,get());return true;}
  if(path==='/api/player/games/risk'){send(res,410,{error:'该设施已撤销。'});return true;}
  send(res,405,{error:'指令无效。'});return true;
 }catch(e){send(res,400,{error:e.message,...(e.code?{code:e.code}:{})});return true;}}};
}
