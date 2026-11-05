const fmtMoney = n => '¤ ' + Number(n).toLocaleString('en-US');
      export function generateSealedTicket(tier, gameTypeObj, seed, random, configuredPayout) {
        const cost = tier.cost;
        const targetPayout = configuredPayout ?? 0;

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
          luckyNums.forEach(n => cells.push({ role: 'LUCKY', label: `基准 #${n}`, sub: '核准频段', isWinPart: false }));
          cells.push({ role: 'MULT', label: '×1 倍', sub: '核准印', isWinPart: false });

          const playerCells = [];
          if (targetPayout > 0) {
            playerCells.push({ role: 'PLAYER', label: `#${luckyNums[0]}`, sub: fmtMoney(targetPayout), isWinPart: true });
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

            cells.push({ role: 'STEP_LEFT', step, label: `第${step}阶·冲击值 ${enemyPt}`, sub: '异常读数', isWinPart: false });
            cells.push({ role: 'STEP_RIGHT', step, label: `我方抑制值 ${myPt}`, sub: `${winThisStep ? '✓ 压制成功' : '未压制'} (${fmtMoney(prizeForStep)})`, isWinPart: winThisStep });
          }
        }

        cells.forEach((c, idx) => { c.idx = idx; c.revealed = false; });

        return {
          seed,
          tier,
          gameType: gameTypeObj,
          totalPayout: targetPayout,
          settled: false,
          cells
        };
      }

