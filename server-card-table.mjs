import {randomInt,randomBytes} from 'node:crypto';
import './public/ddz-rules.js';
import {mediaReference} from './server-media.mjs';
const R=globalThis.AVEDDdzRules;
export function dealTable(size=3,random=()=>randomInt(0x1000000)/0x1000000){
 if(![3,4].includes(size))throw Error('请选择三人或四人桌。');
 const deck=[];let id=0;
 for(let d=0;d<(size===4?2:1);d++){
  for(let val=3;val<=15;val++)for(const suit of ['♠','♥','♣','♦'])deck.push({id:++id,val,suit,label:val<=10?String(val):({11:'J',12:'Q',13:'K',14:'A',15:'2'})[val],red:suit==='♥'||suit==='♦'});
  for(const val of [16,17])deck.push({id:++id,val,suit:val===16?'♠':'♥',label:val===16?'小王':'大王',red:val===17});
 }
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const count=size===4?25:17;
 return {hands:Array.from({length:size},(_,i)=>deck.slice(i*count,(i+1)*count)),bottom:deck.slice(size*count),size,phase:'bidding',turn:0,landlord:-1,bid:0,bidder:-1,bids:0,bidStart:0,last:null,passes:0,multiplier:1,winner:null,plays:Array(size).fill(0),seatPlays:Array(size).fill(null),event:{text:'请叫分',seat:0},revision:0};
}
export function tableAction(s,seat,action,body={}){
 if(!['bidding','playing'].includes(s.phase)||seat!==s.turn)throw Error('还没有轮到你。');
 if(s.phase==='bidding'){
  const value=Number(body.bid);if(action!=='bid'||!Number.isInteger(value)||value<0||value>3||(value&&value<=s.bid))throw Error('请叫更高的分数，或选择不叫。');
  s.bids++;if(value){s.bid=value;s.bidder=seat;}s.event={seat,text:value?value+' 分':'不叫'};
  if(value===3||s.bids===s.size){
   // All pass: discard this deal and rotate the starting bidder.
   if(s.bidder<0){const next=dealTable(s.size);next.turn=((s.bidStart||0)+1)%s.size;next.bidStart=next.turn;Object.assign(s,next);s.event={seat:-1,text:'无人叫分，重新发牌'};return;}
   s.landlord=s.bidder;s.hands[s.landlord].push(...s.bottom);s.turn=s.landlord;s.phase='playing';s.event={seat:s.landlord,text:'地主先出'};
  }else s.turn=(seat+1)%s.size;
  return;
 }
 if(action==='pass'){
  if(!s.last||s.last.seat===seat)throw Error('本轮由你领出，请选择手牌。');
  s.passes++;s.seatPlays[seat]={text:'不出'};s.event={seat,text:'不出'};
  s.turn=(seat+1)%s.size;if(s.passes===s.size-1){s.turn=s.last.seat;s.last=null;s.passes=0;s.seatPlays=Array(s.size).fill(null);}return;
 }
 if(action!=='play')throw Error('出牌指令无效。');
 const ids=body.cards;if(!Array.isArray(ids)||!ids.length||ids.length>33||new Set(ids).size!==ids.length)throw Error('请选择有效的手牌。');
 const cards=ids.map(id=>s.hands[seat].find(c=>c.id===id));if(cards.some(c=>!c))throw Error('手牌已经变化，请重新选择。');
 const p=R.classify(cards,s.size);if(!p)throw Error('这些牌不能组成有效牌型。');if(!R.beats(p,s.last))throw Error('需要同牌型、同张数并且点数更大，或使用炸弹。');
 s.hands[seat]=s.hands[seat].filter(c=>!ids.includes(c.id));s.last={...p,cards,seat};s.passes=0;s.plays[seat]++;
 s.seatPlays[seat]={text:p.label+' · '+cards.length+' 张',cards};s.event={seat,text:p.label+' · '+cards.length+' 张',type:p.type};
 if(p.type==='bomb'||p.type==='rocket')s.multiplier=Math.min(64,s.multiplier*2);
 if(!s.hands[seat].length){s.phase='ended';s.winner=seat===s.landlord?'landlord':'farmers';s.spring=s.winner==='landlord'?s.plays.every((v,i)=>i===s.landlord||v===0):s.plays[s.landlord]===1;if(s.spring)s.multiplier=Math.min(64,s.multiplier*2);return;}
 s.turn=(seat+1)%s.size;
}
export function botTurn(s){
 const seat=s.turn,hand=s.hands[seat];
 if(s.phase==='bidding'){const power=hand.filter(c=>c.val>=15).length+[...new Set(hand.map(c=>c.val))].filter(v=>hand.filter(c=>c.val===v).length>=4).length*2;return {action:'bid',bid:power>=5?3:power>=3&&s.bid<2?2:power>=1&&s.bid<1?1:0};}
 const teammate=s.last&&seat!==s.landlord&&s.last.seat!==s.landlord;
 const danger=s.hands.some((h,i)=>i!==seat&&(i===s.landlord||seat===s.landlord)&&h.length<=2);
 const move=R.choose(hand,s.last,s.size,{teammate,danger});return move?{action:'play',cards:move.cards.map(c=>c.id)}:{action:'pass'};
}
export function tableView(room,employeeId){
 const seat=room.seats.findIndex(p=>p?.id===employeeId),g=room.game;if(seat<0)throw Error('你不在这张牌桌。');
 return {id:room.id,mode:room.mode,size:room.size,host:room.host,revision:room.revision,seat,phase:g?.phase||'waiting',deadline:room.deadline,
  seats:room.seats.map((p,i)=>p?{id:p.id,name:p.name,avatar:p.avatar,bot:p.bot,auto:p.auto,ready:p.ready,count:g?.hands[i].length||0,role:g?.landlord===i?'landlord':g?.landlord>=0?'farmer':null,last:g?.seatPlays[i]||null}:null),
  hand:g?[...g.hands[seat]].sort((a,b)=>b.val-a.val||a.id-b.id):[],bottom:g?.phase==='bidding'?Array(g.bottom.length).fill(null):g?.bottom||[],turn:g?.turn??-1,landlord:g?.landlord??-1,bid:g?.bid||0,multiplier:g?.multiplier||1,last:g?.last||null,event:g?.event||null,winner:g?.winner||null,spring:!!g?.spring};
}
export function installCardTables({db,send,readBody,requireEmployee,sessionEmployee}){
 db.exec('CREATE TABLE IF NOT EXISTS card_table_rooms(id TEXT PRIMARY KEY,state_json TEXT NOT NULL,updated_at INTEGER NOT NULL)');
 const rooms=new Map(),streams=new Set();
 const save=room=>{room.updatedAt=Date.now();db.prepare('INSERT INTO card_table_rooms VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at').run(room.id,JSON.stringify(room),room.updatedAt);};
 for(const row of db.prepare('SELECT state_json FROM card_table_rooms WHERE updated_at>?').all(Date.now()-86400000)){try{const r=JSON.parse(row.state_json);rooms.set(r.id,r);r.deadline=Date.now()+30000;}catch{}}
 const roomFor=id=>[...rooms.values()].find(r=>r.seats.some(p=>p?.id===id));
 const write=(s,r)=>{try{s.res.write('data: '+JSON.stringify({room:r?tableView(r,s.id):null})+'\n\n');}catch{streams.delete(s);}};
 function changed(r){r.revision++;r.deadline=Date.now()+(r.seats[r.game?.turn]?.bot||r.seats[r.game?.turn]?.auto?1100:30000);save(r);for(const s of streams)if(r.seats.some(p=>p?.id===s.id))write(s,r);}
 const person=e=>{const p=db.prepare('SELECT anonymous_name,avatar_url FROM profiles WHERE employee_id=?').get(e.id)||{};return {id:e.id,name:p.anonymous_name||e.display_name||e.username,avatar:String(p.avatar_url||'').startsWith('data:')?mediaReference('avatar',e.id,p.avatar_url,64):'',ready:true,bot:false,auto:false};};
 const bots=r=>{const names=['方片 07','梅花 12','红桃 03'];r.seats=r.seats.map((p,i)=>p||{id:-i-1,name:names[(i-1+3)%3],avatar:'',bot:true,ready:true,auto:false});};
 function leave(r,id){const i=r.seats.findIndex(p=>p?.id===id);if(i<0)return;const playing=['bidding','playing'].includes(r.game?.phase);r.seats[i]=playing?{id:-i-1,name:'托管 '+(i+1),bot:true,auto:true,ready:true,avatar:''}:null;
  const humans=r.seats.filter(p=>p&&!p.bot);if(!humans.length){rooms.delete(r.id);db.prepare('DELETE FROM card_table_rooms WHERE id=?').run(r.id);}else {if(r.host===id)r.host=humans[0].id;changed(r);}for(const s of streams)if(s.id===id)write(s,null);
 }
 const timer=setInterval(()=>{
  for(const r of rooms.values()){
   if(!r.game||!['bidding','playing'].includes(r.game.phase)||Date.now()<r.deadline)continue;
   try{const p=r.seats[r.game.turn];if(!p.bot)p.auto=true;const move=botTurn(r.game);tableAction(r.game,r.game.turn,move.action,move);changed(r);}catch(e){console.error('Card table:',e.message);r.deadline=Date.now()+30000;}
  }
 },350);timer.unref();
 const cleanup=setInterval(()=>{for(const r of rooms.values())if(Date.now()-r.updatedAt>86400000){rooms.delete(r.id);db.prepare('DELETE FROM card_table_rooms WHERE id=?').run(r.id);}},3600000);cleanup.unref();
 return {async handle(req,res,url){
  if(!url.pathname.startsWith('/api/player/card-table'))return false;
  const actor=requireEmployee(req,res);if(!actor)return true;
  if(url.pathname==='/api/player/card-table/stream'&&req.method==='GET'){
   // One active stream per employee avoids duplicate subscriptions after reload.
   for(const s of streams)if(s.id===actor.id){s.res.end();streams.delete(s);}
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
   const s={id:actor.id,res};streams.add(s);write(s,roomFor(actor.id));const ping=setInterval(()=>{if(!sessionEmployee(req)){res.end();return;}res.write(': heartbeat\n\n');},15000);ping.unref();res.on('close',()=>{clearInterval(ping);streams.delete(s);});return true;
  }
  if(url.pathname!=='/api/player/card-table'){send(res,404,{error:'牌桌接口不存在。'});return true;}
  if(req.method==='GET'){const r=roomFor(actor.id);send(res,200,{room:r?tableView(r,actor.id):null});return true;}
  if(req.method!=='POST'){send(res,405,{error:'指令无效。'});return true;}
  try{
   const d=await readBody(req,8192);let r=roomFor(actor.id);
   if(['solo','create','join'].includes(d.action)){
    if(r)throw Error('请先离开当前牌桌。');
    if(d.action==='join'){r=rooms.get(String(d.code||'').trim().toUpperCase());if(!r||r.mode!=='online')throw Error('找不到这张牌桌。');if(r.game&&r.game.phase!=='ended')throw Error('这张牌桌已经开局。');const i=r.seats.indexOf(null);if(i<0)throw Error('牌桌已经坐满。');r.seats[i]={...person(actor),ready:false};if(r.game)r.game=null;}
    else {const size=Number(d.size);if(![3,4].includes(size))throw Error('请选择三人或四人桌。');let id;do{id=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(id));r={id,size,mode:d.action==='solo'?'solo':'online',host:actor.id,seats:Array(size).fill(null),revision:0,receipts:[],game:null};r.seats[0]=person(actor);if(r.mode==='solo'){bots(r);r.game=dealTable(size);}rooms.set(id,r);}
   }else {
    if(!r||r.id!==d.room)throw Error('牌桌已变化，请重新入座。');
    if(typeof d.requestId!=='string'||d.requestId.length>80)throw Error('请重试本次操作。');
    if(r.receipts.includes(d.requestId)){send(res,200,{room:tableView(r,actor.id)});return true;}
    if(d.revision!==r.revision){send(res,409,{error:'牌局已更新，请再试一次。',room:tableView(r,actor.id)});return true;}
    const i=r.seats.findIndex(p=>p?.id===actor.id);
    if(d.action==='leave'){leave(r,actor.id);send(res,200,{room:null});return true;}
    if(d.action==='auto'){r.seats[i].auto=!r.seats[i].auto;}
    else if(d.action==='ready'){if(r.game&&r.game.phase!=='ended')throw Error('本局已经开始。');r.seats[i].ready=!r.seats[i].ready;}
    else if(d.action==='start'){
     if(r.host!==actor.id)throw Error('请等待房主开局。');if(r.game&&r.game.phase!=='ended')throw Error('本局尚未结束。');
     if(d.fillBots)bots(r);if(r.seats.some(p=>!p||!p.ready))throw Error('请等待所有员工准备，或补齐电脑座位。');
     r.game=dealTable(r.size);r.seats.forEach(p=>p.auto=false);
    }else tableAction(r.game,i,d.action,d);
    r.receipts.push(d.requestId);if(r.receipts.length>40)r.receipts.shift();
   }
   changed(r);send(res,200,{room:tableView(r,actor.id)});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
