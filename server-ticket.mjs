const fmtMoney = n => '¤ ' + Number(n).toLocaleString('en-US');
export function generateOutcomeTicket(tier,game,seed,random,outcome){
 const seal=outcome.sealMultiplier||1,base=outcome.baseMultiplier??outcome.multiplier;
 // Round decimal representation noise before flooring integer currency, then
 // apply the stamp once. Every printed base amount remains an integer.
 const payout=Math.floor(tier.cost*base+1e-7)*seal;
 const ticket=generateSealedTicket(tier,game,seed,random,payout,seal);
 if(outcome.penaltyMultiplier)applyScratchBomb(ticket,outcome.penaltyMultiplier,random);
 return ticket;
}
      export function generateSealedTicket(tier, gameTypeObj, seed, random, configuredPayout, sealMultiplier=1) {
        const cost = tier.cost;
        if(![1,2,3,5].includes(sealMultiplier)||gameTypeObj.type!=='lucky_num'&&sealMultiplier!==1)throw Error('核准倍率无效。');
        const basePayout=Math.floor((configuredPayout??0)/sealMultiplier);
        const targetPayout=basePayout*sealMultiplier;

        const cells = [];

        if (gameTypeObj.type === 'three_match') {
          const icons = ['🔺', '👁️', '☢️', '🧬', '⚡', '🔒', '📁'];
          const winIcon = icons[0];
          const counts = {};
          icons.forEach(ic => counts[ic] = 0);

          if (targetPayout > 0) {
            const part1 = Math.round(targetPayout * 0.3);
            const part2 = Math.round(targetPayout * 0.3);
            const part3 = targetPayout - part1 - part2;
            cells.push({ label: winIcon, sub: fmtMoney(part1), isWinPart: true });
            cells.push({ label: winIcon, sub: fmtMoney(part2), isWinPart: true });
            cells.push({ label: winIcon, sub: fmtMoney(part3), isWinPart: true });
            counts[winIcon] = 3;
          }

          while (cells.length < 12) {
            const avail = icons.filter(ic => ic !== winIcon && counts[ic] < 2);
            const pick = avail[Math.floor(random() * avail.length)];
            counts[pick]++;
            const decoyAmt = cost * (1 + Math.floor(random() * 5));
            cells.push({ label: pick, sub: fmtMoney(decoyAmt), isWinPart: false });
          }
          for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
          }
        } else if (gameTypeObj.type === 'lucky_num') {
          const luckyNums = [];
          while (luckyNums.length < 3) {
            const n = 11 + Math.floor(random() * 78);
            if (!luckyNums.includes(n)) luckyNums.push(n);
          }
          luckyNums.forEach(n => cells.push({ role: 'LUCKY', label: `领赏号 #${n}`, sub: '公司核准', isWinPart: false }));
          cells.push({ role: 'MULT', label: '×'+sealMultiplier+' 倍', sub: '核准印', isWinPart: false });

          const playerCells = [];
          if (targetPayout > 0) {
            playerCells.push({ role: 'PLAYER', label: `#${luckyNums[0]}`, sub: fmtMoney(basePayout), baseAmount:basePayout, isWinPart: true });
          }
          while (playerCells.length < 9) {
            let n = 11 + Math.floor(random() * 78);
            if (!luckyNums.includes(n)) {
              playerCells.push({ role: 'PLAYER', label: `#${n}`, sub: fmtMoney(cost * (1 + Math.floor(random() * 6))), isWinPart: false });
            }
          }
          for (let i = playerCells.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [playerCells[i], playerCells[j]] = [playerCells[j], playerCells[i]];
          }
          cells.push(...playerCells);
        } else {
          let remainingPayout = targetPayout;
          for (let step = 1; step <= 5; step++) {
            const winThisStep = (step === 1 && remainingPayout > 0);
            const enemyPt = 20 + Math.floor(random() * 60);
            const myPt = winThisStep ? Math.min(99, enemyPt + 5 + Math.floor(random() * 15)) : Math.max(1, enemyPt - 3 - Math.floor(random() * 15));
            const prizeForStep = winThisStep ? remainingPayout : cost * step;
            if (winThisStep) remainingPayout = 0;

            cells.push({ role: 'STEP_LEFT', step, label: `第${step}站·签号 ${enemyPt}`, sub: '站点留签', isWinPart: false });
            cells.push({ role: 'STEP_RIGHT', step, label: `员工签号 ${myPt}`, sub: `${winThisStep ? '✓ 已通过' : '待下次巡签'} (${fmtMoney(prizeForStep)})`, isWinPart: winThisStep });
          }
        }

        cells.forEach((c, idx) => { c.idx = idx; c.revealed = false; });

        return {
          seed,
          tier,
          gameType: gameTypeObj,
          totalPayout: targetPayout,
          sealMultiplier,basePayout,
          settled: false,
          cells
        };
      }


// Attach one explicit bomb to a playable cell, never to a reference number.
export function applyScratchBomb(ticket,penaltyMultiplier,random){
 if(![1,2,4].includes(penaltyMultiplier)||ticket.totalPayout!==0)throw Error('炸弹票据无效。');
 const candidates=ticket.cells.filter(c=>!c.role||['PLAYER','STEP_RIGHT'].includes(c.role));
 const cell=candidates[Math.floor(random()*candidates.length)];
 const seal=ticket.gameType?.type==='lucky_num'?(ticket.sealMultiplier||1):1;
 if(![1,2,3,5].includes(seal))throw Error('核准倍率无效。');
 ticket.penalty=ticket.tier.cost*penaltyMultiplier*seal;
 ticket.bomb={baseMultiplier:penaltyMultiplier,sealMultiplier:seal,extraMultiplier:penaltyMultiplier*seal,totalLossMultiplier:penaltyMultiplier*seal+1};
 Object.assign(cell,{isBomb:true,label:'💣',sub:'基础扣款 '+fmtMoney(ticket.tier.cost*penaltyMultiplier),baseAmount:ticket.tier.cost*penaltyMultiplier,isWinPart:false});
 return ticket;
}

// Keep the stake, bomb penalty, prize and immutable ticket in one transaction.
export function settleGameTicket({db,transaction,balanceFor,recordLedger,award,getHighlights},id,game,cost,prize,result,proof){
 return transaction(()=>{
  if(balanceFor(id)<cost)throw new Error('余额不足。');
  const penalty=['scratch','slot'].includes(game)?(result.penalty||0):0;
  const seal=result.gameType?.type==='lucky_num'?(result.sealMultiplier||1):1,baseBomb=result.bomb?.baseMultiplier??result.bomb?.extraMultiplier??penalty/(cost*seal);
  const validScratchBomb=[1,2,3,5].includes(seal)&&[1,2,4].includes(baseBomb)&&penalty===cost*baseBomb*seal;
  if(!Number.isSafeInteger(penalty)||penalty<0||(penalty&&(game==='slot'?penalty!==cost*2||result.penaltyKind!=='overload':!validScratchBomb||prize!==0)))throw new Error('炸弹扣款无效。');
  if(cost)recordLedger(id,-cost,game+'投入');
  if(penalty)recordLedger(id,-penalty,game==='slot'?'异常回路过载维修费':'刮刮乐炸弹追加扣款');
  if(prize)recordLedger(id,prize,game+'奖金');
  const row=db.prepare('INSERT INTO game_tickets(employee_id,game,cost,prize,seed,seed_hash,result_json) VALUES(?,?,?,?,?,?,?)').run(id,game,cost,prize,proof.seed,proof.seedHash,JSON.stringify(result));
  award(id);return {ticketId:Number(row.lastInsertRowid),cost,prize,penalty,balance:balanceFor(id),result,seed:proof.seed,seedHash:proof.seedHash,gameHighlight:getHighlights().event(id,Number(row.lastInsertRowid))};
 });
}
