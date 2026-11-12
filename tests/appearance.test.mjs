import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installAppearance} from '../server-appearance.mjs';

test('palette unlocks use server prices, debit once and remain account-specific',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,initial_balance INTEGER);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER,reason TEXT);
 INSERT INTO employees VALUES(1,50000),(2,19999);`);
 const balanceFor=id=>db.prepare('SELECT initial_balance+COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=?),0) AS balance FROM employees WHERE id=?').get(id,id).balance;
 let signedIn=true;
 const service=installAppearance({db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:()=>signedIn?{id:1}:null,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason)});
 const request=async(method,body)=>{const res={};await service.handle({method,body},res,new URL('http://localhost/api/player/appearance'));return res;};
 assert.deepEqual(service.snapshot(1).owned,['oxblood']);
 const purchased=await request('POST',{palette:'mineral',price:0,balance:999999});
 assert.equal(purchased.status,200);assert.equal(purchased.data.balance,30000);assert.ok(purchased.data.appearance.owned.includes('mineral'));
 await Promise.all([request('POST',{palette:'mineral'}),request('POST',{palette:'mineral'})]);
 assert.equal(balanceFor(1),30000);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM balance_ledger').get().n,1);
 assert.deepEqual(service.snapshot(2).owned,['oxblood']);
 assert.equal((await request('POST',{palette:'oxblood'})).data.balance,30000);
 assert.equal((await request('POST',{palette:'darkroom'})).data.balance,10000);
 assert.equal((await request('POST',{palette:'not-a-palette'})).status,400);
 assert.equal((await request('POST',{palette:'__proto__'})).status,400);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM employee_palettes').get().n,2);
 const second=installAppearance({db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:()=>({id:2}),balanceFor,recordLedger:()=>assert.fail('insufficient balance must not debit')});
 const denied={};await second.handle({method:'POST',body:{palette:'mineral'}},denied,new URL('http://localhost/api/player/appearance'));
 assert.equal(denied.status,400);assert.equal(balanceFor(2),19999);assert.deepEqual(second.snapshot(1).owned.sort(),['darkroom','mineral','oxblood']);
 signedIn=false;const unauth=await request('POST',{palette:'mineral'});assert.equal(unauth.status,undefined);assert.equal(balanceFor(1),10000);
});

function shopFixture(t,initialBalance=80000){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,initial_balance INTEGER);
 CREATE TABLE balance_ledger(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES employees(id),delta INTEGER,reason TEXT);`);
 db.prepare('INSERT INTO employees VALUES(1,?),(2,9999)').run(initialBalance);
 const balanceFor=id=>db.prepare('SELECT initial_balance+COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=?),0) balance FROM employees WHERE id=?').get(id,id).balance;
 let userId=1;
 const options={db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:()=>userId?{id:userId}:null,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger(employee_id,delta,reason) VALUES(?,?,?)').run(id,delta,reason)};
 const service=installAppearance(options),request=async(body,method='POST')=>{const res={};await service.handle({method,body},res,new URL('http://localhost/api/player/appearance'));return res;};
 return {db,balanceFor,options,service,request,login:id=>userId=id};
}

test('background shop defaults are free; the sphere and three textures charge once and survive restart',async t=>{
 const {db,balanceFor,options,service,request,login}=shopFixture(t);
 assert.deepEqual(service.snapshot(1).backgrounds,{owned:['image'],prices:{image:0,sphere:50000}});
 assert.deepEqual(service.snapshot(1).patterns,{owned:['plain'],prices:{plain:0,halftone:10000,fade:10000,grain:10000}});
 await request({background:'image'});await request({pattern:'plain'});assert.equal(balanceFor(1),80000);
 const sphere=await request({background:'sphere',price:1,balance:900000});assert.equal(sphere.data.balance,30000);
 assert.ok(sphere.data.appearance.backgrounds.owned.includes('sphere'));
 await Promise.all([request({background:'sphere'}),request({background:'sphere'})]);assert.equal(balanceFor(1),30000);
 for(const pattern of ['halftone','fade','grain']){assert.equal((await request({pattern,price:0})).status,200);await request({pattern});}
 assert.equal(balanceFor(1),0);assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,4);
 assert.deepEqual(db.prepare('SELECT delta FROM balance_ledger ORDER BY id').all().map(r=>r.delta),[-50000,-10000,-10000,-10000]);
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
 assert.equal(balanceFor(1),80000);
 db.exec("CREATE TRIGGER reject_background BEFORE INSERT ON employee_backgrounds BEGIN SELECT RAISE(ABORT,'fixture write failure'); END;");
 assert.equal((await request({background:'sphere'})).status,400);
 assert.equal(balanceFor(1),80000);assert.deepEqual(service.snapshot(1).backgrounds.owned,['image']);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM balance_ledger').get().n,0);
});
