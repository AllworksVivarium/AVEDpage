import './public/ddz-rules.js';
const R=globalThis.AVEDDdzRules;
export const autoLevels=['easy','standard','smart'];
const counts=hand=>{const c=new Map();for(const x of hand)c.set(x.val,(c.get(x.val)||0)+1);return c;};
function remainingTurns(hand){
 const c=counts(hand);let turns=0;
 // Cheap greedy decomposition: no tree search and no opponent hands.
 for(let lo=3;lo<=10;lo++){
  let hi=lo;while(hi<=14&&c.get(hi)>0)hi++;
  if(hi-lo>=5){for(let v=lo;v<hi;v++)c.set(v,c.get(v)-1);turns++;lo--;}
 }
 const groups=[...c.values()].filter(Boolean),triples=groups.filter(n=>n>=3).length;
 return turns+groups.length-Math.min(triples,groups.filter(n=>n<=2).length);
}
export function chooseAuto(hand,previous,size,{level='smart',teammate=false,danger=false,enemyCount=Infinity,allyCount=Infinity}={}){
 if(level==='standard')return R.choose(hand,previous,size,{teammate,danger});
 const moves=R.moves(hand,previous,size),finish=moves.find(m=>m.count===hand.length);
 if(finish)return finish;if(teammate&&previous)return null;
 if(level==='easy')return moves[0]||null;
 if(danger&&previous?.type==='single')return moves.filter(m=>m.type==='single').at(-1)||moves[0]||null;
 if(danger&&previous?.type==='pair'&&enemyCount<=2)return moves.filter(m=>m.type==='pair').at(-1)||moves[0]||null;
 const own=counts(hand);
 const scored=moves.map(m=>{
  const used=counts(m.cards);let split=0;
  for(const [v,n] of used){const total=own.get(v);if(n<total)split+=total>=4?20:total===3?5:2;}
  const control=m.mainRank>=15&&!danger?3:0;
  const feed=!previous&&allyCount===1&&m.type==='single'?-8:0;
  const block=!previous&&((enemyCount===1&&m.type==='single')||(enemyCount===2&&m.type==='pair'))?14:0;
  return {m,cheap:split+m.mainRank*.12-m.count*.4+control+feed+block+(['bomb','rocket','four_two','four_two_pair'].includes(m.type)&&!danger?18:0)};
 }).sort((a,b)=>a.cheap-b.cheap).slice(0,48);
 let best=null,value=Infinity;
 // In a small endgame, inspect a bounded second own-hand move. This is hand
 // decomposition, not an assumption that opponents will let both moves through.
 let searches=0;const cache=new Map();
 for(const {m,cheap} of scored){
  const ids=new Set(m.cards.map(c=>c.id)),rest=hand.filter(c=>!ids.has(c.id));let turns=remainingTurns(rest);
  if(hand.length<=12&&searches++<8){
   const key=rest.map(c=>c.val).sort((a,b)=>a-b).join(',');
   if(cache.has(key))turns=cache.get(key);
   else{const next=R.moves(rest,null,size);turns=Math.min(turns,...next.map(n=>{const used=new Set(n.cards.map(c=>c.id));return 1+remainingTurns(rest.filter(c=>!used.has(c.id)));}));cache.set(key,turns);}
  }
  const cost=turns*8+cheap;if(cost<value){value=cost;best=m;}
 }
 return best;
}
