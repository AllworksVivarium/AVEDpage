import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEconomy} from '../server-economy.mjs';
import {scratchGameTypes,scratchBombRules} from '../server-content.mjs';
import {generateSealedTicket,generateOutcomeTicket} from '../server-ticket.mjs';

const game = scratchGameTypes.find(x => x.type === 'three_match');
function rng(seed = 17) { return () => ((seed = Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32; }
const money = cell => Number(cell.sub.match(/¤ ([\d,]+)/)[1].replaceAll(',', ''));

// Interpret only visible symbols and amounts, independently of isWinPart.
function readTicket(ticket) {
  assert.equal(ticket.cells.length, 12);
  const symbols = new Map();
  ticket.cells.forEach((cell, index) => {
    assert.equal(cell.idx, index);
    assert.equal(cell.revealed, false);
    if (cell.isBomb) return;
    const cells = symbols.get(cell.label) || [];
    cells.push(cell);
    symbols.set(cell.label, cells);
  });
  const groups = [...symbols.values()].filter(cells => cells.length >= 3);
  let printed = 0;
  for (const cells of symbols.values()) {
    assert.ok(cells.length <= 3, 'one symbol cannot accidentally form an extra group');
    const wins = cells.length === 3;
    for (const cell of cells) {
      assert.equal(cell.isWinPart, wins);
      assert.ok(Number.isSafeInteger(money(cell)) && money(cell) >= 0);
      if (wins) printed += money(cell);
    }
    if (wins) assert.ok(cells.reduce((sum, cell) => sum + money(cell), 0) > 0);
  }
  assert.equal(printed, ticket.totalPayout);
  return groups;
}

test('every configured three-seal prize prints exactly its credited amount across valid groups', () => {
  for (const tier of defaultEconomy().scratch) {
    for (const outcome of tier.variants.three_match.filter(x => x.weight > 0)) {
      for (const seed of [1, 99, 7123, 870012, 12000000, 456789012]) {
        const ticket = generateOutcomeTicket(tier, game, 'proof', rng(seed), outcome);
        const groups = readTicket(ticket);
        assert.equal(ticket.totalPayout, Math.floor(tier.cost * outcome.multiplier + 1e-7));
        assert.ok(ticket.totalPayout > 0 ? groups.length >= 1 && groups.length <= 4 : groups.length === 0);
        assert.equal(ticket.penalty || 0, tier.cost * (outcome.penaltyMultiplier || 0));
        assert.equal(ticket.cells.filter(cell => cell.isBomb).length, outcome.penaltyMultiplier ? 1 : 0);
      }
    }
  }
});

test('the same prize can form one through four groups using all seven symbols', () => {
  const counts = new Set(), icons = new Set(), layouts = new Set();
  for (let seed = 1; seed <= 512; seed++) {
    const ticket = generateSealedTicket({cost: 1000}, game, 'proof', rng(seed * 7919), 5000);
    const groups = readTicket(ticket);
    counts.add(groups.length);
    groups.forEach(cells => icons.add(cells[0].label));
    layouts.add(ticket.cells.filter(c => c.isWinPart).map(c => c.idx).join(','));
  }
  assert.deepEqual([...counts].sort(), [1, 2, 3, 4]);
  assert.equal(icons.size, 7);
  assert.ok(layouts.size > 100);
});

test('small, uneven and jackpot awards conserve integer currency, including constant random sources', () => {
  for (const payout of [0, 1, 2, 3, 5, 8, 11, 12, 13, 650, 1201, 100000, 200000000]) {
    for (const value of [0, .5499, .55, .8499, .85, .9699, .97, .999999]) {
      const ticket = generateSealedTicket({cost: 1000}, game, 'edge', () => value, payout);
      readTicket(ticket);
      if (payout >= 3) assert.ok(ticket.cells.filter(c => c.isWinPart).every(c => money(c) > 0));
    }
  }
});

test('zero-prize and bomb tickets never print an unintended matching group', () => {
  for (const penalty of [0, ...scratchBombRules.outcomes.map(x => x.penaltyMultiplier)]) {
    for (let seed = 1; seed <= 64; seed++) {
      const ticket = generateOutcomeTicket({cost: 1000}, game, 'proof', rng(seed), {multiplier: 0, penaltyMultiplier: penalty});
      assert.equal(readTicket(ticket).length, 0);
      assert.equal(ticket.penalty || 0, 1000 * penalty);
    }
  }
});

test('identical seeds reproduce the entire multi-group ticket', () => {
  const make = () => generateSealedTicket({cost: 1000}, game, 'reproducible', rng(27654321), 5000);
  assert.deepEqual(make(), make());
});
