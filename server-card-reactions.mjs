import {randomUUID} from 'node:crypto';
import './public/card-reaction-rules.js';
const {quick,lifetime}=globalThis.AVEDCardReactionRules;
const positive=new Set(quick.filter(x=>x.tone==='positive').map(x=>x.id));

// Reads public counts, roles and the last public play only; never card values.
export function chooseReactionReply(room,sender,bot,emoji,positiveStreak=0){
 const g=room.game;if(!g||g.landlord<0)return emoji==='cry'?'handshake':positive.has(emoji)?'like':'think';
 const teammates=(sender===g.landlord)===(bot===g.landlord);
 const senderWon=g.phase==='ended'&&((g.winner==='landlord')===(sender===g.landlord));
 const botWon=g.phase==='ended'&&((g.winner==='landlord')===(bot===g.landlord));
 const publicCounts=g.hands.map(h=>h.length),botClose=publicCounts[bot]<=2;
 const behind=!teammates&&(botWon||botClose||publicCounts[sender]>=publicCounts[bot]+5);
 const bomb=g.last&&['bomb','rocket'].includes(g.last.type);
 if(positive.has(emoji)){
  if(positiveStreak>=3&&(behind||(!teammates&&bomb&&g.last.seat===bot)))return 'eyeroll';
  if(senderWon)return teammates?'clap':'sweat';
  if(!teammates&&bomb&&g.last.seat===sender)return 'angry';
  return teammates?'handshake':behind?'smirk':'like';
 }
 if(emoji==='cry'||emoji==='angry')return teammates?'handshake':botWon||botClose?'cool':'sweat';
 if(emoji==='laugh'||emoji==='smirk')return teammates?'laugh':botWon||botClose?'cool':'eyeroll';
 return 'think';
}

export function createCardReactions({clock=()=>Date.now(),random=Math.random}={}){
 const tables=new Map(),prefix=randomUUID();let sequence=0;
 function prune(state,now){
  state.events=state.events.filter(e=>now-e.at<lifetime);
  for(const [id,a] of state.actors)if(now-a.at>20000)state.actors.delete(id);
 }
 function stateFor(room){let state=tables.get(room.id);if(!state){state={events:[],actors:new Map(),pending:null,lastReply:-Infinity,touched:clock()};tables.set(room.id,state);}prune(state,clock());return state;}
 const add=(s,seat,emoji,at,replyTo)=>{const e={id:prefix+':'+(++sequence),seat,emoji,at,...(replyTo?{replyTo}: {})};s.events.push(e);s.events=s.events.slice(-12);return e;};
 return {
  receive(room,actorId,emoji,requestId){
   const seat=room.seats.findIndex(p=>p?.id===actorId&&!p.bot&&!p.detached);
   if(seat<0)throw Error('入座后才能发送表情。');
   if(!quick.some(e=>e.id===emoji))throw Error('请选择牌桌上的快捷表情。');
   if(typeof requestId!=='string'||!requestId.length||requestId.length>80)throw Error('请重试本次表情。');
   const now=clock(),s=stateFor(room);s.touched=now;
   let actor=s.actors.get(actorId);
   if(actor?.receipts.includes(requestId))return false;
   if(!actor)actor={at:-Infinity,sends:[],positives:[],receipts:[]};
   actor.sends=actor.sends.filter(at=>now-at<8000);
   if(now-actor.at<850||actor.sends.length>=5)throw Error('慢一点，等表情飘完再发。');
   actor.at=now;actor.sends.push(now);actor.receipts.push(requestId);actor.receipts=actor.receipts.slice(-24);
   actor.positives=positive.has(emoji)?[...actor.positives.filter(at=>now-at<6500),now]:[];
   s.actors.set(actorId,actor);const event=add(s,seat,emoji,now);
   const bots=room.seats.flatMap((p,i)=>p?.bot?[i]:[]);
   if(bots.length){
    // Coalesce rapid reactions: at most one delayed bot reply per table.
    const bot=s.pending?.actorId===actorId?s.pending.bot:bots[Math.min(bots.length-1,Math.floor(random()*bots.length))];
    const reply={actorId,bot,emoji:chooseReactionReply(room,seat,bot,emoji,actor.positives.length),replyTo:event.id};
    s.pending={...reply,due:s.pending?.due??Math.max(now+850+Math.floor(random()*500),s.lastReply+2400)};
   }
   return true;
  },
  view(room){const s=tables.get(room.id);if(!s)return [];prune(s,clock());return s.events.map(e=>({...e}));},
  tick(rooms,broadcast){
   const now=clock();for(const [id,s] of tables){
    const room=rooms.get(id);if(!room||now-s.touched>30000){tables.delete(id);continue;}
    prune(s,now);
    if(s.pending&&now>=s.pending.due){
     const p=s.pending;s.pending=null;
     if(room.seats[p.bot]?.bot&&room.seats.some(seat=>seat?.id===p.actorId&&!seat.detached)){
      add(s,p.bot,p.emoji,now,p.replyTo);s.lastReply=now;broadcast(room);
     }
    }
   }
  },
  close(){tables.clear();}
 };
}
