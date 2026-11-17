import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installAppearance} from '../server-appearance.mjs';

test('palette unlocks use server prices, debit once and remain account-specific',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,initial_balance INTEGER);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER,reason TEXT);
 INSERT INTO employees VALUES(1,110000),(2,49999);`);
 const balanceFor=id=>db.prepare('SELECT initial_balance+COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=?),0) AS balance FROM employees WHERE id=?').get(id,id).balance;
 let signedIn=true;
 const service=installAppearance({db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:()=>signedIn?{id:1}:null,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason)});
 const request=async(method,body)=>{const res={};await service.handle({method,body},res,new URL('http://localhost/api/player/appearance'));return res;};
 assert.deepEqual(service.snapshot(1).owned,['oxblood']);
 const purchased=await request('POST',{palette:'mineral',price:0,balance:999999});
 assert.equal(purchased.status,200);assert.equal(purchased.data.balance,60000);assert.ok(purchased.data.appearance.owned.includes('mineral'));
 await Promise.all([request('POST',{palette:'mineral'}),request('POST',{palette:'mineral'})]);
 assert.equal(balanceFor(1),60000);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM balance_ledger').get().n,1);
 assert.deepEqual(service.snapshot(2).owned,['oxblood']);
 assert.equal((await request('POST',{palette:'oxblood'})).data.balance,60000);
 assert.equal((await request('POST',{palette:'darkroom'})).data.balance,10000);
 assert.equal((await request('POST',{palette:'not-a-palette'})).status,400);
 assert.equal((await request('POST',{palette:'__proto__'})).status,400);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM employee_palettes').get().n,2);
 const second=installAppearance({db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:()=>({id:2}),balanceFor,recordLedger:()=>assert.fail('insufficient balance must not debit')});
 const denied={};await second.handle({method:'POST',body:{palette:'mineral'}},denied,new URL('http://localhost/api/player/appearance'));
 assert.equal(denied.status,400);assert.equal(balanceFor(2),49999);assert.deepEqual(second.snapshot(1).owned.sort(),['darkroom','mineral','oxblood']);
 signedIn=false;const unauth=await request('POST',{palette:'mineral'});assert.equal(unauth.status,undefined);assert.equal(balanceFor(1),10000);
});

function shopFixture(t,initialBalance=160000){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,initial_balance INTEGER);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER,reason TEXT);`);
 db.prepare('INSERT INTO employees VALUES(1,?),(2,9999)').run(initialBalance);
 const balanceFor=id=>db.prepare('SELECT initial_balance+COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=?),0) balance FROM employees WHERE id=?').get(id,id).balance;
 let userId=1;const containmentIds=new Set();
 const options={db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:()=>userId?{id:userId}:null,balanceFor,isContainment:id=>containmentIds.has(id),recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason)};
 const service=installAppearance(options),request=async(body,method='POST')=>{const res={};await service.handle({method,body},res,new URL('http://localhost/api/player/appearance'));return res;};
 return {db,balanceFor,options,service,request,containmentIds,login:id=>userId=id};
}

test('background shop defaults are free; the sphere and three textures charge once and survive restart',async t=>{
 const {db,balanceFor,options,service,request,login}=shopFixture(t);
 assert.deepEqual(service.snapshot(1).backgrounds,{owned:['image'],prices:{image:0,sphere:100000}});
 assert.deepEqual(service.snapshot(1).patterns,{owned:['plain'],prices:{plain:0,halftone:20000,fade:20000,grain:20000,ascii:20000,phase:20000}});
 await request({background:'image'});await request({pattern:'plain'});assert.equal(balanceFor(1),160000);
 const sphere=await request({background:'sphere',price:1,balance:900000});assert.equal(sphere.data.balance,60000);
 assert.ok(sphere.data.appearance.backgrounds.owned.includes('sphere'));
 await Promise.all([request({background:'sphere'}),request({background:'sphere'})]);assert.equal(balanceFor(1),60000);
 for(const pattern of ['halftone','fade','grain']){assert.equal((await request({pattern,price:0})).status,200);await request({pattern});}
 assert.equal(balanceFor(1),0);assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,4);
 assert.deepEqual(db.prepare('SELECT delta FROM balance_ledger ORDER BY id').all().map(r=>r.delta),[-100000,-20000,-20000,-20000]);
 assert.deepEqual(installAppearance(options).snapshot(1),service.snapshot(1));
 // Already owned items can be selected again even with no remaining balance.
 assert.equal((await request({background:'sphere'})).status,200);assert.equal(balanceFor(1),0);
 login(2);assert.deepEqual((await request(null,'GET')).data.appearance.backgrounds.owned,['image']);
 for(const body of [{background:'sphere'},{pattern:'grain'}])assert.equal((await request(body)).status,400);
 assert.equal(balanceFor(2),9999);assert.deepEqual(service.snapshot(2).patterns.owned,['plain']);
 login(null);await request({background:'sphere'});assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,4);
});

test('invalid shop purchases and failed entitlement writes cannot charge the account',async t=>{
 const {db,balanceFor,request,service}=shopFixture(t);
 for(const body of [null,{}, {background:'__proto__'},{pattern:'image'},{background:'grain'},{pattern:'plain',background:'sphere'}])assert.equal((await request(body)).status,400);
 assert.equal(balanceFor(1),160000);
 db.exec("CREATE TRIGGER reject_background BEFORE INSERT ON employee_backgrounds BEGIN SELECT RAISE(ABORT,'fixture write failure'); END;");
 assert.equal((await request({background:'sphere'})).status,400);
 assert.equal(balanceFor(1),160000);assert.deepEqual(service.snapshot(1).backgrounds.owned,['image']);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,0);
});

test('symbol flow and phase textures use the same one-time purchase and account isolation',async t=>{
 const {db,request,balanceFor,service}=shopFixture(t,40000);
 for(const pattern of ['ascii','phase']){assert.equal((await request({pattern})).status,200);assert.equal((await request({pattern})).status,200);}
 assert.equal(balanceFor(1),0);assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,2);
 assert.deepEqual(service.snapshot(1).patterns.owned,['plain','ascii','phase']);assert.deepEqual(service.snapshot(2).patterns.owned,['plain']);
});

test('contamination costs 500000 after explicit confirmation and remains owned once purchased',async t=>{
 const {db,request,balanceFor,service,options,login}=shopFixture(t,500000);
 assert.deepEqual(service.snapshot(1).effects,{owned:[],prices:{contamination:500000}});
 assert.equal((await request({effect:'contamination'})).status,400);assert.equal(balanceFor(1),500000);
 assert.equal((await request({effect:'contamination',confirmed:1})).status,400);
 assert.equal((await request({effect:'contamination',confirmed:true,price:1})).status,200);
 assert.equal(balanceFor(1),0);assert.equal(db.prepare('SELECT delta FROM balance_ledger').get().delta,-500000);
 assert.deepEqual(installAppearance(options).snapshot(1).effects.owned,['contamination']);
 await Promise.all([request({effect:'contamination',confirmed:true}),request({effect:'contamination',confirmed:true})]);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,1);
 login(2);assert.equal((await request({effect:'contamination',confirmed:true})).status,400);assert.equal(balanceFor(2),9999);
 assert.deepEqual(service.snapshot(2).effects.owned,[]);
});

test('a failed effect entitlement write rolls back the debit',async t=>{
 const {db,request,balanceFor,service}=shopFixture(t,500000);
 db.exec("CREATE TRIGGER reject_effect BEFORE INSERT ON employee_interface_effects BEGIN SELECT RAISE(ABORT,'fixture write failure'); END;");
 assert.equal((await request({effect:'contamination',confirmed:true})).status,400);
 assert.equal(balanceFor(1),500000);assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,0);
 assert.deepEqual(service.snapshot(1).effects.owned,[]);
});

test('containment discount follows server identity and retries never debit twice',async t=>{
 const {db,service,request,balanceFor,containmentIds,login}=shopFixture(t,100000);
 containmentIds.add(1);
 assert.equal(service.snapshot(1).effects.prices.contamination,100000);
 assert.equal(service.snapshot(2).effects.prices.contamination,500000);
 const unconfirmed=await request({effect:'contamination'});assert.equal(unconfirmed.status,400);assert.match(unconfirmed.data.error,/100,000/);
 await Promise.all([request({effect:'contamination',confirmed:true,price:1,identityKind:'player_employee'}),request({effect:'contamination',confirmed:true})]);
 assert.equal(balanceFor(1),0);assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,1);
 assert.equal(db.prepare('SELECT delta FROM balance_ledger').get().delta,-100000);
 assert.deepEqual(service.snapshot(1).effects.owned,['contamination']);
 login(2);assert.equal((await request({effect:'contamination',confirmed:true,identityKind:'player_containment',price:200000})).status,400);
 assert.equal(balanceFor(2),9999);assert.deepEqual(service.snapshot(2).effects.owned,[]);
});

test('expanding the old texture constraint preserves existing ownership and ledger links',async t=>{
 const {db,options,request}=shopFixture(t);
 await request({pattern:'grain'});
 db.exec(`ALTER TABLE employee_backgrounds RENAME TO old_backgrounds;
 CREATE TABLE employee_backgrounds(employee_id INTEGER NOT NULL REFERENCES employees(id),kind TEXT NOT NULL,item TEXT NOT NULL,ledger_id INTEGER NOT NULL UNIQUE REFERENCES balance_ledger(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,kind,item),CHECK((kind='background' AND item='sphere') OR (kind='pattern' AND item IN ('halftone','fade','grain'))));
 INSERT INTO employee_backgrounds SELECT * FROM old_backgrounds;DROP TABLE old_backgrounds;`);
 const before=db.prepare('SELECT * FROM employee_backgrounds').all();const updated=installAppearance(options);
 assert.deepEqual(db.prepare('SELECT * FROM employee_backgrounds').all(),before);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 const response={};await updated.handle({method:'POST',body:{pattern:'ascii'}},response,new URL('http://localhost/api/player/appearance'));assert.equal(response.status,200);
});
