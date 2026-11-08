import {slot5x3Symbols,slot5x3Lines} from './server-content.mjs';

const pay=[[60,120,650],[12,35,120],[6,17,45],[3.5,8,18],[3,6,11],[4,6,10]];
export const slotSymbols=slot5x3Symbols.map((s,i)=>({...s,m3:pay[i][0],m4:pay[i][1],m5:pay[i][2]}));
const reel=[2,2,3,4,5,6].flatMap((n,i)=>Array(n).fill(slotSymbols[i]));
// A separate, disclosed partial return only when no line/protocol paid.
// No stake-dependent or account-dependent probability adjustments.
export const slotPartialReturns=[.05,.1,.15,.2,.2,.25,.3,.35,.4,.45,.5,.55,.6,.65,.7,.75];
export const slotRules={symbols:slotSymbols,partialReturnMin:.05,partialReturnMax:.75,emptyReturnChance:.05,overloadChance:.0075,overloadMultiplier:2};

export function spinSlot(cost,random){
 const board=Array.from({length:3},()=>Array.from({length:5},()=>reel[Math.floor(random()*reel.length)]));
 const winningCells=[],notes=[],mechanisms=[];let tenths=0;
 for(const line of slot5x3Lines){const first=board[line.rows[0]][0];let n=1;while(n<5&&board[line.rows[n]][n].id===first.id)n++;
  if(n>=3){tenths+=first['m'+n]*cost*2;notes.push(line.name+' '+n+'连');for(let c=0;c<n;c++)winningCells.push(`${line.rows[c]}_${c}`);}}
 if(board.flat().filter(s=>s.id==='eye').length>=3){tenths+=cost*40;mechanisms.push(0);}
 if(board.some(row=>row[0].id==='rad')&&board.some(row=>row[4].id==='rad')){tenths+=cost*5;mechanisms.push(1);}
 if(new Set(board[1].map(s=>s.id)).size===5){tenths+=cost*30;mechanisms.push(2);}
 let prize=Math.floor(tenths/10),partialReturn=0;
 if(tenths===0&&random()>=slotRules.emptyReturnChance){const percent=Math.round(100*slotPartialReturns[Math.floor(random()*slotPartialReturns.length)]);partialReturn=Math.floor(cost*percent/100);prize=partialReturn;notes.push('小额返还');}
 const penalty=random()<slotRules.overloadChance?cost*slotRules.overloadMultiplier:0;if(penalty)notes.push('回路过载 · 维修费');
 return {prize,result:{board,winningCells,notes,mechanisms,partialReturn,penalty,penaltyKind:penalty?'overload':null}};
}
