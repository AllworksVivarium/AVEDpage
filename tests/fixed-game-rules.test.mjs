import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {installEconomy,defaultEconomy} from '../server-economy.mjs';
test('removed admin routes cannot change fixed rules; restart and legacy storage retain agreed values',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE economy_config(id INTEGER PRIMARY KEY,revision INTEGER,config_json TEXT);CREATE TABLE economy_migrations(code TEXT PRIMARY KEY);CREATE TABLE stock_prices(code TEXT,price INTEGER);');
 const old=defaultEconomy();old.scratch[0].returnPercent=12;old.sky.speed=90;
 db.prepare('INSERT INTO economy_config VALUES(1,99,?)').run(JSON.stringify(old));
 const dependencies={db,send:(r,status,data)=>Object.assign(r,{status,data}),requireEmployee:()=>({id:1}),recordLedger:()=>{throw Error('unexpected ledger write');}};
 let service=installEconomy(dependencies);
 assert.equal(service.get().scratch[0].returnPercent,120);assert.equal(service.get().sky.speed,25);
 const stored=db.prepare('SELECT * FROM economy_config').get();assert.deepEqual(JSON.parse(stored.config_json),defaultEconomy());
 for(const [path,method] of [['/api/admin/economy','GET'],['/api/admin/economy','PUT'],['/api/admin/economy/generate','POST']]){const response={};assert.equal(await service.handle({method},response,new URL(path,'http://test')),true);assert.equal(response.status,404);}
 const callerCopy=service.get();callerCopy.scratch[0].returnPercent=1;assert.equal(service.get().scratch[0].returnPercent,120);
 service=installEconomy(dependencies);assert.equal(service.get().revision,stored.revision);
 const res={};await service.handle({method:'GET'},res,new URL('/api/player/economy','http://test'));assert.equal(res.status,200);assert.equal(res.data.tiers.length,6);
 db.close();
});
test('admin navigation exposes robot settings and removes economy editor',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/admin-terminal.html',import.meta.url),'utf8');
 assert.match(app,/"terminology","robots"/);assert.match(html,/data-tab="robots">公司机器人设置/);assert.ok(!html.includes('admin-economy.js'));assert.ok(!html.includes('data-tab="economy"'));assert.ok(!app.includes('renderEconomy()'));
});
