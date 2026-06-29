/**
 * Setnayan AI snapshot adapter — pure mapping invariants (node:test via tsx).
 *
 * Locks the budget→snapshot mapping that feeds the money guard floor: how line
 * items + payments become payment reminders, and how totals become the budget
 * the over-budget trigger reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  paymentsFromBudget,
  budgetFromTotals,
  type BudgetLineItem,
} from './setnayan-ai-snapshot';

const items: BudgetLineItem[] = [
  { vendorName: 'Bloom Florals', amountPhp: 20000, dueDate: '2026-02-01' },
  { vendorName: 'Bloom Florals', amountPhp: 10000, dueDate: null }, // no due date → not a reminder
  { vendorName: 'Grand Venue', amountPhp: 80000, dueDate: '2026-03-01' },
];

test('paymentsFromBudget: due-dated items become reminders; unpaid while owing', () => {
  const out = paymentsFromBudget(items, 0); // nothing paid
  assert.equal(out.length, 2); // only the two with a due_date
  assert.ok(out.every((p) => p.paid === false));
  assert.deepEqual(
    out.map((p) => p.vendor),
    ['Bloom Florals', 'Grand Venue'],
  );
});

test('paymentsFromBudget: fully-settled event marks everything paid (trigger goes quiet)', () => {
  const out = paymentsFromBudget(items, 110000); // total due = 110000, paid in full
  assert.ok(out.every((p) => p.paid === true));
});

test('paymentsFromBudget: partial payment still leaves items unpaid', () => {
  const out = paymentsFromBudget(items, 20000); // paid less than total due
  assert.ok(out.every((p) => p.paid === false));
});

test('budgetFromTotals: null budget → no budget guard', () => {
  assert.equal(budgetFromTotals(null, items, 0), null);
});

test('budgetFromTotals: committed=paid, pending=rest, topDriver=biggest vendor', () => {
  const b = budgetFromTotals(100000, items, 30000)!;
  assert.equal(b.totalPhp, 100000);
  assert.equal(b.committedPhp, 30000);
  assert.equal(b.pendingPhp, 110000 - 30000); // total due 110000 − paid 30000
  assert.equal(b.topDriverCategory, 'Grand Venue'); // 80000 > Bloom's 30000
});

test('budgetFromTotals: over-budget shape (committed+pending exceeds total)', () => {
  const b = budgetFromTotals(50000, items, 0)!;
  // committed(0) + pending(110000) = 110000 > 50000 → the trigger will fire
  assert.ok(b.committedPhp + b.pendingPhp > b.totalPhp);
});
