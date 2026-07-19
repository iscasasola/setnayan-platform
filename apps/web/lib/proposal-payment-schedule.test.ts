/**
 * Unit suite for the self-balancing proposal payment schedule resolver.
 *
 * The whole point: the plan must ALWAYS pay to ₱0 — Σ(raw installments) =
 * base_centavos exactly, and after the crew-meal credit Σ(amount) = base −
 * credit (the net). No non-zero residual, no negative amount, and the
 * downpayment (seq 0 / the lock) is never eaten by the credit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSchedule,
  sanitizeAndResolveSchedule,
  type InstallmentDraft,
  type AutoBalanceMeta,
} from './proposal-payment-schedule';

const AB: AutoBalanceMeta = { label: 'Final balance', due: 'before_event', offsetDays: 14 };

const fixed = (label: string, php: number): InstallmentDraft => ({
  label,
  kind: 'fixed',
  amountPhp: php,
  percent: null,
  due: 'on_lock',
  offsetDays: 0,
});
const pct = (label: string, percent: number): InstallmentDraft => ({
  label,
  kind: 'percent',
  amountPhp: null,
  percent,
  due: 'on_lock',
  offsetDays: 0,
});

const sumRaw = (s: ReturnType<typeof resolveSchedule>) =>
  s.installments.reduce((a, r) => a + r.raw_centavos, 0);
const sumPost = (s: ReturnType<typeof resolveSchedule>) =>
  s.installments.reduce((a, r) => a + r.amount_centavos, 0);
const noNegatives = (s: ReturnType<typeof resolveSchedule>) =>
  s.installments.every((r) => r.amount_centavos >= 0 && r.raw_centavos >= 0);

// base ₱8,300 = 830000 centavos throughout (arbitrary but non-round-ish).
const BASE = 830000;

test('fixed downpayment + auto balance pays to ₱0 (no credit)', () => {
  const s = resolveSchedule({ manual: [fixed('First payment', 2000)], autoBalance: AB, baseCentavos: BASE, creditCentavos: 0 });
  assert.equal(s.installments.length, 2);
  assert.equal(s.installments[0]!.is_downpayment, true);
  assert.equal(s.installments[1]!.is_auto_balance, true);
  assert.equal(sumRaw(s), BASE, 'raw sums to base exactly');
  assert.equal(sumPost(s), BASE, 'no credit → post = base');
  assert.equal(s.balances, true);
  assert.equal(s.over_by_centavos, 0);
  assert.equal(s.credit_over_centavos, 0);
  assert.ok(noNegatives(s));
});

test('percent downpayment resolves against base and balances', () => {
  const s = resolveSchedule({ manual: [pct('Downpayment', 20)], autoBalance: AB, baseCentavos: BASE, creditCentavos: 0 });
  assert.equal(s.installments[0]!.amount_centavos, Math.round(BASE * 0.2)); // 166000
  assert.equal(s.installments[0]!.percent_bps, 2000);
  assert.equal(sumRaw(s), BASE);
  assert.equal(s.balances, true);
});

test('crew credit ≤ auto balance: reduces final, downpayment whole, post = net', () => {
  const credit = 175000;
  const s = resolveSchedule({ manual: [fixed('First payment', 2000)], autoBalance: AB, baseCentavos: BASE, creditCentavos: credit });
  assert.equal(s.installments[0]!.amount_centavos, 200000, 'downpayment untouched by credit');
  assert.equal(s.installments[0]!.credit_applied_centavos, 0);
  const finalRow = s.installments[s.installments.length - 1]!;
  assert.equal(finalRow.credit_applied_centavos, credit);
  assert.equal(sumRaw(s), BASE, 'raw still balances to base');
  assert.equal(sumPost(s), BASE - credit, 'net = base − credit');
  assert.equal(s.balances, true);
  assert.ok(noNegatives(s));
});

test('credit spanning multiple tail rows cascades up but never hits the downpayment', () => {
  // downpayment 200000, two middle 100000 each, auto balance = 430000. base 830000.
  const manual = [fixed('Down', 2000), fixed('P2', 1000), fixed('P3', 1000)];
  const credit = 500000; // 5000 pesos → eats auto (430000) + 70000 of P3
  const s = resolveSchedule({ manual, autoBalance: AB, baseCentavos: BASE, creditCentavos: credit });
  assert.equal(s.installments[0]!.amount_centavos, 200000, 'downpayment stays whole');
  assert.equal(s.installments[0]!.credit_applied_centavos, 0);
  assert.equal(sumPost(s), BASE - credit); // 330000
  assert.equal(s.credit_over_centavos, 0);
  assert.equal(s.balances, true);
  assert.ok(noNegatives(s));
});

test('credit exceeding everything-but-downpayment flags over, protects the lock', () => {
  // Only the downpayment covers the whole base (100%), so tail = [] (no auto row).
  const s = resolveSchedule({ manual: [pct('Full upfront', 100)], autoBalance: AB, baseCentavos: BASE, creditCentavos: 175000 });
  assert.equal(s.installments.length, 1);
  assert.equal(s.installments[0]!.amount_centavos, BASE, 'downpayment NOT eaten by the credit');
  assert.equal(s.credit_over_centavos, 175000);
  assert.equal(s.balances, false, 'flagged — trim a payment');
  assert.ok(noNegatives(s));
});

test('over-cover (manual exceeds base) flags over_by and appends no auto row', () => {
  const s = resolveSchedule({ manual: [fixed('Down', 5000), fixed('P2', 5000)], autoBalance: AB, baseCentavos: BASE, creditCentavos: 0 });
  assert.equal(s.over_by_centavos, 1000000 - BASE); // 170000
  assert.equal(s.balances, false);
  assert.ok(!s.installments.some((r) => r.is_auto_balance), 'no auto balance when over');
});

test('mixed fixed + percent installments land exactly on base (no residual)', () => {
  // 20% downpayment (166000) + fixed 3000 (300000) + auto balance (364000) = 830000.
  const manual = [pct('Down', 20), fixed('Mid', 3000)];
  const s = resolveSchedule({ manual, autoBalance: AB, baseCentavos: BASE, creditCentavos: 0 });
  assert.equal(sumRaw(s), BASE, 'exact — no rounding residual');
  assert.equal(s.balances, true);
});

test('materializing the balance is net-stable (add-payment idempotence)', () => {
  const credit = 175000;
  const before = resolveSchedule({ manual: [fixed('First payment', 2000)], autoBalance: AB, baseCentavos: BASE, creditCentavos: credit });
  const finalRow = before.installments[before.installments.length - 1]!;
  // "Add payment" materializes the displayed (post-credit) balance as a new fixed row.
  const materialized = fixed('Second payment', finalRow.amount_centavos / 100);
  const after = resolveSchedule({
    manual: [fixed('First payment', 2000), materialized],
    autoBalance: AB,
    baseCentavos: BASE,
    creditCentavos: credit,
  });
  assert.equal(sumPost(after), BASE - credit, 'net unchanged after materialize');
  assert.equal(after.installments[0]!.amount_centavos, 200000, 'downpayment unchanged');
  assert.ok(noNegatives(after));
});

test('sanitizeAndResolveSchedule coerces junk + returns null on no installments', () => {
  assert.equal(sanitizeAndResolveSchedule(null), null);
  assert.equal(sanitizeAndResolveSchedule({ manual: [] }), null);
  const s = sanitizeAndResolveSchedule({
    manual: [{ label: 'x', kind: 'percent', percent: '20', due: 'weird', offsetDays: -3 }],
    autoBalance: { label: '', due: 'on_event', offsetDays: 2 },
    baseCentavos: '830000',
    creditCentavos: 'abc',
  });
  assert.ok(s);
  assert.equal(s!.installments[0]!.percent_bps, 2000, 'string percent coerced');
  assert.equal(s!.installments[0]!.due, 'on_lock', 'bad due normalized');
  assert.equal(s!.credit_centavos, 0, 'NaN credit → 0');
  assert.equal(sumRaw(s!), 830000);
});

test('degenerate empty base never throws and yields ₱0 plan', () => {
  const s = resolveSchedule({ manual: [fixed('Down', 0)], autoBalance: AB, baseCentavos: 0, creditCentavos: 0 });
  assert.equal(sumPost(s), 0);
  assert.equal(s.balances, true);
});
