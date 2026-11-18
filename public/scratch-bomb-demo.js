(() => {
 function make({tier,gameType,totalLoss=3}){
  if(![3,11,101].includes(totalLoss))throw Error('炸弹倍率无效。');
  const money=n=>'¤ '+Number(n).toLocaleString('en-US'),marks=['🔺','👁️','☢️','🧬','⚡','🔒','📁'];
  let cells,climb;
  if(gameType.type==='lucky_num')cells=[...['#18','#36','#72'].map(n=>({role:'LUCKY',label:'领赏号 '+n,sub:'公司核准'})),{role:'MULT',label:'×1 倍',sub:'核准印'},...Array.from({length:9},(_,i)=>({role:'PLAYER',label:'#'+(41+i),sub:money(tier.cost*(i%4+1))}))];
  else if(gameType.type==='step_climb'){
   let floor=0;cells=[2,0,-1,1,-2].map((delta,idx)=>{floor+=delta;return {role:'STEP_RIGHT',step:idx+1,stepDelta:delta,stepFloor:floor,label:delta>0?'↑ +'+delta+' 层':delta<0?'↓ '+delta+' 层':'— 停留',sub:idx===4?money(0):'第'+(idx+1)+'站'};});
   climb={startFloor:0,finishFloor:0,topFloor:5,levels:[0,.5,1.2,5,20,100].map(x=>Math.floor(tier.cost*x+1e-7))};
  }
  else cells=Array.from({length:12},(_,i)=>({label:marks[i%marks.length],sub:money(tier.cost*(i%5+1))}));
  cells.forEach((c,idx)=>Object.assign(c,{idx,revealed:false,isWinPart:false}));
  const playable=cells.filter(c=>climb?c.stepDelta===0:!c.role||['PLAYER','STEP_RIGHT'].includes(c.role)),bomb=playable[Math.floor(Math.random()*playable.length)],penalty=tier.cost*(totalLoss-1);
  Object.assign(bomb,{isBomb:true,label:'💣',sub:'追加扣款 '+money(penalty)});
  return {demo:true,draft:false,settled:false,tier:{...tier},gameType,cost:tier.cost,prize:0,totalPayout:0,penalty,bomb:{extraMultiplier:totalLoss-1,totalLossMultiplier:totalLoss},cells,...(climb?{climb}:{})};
 }
 window.AVEDScratchBombDemo={make};
})();
