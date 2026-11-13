import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installPersonal} from '../server-personal.mjs';

function fixture(t,initialize=true){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE employees(id INTEGER PRIMARY KEY);
 CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);
 CREATE TABLE earned_achievements(employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,code TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,code));
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER,reason TEXT);
 CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,game TEXT,cost INTEGER,prize INTEGER,result_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE sky_flights(id INTEGER PRIMARY KEY,ended_at INTEGER DEFAULT 0);`);
 for(let id=1;id<=20;id++)db.prepare('INSERT INTO employees VALUES(?)').run(id);
 let service;
 const install=()=>service=installPersonal({db});
 const add=(id,game,result={},prize=200,cost=100)=>db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,result_json) VALUES(?,?,?,?,?)').run(id,game,cost,prize,JSON.stringify(result));
 // This fixture checks the original gameplay awards; fun awards have their own coverage.
 const codes=id=>service.earned(id).map(a=>a.code).filter(code=>!code.startsWith('fun-'));
 const metric=(id,name)=>db.prepare('SELECT value FROM gameplay_achievement_metrics WHERE employee_id=? AND metric=?').get(id,name)?.value||0;
 if(initialize)install();return {db,install,add,codes,metric};
}

test('sky boundaries award only safe openings after reveal, including exactly 1 and 10 metres',t=>{
 const {db,add,codes,metric,install}=fixture(t);
 for(const [index,gap] of [0,1,2,10,11].entries()){
  const id=index+1;db.prepare('INSERT INTO sky_flights(id) VALUES(?)').run(id);
  add(id,'sky',{flight:id,safe:true,depth:800,safetyLine:800+gap,expired:false});
  assert.deepEqual(codes(id),[],'profile must not leak proximity before the safety line is public');
  db.prepare('UPDATE sky_flights SET ended_at=1000 WHERE id=?').run(id);
  assert.ok(codes(id).includes('sky-safe'));assert.ok(codes(id).includes('sky-deep'));
  assert.equal(codes(id).includes('sky-extreme'),gap<=10);assert.equal(codes(id).includes('sky-miracle'),gap<=1);
  db.prepare('UPDATE sky_flights SET ended_at=2000 WHERE id=?').run(id);assert.equal(metric(id,'sky_safe_count'),1);
 }
 for(const [i,result] of [{safe:false,depth:800,safetyLine:800},{safe:true,expired:true,depth:800,safetyLine:800},{safe:true,depth:801,safetyLine:800},{safe:true,depth:800,safetyLine:800,cancelled:true}].entries()){
  const id=i+6;db.prepare('INSERT INTO sky_flights(id) VALUES(?)').run(id);add(id,'sky',{flight:id,...result});db.prepare('UPDATE sky_flights SET ended_at=1000 WHERE id=?').run(id);assert.deepEqual(codes(id),[]);
 }
 install();assert.equal(metric(1,'sky_safe_count'),1,'restart does not double-count a revealed flight');
});

test('scratch and slot achievements follow actual results and ignore refunds and demos',t=>{
 const {add,codes,db}=fixture(t);
 add(1,'scratch',{},200);assert.deepEqual(codes(1),['scratch-win']);
 add(1,'scratch',{rarePrize:true},1000);assert.ok(codes(1).includes('scratch-ten'));assert.ok(codes(1).includes('scratch-rare'));
 add(2,'scratch',{penalty:400},200);assert.deepEqual(codes(2),[],'a gross return below total outlay is not a win');
 for(const key of ['cancelled','migrated','demo'])add(3,'scratch',{[key]:true,rarePrize:true},1000);assert.deepEqual(codes(3),[]);
 add(4,'slot',{notes:['上沿 5连'],mechanisms:[0,1]});assert.ok(codes(4).includes('slot-five'));assert.ok(codes(4).includes('slot-dual'));assert.ok(!codes(4).includes('slot-full'));
 add(4,'slot',{notes:[],mechanisms:[0,1,2]});assert.ok(codes(4).includes('slot-full'));
 const before=db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n;
 db.exec('BEGIN');add(5,'slot',{notes:['中路 5连'],mechanisms:[0,1,2]});db.exec('ROLLBACK');assert.deepEqual(codes(5),[]);assert.equal(db.prepare('SELECT COUNT(*) n FROM game_tickets').get().n,before);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,0,'achievements never add money');
});

test('derby double hit requires the same person and race, in either settlement order',t=>{
 const {add,codes,metric}=fixture(t);
 for(const [id,markets] of [[1,['first','last']],[2,['last','first']]]){
  add(id,'derby',{round:10,market:markets[0]});assert.ok(!codes(id).includes('derby-both'));
  add(id,'derby',{round:10,market:markets[1]});assert.ok(codes(id).includes('derby-both'));assert.equal(metric(id,'derby_both_count'),1);
 }
 add(3,'derby',{round:20,market:'first'});add(3,'derby',{round:21,market:'last'});assert.ok(!codes(3).includes('derby-both'));
 add(4,'derby',{round:20,market:'last'});assert.ok(!codes(4).includes('derby-both'));
 add(5,'derby',{round:20,market:'first',cancelled:true});add(5,'derby',{round:20,market:'last'});assert.ok(!codes(5).includes('derby-both'));
 add(6,'derby',{round:20,market:'first'},0);add(6,'derby',{round:20,market:'last'});assert.ok(!codes(6).includes('derby-both'));
});

test('card achievements require a manual play and distinguish actual winner roles',t=>{
 const {add,codes}=fixture(t);
 const round={seat:1,landlord:0,winner:'farmers',multiplier:8};
 add(1,'cards',{...round,autoOnly:true});add(2,'cards',round);assert.deepEqual(codes(1),[]);assert.deepEqual(codes(2),[],'old tickets without participation evidence cannot prove manual play');
 add(3,'cards',{...round,autoOnly:false});assert.ok(codes(3).includes('cards-win'));assert.ok(codes(3).includes('cards-partner'));assert.ok(codes(3).includes('cards-multiplier'));assert.ok(!codes(3).includes('cards-landlord'));
 add(4,'cards',{...round,seat:0,winner:'landlord',autoOnly:false});assert.ok(codes(4).includes('cards-landlord'));assert.ok(!codes(4).includes('cards-partner'));
 add(5,'cards',{...round,autoOnly:false},0);assert.deepEqual(codes(5),[]);
});

test('historical backfill is idempotent, keeps admin revisions and excludes flights still in progress',t=>{
 const {db,install,add,codes,metric}=fixture(t,false);
 db.exec('INSERT INTO sky_flights VALUES(1,1000),(2,0)');
 add(1,'sky',{flight:1,safe:true,depth:800,safetyLine:801});add(2,'sky',{flight:2,safe:true,depth:800,safetyLine:801});
 add(3,'derby',{round:1,market:'last'});add(3,'derby',{round:1,market:'first'});
 add(4,'scratch',{rarePrize:true},1000);const rows=db.prepare('SELECT * FROM game_tickets').all();install();
 assert.ok(codes(1).includes('sky-miracle'));assert.deepEqual(codes(2),[]);assert.equal(metric(3,'derby_both_count'),1);
 assert.ok(codes(4).includes('scratch-rare'));db.exec("UPDATE achievement_definitions SET title='管理员修订',enabled=0 WHERE code='sky-miracle'");
 install();assert.equal(metric(3,'derby_both_count'),1);assert.equal(db.prepare("SELECT title FROM achievement_definitions WHERE code='sky-miracle'").get().title,'管理员修订');assert.ok(!codes(1).includes('sky-miracle'));
 db.exec('UPDATE sky_flights SET ended_at=2000 WHERE id=2');assert.ok(codes(2).includes('sky-extreme'));
 assert.deepEqual(db.prepare('SELECT * FROM game_tickets').all(),rows);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
});
