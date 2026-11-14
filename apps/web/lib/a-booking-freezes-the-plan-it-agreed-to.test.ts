/**
 * PAY-01 (live walk, 14 Nov 2026) — a quote accepted at "20% on lock, balance 14 days before" froze a
 * 50/50 payment plan. The plan must be the quote's own amounts. Fixture is the live prod shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scheduleRowsFromAcceptedQuote } from './accepted-quote-plan';
import { computePlanInstances } from './vendor-service-payment-schedules';

const LIVE_QUOTE = {
  version: 1,
  balances: true,
  installments: [
    { due: 'on_lock', seq: 0, kind: 'percent', label: 'First payment', offset_days: 0, percent_bps: 2000, amount_centavos: 535000, is_downpayment: true, is_auto_balance: false },
    { due: 'before_event', seq: 1, kind: 'auto', label: 'Final balance', offset_days: 14, percent_bps: null, amount_centavos: 2140000, is_downpayment: false, is_auto_balance: true },
  ],
  total_centavos: 2675000,
};

test('the frozen plan carries the quote amounts, not 50/50', () => {
  const rows = scheduleRowsFromAcceptedQuote(LIVE_QUOTE);
  const plan = computePlanInstances({ scheduleRows: rows, totalCostPhp: 26750, lockDateIso: '2026-11-14', eventDateIso: '2027-02-27' });
  assert.deepEqual(plan.map((p) => [p.label, p.amount_php, p.due_date]), [
    ['First payment', 5350, '2026-11-14'],
    ['Final balance', 21400, '2027-02-13'],
  ]);
});

test('no usable quote schedule → nothing, so the caller keeps its own fallback', () => {
  assert.deepEqual(scheduleRowsFromAcceptedQuote({}), []);
  assert.deepEqual(scheduleRowsFromAcceptedQuote(null), []);
  assert.deepEqual(scheduleRowsFromAcceptedQuote({ installments: [] }), []);
});

test('"on the event day" freezes as zero days before', () => {
  const [r] = scheduleRowsFromAcceptedQuote({ installments: [{ seq: 0, due: 'on_event', amount_centavos: 100000, label: 'Day-of' }] });
  assert.equal(r.due_anchor, 'before_event');
  assert.equal(r.due_offset_days, 0);
});

test('the freeze asks the accepted quote BEFORE it seeds the 50/50 estimate', () => {
  const src = readFileSync(join(__dirname, 'booking-payment-plan.server.ts'), 'utf8');
  const ask = src.indexOf('scheduleRowsFromAcceptedQuote(');
  const seed = src.indexOf('defaultPaymentScheduleRows();');
  assert.ok(ask > 0 && seed > 0 && ask < seed, `quote read ${ask} must precede the estimate ${seed}`);
  assert.match(src.slice(ask - 900, ask), /\.eq\('status', 'accepted'\)/);
});
