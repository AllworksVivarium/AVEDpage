// Entertainment labels from a bounded recent-opening sample.
const STYLE_LABELS=[
 ['保守看多派','保守看空派','谨慎双向派'],
 ['稳健多头','稳健空头','均衡操作派'],
 ['进取多头','进取空头','双向进攻派'],
 ['激进多头','激进空头','高杠杆游走派']
];
export function tradingStyle(trades){
 const opens=trades.length,codes=new Map();
 let longs=0,cash=0,triple=0,tenfold=0,totalLeverage=0,switches=0;
 for(const [i,t] of trades.entries()){
  const leverage=Number(t.leverage);
  longs+=t.action==='buy';cash+=leverage===1;triple+=leverage===3;tenfold+=leverage===10;totalLeverage+=leverage;
  codes.set(t.code,(codes.get(t.code)||0)+1);
  if(i&&t.action!==trades[i-1].action)switches++;
 }
 const favorites=[...codes].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code)).slice(0,3);
 const style={opens,longs,shorts:opens-longs,cash,triple,tenfold,averageLeverage:opens?totalLeverage/opens:null,favorites,tags:[],label:'样本积累中'};
 if(opens<5)return style;
 const direction=longs/opens>=.7?0:style.shorts/opens>=.7?1:2;
 const risk=style.tenfold/opens>=.4?3:style.averageLeverage>=3?2:style.cash/opens>=.8?0:1;
 style.label=STYLE_LABELS[risk][direction];
 if(switches/(opens-1)>=.5)style.tags.push('多空换班');
 if(favorites[0].count/opens>=.7)style.tags.push('老熟人');
 else if(codes.size>=3)style.tags.push('到处看看');
 if(style.tenfold/opens>=.6)style.tags.push('油门到底');
 else if(style.cash===opens)style.tags.push('原装动力');
 else if([style.cash,style.triple,style.tenfold].every(n=>n>0))style.tags.push('档位齐全');
 if(!style.tags.length)style.tags.push(direction===0?'等风向上':direction===1?'向下找机会':'两边都看看');
 style.tags=style.tags.slice(0,2);
 return style;
}
