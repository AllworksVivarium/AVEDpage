import {randomInt,randomUUID} from 'node:crypto';
import './public/ddz-rules.js';
import {robotAvatar,storedAvatar,defaultAvatar,installAvatarPresets} from './server-default-avatar.mjs';
import {installCardWallet,cardMoneyRules,cardStakes} from './server-card-wallet.mjs';
import {chooseAuto,autoLevels} from './server-card-ai.mjs';
import {createCardReactions} from './server-card-reactions.mjs';
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
 return {hands:Array.from({length:size},(_,i)=>deck.slice(i*count,(i+1)*count)),bottom:deck.slice(size*count),size,phase:'bidding',turn:0,landlord:-1,bid:0,bidder:-1,bids:0,bidStart:0,last:null,passes:0,multiplier:1,winner:null,plays:Array(size).fill(0),seatPlays:Array(size).fill(null),event:{id:randomUUID(),text:'请叫分',seat:0},revision:0};
}
export function tableAction(s,seat,action,body={}){
 if(!['bidding','playing'].includes(s.phase)||seat!==s.turn)throw Error('还没有轮到你。');
 if(s.phase==='bidding'){
  const value=Number(body.bid);if(action!=='bid'||!Number.isInteger(value)||value<0||value>3||(value&&value<=s.bid))throw Error('请叫更高的分数，或选择不叫。');
  s.bids++;if(value){s.bid=value;s.bidder=seat;}s.event={id:randomUUID(),seat,text:value?value+' 分':'不叫'};
  if(value===3||s.bids===s.size){
   // All pass: discard this deal and rotate the starting bidder.
   if(s.bidder<0){const next=dealTable(s.size);next.turn=((s.bidStart||0)+1)%s.size;next.bidStart=next.turn;Object.assign(s,next);s.event={id:randomUUID(),seat:-1,text:'无人叫分，重新发牌'};return;}
   s.landlord=s.bidder;s.hands[s.landlord].push(...s.bottom);s.turn=s.landlord;s.phase='playing';s.event={id:randomUUID(),seat:s.landlord,text:'太姥先出'};
  }else s.turn=(seat+1)%s.size;
  return;
 }
 if(action==='pass'){
  if(!s.last||s.last.seat===seat)throw Error('本轮由你领出，请选择手牌。');
  s.passes++;s.seatPlays[seat]={text:'不出'};s.event={id:randomUUID(),seat,text:'不出'};
  s.turn=(seat+1)%s.size;if(s.passes===s.size-1){s.turn=s.last.seat;s.last=null;s.passes=0;s.seatPlays=Array(s.size).fill(null);}return;
 }
 if(action!=='play')throw Error('出牌指令无效。');
 const ids=body.cards;if(!Array.isArray(ids)||!ids.length||ids.length>33||new Set(ids).size!==ids.length)throw Error('请选择有效的手牌。');
 const cards=ids.map(id=>s.hands[seat].find(c=>c.id===id));if(cards.some(c=>!c))throw Error('手牌已经变化，请重新选择。');
 const p=R.classify(cards,s.size);if(!p)throw Error('这些牌不能组成有效牌型。');if(!R.beats(p,s.last))throw Error('需要同牌型、同张数并且点数更大，或使用炸弹。');
 s.hands[seat]=s.hands[seat].filter(c=>!ids.includes(c.id));s.last={...p,cards,seat};s.passes=0;s.plays[seat]++;
 s.seatPlays[seat]={text:p.label+' · '+cards.length+' 张',cards};s.event={id:randomUUID(),seat,text:p.label+' · '+cards.length+' 张',type:p.type};
 if(p.type==='bomb'||p.type==='rocket')s.multiplier=Math.min(64,s.multiplier*2);
 if(!s.hands[seat].length){s.phase='ended';s.winner=seat===s.landlord?'landlord':'farmers';s.spring=s.winner==='landlord'?s.plays.every((v,i)=>i===s.landlord||v===0):s.plays[s.landlord]===1;if(s.spring)s.multiplier=Math.min(64,s.multiplier*2);return;}
 s.turn=(seat+1)%s.size;
}
export function autoplayLevel(room,seat){
 return room.seats[seat]?.bot||room.seats.every((p,i)=>i===seat||!p||p.bot)?(room.botLevel||'standard'):'smart';
}
export function botTurn(s,level='standard'){
 const seat=s.turn,hand=s.hands[seat];
 if(s.phase==='bidding'){const power=hand.filter(c=>c.val>=15).length+[...new Set(hand.map(c=>c.val))].filter(v=>hand.filter(c=>c.val===v).length>=4).length*2;const wanted=power>=5?3:power>=3?2:power>=1?1:0;return {action:'bid',bid:wanted>s.bid?wanted:0};}
 const teammate=s.last&&seat!==s.landlord&&s.last.seat!==s.landlord;
 const danger=s.hands.some((h,i)=>i!==seat&&(i===s.landlord||seat===s.landlord)&&h.length<=2);
 const move=chooseAuto(hand,s.last,s.size,{teammate,danger,level,enemyCount:Math.min(...s.hands.map((h,i)=>i!==seat&&(i===s.landlord||seat===s.landlord)?h.length:Infinity)),allyCount:Math.min(...s.hands.map((h,i)=>i!==seat&&i!==s.landlord&&seat!==s.landlord?h.length:Infinity))});return move?{action:'play',cards:move.cards.map(c=>c.id)}:{action:'pass'};
}
export function tableView(room,employeeId,spectating=false){
 const seat=room.seats.findIndex(p=>p?.id===employeeId),g=room.game;if(seat<0&&!spectating)throw Error('你不在这张牌桌。');
  return {id:room.id,mode:room.mode,size:room.size,host:room.host,hostName:room.seats.find(p=>p?.id===room.host)?.name||'员工',revision:room.revision,base:room.base||100,reserve:room.money?.rules.reserve??cardStakes.reserve(room.base||100),botLevel:room.botLevel||'standard',spectating, money:room.money&&!spectating?{round:room.money.round,rules:room.money.rules,settlement:room.money.settlement?{...room.money.settlement.players[seat]}:null}:null,seat,phase:g?.phase||'waiting',deadline:room.deadline,
  seats:room.seats.map((p,i)=>p?{id:p.id,name:p.name,avatar:p.bot?robotAvatar(p.id):p.avatar||defaultAvatar('slate'),bot:p.bot,auto:p.auto,ready:p.ready,count:g?.hands[i].length||0,role:g?.landlord===i?'landlord':g?.landlord>=0?'farmer':null,last:g?.seatPlays[i]||null}:null),
  hand:g&&!spectating?[...g.hands[seat]].sort((a,b)=>b.val-a.val||a.id-b.id):[],bottom:g?.phase==='bidding'?Array(g.bottom.length).fill(null):g?.bottom||[],turn:g?.turn??-1,landlord:g?.landlord??-1,bid:g?.bid||0,multiplier:g?.multiplier||1,last:g?.last||null,event:g?.event||null,winner:g?.winner||null,spring:!!g?.spring};
}
export function installCardTables({db,send,readBody,requireEmployee,sessionEmployee,balanceFor,recordLedger,highlights,clock=()=>Date.now(),schedule=setInterval,cancel=clearInterval}){
 installAvatarPresets(db);
 const profileFor=db.prepare('SELECT anonymous_name,avatar_url,avatar_preset FROM profiles WHERE employee_id=?');
 const portraitFor=p=>{const profile=profileFor.get(p.id);return storedAvatar(p.id,profile?.avatar_url??p.avatar,profile?.avatar_preset,64)||defaultAvatar('slate');};
 db.exec('CREATE TABLE IF NOT EXISTS card_table_rooms(id TEXT PRIMARY KEY,state_json TEXT NOT NULL,updated_at INTEGER NOT NULL)');
 db.exec("DROP TABLE IF EXISTS card_auto_preferences;CREATE TABLE IF NOT EXISTS card_bot_preferences(employee_id INTEGER PRIMARY KEY,level TEXT NOT NULL CHECK(level IN ('easy','standard','smart')))");
 const botLevel=id=>db.prepare('SELECT level FROM card_bot_preferences WHERE employee_id=?').get(id)?.level||'standard';
 const wallet=installCardWallet({db,balanceFor,recordLedger});
 const rooms=new Map(),streams=new Set(),watchers=new Map(),reactions=createCardReactions({clock});
 const save=r=>{r.updatedAt=clock();db.prepare('INSERT INTO card_table_rooms VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at').run(r.id,JSON.stringify(r),r.updatedAt);};
 for(const row of db.prepare('SELECT state_json FROM card_table_rooms').all()){const r=JSON.parse(row.state_json);rooms.set(r.id,r);if(!Number.isFinite(r.deadline))r.deadline=clock()+30000;}
 const playing=r=>['bidding','playing'].includes(r.game?.phase);
 const humans=r=>r.seats.filter(p=>p&&!p.bot&&!p.detached);
 const roomFor=id=>[...rooms.values()].find(r=>r.seats.some(p=>p?.id===id&&!p.detached));
 const selectedRoom=id=>roomFor(id)||rooms.get(watchers.get(id)?.roomId);
 const view=(r,id)=>r?{...tableView({...r,seats:r.seats.map(p=>p&&!p.bot?{...p,avatar:portraitFor(p)}:p)},id,!roomFor(id)),reactions:reactions.view(r),spectators:[...watchers.values()].filter(w=>w.roomId===r.id).map(w=>({...w.person,avatar:portraitFor(w.person)})),serverTime:clock(),gameHighlight:r.money?.settlement?highlights?.roundEvent(id,'cards',r.money.round)||null:null,balance:balanceFor(id)}:null;
 const write=(s,r)=>{if(s.res.destroyed||s.res.writableLength>262144){s.res.destroy();streams.delete(s);return;}try{s.res.write('data: '+JSON.stringify({room:view(r,s.id),balance:balanceFor(s.id)})+'\n\n');}catch{streams.delete(s);}};
 const broadcast=r=>{for(const s of streams)if(r?.seats.some(p=>p?.id===s.id)||watchers.get(s.id)?.roomId===r?.id)write(s,selectedRoom(s.id));};
 const broadcastReactions=r=>{
  const payload='event: reaction\ndata: '+JSON.stringify({roomId:r.id,reactions:reactions.view(r),serverTime:clock()})+'\n\n';
  for(const s of streams)if(r.seats.some(p=>p?.id===s.id&&!p.detached)||watchers.get(s.id)?.roomId===r.id){
   if(s.res.destroyed||s.res.writableLength>262144){s.res.destroy();streams.delete(s);continue;}
   try{s.res.write(payload);}catch{streams.delete(s);}
  }
 };
 // All mutations (including automatic turns) persist together with money. Restore memory on rollback.
 function mutate(r,fn){const previous=r?structuredClone(r):null,existed=r&&rooms.has(r.id);db.exec('BEGIN IMMEDIATE');try{
  const result=fn();if(r){wallet.settle(r);if(r.game?.phase==='ended'&&previous?.game?.phase!=='ended')r.seats.forEach(p=>{if(p)p.ready=!!p.bot||p.id===r.host;});r.revision++;r.deadline=r.mode==='solo'&&!r.seats[r.game?.turn]?.bot&&!r.seats[r.game?.turn]?.auto?0:clock()+(r.seats[r.game?.turn]?.bot||r.seats[r.game?.turn]?.auto?400:30000);
   if(!humans(r).length&&!playing(r)){rooms.delete(r.id);db.prepare('DELETE FROM card_table_rooms WHERE id=?').run(r.id);}else{save(r);rooms.set(r.id,r);}}
  db.exec('COMMIT');if(r&&existed)reactions.observe(r,previous);broadcast(r);return result;
 }catch(e){db.exec('ROLLBACK');if(r){for(const k of Object.keys(r))delete r[k];Object.assign(r,previous);if(existed)rooms.set(r.id,r);else rooms.delete(r.id);}throw e;}}
 const person=e=>{const p=profileFor.get(e.id)||{};return {id:e.id,name:p.anonymous_name||e.display_name||e.username,avatar:portraitFor(e),ready:true,bot:false,auto:false};};
 const bots=r=>{const names=['方片 07','梅花 12','红桃 03'];r.seats=r.seats.map((p,i)=>p||{id:-i-1,name:names[(i-1+3)%3],avatar:'',bot:true,ready:true,auto:false});};
 function start(r){wallet.start(r);r.game=dealTable(r.size);r.seats.forEach(p=>p.auto=false);}
 function leave(r,id){const i=r.seats.findIndex(p=>p?.id===id);if(i<0)return;
  // A departing human keeps their identity and financial liability until settlement.
  if(playing(r)){r.seats[i].detached=true;r.seats[i].auto=true;}else r.seats[i]=null;
  const remaining=humans(r);if(r.host===id&&remaining.length)r.host=remaining[0].id;
 }
 const timer=schedule(()=>{reactions.tick(rooms,broadcastReactions);for(const r of rooms.values()){
  if(!playing(r)||!r.deadline||clock()<r.deadline)continue;
  try{mutate(r,()=>{const p=r.seats[r.game.turn];if(!p.bot)p.auto=true;const seat=r.game.turn,move=botTurn(r.game,autoplayLevel(r,seat));tableAction(r.game,seat,move.action,move);wallet.recordTurn(r,seat,move.action,true);});}
  catch(e){console.error('Card table:',e.message);r.deadline=clock()+30000;}
 }},350);timer.unref();
 const cleanup=schedule(()=>{for(const r of rooms.values())if(!playing(r)&&clock()-r.updatedAt>86400000){rooms.delete(r.id);db.prepare('DELETE FROM card_table_rooms WHERE id=?').run(r.id);}},3600000);cleanup.unref();
 return {close(){cancel(timer);cancel(cleanup);reactions.close();for(const s of streams)s.res.end();},async handle(req,res,url){
  if(!url.pathname.startsWith('/api/player/card-table'))return false;
  const actor=requireEmployee(req,res);if(!actor)return true;
  if(url.pathname==='/api/player/card-table/rooms'&&req.method==='GET'){
   const current=roomFor(actor.id),items=[...rooms.values()].filter(r=>r.mode==='online'&&humans(r).length).map(r=>{const phase=r.game?.phase||'waiting',players=r.seats.filter(p=>p&&(!p.detached||playing(r))).length;
    return {id:r.id,size:r.size,players,hostName:r.seats.find(p=>p?.id===r.host)?.name||'员工',phase,base:r.base||100,spectators:[...watchers.values()].filter(w=>w.roomId===r.id).length,canWatch:true,canJoin:players<r.size&&['waiting','ended'].includes(phase),updatedAt:r.updatedAt};
   }).sort((a,b)=>Number(b.canJoin)-Number(a.canJoin)||b.updatedAt-a.updatedAt).slice(0,30);
   send(res,200,{items,currentRoom:current?{id:current.id,size:current.size,mode:current.mode,hostName:current.seats.find(p=>p?.id===current.host)?.name||'员工'}:null,rules:cardMoneyRules});return true;
  }
  if(url.pathname==='/api/player/card-table/stream'&&req.method==='GET'){
   for(const s of streams)if(s.id===actor.id){s.res.end();streams.delete(s);}
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
   const s={id:actor.id,res};streams.add(s);write(s,selectedRoom(actor.id));const ping=setInterval(()=>{if(!sessionEmployee(req)){res.end();return;}if(res.writableLength>262144){res.destroy();return;}res.write(': heartbeat\n\n');},15000);ping.unref();res.on('close',()=>{clearInterval(ping);streams.delete(s);const cleanup=setTimeout(()=>{if([...streams].some(x=>x.id===actor.id))return;const watched=rooms.get(watchers.get(actor.id)?.roomId);watchers.delete(actor.id);if(watched)broadcast(watched);},2000);cleanup.unref();});return true;
  }
  if(url.pathname!=='/api/player/card-table'){send(res,404,{error:'牌桌接口不存在。'});return true;}
  if(req.method==='GET'){send(res,200,{room:view(selectedRoom(actor.id),actor.id),botLevel:botLevel(actor.id),balance:balanceFor(actor.id)});return true;}
  if(req.method!=='POST'){send(res,405,{error:'指令无效。'});return true;}
  try{
   const d=await readBody(req,8192);let r=roomFor(actor.id);
   if(d.action==='reaction'){
    if(!r||r.id!==d.room)throw Error('入座后才能发送表情。');
    // Ephemeral social events must not write the wallet, change turns or reset deadlines.
    if(reactions.receive(r,actor.id,d.emoji,d.requestId))broadcastReactions(r);
    send(res,200,{roomId:r.id,reactions:reactions.view(r),serverTime:clock()});return true;
   }
   if(d.action==='botLevel'){
    if(!autoLevels.includes(d.level))throw Error('请选择有效的电脑难度。');
    if(r&&(r.host!==actor.id||playing(r)))throw Error('只能由房主在开局前选择电脑难度。');
    const savePreference=()=>{db.prepare('INSERT INTO card_bot_preferences VALUES(?,?) ON CONFLICT(employee_id) DO UPDATE SET level=excluded.level').run(actor.id,d.level);if(r)r.botLevel=d.level;};
    if(r)mutate(r,savePreference);else savePreference();
    send(res,200,{room:view(selectedRoom(actor.id),actor.id),balance:balanceFor(actor.id),botLevel:d.level});return true;
   }
   if(d.action==='watch'||d.action==='unwatch'){
    if(r)throw Error('请先退出当前牌桌再旁观。');
    const old=rooms.get(watchers.get(actor.id)?.roomId);
    if(d.action==='watch'){const target=rooms.get(d.roomId);if(!target||target.mode!=='online')throw Error('牌桌不存在。');watchers.set(actor.id,{roomId:target.id,person:person(actor)});broadcast(target);}else watchers.delete(actor.id);
    if(old)broadcast(old);send(res,200,{room:view(selectedRoom(actor.id),actor.id),balance:balanceFor(actor.id)});return true;
   }
   if(['solo','create','join'].includes(d.action)){
    watchers.delete(actor.id);
    if(r)throw Error('请先离开当前牌桌。');
    wallet.checkEntry(actor.id);
    if(balanceFor(actor.id)<cardMoneyRules.reserve)throw Error('入座需有 10,000 可用余额；开局时锁定本局筹码。');
    if(d.action==='join'){
     r=typeof d.roomId==='string'&&!('code' in d)?rooms.get(d.roomId):null;if(!r||r.mode!=='online')throw Error('请从牌桌列表选择有效的员工牌桌。');if(playing(r))throw Error('这张牌桌已经开局。');
     const reserve=cardStakes.reserve(r.base||100);if(balanceFor(actor.id)<reserve)throw Error('本桌入座需有 '+reserve.toLocaleString('en-US')+' 可用余额。');
     const i=r.seats.findIndex(p=>!p||p.detached);if(i<0)throw Error('牌桌已经坐满。');
     mutate(r,()=>{r.seats[i]={...person(actor),ready:false};if(r.game){r.game=null;r.money=null;}});
    }else{
     const size=Number(d.size);if(![3,4].includes(size))throw Error('请选择三人或四人桌。');
     const base=cardStakes.validate(d.base??cardStakes.defaultBase),reserve=cardStakes.reserve(base);
     if(balanceFor(actor.id)<reserve)throw Error('本桌入座需有 '+reserve.toLocaleString('en-US')+' 可用余额。');
     const level=d.botLevel??botLevel(actor.id);if(!autoLevels.includes(level))throw Error('请选择有效的电脑难度。');
     r={id:randomUUID(),botLevel:level,base,size,mode:d.action==='solo'?'solo':'online',host:actor.id,seats:Array(size).fill(null),revision:0,receipts:[],game:null};r.seats[0]=person(actor);
     mutate(r,()=>{if(r.mode==='solo'){bots(r);start(r);}});
    }
   }else{
    if(!r||r.id!==d.room)throw Error('牌桌已变化，请重新入座。');
    if(typeof d.requestId!=='string'||!d.requestId.length||d.requestId.length>80)throw Error('请重试本次操作。');
    if(r.receipts.includes(d.requestId)){send(res,200,{room:view(r,actor.id),balance:balanceFor(actor.id)});return true;}
    if(d.revision!==r.revision){send(res,409,{error:'牌局已更新，请再试一次。',room:view(r,actor.id)});return true;}
    const i=r.seats.findIndex(p=>p?.id===actor.id);
    mutate(r,()=>{
     if(d.action==='leave')leave(r,actor.id);
     else if(d.action==='auto')r.seats[i].auto=!r.seats[i].auto;
     else if(d.action==='ready'){if(playing(r))throw Error('本局已经开始。');r.seats[i].ready=!r.seats[i].ready;}
     else if(d.action==='fillBots'){
      if(r.host!==actor.id)throw Error('只有房主可以添加电脑。');if(playing(r))throw Error('本局尚未结束，不能更换座位。');
      r.seats=r.seats.map(p=>p?.detached?null:p);
      if(r.seats.every(Boolean))throw Error('牌桌已经坐满。');
      bots(r);
     }
     else if(d.action==='start'){
      if(r.host!==actor.id)throw Error('请等待房主开局。');if(playing(r))throw Error('本局尚未结束。');
      r.seats=r.seats.map(p=>p?.detached?null:p);if(d.fillBots)bots(r);
      if(r.seats.some(p=>!p||!p.ready))throw Error('请等待所有员工准备，或补齐电脑座位。');start(r);
     }else{tableAction(r.game,i,d.action,d);wallet.recordTurn(r,i,d.action,false);}
     r.receipts.push(d.requestId);if(r.receipts.length>40)r.receipts.shift();
    });
   }
   send(res,200,{room:view(selectedRoom(actor.id),actor.id),balance:balanceFor(actor.id)});return true;
  }catch(e){send(res,400,{error:e.message});return true;}
 }};
}
