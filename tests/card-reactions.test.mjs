import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {chooseReactionReply,chooseTableReaction,createCardReactions} from '../server-card-reactions.mjs';
import {installCardTables} from '../server-card-table.mjs';

function room(){return {id:'table-a',seats:[{id:1},{id:-2,bot:true},{id:-3,bot:true}],game:{phase:'playing',landlord:0,hands:[Array(12),Array(2),Array(8)],last:null}};}

test('named computers keep their promised exact emoji and take priority over generic reactions',()=>{
 let now=10000;const r=room(),social=createCardReactions({clock:()=>now,random:()=>.99}),rooms=new Map([[r.id,r]]);
 r.seats[1].name='你炸我就鼓掌';r.game.event={id:'bomb',seat:0,type:'bomb'};
 assert.deepEqual(chooseTableReaction(r,{game:{phase:'playing'}},1),{emoji:'clap',fixed:true});
 social.observe(r,{game:{phase:'playing',event:{id:'old'}}});now+=1500;social.tick(rooms,()=>{});
 assert.equal(social.view(r).at(-1).seat,1);assert.equal(social.view(r).at(-1).emoji,'clap','no random fire/star variant');
 r.seats[1].name='别给我发表情了';
 for(const emoji of globalThis.AVEDCardReactionRules.quick.map(e=>e.id)){
  now+=9000;social.receive(r,1,emoji,'name-'+emoji);now+=1500;social.tick(rooms,()=>{});
  const reply=social.view(r).find(e=>e.replyTo);
  assert.equal(reply.seat,1);assert.equal(reply.emoji,'eyeroll',emoji);
 }
 social.close();
});
test('all contextual computer reactions stay within the emoji vocabulary, with varied replies and no speech',()=>{
 const ids=new Set(globalThis.AVEDCardReactionRules.items.map(e=>e.id)),replies=new Set();
 for(const value of [0,.5,.99])for(const type of ['bomb','pair']){
  let now=10000;const r=room();r.game.hands[0]=Array(1);r.game.event={id:'one',seat:0,type};
  const social=createCardReactions({clock:()=>now,random:()=>value});social.observe(r,{game:{phase:'playing',event:{id:'old'}}});now+=1500;social.tick(new Map([[r.id,r]]),()=>{});
  const events=social.view(r);assert.equal(events.length,1);
  for(const event of events){assert.ok(ids.has(event.emoji));assert.ok(!('caption' in event));assert.ok(!('text' in event));replies.add(event.emoji);}
  social.close();
 }
 assert.ok(replies.size>=4,'different valid emoji variants are actually selected');
});
test('public move reactions are delayed, bounded, private-hand blind and never replay an old round',()=>{
 let now=10000;const reactions=createCardReactions({clock:()=>now,random:()=>0}),r=room(),rooms=new Map([[r.id,r]]);
 r.money={round:'one'};r.game.event={id:'bomb1',seat:0,type:'bomb'};
 r.game.hands=r.game.hands.map(h=>new Proxy({length:h.length},{get:(o,k)=>{if(k!=='length')throw Error('private card access');return o[k];}}));
 assert.equal(chooseTableReaction(r,{game:{phase:'playing'}},1).emoji,'sweat');
 reactions.observe(r,{game:{phase:'playing',event:{id:'previous'}}});
 assert.deepEqual(reactions.view(r),[]);
 now+=900;reactions.tick(rooms,()=>{});
 let events=reactions.view(r);assert.equal(events.length,1);assert.equal(events[0].context,true);assert.ok(!('caption' in events[0]),'computer reactions never contain speech');
 reactions.observe(r,{game:{phase:'playing',event:r.game.event}});
 r.game.event={id:'bomb2',seat:0,type:'bomb'};reactions.observe(r,{game:{phase:'playing',event:{id:'bomb1'}}});
 now+=1000;reactions.tick(rooms,()=>{});assert.equal(reactions.view(r).length,1,'rapid public moves do not create a reaction storm');
 r.game.phase='ended';r.game.winner='landlord';reactions.observe(r,{game:{phase:'playing',event:{id:'bomb1'}}});
 r.money.round='two';now+=2500;reactions.tick(rooms,()=>{});
 assert.ok(!reactions.view(r).some(e=>e.emoji==='cry'),'new round suppresses delayed victory/defeat replies');
 reactions.close();
});
test('bot reactions understand public context and repeated praise without reading card values',()=>{
 const r=room();
 assert.equal(chooseReactionReply(r,0,1,'like',1),'smirk');
 assert.equal(chooseReactionReply(r,0,1,'like',3),'eyeroll');
 assert.equal(chooseReactionReply(r,0,1,'smirk'),'cool');
 assert.equal(chooseReactionReply(r,2,1,'cry'),'handshake');
 r.game.last={seat:0,type:'bomb'};
 assert.equal(chooseReactionReply(r,0,2,'clap',1),'angry');
 r.game.phase='ended';r.game.winner='landlord';
 assert.equal(chooseReactionReply(r,0,1,'clap'),'sweat');
 // Only lengths are public. Accessing an actual card is forbidden in this fixture.
 r.game.hands=r.game.hands.map(h=>new Proxy({length:h.length},{get:(o,k)=>{if(k!=='length')throw Error('private card access');return o[k];}}));
 assert.doesNotThrow(()=>chooseReactionReply(r,0,1,'like',3));
});

test('reactions deduplicate, throttle, coalesce bot replies, expire and stay bounded',()=>{
 let now=10000;const reactions=createCardReactions({clock:()=>now,random:()=>0}),r=room(),rooms=new Map([[r.id,r]]),broadcasts=[];
 const emit=(emoji='like',id=randomUUID())=>reactions.receive(r,1,emoji,id);
 assert.throws(()=>reactions.receive(r,99,'like','x'),/入座/);
 assert.throws(()=>emit('<script>'),/快捷/);
 assert.equal(emit('like','once'),true);assert.equal(emit('like','once'),false);
 assert.throws(()=>emit(),/慢一点/);assert.equal(reactions.view(r).length,1);
 now+=900;emit();reactions.tick(rooms,r=>broadcasts.push(r.id));
 assert.equal(reactions.view(r).filter(x=>x.replyTo).length,1);
 now+=900;emit();now+=900;emit();now+=900;reactions.tick(rooms,r=>broadcasts.push(r.id));
 assert.equal(reactions.view(r).filter(x=>x.replyTo).at(-1).emoji,'eyeroll');
 assert.equal(broadcasts.length,2,'rapid clicks do not cause a bot reply per click');
 now+=900;emit();now+=900;assert.throws(()=>emit(),/慢一点/);
 now+=9000;reactions.tick(rooms,()=>{});now+=5000;
 assert.deepEqual(reactions.view(r),[],'reconnect does not replay expired emoji');
 now+=20000;reactions.tick(new Map(),()=>{});assert.deepEqual(reactions.view(r),[]);
});

test('reaction SSE is room-scoped, does not write money or advance turns, and spectators cannot send',async t=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE employees(id INTEGER PRIMARY KEY,balance INTEGER);INSERT INTO employees VALUES(1,50000),(2,50000),(3,50000);
 CREATE TABLE profiles(employee_id INTEGER,anonymous_name TEXT,avatar_url TEXT);
 CREATE TABLE ledger(employee_id INTEGER,delta INTEGER);CREATE TABLE game_tickets(id INTEGER PRIMARY KEY,employee_id INTEGER,game TEXT,cost INTEGER,prize INTEGER,seed TEXT,seed_hash TEXT,result_json TEXT);`);
 let now=10000,tick;const deps={db,clock:()=>now,schedule:(fn,ms)=>{if(ms===350)tick=fn;return {unref(){}};},cancel(){},
 readBody:async req=>req.body,requireEmployee:req=>({id:req.id}),sessionEmployee:()=>true,send:(res,status,data)=>Object.assign(res,{status,data}),
 balanceFor:id=>db.prepare('SELECT balance FROM employees WHERE id=?').get(id).balance,
 recordLedger:(id,delta)=>{db.prepare('INSERT INTO ledger VALUES(?,?)').run(id,delta);db.prepare('UPDATE employees SET balance=balance+? WHERE id=?').run(delta,id);}};
 const service=installCardTables(deps),streams=[];t.after(()=>{for(const s of streams)s.emit('close');service.close();db.close();});
 async function call(id,body,path='/api/player/card-table'){const res={};await service.handle({id,body,method:body?'POST':'GET'},res,new URL('http://test'+path));return res;}
 function stream(){const res=new EventEmitter();Object.assign(res,{chunks:[],writableLength:0,writeHead(){},write(x){this.chunks.push(x);},end(){},destroy(){this.destroyed=true;}});streams.push(res);return res;}
 let response=await call(1,{action:'create',size:3}),r=response.data.room;
 assert.equal((await call(2,{action:'watch',roomId:r.id})).status,200);
 assert.equal((await call(3,{action:'create',size:3})).status,200);
 const owner=stream(),watcher=stream(),other=stream();
 for(const [id,res] of [[1,owner],[2,watcher],[3,other]])await service.handle({id,method:'GET'},res,new URL('http://test/api/player/card-table/stream'));
 const saved=db.prepare('SELECT state_json FROM card_table_rooms WHERE id=?').get(r.id).state_json;
 const revision=r.revision,deadline=r.deadline,requestId=randomUUID();
 response=await call(1,{action:'reaction',room:r.id,emoji:'like',requestId,revision:-999,balance:999999});assert.equal(response.status,200);
 assert.equal(response.data.reactions.length,1);assert.equal(response.data.room,undefined,'small social payload contains no private hand or wallet');
 assert.match(owner.chunks.at(-1),/^event: reaction/);assert.match(watcher.chunks.at(-1),/^event: reaction/);assert.equal(other.chunks.length,1);
 assert.ok(!owner.chunks.at(-1).includes('hands'));
 assert.equal((await call(2,{action:'reaction',room:r.id,emoji:'angry',requestId:randomUUID()})).status,400);
 assert.equal((await call(3,{action:'reaction',room:r.id,emoji:'angry',requestId:randomUUID()})).status,400);
 const count=owner.chunks.length;await call(1,{action:'reaction',room:r.id,emoji:'like',requestId});assert.equal(owner.chunks.length,count);
 r=(await call(1)).data.room;assert.equal(r.revision,revision);assert.equal(r.deadline,deadline);
 assert.equal(db.prepare('SELECT state_json FROM card_table_rooms WHERE id=?').get(r.id).state_json,saved);
 assert.equal(db.prepare('SELECT count(*) n FROM ledger').get().n,0);assert.equal(deps.balanceFor(1),50000);
 now+=9000;tick();assert.deepEqual((await call(1)).data.room.reactions,[]);
});
