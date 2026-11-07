(() => {
 function make({tier,gameType,totalLoss=2}){
  if(![2,3,5].includes(totalLoss))throw Error('炸弹倍率无效。');
  const money=n=>'¤ '+Number(n).toLocaleString('en-US'),marks=['🔺','👁️','☢️','🧬','⚡','🔒','📁'];
  let cells;
  if(gameType.type==='lucky_num')cells=[...['#18','#36','#72'].map(n=>({role:'LUCKY',label:'领赏号 '+n,sub:'公司核准'})),{role:'MULT',label:'×1 倍',sub:'核准印'},...Array.from({length:9},(_,i)=>({role:'PLAYER',label:'#'+(41+i),sub:money(tier.cost*(i%4+1))}))];
  else if(gameType.type==='step_climb')cells=Array.from({length:10},(_,i)=>({role:i%2?'STEP_RIGHT':'STEP_LEFT',step:Math.floor(i/2)+1,label:i%2?'员工签号 '+(21+i):'第'+(i/2+1)+'站·签号 '+(51+i),sub:i%2?'待下次巡签 ('+money(tier.cost*(Math.floor(i/2)+1))+')':'站点留签'}));
  else cells=Array.from({length:12},(_,i)=>({label:marks[i%marks.length],sub:money(tier.cost*(i%5+1))}));
  cells.forEach((c,idx)=>Object.assign(c,{idx,revealed:false,isWinPart:false}));
  const playable=cells.filter(c=>!c.role||['PLAYER','STEP_RIGHT'].includes(c.role)),bomb=playable[Math.floor(Math.random()*playable.length)],penalty=tier.cost*(totalLoss-1);
  Object.assign(bomb,{isBomb:true,label:'💣',sub:'追加扣款 '+money(penalty)});
  return {demo:true,draft:false,settled:false,tier:{...tier},gameType,cost:tier.cost,prize:0,totalPayout:0,penalty,bomb:{extraMultiplier:totalLoss-1,totalLossMultiplier:totalLoss},cells};
 }
 window.AVEDScratchBombDemo={make};
})();
