import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installPersonal} from '../server-personal.mjs';
import {installFunDerbyAchievements} from '../server-fun-achievements.mjs';

function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY);
 CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);
 CREATE TABLE earned_achievements(employee_id INTEGER REFERENCES employees(id),code TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,code));
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER,reason TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),game TEXT,cost INTEGER,prize INTEGER,result_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO employees VALUES(1),(2);INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(1,1000,'初始余额');`);
 const service=installPersonal({db});
 const ledger=(delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(1,?,?)').run(delta,reason);
 const ticket=(game,prize=0,result={})=>db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,result_json) VALUES(1,?,100,?,?)').run(game,prize,JSON.stringify(result));
 const has=code=>service.earned(1).some(a=>a.code===code);
 return {db,ledger,ticket,has,service};
}
test('hidden fun awards use settled losses and same-day ledger actions without minting money',t=>{
 const {db,ledger,ticket,has,service}=fixture(t);assert.deepEqual(service.earned(2),[]);
 ticket('scratch');assert.ok(has('fun-startup'));ticket('scratch');assert.ok(!has('fun-smiling'));
 ticket('scratch',101,{tax:1});assert.ok(has('fun-smiling'));
 ledger(10000,'应急低保');assert.ok(has('fun-relief'));
 ledger(-10,'爱心账户捐款');assert.ok(has('fun-charity'));
 ledger(500000,'slot奖金');ticket('slot',500000);
 ledger(-600000,'刮刮乐炸弹追加扣款');assert.ok(!has('fun-money-visited'),'wait for settled result');
 ticket('scratch');assert.ok(has('fun-money-visited'));
 ledger(89010,'主动归零');assert.ok(has('fun-company-backup'));
 assert.equal(db.prepare('SELECT balance FROM fun_achievement_state WHERE employee_id=1').get().balance,0);
});
test('sky rolling losses and last-round window reset correctly and retain bounded history',t=>{
 const {db,ticket,has}=fixture(t);
 ticket('sky',50,{safe:true,depth:120});assert.ok(has('fun-arrived'));
 ticket('sky',50,{safe:true,depth:150});assert.ok(!has('fun-alive'));
 ticket('sky',50,{safe:true,depth:180});assert.ok(has('fun-alive'));
 db.exec("UPDATE fun_achievement_events SET created_at=datetime('now','-16 minutes')");
 for(let i=0;i<9;i++)ticket('slot',100);assert.ok(!has('fun-last-round'));
 ticket('slot',100);assert.ok(has('fun-last-round'));
 for(let i=0;i<15;i++)ticket('slot',100);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM fun_achievement_events WHERE game='slot'").get().n,10);
});
test('derby streak counts settled races once and any winning selection breaks the streak',t=>{
 const {db,has}=fixture(t);
 db.exec('CREATE TABLE derby_races(id INTEGER PRIMARY KEY,settled INTEGER DEFAULT 0);CREATE TABLE derby_wagers(race_id INTEGER,employee_id INTEGER,settled INTEGER,cost INTEGER,prize INTEGER)');
 installFunDerbyAchievements(db);
 function race(id,win=false){db.prepare('INSERT INTO derby_races(id) VALUES(?)').run(id);db.prepare('INSERT INTO derby_wagers VALUES(?,1,1,100,0),(?,1,1,100,?)').run(id,id,win?300:0);db.prepare('UPDATE derby_races SET settled=1 WHERE id=?').run(id);}
 for(let i=1;i<=4;i++)race(i);assert.ok(!has('fun-participation'));
 race(5,true);for(let i=6;i<=9;i++)race(i);assert.ok(!has('fun-participation'));
 race(10);assert.ok(has('fun-participation'));
 db.exec('UPDATE derby_races SET settled=1');assert.equal(db.prepare('SELECT derby_streak FROM fun_achievement_state WHERE employee_id=1').get().derby_streak,5);
});
test('new-day reset, cancelled rounds, rollback and reinstall do not create phantom awards',t=>{
 const {db,ledger,ticket,has}=fixture(t);
 for(const key of ['demo','cancelled','migrated'])ticket('scratch',0,{[key]:true});assert.ok(!has('fun-startup'));
 ledger(-5,'爱心账户捐款');db.exec("UPDATE fun_achievement_state SET day='2000-01-01',large_prize=1,lost=1");
 ledger(10000,'应急低保');assert.ok(!has('fun-charity'));assert.ok(!has('fun-relief'));
 db.exec('BEGIN');ticket('scratch');db.exec('ROLLBACK');assert.ok(!has('fun-startup'));
 ticket('scratch');installPersonal({db});assert.equal(db.prepare('SELECT scratch_streak FROM fun_achievement_state WHERE employee_id=1').get().scratch_streak,1);
});
