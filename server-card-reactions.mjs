import {randomUUID} from 'node:crypto';
import './public/card-reaction-rules.js';
const {quick,lifetime}=globalThis.AVEDCardReactionRules;
const positive=new Set(quick.filter(x=>x.tone==='positive').map(x=>x.id));
const variants={like:['like','star','clap'],clap:['clap','star','fire'],laugh:['laugh','grin'],smirk:['smirk','cool'],angry:['angry','shock'],cry:['cry','sob','facepalm'],think:['think','peek'],eyeroll:['eyeroll'],cool:['cool','relief','salute'],handshake:['handshake','salute','like'],sweat:['sweat','shock','wow']};

// Only the public move, team roles and remaining card counts are consulted.
export function chooseTableReaction(room,previous,bot){
 const g=room.game,e=g?.event;if(!g||g.landlord<0||!e||e.seat<0)return null;
 const teammate=(e.seat===g.landlord)===(bot===g.landlord),count=g.hands[e.seat].length;
 const name=room.seats[bot]?.name;
 if(name==='你炸我就鼓掌'&&e.seat!==bot&&!teammate&&['bomb','rocket'].includes(e.type))return {emoji:'clap',fixed:true};
 if(name==='笑容转移中'&&g.phase==='ended'&&previous?.game?.phase!=='ended')return {emoji:((g.winner==='landlord')===(bot===g.landlord))?'laugh':'cry',fixed:true};
 if(name==='我牌呢'&&e.seat===bot&&g.hands[bot].length<=2&&e.type)return {emoji:'think',fixed:true};
 if(g.phase==='ended'&&previous?.game?.phase!=='ended')return ((g.winner==='landlord')===(bot===g.landlord))?{emoji:'clap'}:{emoji:'cry'};
 if(e.seat===bot)return null;
 if(['bomb','rocket'].includes(e.type))return teammate?{emoji:'clap'}:{emoji:'sweat'};
 if(e.type&&count<=2)return teammate?{emoji:'handshake'}:{emoji:'think'};
 if(e.text==='不出'&&teammate)return {emoji:'cool'};
 if(e.type&&previous?.game?.last?.seat===bot&&!teammate)return {emoji:'angry'};
 return null;
}

// Reads public counts, roles and the last public play only; never card values.
export function chooseReactionReply(room,sender,bot,emoji,positiveStreak=0){
 if(room.seats[bot]?.name==='别给我发表情了')return 'eyeroll';
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
 function stateFor(room){let state=tables.get(room.id);if(!state){state={events:[],actors:new Map(),pending:null,lastReply:-Infinity,lastContext:-Infinity,lastBot:-1,lastObserved:'',touched:clock()};tables.set(room.id,state);}prune(state,clock());return state;}
 const add=(s,seat,emoji,at,replyTo,context)=>{const e={id:prefix+':'+(++sequence),seat,emoji,at,...(replyTo?{replyTo}: {}),...(context?{context:true}:{})};s.events.push(e);s.events=s.events.slice(-12);return e;};
 return {
  observe(room,previous){
   if(!room.game||room.game===previous?.game)return;
   const key=room.game.event?.id||JSON.stringify(room.game.event),old=previous?.game?.event;
   if(key===(old?.id||JSON.stringify(old)))return;
   const now=clock(),s=stateFor(room);s.touched=now;
   if(key===s.lastObserved)return;s.lastObserved=key;
   const ended=room.game.phase==='ended'&&previous?.game?.phase!=='ended';
   const candidates=room.seats.flatMap((p,i)=>p?.bot?[[i,chooseTableReaction(room,previous,i)]]:[]).filter(([,reply])=>reply);
   if(!candidates.length)return;
   const fixed=candidates.filter(([,reply])=>reply.fixed);
   if(!fixed.length&&!ended&&(s.pending||now-s.lastContext<6500||now-s.lastReply<2400))return;
   const eligible=fixed.length?fixed:candidates,pool=eligible.filter(([i])=>i!==s.lastBot),choices=pool.length?pool:eligible;
   const [bot,reply]=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
   const options=reply.fixed?[reply.emoji]:variants[reply.emoji]||[reply.emoji],emoji=options[Math.min(options.length-1,Math.floor(random()*options.length))];
   s.pending={bot,emoji,context:true,round:room.money?.round,due:Math.max(now+850+Math.floor(random()*500),s.lastReply+2400)};s.lastContext=now;
  },
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
    const grumpy=bots.find(i=>room.seats[i].name==='别给我发表情了');
    const bot=grumpy??(s.pending?.actorId===actorId?s.pending.bot:bots[Math.min(bots.length-1,Math.floor(random()*bots.length))]);
    const answer=chooseReactionReply(room,seat,bot,emoji,actor.positives.length),options=variants[answer]||[answer];
    const reply={actorId,bot,emoji:options[Math.min(options.length-1,Math.floor(random()*options.length))],replyTo:event.id,round:room.money?.round};
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
     if(room.seats[p.bot]?.bot&&p.round===room.money?.round&&(p.context||room.seats.some(seat=>seat?.id===p.actorId&&!seat.detached))){
      add(s,p.bot,p.emoji,now,p.replyTo,p.context);s.lastReply=now;s.lastBot=p.bot;broadcast(room);
     }
    }
   }
  },
  close(){tables.clear();}
 };
}
