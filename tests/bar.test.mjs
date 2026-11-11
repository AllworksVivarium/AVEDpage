import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {EventEmitter} from 'node:events';
import {installBar,barDay} from '../server-bar.mjs';
import {barDrinks} from '../server-bar-catalog.mjs';

class Response extends EventEmitter{
 constructor(){super();this.output='';this.writableLength=0;this.destroyed=false;}
 writeHead(status,headers){this.status=status;this.headers=headers;}
 write(text){this.output+=text;}
 end(){if(!this.destroyed){this.destroyed=true;this.emit('close');}}
 destroy(){this.end();}
 state(){const events=this.output.split('event: bar\ndata: ').slice(1);return JSON.parse(events.at(-1).split('\n')[0]);}
}
function setup(t){
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER,display_name TEXT);CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT);CREATE TABLE balance_ledger(employee_id INTEGER,delta INTEGER,reason TEXT);INSERT INTO employees VALUES(1,10000,'甲实名'),(2,10000,'乙实名'),(3,1,'丙实名');INSERT INTO profiles VALUES(1,'甲'),(2,'乙'),(3,'丙');`);
 let now=Date.parse('2026-11-11T15:59:50Z');const balanceFor=id=>db.prepare('SELECT balance+COALESCE((SELECT SUM(delta) FROM balance_ledger WHERE employee_id=?),0) AS balance FROM employees WHERE id=?').get(id,id).balance;
 const options={db,send:(res,status,data)=>Object.assign(res,{status,data}),readBody:async req=>req.body,requireEmployee:(req,res)=>{if(!req.actor){Object.assign(res,{status:401});return null;}return {id:req.actor};},sessionEmployee:req=>req.actor?{id:req.actor}:null,balanceFor,recordLedger:(id,delta,reason)=>db.prepare('INSERT INTO balance_ledger VALUES(?,?,?)').run(id,delta,reason),clock:()=>now};
 let service=installBar(options);
 const request=async(actor,path='/api/player/bar',method='GET',body)=>{const res=new Response();await service.handle({actor,method,body},res,new URL('http://localhost'+path));return res;};
 t.after(()=>{service.close();db.close();});return {db,request,balanceFor,setTime:value=>now=value,restart(){service.close();service=installBar(options);},get service(){return service;}};
}
test('bar purchases use server prices, survive reentry, and never debit a retried request twice',async t=>{
 const f=setup(t),drink=barDrinks[0],key='first-order-request-001';
 assert.equal((await f.request(null)).status,401);
 const order=await f.request(1,'/api/player/bar/orders','POST',{drinkId:drink.id,requestId:key,price:0,balance:999999});assert.equal(order.status,200);assert.equal(f.balanceFor(1),10000-drink.price);
 for(let i=0;i<2;i++)assert.equal((await f.request(1,'/api/player/bar/orders','POST',{drinkId:drink.id,requestId:key})).data.receipt.id,order.data.receipt.id);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM balance_ledger').get().n,1);
 assert.equal((await f.request(1,'/api/player/bar/orders','POST',{drinkId:barDrinks[1].id,requestId:key})).status,400);
 assert.equal((await f.request(3,'/api/player/bar/orders','POST',{drinkId:drink.id,requestId:'insufficient-order-01'})).status,400);
 f.restart();assert.equal((await f.request(1)).data.myDrink.drinkId,drink.id);assert.equal((await f.request(2)).data.myDrink,null);
 assert.equal((await f.request(1,'/api/player/bar/orders','POST',{drinkId:'__proto__',requestId:'invalid-drink-0001'})).status,400);
 f.db.exec("CREATE TRIGGER bar_fail BEFORE INSERT ON bar_orders BEGIN SELECT RAISE(ABORT,'fixture failure');END");
 assert.equal((await f.request(1,'/api/player/bar/orders','POST',{drinkId:drink.id,requestId:'rollback-order-0001'})).status,400);assert.equal(f.balanceFor(1),10000-drink.price);
 f.setTime(Date.parse('2026-11-11T16:00:01Z'));assert.equal(barDay(Date.parse('2026-11-11T16:00:01Z')),'2026-11-12');assert.equal((await f.request(1)).data.myDrink,null);
 assert.equal((await f.request(1,'/api/player/bar/orders','POST',{drinkId:drink.id,requestId:key})).data.myDrink,null);assert.equal(f.balanceFor(1),10000-drink.price);
});
test('bar presence counts distinct connected accounts and broadcasts each real guest order',async t=>{
 const f=setup(t),first=await f.request(1,'/api/player/bar/events'),duplicate=await f.request(1,'/api/player/bar/events'),other=await f.request(2,'/api/player/bar/events');
 assert.equal(first.state().onlineCount,2);assert.equal(duplicate.state().onlineCount,2);
 await f.request(2,'/api/player/bar/orders','POST',{drinkId:barDrinks[1].id,requestId:'other-order-00001'});
 assert.equal(first.state().guests.find(x=>x.employeeId===2).drink.drinkId,barDrinks[1].id);assert.equal(first.state().myDrink,null);assert.equal(other.state().myDrink.drinkId,barDrinks[1].id);
 first.end();assert.equal(other.state().onlineCount,2);duplicate.end();assert.equal(other.state().onlineCount,1);
});
test('bar messages are shared, bounded to five days, paginated, and rate limited per account',async t=>{
 const f=setup(t),one=await f.request(1,'/api/player/bar/events'),two=await f.request(2,'/api/player/bar/events');
 const message=await f.request(1,'/api/player/bar/messages','POST',{body:'<script>只作为文字</script>'});assert.equal(message.status,201);assert.equal(two.state().items.at(-1).body,'<script>只作为文字</script>');
 assert.equal((await f.request(1,'/api/player/bar/messages','POST',{body:'太快'})).status,429);
 assert.equal((await f.request(2,'/api/player/bar/messages','POST',{body:' '})).status,400);
 const add=f.db.prepare('INSERT INTO bar_messages(employee_id,alias,body,created_at) VALUES(1,?,?,?)');
 add.run('甲','expired','2026-11-01T00:00:00.000Z');for(let i=0;i<85;i++)add.run('甲','消息'+i,'2026-11-11T14:00:00.000Z');
 let page=(await f.request(1,'/api/player/bar/messages')).data;assert.equal(page.items.length,40);assert.ok(page.nextBefore);const ids=new Set(page.items.map(x=>x.id));
 const older=(await f.request(1,'/api/player/bar/messages?before='+page.nextBefore)).data;assert.equal(older.items.length,40);assert.ok(older.items.every(x=>!ids.has(x.id)));assert.ok(!older.items.some(x=>x.body==='expired'));
 f.service.prune();assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM bar_messages WHERE body='expired'").get().n,0);assert.equal(one.state().onlineCount,2);
});

test('bar chat chooses server-owned real or anonymous names per message and preserves history',async t=>{
 const f=setup(t),peer=await f.request(2,'/api/player/bar/events');
 assert.equal((await f.request(1,'/api/player/bar/messages','POST',{body:'匿名消息',alias:'冒充别人',displayName:'伪造实名'})).status,201);
 let items=peer.state().items;assert.equal(items.at(-1).alias,'甲');assert.equal(items.at(-1).identityMode,'anonymous');
 f.setTime(Date.parse('2026-11-11T15:59:52Z'));
 assert.equal((await f.request(1,'/api/player/bar/messages','POST',{body:'实名消息',identityMode:'real',alias:'伪造姓名'})).status,201);
 items=peer.state().items;assert.equal(items.at(-1).alias,'甲实名');assert.equal(items.at(-1).identityMode,'real');assert.equal(items[0].alias,'甲');
 f.setTime(Date.parse('2026-11-11T15:59:54Z'));
 assert.equal((await f.request(1,'/api/player/bar/messages','POST',{body:'切回匿名',identityMode:'anonymous'})).status,201);
 assert.equal(peer.state().items.at(-1).alias,'甲');
 for(const identityMode of ['invalid','admin','',null])assert.equal((await f.request(1,'/api/player/bar/messages','POST',{body:'无效身份',identityMode})).status,400);
 f.db.exec("UPDATE employees SET display_name='改名后' WHERE id=1;UPDATE profiles SET anonymous_name='新代号' WHERE employee_id=1");f.restart();
 items=(await f.request(2,'/api/player/bar/messages')).data.items;assert.deepEqual(items.map(x=>x.alias),['甲','甲实名','甲']);assert.deepEqual(items.map(x=>x.identityMode),['anonymous','real','anonymous']);
});
