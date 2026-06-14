/**
 * Unit suite for the budget overspend + absorption planner. Load-bearing
 * invariants: transfers never exceed real headroom, netOver reports the truly
 * uncovered remainder, and a zero/negative benchmark is ignored (not a signal).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeBudgetOverspend } from './budget-overspend';

test('fully absorbable: overspend covered by under-budget headroom', () => {
  const r = computeBudgetOverspend([
    { key: 'photo', label: 'Photography', benchmarkPhp: 50000, actualPhp: 58000 },
    { key: 'flowers', label: 'Flowers', benchmarkPhp: 30000, actualPhp: 24000 },
    { key: 'cake', label: 'Cake', benchmarkPhp: 15000, actualPhp: 11000 },
  ]);
  assert.equal(r.hasOverspend, true);
  assert.equal(r.totalOverspendPhp, 8000);
  assert.equal(r.totalHeadroomPhp, 10000); // 6000 + 4000
  assert.equal(r.fullyAbsorbable, true);
  assert.equal(r.netOverPhp, 0);
  // Greedy: 6000 from Flowers (deepest), then 2000 from Cake.
  const total = r.transfers.reduce((s, t) => s + t.amountPhp, 0);
  assert.equal(total, 8000);
  // No transfer draws more than its source's headroom.
  for (const t of r.transfers) {
    const src = r.underBudget.find((u) => u.key === t.fromKey)!;
    assert.ok(t.amountPhp <= src.headroomPhp);
  }
});

test('partially absorbable: netOver is the uncovered remainder', () => {
  const r = computeBudgetOverspend([
    { key: 'venue', label: 'Venue', benchmarkPhp: 100000, actualPhp: 130000 },
    { key: 'cake', label: 'Cake', benchmarkPhp: 20000, actualPhp: 12000 },
  ]);
  assert.equal(r.totalOverspendPhp, 30000);
  assert.equal(r.totalHeadroomPhp, 8000);
  assert.equal(r.fullyAbsorbable, false);
  assert.equal(r.netOverPhp, 22000);
  // Only 8000 moves; the source is fully drained, never over-drawn.
  assert.equal(r.transfers.reduce((s, t) => s + t.amountPhp, 0), 8000);
});

test('no overspend → hasOverspend false, no transfers', () => {
  const r = computeBudgetOverspend([
    { key: 'a', label: 'A', benchmarkPhp: 10000, actualPhp: 9000 },
    { key: 'b', label: 'B', benchmarkPhp: 10000, actualPhp: 10000 },
  ]);
  assert.equal(r.hasOverspend, false);
  assert.equal(r.transfers.length, 0);
  assert.equal(r.netOverPhp, 0);
});

test('zero/negative benchmark categories are ignored', () => {
  const r = computeBudgetOverspend([
    { key: 'unknown', label: 'No benchmark', benchmarkPhp: 0, actualPhp: 50000 },
    { key: 'photo', label: 'Photography', benchmarkPhp: 40000, actualPhp: 45000 },
  ]);
  // The benchmark-less category neither counts as overspend nor as headroom.
  assert.equal(r.overspent.length, 1);
  assert.equal(r.overspent[0]!.key, 'photo');
  assert.equal(r.totalOverspendPhp, 5000);
});

test('deterministic: same input → same transfer plan', () => {
  const input = [
    { key: 'a', label: 'A', benchmarkPhp: 10000, actualPhp: 15000 },
    { key: 'b', label: 'B', benchmarkPhp: 10000, actualPhp: 7000 },
    { key: 'c', label: 'C', benchmarkPhp: 10000, actualPhp: 8000 },
  ];
  assert.deepEqual(computeBudgetOverspend(input), computeBudgetOverspend(input));
});
