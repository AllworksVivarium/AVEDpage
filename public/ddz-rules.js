/* Card classification adapted from NFraw/Tongzhuo, games/landlord/hand.ts
 * blob 609b430d0e03e253be36d646d7bb0d8ad7f524e0, MIT, Copyright (c) 2026 NFraw.
 * License: /licenses/tongzhuo.txt. AVED changes: rank format, four-player rules,
 * wing validation, length-safe comparison, bounded legal moves and bot choice. */
(function(root){
 const labels={single:'单张',pair:'对子',triple:'三张',triple_one:'三带一',triple_two:'三带二',straight:'顺子',double_straight:'连对',plane:'飞机',plane_single:'飞机带单',plane_pair:'飞机带对',four_two:'四带二',four_two_pair:'四带两对',bomb:'炸弹',rocket:'王炸'};
 const group=cards=>{const g=new Map();for(const c of cards){const a=g.get(c.val)||[];a.push(c);g.set(c.val,a);}return g;};
 const consecutive=r=>r.length>1&&r.every((v,i)=>v<=14&&(!i||v===r[i-1]+1));
 function classify(cards,players=3){
  if(!cards.length||new Set(cards.map(c=>c.id)).size!==cards.length)return null;
  const g=group(cards),r=[...g.keys()].sort((a,b)=>a-b),n=cards.length;
  const d=new Map();for(const [v,a]of g){const b=d.get(a.length)||[];b.push(v);d.set(a.length,b);}
  const make=(type,mainRank)=>({type,mainRank,count:n,label:labels[type]});
  if((players===3&&n===2&&g.has(16)&&g.has(17))||(players===4&&n===4&&g.get(16)?.length===2&&g.get(17)?.length===2))return make('rocket',17);
  if(n===1)return make('single',r[0]);
  if(g.size===1){if(n===2)return make('pair',r[0]);if(n===3)return make('triple',r[0]);if(n>=4&&n<=(players===4?8:4)&&r[0]<=15)return make('bomb',r[0]);}
  if(n===4&&d.get(3)?.length===1&&d.get(1)?.length===1)return make('triple_one',d.get(3)[0]);
  if(n===5&&d.get(3)?.length===1&&d.get(2)?.length===1)return make('triple_two',d.get(3)[0]);
  if(n>=5&&g.size===n&&consecutive(r))return make('straight',r.at(-1));
  if(n>=6&&n%2===0&&d.get(2)?.length===n/2&&consecutive(r))return make('double_straight',r.at(-1));
  if(n>=6&&n%3===0&&d.get(3)?.length===n/3&&consecutive(r))return make('plane',r.at(-1));
  // Try every consecutive triple body. Wings may contain a pair, but cannot
  // reuse a body rank; pair wings must be distinct ranks. Prefer highest body.
  for(const [unit,type]of [[4,'plane_single'],[5,'plane_pair']]){
   const len=n/unit;if(!Number.isInteger(len)||len<2)continue;
   for(let hi=14;hi>=len+2;hi--){const body=Array.from({length:len},(_,i)=>hi-len+1+i);if(!body.every(v=>g.get(v)?.length===3))continue;
    const rest=[...g].filter(([v])=>!body.includes(v));
    if(type==='plane_single'&&rest.reduce((s,[,a])=>s+a.length,0)===len)return make(type,hi);
    if(type==='plane_pair'&&rest.length===len&&rest.every(([,a])=>a.length===2))return make(type,hi);
   }
  }
  if(n===6&&d.get(4)?.length===1)return make('four_two',d.get(4)[0]);
  if(n===8&&d.get(4)?.length===1&&d.get(2)?.length===2)return make('four_two_pair',d.get(4)[0]);
  return null;
 }
 function beats(a,b){if(!a)return false;if(!b)return true;if(b.type==='rocket')return false;if(a.type==='rocket')return true;
  if(a.type==='bomb'){if(b.type!=='bomb')return true;return a.count>b.count||(a.count===b.count&&a.mainRank>b.mainRank);}
  return b.type!=='bomb'&&a.type===b.type&&a.count===b.count&&a.mainRank>b.mainRank;
 }
 function moves(hand,previous=null,players=3){
  const g=group(hand),r=[...g.keys()].sort((a,b)=>a-b),out=[],seen=new Set();
  function add(cards){const p=classify(cards,players);if(!beats(p,previous))return;const key=cards.map(c=>c.id).sort((a,b)=>a-b).join(',');if(!seen.has(key)){seen.add(key);out.push({cards,...p});}}
  for(const v of r)for(let n=1;n<=g.get(v).length;n++)add(g.get(v).slice(0,n));
  const jokers=hand.filter(c=>c.val>=16);if(jokers.length===(players===4?4:2))add(jokers);
  function wings(body,count,pairs){
   const excluded=new Set(body.map(c=>c.val)),ranks=r.filter(v=>!excluded.has(v)&&(!pairs||g.get(v).length>=2));let combinations=0;
   function visit(i,left,tail){if(combinations>=100)return;if(!left){combinations++;add([...body,...tail]);return;}if(i>=ranks.length)return;
    const a=g.get(ranks[i]),max=pairs?Math.min(1,left):Math.min(a.length,left);
    for(let k=max;k>=0;k--)visit(i+1,left-k,[...tail,...a.slice(0,pairs?k*2:k)]);
   }visit(0,count,[]);
  }
  for(const v of r){const a=g.get(v);if(a.length>=3){wings(a.slice(0,3),1,false);wings(a.slice(0,3),1,true);}if(a.length>=4){wings(a.slice(0,4),2,false);wings(a.slice(0,4),2,true);}}
  for(const size of [1,2,3])for(let lo=3;lo<=14;lo++){
   const cards=[];for(let hi=lo;hi<=14;hi++){if((g.get(hi)?.length||0)<size)break;cards.push(...g.get(hi).slice(0,size));const len=hi-lo+1;
    if(len>=(size===1?5:size===2?3:2)){add(cards.slice());if(size===3){wings(cards,len,false);wings(cards,len,true);}}
   }
  }
  return out.sort((a,b)=>(a.type==='rocket')-(b.type==='rocket')||(a.type==='bomb')-(b.type==='bomb')||a.mainRank-b.mainRank||b.count-a.count);
 }
 function choose(hand,previous,players,{teammate=false,danger=false}={}){
  const all=moves(hand,previous,players),finish=all.find(m=>m.count===hand.length);if(finish)return finish;
  if(teammate&&previous)return null;
  if(previous){if(danger&&previous.type==='single'){const singles=all.filter(m=>m.type==='single');if(singles.length)return singles.at(-1);}return all[0]||null;}
  return all.sort((a,b)=>(b.count*4-b.mainRank-(b.type==='bomb'||b.type==='rocket'?30:0))-(a.count*4-a.mainRank-(a.type==='bomb'||a.type==='rocket'?30:0)))[0]||null;
 }
 root.AVEDDdzRules={classify,beats,moves,choose,labels};
})(globalThis);
