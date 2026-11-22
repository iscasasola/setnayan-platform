/**
 * lib/your-booking.test.ts — 🧾 THE SUPPLIER'S "YOUR BOOKING" ON DETAILS (owner 21 Nov 2026, DECISION_LOG "SUPPLIER
 * EVENT DETAILS — 'Budget' = their own booking money only"; controller 22 Nov: never the hosts' plan, switch or not).
 *
 *   1. Price · Paid · Left are the Payment page's own figures (`clientPaymentView`) — one fold, two places.
 *   2. Status is said in the plan's own words: Due · Was due (overdue) · Waiting for you · All paid.
 *   3. A figure nobody measured is "—" and SAID — never ₱0, never "All paid" with no amount set.
 *   4. The hosts' planned amount is never drawn on Details — not while they share it, and no hint that it exists.
 *   5. The card stands where "Budget" stood, booked only, and opens the shipped Payment page — no second money screen.
 *
 * SABOTAGE (each run once, each went red): `next` built from a second computation → 1; "All paid" allowed with
 * `agreedPhp` null → 3; the card given a `planned` line fed from `brief.budget_band` → 4; the card drawn before a booking → 5.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './strip-comments';
import { join } from 'node:path';

import { clientPaymentView } from './client-payment-view';
import { PRICE_BADGE } from './price-summary';
import type { StepperInstallment } from './vendor-service-payment-schedules';
import {
  YOUR_BOOKING_ALL_PAID,
  YOUR_BOOKING_COVERS_UNREAD,
  YOUR_BOOKING_NO_AMOUNT,
  YOUR_BOOKING_UNREAD,
  coversLine,
  yourBookingView,
} from './your-booking';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const peso = (php: number) => `₱${php.toLocaleString('en-PH')}`;
const NO_LEDGER = { rows: [], receivedPhp: 0, expectedPhp: 0 };
const TODAY = '2026-11-22';

// The same fixture shape `client-payment-view.test.ts` uses.
const step = (seq: number, label: string, amount: number | null, due: string | null, state: StepperInstallment['state']): StepperInstallment =>
  ({ seq, label, amount_php: amount, due_date: due, amount_kind: 'fixed', percent_bps: null, state }) as StepperInstallment;
const PLAN = [
  step(1, 'Downpayment', 84_000, '2026-10-01', 'paid'),
  step(2, 'Second payment', 98_000, '2026-11-27', 'due'),
  step(3, 'Balance', 98_000, '2026-12-05', 'due'),
];
const payOf = (steps: StepperInstallment[] | null, extra: Partial<Parameters<typeof clientPaymentView>[0]> = {}) =>
  clientPaymentView({ steps, clearedAt: null, ledgerMoney: NO_LEDGER as never, ledgerUnreadable: false, today: TODAY, ...extra });
const base = { quoteLines: undefined, peso } as const;

test('1 · Price · Paid · Left are the Payment page’s own figures', () => {
  const pay = payOf(PLAN);
  const v = yourBookingView({ ...base, pay });
  assert.deepEqual(v.figures.map((f) => [f.label, f.value]), [['Price', '₱280,000'], ['Paid', '₱84,000'], ['Left', '₱196,000']]);
  // The same numbers the Payment page holds — never a second sum.
  assert.equal(v.figures[0]!.value, peso(pay.agreedPhp!));
  assert.equal(v.figures[2]!.value, peso(pay.collectPhp!));
  assert.equal(v.note, null);
});

test('2 · the status is the plan’s own words — due, overdue, waiting for you, all paid', () => {
  const due = yourBookingView({ ...base, pay: payOf(PLAN) });
  assert.equal(due.next?.line, 'Next: Second payment · ₱98,000');
  assert.equal(due.next?.status, payOf(PLAN).next!.dueText);
  assert.match(due.next!.status, /^Due /);
  assert.equal(due.next?.tone, 'soft');

  const late = yourBookingView({ ...base, pay: payOf([PLAN[0]!, step(2, 'Second payment', 98_000, '2026-11-13', 'due'), PLAN[2]!]) });
  assert.match(late.next!.status, /^Was due /);
  assert.equal(late.next?.tone, 'late');

  const waiting = yourBookingView({ ...base, pay: payOf([PLAN[0]!, step(2, 'Second payment', 98_000, '2026-11-27', 'pending'), PLAN[2]!]) });
  assert.equal(waiting.next?.status, PRICE_BADGE.supplier.pending);
  assert.equal(waiting.next?.tone, 'warn');

  const paid = yourBookingView({ ...base, pay: payOf(PLAN.map((s) => ({ ...s, state: 'paid' as const }))) });
  assert.equal(paid.next?.line, YOUR_BOOKING_ALL_PAID);
  assert.equal(paid.next?.tone, 'ok');
  assert.equal(paid.figures[2]!.value, '₱0');
});

test('3 · a figure nobody measured is "—" and said — never ₱0, never "All paid" with no amount', () => {
  const unread = yourBookingView({ ...base, pay: payOf(null, { ledgerUnreadable: true }) });
  assert.deepEqual(unread.figures.map((f) => f.value), ['—', '—', '—']);
  assert.equal(unread.note, YOUR_BOOKING_UNREAD);
  assert.equal(unread.next, null);

  const nothing = yourBookingView({ ...base, pay: payOf(null) });
  assert.deepEqual(nothing.figures.map((f) => f.value), ['—', '—', '—']);
  assert.equal(nothing.note, YOUR_BOOKING_NO_AMOUNT);
  assert.equal(nothing.next, null, 'nothing owed because nothing was set is not "All paid"');

  // An amount not set yet: no honest total; what is left is a floor.
  const open = yourBookingView({ ...base, pay: payOf([PLAN[0]!, PLAN[1]!, step(3, 'Balance', null, null, 'due')]) });
  assert.equal(open.figures[0]!.value, '—');
  assert.match(open.figures[2]!.value, /\+$/);
  assert.notEqual(open.next?.line, YOUR_BOOKING_ALL_PAID);

  // The quotation: refused read is said; none on record draws no line; its own line names, capped.
  assert.equal(yourBookingView({ ...base, pay: payOf(PLAN), quoteLines: null }).covers, YOUR_BOOKING_COVERS_UNREAD);
  assert.equal(yourBookingView({ ...base, pay: payOf(PLAN), quoteLines: undefined }).covers, null);
  assert.equal(coversLine(['Catering', ' Dessert table ', '', 'Coffee cart', 'Grazing', 'Staff']), 'Catering · Dessert table · Coffee cart +2 more');
  assert.equal(coversLine([]), null);
});

test('4 · the hosts’ planned amount is never drawn on Details — shared or not, and no hint of it', () => {
  // The view has no field for it: only the supplier's own booking money can reach the card.
  assert.deepEqual(Object.keys(yourBookingView({ ...base, pay: payOf(PLAN) })).sort(), ['covers', 'figures', 'next', 'note']);
  const PAGE = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  const CARD = stripComments(read('app/vendor-dashboard/clients/[eventId]/_components/your-booking-card.tsx'));
  const LIB = stripComments(read('lib/your-booking.ts'));
  assert.doesNotMatch(CARD, /planned|budget_band|Not shared|not shared/i);
  assert.doesNotMatch(LIB, /planned|budget_band/i);
  // The old card said "Not shared — the couple hasn't opted into budget sharing": a hint. Gone from the supplier side.
  assert.doesNotMatch(PAGE, /opted into budget sharing|Not shared —|data-hosts-planned/);
  // Where "Budget" stood there is the booking card or nothing — no branch draws the hosts' range in its place.
  const slot = PAGE.slice(PAGE.indexOf('{isBooked && yourBooking ? ('));
  const card = slot.slice(0, slot.indexOf(') : null}') + 9);
  assert.ok(card.length > 50 && card.length < 900, 'the Your booking slot was found');
  assert.doesNotMatch(card, /budget_band/);
});

test('5 · the card stands where "Budget" stood, booked only, view only, and opens the shipped Payment page', () => {
  const PAGE = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  const CARD = read('app/vendor-dashboard/clients/[eventId]/_components/your-booking-card.tsx');
  assert.match(PAGE, /\{isBooked && yourBooking \? \(\s*<Card>\s*<YourBookingCard eventId=\{eventId\} view=\{yourBooking\} \/>/);
  // Folded ONCE on the page (before `overviewNode`, which is drawn eagerly) and handed to the Details tab.
  assert.match(PAGE, /const yourBooking = stripPay\s*\?\s*yourBookingView\(\{/);
  assert.ok(PAGE.indexOf('const yourBooking = stripPay') < PAGE.indexOf('const overviewNode = ('), 'the view is built before the Details node that draws it');
  assert.match(PAGE, /yourBooking=\{yourBooking\}/);
  assert.match(PAGE, /pay: stripPay,/, 'the figures are the Payment page’s own view — no second read');
  assert.doesNotMatch(PAGE, /<Wallet aria-hidden className="h-4 w-4 text-terracotta" \/> Budget/);
  // One door, to the shipped page: switched in place, or its own address with no script.
  assert.match(CARD, /nav\.select\('payments'\)/);
  assert.match(CARD, /customerCardHref\(eventId, 'payments'\)/);
  // A refused quotes read is said as a sentence of its own — never "Covers: couldn't load".
  assert.match(CARD, /view\.covers === YOUR_BOOKING_COVERS_UNREAD \? \(/);
  // View only: no form, no input, no action in the card.
  assert.doesNotMatch(CARD, /<form\b|<input\b|action=|useActionState|'use server'/);
});
