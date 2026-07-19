/**
 * Unit suite for the budget health presentation helpers. Invariants: peso
 * formatting rounds from centavos, and the three health states map correctly
 * (good / tight / over) with the right buffer figures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatPeso, budgetHealthCopy } from './checklist-budget-format';
import type { ChecklistBudgetHealth } from './checklist-budget';

function health(p: Partial<ChecklistBudgetHealth>): ChecklistBudgetHealth {
  return {
    totalBudgetCentavos: 100_000_00,
    committedCentavos: 0,
    projectedMinCentavos: 0,
    projectedMaxCentavos: 0,
    paperworkCentavos: 0,
    bestCaseBufferCentavos: 0,
    worstCaseBufferCentavos: 0,
    isOverBudgetBestCase: false,
    isOverBudgetWorstCase: false,
    lines: [],
    ...p,
  };
}

test('formatPeso: whole pesos from centavos with grouping', () => {
  assert.equal(formatPeso(1_230_00), '₱1,230');
  assert.equal(formatPeso(0), '₱0');
  assert.equal(formatPeso(1_500_000_00), '₱1,500,000');
  // rounds, and non-finite is treated as 0
  assert.equal(formatPeso(149), '₱1');
  assert.equal(formatPeso(Number.NaN), '₱0');
});

test('budgetHealthCopy: good range when best-case buffer is positive', () => {
  const c = budgetHealthCopy(
    health({ bestCaseBufferCentavos: 90_000_00, worstCaseBufferCentavos: 40_000_00 }),
  );
  assert.equal(c.tone, 'good');
  assert.match(c.headline, /good range/i);
});

test('budgetHealthCopy: tight when best-case ok but worst-case over', () => {
  const c = budgetHealthCopy(
    health({
      bestCaseBufferCentavos: 10_000_00,
      worstCaseBufferCentavos: -20_000_00,
      isOverBudgetWorstCase: true,
    }),
  );
  assert.equal(c.tone, 'tight');
  assert.match(c.headline, /close/i);
});

test('budgetHealthCopy: over when even best-case is negative', () => {
  const c = budgetHealthCopy(
    health({
      bestCaseBufferCentavos: -30_000_00,
      worstCaseBufferCentavos: -80_000_00,
      isOverBudgetBestCase: true,
      isOverBudgetWorstCase: true,
    }),
  );
  assert.equal(c.tone, 'over');
  assert.match(c.detail, /30,000 over/);
});
