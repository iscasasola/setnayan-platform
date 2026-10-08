/**
 * budget-page-view.test.ts — what the Budget page draws, derived from the one
 * resolver (`BUDGET_PAGE_2026-10-08_fable.md`: "summary = sum(list)").
 *
 * Every assertion drives the pure functions over lines built by the REAL
 * `computeEventMoney`, so a change in how the resolver stamps a line (its due
 * date, what is still owed on it) reaches these tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEventMoney, type MoneyInputs } from '@/lib/budget-truth';
import { budgetMeter, pickNextPayment, shortDate } from '@/lib/budget-page-view';

const E = 'e1';
const NOW = new Date('2026-10-01T04:00:00Z');

function money(over: Partial<MoneyInputs>) {
  return computeEventMoney({
    targetCentavos: null,
    vendors: [],
    lineItems: [],
    payments: [],
    orders: [],
    costs: [],
    pricing: new Map(),
    packageLockedCentavos: new Map(),
    benchmarks: [],
    now: NOW,
    ...over,
  });
}

const supplier = (id: string, name: string, status: string, total: number) => ({
  vendor_id: id,
  event_id: E,
  category: 'reception_venue' as never,
  vendor_name: name,
  status: status as never,
  total_cost_php: total,
});

// ── pickNextPayment ────────────────────────────────────────────────────────

test('Next is the earliest dated payment that still has money owed', () => {
  const m = money({
    vendors: [supplier('sv', 'Seda Vertis North', 'contracted', 1_056_000)],
    lineItems: [
      { line_item_id: 'a', vendor_id: 'sv', label: 'Reservation', amount_php: 105_600, due_date: '2026-08-02' },
      { line_item_id: 'b', vendor_id: 'sv', label: 'Second', amount_php: 528_000, due_date: '2026-10-05' },
      { line_item_id: 'c', vendor_id: 'sv', label: 'Balance', amount_php: 422_400, due_date: '2026-12-04' },
    ],
    payments: [{ payment_id: 'p', vendor_id: 'sv', line_item_id: 'a', amount_php: 105_600, paid_at: '2026-08-02T00:00:00Z' }],
  });
  assert.deepEqual(pickNextPayment(m.lines), {
    amountPhp: 528_000,
    name: 'Seda Vertis North',
    dueDate: '2026-10-05',
    vendorId: 'sv',
  });
});

test('a paid-up milestone is skipped even though its date is the earliest', () => {
  const m = money({
    vendors: [supplier('sv', 'Seda', 'contracted', 200)],
    lineItems: [
      { line_item_id: 'a', vendor_id: 'sv', label: 'First', amount_php: 100, due_date: '2026-09-01' },
      { line_item_id: 'b', vendor_id: 'sv', label: 'Second', amount_php: 100, due_date: '2026-11-01' },
    ],
    payments: [{ payment_id: 'p', vendor_id: 'sv', line_item_id: 'a', amount_php: 100, paid_at: '2026-09-01T00:00:00Z' }],
  });
  assert.equal(pickNextPayment(m.lines)?.dueDate, '2026-11-01');
});

test('an OVERDUE payment is still the next thing to pay', () => {
  const m = money({
    vendors: [supplier('sv', 'Seda', 'contracted', 300)],
    lineItems: [
      { line_item_id: 'a', vendor_id: 'sv', label: 'Missed', amount_php: 100, due_date: '2026-09-15' },
      { line_item_id: 'b', vendor_id: 'sv', label: 'Later', amount_php: 200, due_date: '2026-12-01' },
    ],
  });
  assert.equal(pickNextPayment(m.lines)?.dueDate, '2026-09-15');
});

test('a supplier nobody booked can never be the Next payment', () => {
  // BA2 — "we only add the finalized budgets". A shortlisted supplier's dated
  // line is shopping, not a payment the couple agreed to make.
  const m = money({
    vendors: [supplier('q', 'Still deciding', 'shortlisted', 80_000)],
    lineItems: [{ line_item_id: 'a', vendor_id: 'q', label: 'Quote', amount_php: 80_000, due_date: '2026-10-02' }],
  });
  assert.equal(pickNextPayment(m.lines), null);
});

test('a dated cost with no supplier is named by its own label', () => {
  const m = money({
    costs: [{ cost_id: 'c', plan_group_id: null, label: 'Marriage licence', amount_php: 500, paid_php: 0, due_date: '2026-10-20' }],
  });
  assert.deepEqual(pickNextPayment(m.lines), {
    amountPhp: 500,
    name: 'Marriage licence',
    dueDate: '2026-10-20',
    vendorId: null,
  });
});

test('nothing dated and owed → no Next line at all (never "₱0 due")', () => {
  assert.equal(pickNextPayment(money({}).lines), null);
  const undated = money({ vendors: [supplier('sv', 'Seda', 'contracted', 100)] });
  assert.equal(pickNextPayment(undated.lines), null);
});

// ── budgetMeter ────────────────────────────────────────────────────────────

test("the meter reproduces the prototype's proportions", () => {
  const m = budgetMeter({ targetPhp: 2_250_000, agreedPhp: 1_189_397, paidPhp: 194_997 });
  assert.equal(Math.round(m.agreedPct * 10) / 10, 52.9);
  assert.equal(Math.round(m.paidPct * 10) / 10, 8.7);
  assert.equal(m.overPct, 0);
});

test('over target: the bar fills its track and the red tail is the overshoot, to scale', () => {
  const m = budgetMeter({ targetPhp: 1_000_000, agreedPhp: 1_250_000, paidPhp: 250_000 });
  assert.equal(m.agreedPct, 100);
  assert.equal(m.overPct, 20);
  assert.equal(m.paidPct, 20);
});

test('no target: agreed is the whole track, and nothing is called "over"', () => {
  const m = budgetMeter({ targetPhp: null, agreedPhp: 400, paidPhp: 100 });
  assert.equal(m.agreedPct, 100);
  assert.equal(m.paidPct, 25);
  assert.equal(m.overPct, 0);
});

test('an UNKNOWN figure draws no bar — a bar at 0% would be a claim', () => {
  assert.deepEqual(budgetMeter({ targetPhp: 2_250_000, agreedPhp: null, paidPhp: null }), {
    agreedPct: 0,
    paidPct: 0,
    overPct: 0,
  });
});

test('shortDate prints the month and day, no year', () => {
  assert.equal(shortDate('2026-10-05'), 'Oct 5');
  assert.equal(shortDate('2026-12-04T00:00:00Z'), 'Dec 4');
});
