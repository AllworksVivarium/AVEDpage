import {scratchClimbMultipliers} from './server-content.mjs';

const moves = [-2, -1, 0, 1, 2];
const money = n => '¤ ' + Number(n).toLocaleString('en-US');

export function generateClimbRoute(cost, payout, random) {
  const topFloor = scratchClimbMultipliers.length - 1;
  const steps = topFloor;
  const levels = scratchClimbMultipliers.map(x => Math.floor(cost * x + 1e-7));
  let finishFloor = levels.indexOf(payout);
  // Keep old/custom ticket amounts exact; super jackpots occupy the top floor.
  if(finishFloor < 0){finishFloor=levels.findIndex(x=>x>=payout);if(finishFloor<0)finishFloor=topFloor;levels[finishFloor]=payout;}
  // A zero-award route has a stationary station where a bomb can be printed.
  const pauseStep = payout === 0 ? Math.floor(random() * steps) : -1;
  let floor = 0;
  const cells = [];
  for (let step = 0; step < steps; step++) {
    const remaining = steps - 1 - step - (pauseStep > step ? 1 : 0);
    const choices = (step === pauseStep ? [0] : moves).filter(delta => {
      const next = floor + delta;
      return next >= 0 && next <= topFloor && finishFloor - next >= -2 * remaining && finishFloor - next <= 2 * remaining;
    });
    if (!choices.length) throw Error('巡签路线无法到达终点。');
    const delta = choices[Math.floor(random() * choices.length)];
    floor += delta;
    cells.push({
      role: 'STEP_RIGHT', step: step + 1, stepDelta: delta, stepFloor: floor,
      label: delta > 0 ? '↑ +' + delta + ' 层' : delta < 0 ? '↓ ' + delta + ' 层' : '— 停留',
      sub: step === steps - 1 ? money(payout) : '第' + (step + 1) + '站',
      isWinPart: step === steps - 1 && payout > 0
    });
  }
  return {cells, climb: {startFloor: 0, finishFloor, topFloor, levels}};
}
