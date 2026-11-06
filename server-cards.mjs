// Simplified card table: one player and two computer opponents. Only the server holds the deck.
export function newCards(random){
  const deck=[];let id=1;
  for(let val=3;val<=15;val++)for(const suit of ['♠','♥','♣','♦'])deck.push({id:id++,val,suit,label:val<=10?String(val):({11:'J',12:'Q',13:'K',14:'A',15:'2'})[val],isRed:['♥','♦'].includes(suit)});
  deck.push({id:id++,val:16,suit:'B',label:'JOKER',isRed:false},{id:id++,val:17,suit:'R',label:'JOKER',isRed:true});
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  return {phase:'bidding',hands:[deck.slice(0,17),deck.slice(17,34),deck.slice(34,51)],hole:deck.slice(51),last:null,passes:0,winner:null};
}
function pattern(cards){
  if(!cards.length)return null;
  const vals=cards.map(c=>c.val).sort((a,b)=>a-b);
  if(vals.length===2&&vals[0]===16&&vals[1]===17)return {type:'bomb',val:99};
  if(vals.length<=4&&vals.every(n=>n===vals[0]))return {type:['','single','pair','triple','bomb'][vals.length],val:vals[0]};
  return null;
}
function beats(a,b){return !b||(a.type==='bomb'&&b.type!=='bomb')||(a.type===b.type&&a.val>b.val);}
function choices(hand){const options=[];for(const c of hand)options.push([c]);for(const v of new Set(hand.map(c=>c.val))){const group=hand.filter(c=>c.val===v);for(let n=2;n<=group.length;n++)options.push(group.slice(0,n));}if(hand.some(c=>c.val===16)&&hand.some(c=>c.val===17))options.push(hand.filter(c=>c.val>=16));return options.sort((a,b)=>pattern(a).val-pattern(b).val);}
export function cardsAction(s,action,ids=[]) {
  if(action==='bid'&&s.phase==='bidding'){s.hands[0].push(...s.hole);s.phase='playing';return;}
  if(s.phase!=='playing')throw new Error('请先抢地主或开始新局。');
  function turn(who,cards){
    if(!cards.length){if(!s.last||s.last.by===who)throw new Error('当前必须出牌。');s.passes++;if(s.passes===2){s.last=null;s.passes=0;}return;}
    const p=pattern(cards);if(!p||!beats(p,s.last?.by===who?null:s.last))throw new Error('牌型或点数不符合规则。');
    s.hands[who]=s.hands[who].filter(c=>!cards.some(x=>x.id===c.id));s.last={...p,by:who,cards};s.passes=0;
    if(!s.hands[who].length){s.phase='ended';s.winner=who;}
  }
  if(action==='play'){
    if(!Array.isArray(ids)||new Set(ids).size!==ids.length||!ids.length)throw new Error('请选择手牌。');
    const chosen=ids.map(id=>s.hands[0].find(c=>c.id===id));if(chosen.some(c=>!c))throw new Error('手牌无效。');turn(0,chosen);
  }else if(action==='pass')turn(0,[]);else throw new Error('操作无效。');
  for(const who of [1,2]){if(s.phase!=='playing')break;const candidate=choices(s.hands[who]).find(c=>beats(pattern(c),s.last?.by===who?null:s.last));turn(who,candidate||[]);}
}
export function publicCards(s,round){return {round,cost:0,prize:s.phase==='ended'&&s.winner===0?20000:0,phase:s.phase,playerHand:[...s.hands[0]].sort((a,b)=>b.val-a.val),aiLeftCount:s.hands[1].length,aiRightCount:s.hands[2].length,holeCards:s.phase==='bidding'?[{},{},{}]:s.hole,lastPlay:s.last?{...s.last,by:['player','left','right'][s.last.by]}:null,winner:s.winner,seedHash:s.seedHash,...(s.phase==='ended'?{seed:s.seed}:{})};}
