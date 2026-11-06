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
import {
  budgetMeter,
  buildBudgetList,
  firstTwoLetters,
  initialsOf,
  pickNextPayment,
  shortDate,
  suggestedPayment,
} from '@/lib/budget-page-view';

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
  category: 'venue' as never,
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
    costId: null,
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
    costId: 'c',
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

// ═══ the one list (plan row B2) ════════════════════════════════════════════

/** A ledger with every kind of row the list must place — and several it must refuse. */
function fullLedger(over: Partial<MoneyInputs> = {}) {
  return money({
    targetCentavos: 225_000_000,
    vendors: [
      supplier('sv', 'Seda Vertis North', 'contracted', 1_056_000),
      { ...supplier('sd', 'Santuario de San Vicente de Paul', 'deposit_paid', 26_499), category: 'religious_venue' as never },
      // Shopping, not budget: must appear NOWHERE in the list.
      supplier('q', 'Still deciding', 'shortlisted', 80_000),
    ],
    lineItems: [
      { line_item_id: 'c', vendor_id: 'sv', label: 'Balance', amount_php: 422_400, due_date: '2026-12-04' },
      { line_item_id: 'a', vendor_id: 'sv', label: 'Reservation', amount_php: 105_600, due_date: '2026-08-02' },
      { line_item_id: 'b', vendor_id: 'sv', label: 'Second payment', amount_php: 528_000, due_date: '2026-10-05' },
    ],
    payments: [
      { payment_id: 'p1', vendor_id: 'sv', line_item_id: 'a', amount_php: 105_600, paid_at: '2026-08-02T03:00:00Z' },
      { payment_id: 'p2', vendor_id: 'sd', line_item_id: null, amount_php: 26_499, paid_at: '2026-07-21T03:00:00Z' },
    ],
    orders: [
      // Placed at 01:00 on Sep 14 in Manila — which is still Sep 13 in UTC.
      { order_id: 'o1', description: 'Event Hub Pro', service_key: 'EVENT_HUB_PRO', requested_total_php: 2_499, confirmed_total_php: 2_499, status: 'paid', created_at: '2026-09-13T17:00:00Z' },
      { order_id: 'o3', description: 'Live Watch', service_key: 'LIVE_WATCH', requested_total_php: 2_500, confirmed_total_php: 2_500, status: 'awaiting_payment', created_at: '2026-09-30T03:00:00Z' },
      // Applied for, not approved: an estimate. Not in the list.
      { order_id: 'o4', description: 'Papic', service_key: 'PAPIC', requested_total_php: 2_899, confirmed_total_php: null, status: 'submitted', created_at: '2026-09-29T03:00:00Z' },
      // The SUPPLIER's booking fee, stamped with the couple's event. Never theirs.
      { order_id: 'o5', description: 'Booking fee', service_key: 'vendor_booking_fee', requested_total_php: 5_000, confirmed_total_php: 5_000, status: 'paid', created_at: '2026-09-01T03:00:00Z' },
      { order_id: 'o6', description: 'Cancelled thing', service_key: 'X', requested_total_php: 900, confirmed_total_php: 900, status: 'cancelled', created_at: '2026-09-02T03:00:00Z' },
    ],
    costs: [
      { cost_id: 'e1', plan_group_id: 'ceremony_venue', label: 'Church offering', amount_php: 15_000, paid_php: 15_000, due_date: null },
      { cost_id: 'e2', plan_group_id: 'other', label: 'Entourage gowns', amount_php: 84_000.5, paid_php: 40_000, due_date: null },
    ],
    ...over,
  });
}

const sum = (ns: number[]) => Math.round(ns.reduce((a, n) => a + n * 100, 0)) / 100;

test('SUMMARY = SUM(LIST): the rows add up to exactly what the resolver reports', () => {
  const m = fullLedger();
  const list = buildBudgetList(m);
  assert.ok(list.suppliers && list.orders && list.expenses, 'every group answered');
  const agreed = sum([
    ...list.suppliers.map((r) => r.agreedPhp),
    ...list.orders.map((r) => r.amountPhp),
    ...list.expenses.map((r) => r.amountPhp),
  ]);
  const owed = sum([
    ...list.suppliers.map((r) => r.owedPhp),
    ...list.orders.map((r) => r.owedPhp),
    ...list.expenses.map((r) => r.owedPhp),
  ]);
  const paid = sum([
    ...list.suppliers.map((r) => r.paidPhp),
    ...list.orders.map((r) => r.amountPhp - r.owedPhp),
    ...list.expenses.map((r) => r.paidPhp),
  ]);
  assert.equal(agreed, m.committed, 'Σ agreed down the list must be the Agreed figure above it');
  assert.equal(owed, m.stillOwed, 'Σ owed down the list must be the Owed figure above it');
  assert.equal(paid, m.paid, 'Σ paid down the list must be the Paid figure above it');
  assert.ok(m.committed > 1_000_000, 'the fixture really carries money — an empty ledger would pass this for free');
});

test('booked suppliers: one row each, agreed · paid · owed, and nobody who is only being considered', () => {
  const { suppliers } = buildBudgetList(fullLedger());
  assert.deepEqual(
    suppliers!.map((s) => [s.name, s.initials, s.service, s.agreedPhp, s.paidPhp, s.owedPhp, s.status]),
    [
      ['Seda Vertis North', 'SV', 'Reception venue', 1_056_000, 105_600, 950_400, 'owing'],
      ['Santuario de San Vicente de Paul', 'SD', 'Ceremony venue', 26_499, 26_499, 0, 'paid'],
    ],
  );
  assert.equal(suppliers!.some((s) => s.name === 'Still deciding'), false, 'a shortlisted supplier is shopping, not budget (BA2)');
});

test("a supplier's dues are its dated payments still owed, earliest first — the paid one is gone", () => {
  const sv = buildBudgetList(fullLedger()).suppliers!.find((s) => s.vendorId === 'sv')!;
  assert.deepEqual(
    sv.dues.map((d) => [d.dueDate, d.amountPhp]),
    [
      ['2026-10-05', 528_000],
      ['2026-12-04', 422_400],
    ],
  );
  assert.deepEqual(suggestedPayment(sv), { amountPhp: 528_000, dueDate: '2026-10-05' }, 'Record a payment pre-fills the next due');
});

test('Record a payment pre-fills what is owed when nothing is dated, and nothing when paid up', () => {
  assert.deepEqual(suggestedPayment({ dues: [], owedPhp: 12_000 }), { amountPhp: 12_000, dueDate: null });
  assert.equal(suggestedPayment({ dues: [], owedPhp: 0 }), null, 'a form pre-filled with ₱0 invites a ₱0 payment');
});

test('bought on Setnayan: paid and awaiting-payment orders only, dated by the day they were placed', () => {
  const { orders } = buildBudgetList(fullLedger());
  assert.deepEqual(
    orders!.map((o) => [o.name, o.bookedOn, o.amountPhp, o.owedPhp, o.status]),
    [
      ['Event Hub Pro', '2026-09-14', 2_499, 0, 'paid'],
      ['Live Watch', '2026-09-30', 2_500, 2_500, 'owing'],
    ],
    'submitted (an estimate), cancelled, and the supplier-paid booking fee must not appear; ' +
      'and 2026-09-13T17:00Z is Sep 14 on the couple\'s calendar',
  );
});

test('your expenses: named by two letters, filed under a category or under none', () => {
  const { expenses } = buildBudgetList(fullLedger());
  assert.deepEqual(
    expenses!.map((e) => [e.name, e.initials, e.category, e.amountPhp, e.paidPhp, e.owedPhp, e.status]),
    [
      ['Church offering', 'CH', 'Ceremony venue', 15_000, 15_000, 0, 'paid'],
      ['Entourage gowns', 'EN', null, 84_000.5, 40_000, 44_000.5, 'owing'],
    ],
    '"Other" is no category — the row prints none; and centavos survive',
  );
});

test('A REFUSED GROUP IS null — never an empty array that reads "you have none"', () => {
  const refused = buildBudgetList(fullLedger({ orders: [], reads: { suppliers: 'ok', orders: 'failed', costs: 'ok' } }));
  assert.equal(refused.orders, null, 'a refused orders read must be UNKNOWN');
  assert.equal(refused.suppliers!.length, 2, 'the groups that answered are still drawn');
  assert.equal(refused.expenses!.length, 2);

  const genuine = buildBudgetList(fullLedger({ orders: [] }));
  assert.deepEqual(genuine.orders, [], 'a real "bought nothing" is a fact, and is an empty list');
  assert.notDeepEqual(refused.orders, genuine.orders, 'the two must be told apart — that is the whole point');

  const nothing = buildBudgetList(fullLedger({ reads: { suppliers: 'failed', orders: 'failed', costs: 'failed' } }));
  assert.deepEqual(nothing, { suppliers: null, orders: null, expenses: null });
});

test('initials never come back empty', () => {
  assert.equal(initialsOf('Seda Vertis North'), 'SV');
  assert.equal(initialsOf('catering'), 'CA');
  assert.equal(initialsOf('   '), '·');
  assert.equal(firstTwoLetters('Church offering'), 'CH');
  assert.equal(firstTwoLetters(''), '·');
});
