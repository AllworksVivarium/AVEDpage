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
export function chooseAuto(hand,previous,size,{level='smart',teammate=false,danger=false}={}){
 if(level==='standard')return R.choose(hand,previous,size,{teammate,danger});
 const moves=R.moves(hand,previous,size),finish=moves.find(m=>m.count===hand.length);
 if(finish)return finish;if(teammate&&previous)return null;
 if(level==='easy')return moves[0]||null;
 if(danger&&previous?.type==='single')return moves.filter(m=>m.type==='single').at(-1)||moves[0]||null;
 const own=counts(hand);
 const scored=moves.map(m=>{
  const used=counts(m.cards);let split=0;
  for(const [v,n] of used){const total=own.get(v);if(n<total)split+=total>=4?20:total===3?5:2;}
  return {m,cheap:split+m.mainRank*.12-m.count*.4+(['bomb','rocket','four_two','four_two_pair'].includes(m.type)&&!danger?18:0)};
 }).sort((a,b)=>a.cheap-b.cheap).slice(0,48);
 let best=null,value=Infinity;
 for(const {m,cheap} of scored){const ids=new Set(m.cards.map(c=>c.id));const cost=remainingTurns(hand.filter(c=>!ids.has(c.id)))*8+cheap;if(cost<value){value=cost;best=m;}}
 return best;
}
