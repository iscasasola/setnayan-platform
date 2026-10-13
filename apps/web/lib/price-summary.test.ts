/**
 * price-summary.test.ts — kind 26 for one booking's payment plan, read by BOTH
 * ends of Suppliers Pair 3: the couple's Pay sheet and the supplier's customer
 * card. Executed over the real plan fold (`computeStepper`), then the two
 * mounts are held to it by source.
 *
 *   · the two viewers get the SAME rows, amounts and states — only words differ;
 *   · a payment the supplier refused is never "paid" and never "waiting" (H4);
 *   · an unresolved amount is words, and the total is then not stated (never ₱0);
 *   · the couple's words never name the booking fee (owner 2026-10-12 #4, #14);
 *   · the supplier answers a logged payment ON the card, posting the card back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeStepper, type PlanInstance } from './vendor-service-payment-schedules';
import { PRICE_BADGE, priceSummaryOf, priceToday } from './price-summary';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));

const inst = (seq: number, label: string, amount_php: number | null, due_date: string | null, extra: Partial<PlanInstance> = {}): PlanInstance => ({
  seq,
  label,
  amount_php,
  due_date,
  amount_kind: 'fixed',
  percent_bps: null,
  ...extra,
});
const PLAN = [inst(1, 'Reservation', 38_000, '2026-10-08'), inst(2, 'Second payment', 76_000, '2026-11-12'), inst(3, 'Balance', 76_000, '2026-12-04')];
const TODAY = '2026-10-10';

test('both ends: the same rows, the same amounts, the same states — only the words turn', () => {
  const steps = computeStepper(PLAN, [
    { schedule_instance_seq: 1, vendor_confirmed: true },
    { schedule_instance_seq: 2, vendor_confirmed: false },
  ]);
  const couple = priceSummaryOf(steps, 'couple', { today: TODAY });
  const supplier = priceSummaryOf(steps, 'supplier', { today: TODAY });
  const shape = (s: typeof couple) => s.rows.map((r) => [r.seq, r.label, r.amountPhp, r.dueDate, r.state, r.badge.tone]);
  assert.deepEqual(shape(couple), shape(supplier));
  assert.deepEqual([couple.totalPhp, couple.paidPhp, couple.leftPhp], [190_000, 38_000, 152_000]);
  assert.deepEqual([supplier.totalPhp, supplier.paidPhp, supplier.leftPhp], [190_000, 38_000, 152_000]);
  assert.deepEqual(couple.rows.map((r) => r.badge.text), ['Paid ✓', 'Waiting for their check', 'Due Dec 4']);
  assert.deepEqual(supplier.rows.map((r) => r.badge.text), ['Received ✓', 'Waiting for you', 'Due Dec 4']);
  assert.equal(supplier.waiting, 1);
});

test('H4: a payment the supplier said never arrived is Due again — never paid, never waiting', () => {
  const steps = computeStepper(PLAN, [{ schedule_instance_seq: 1, vendor_confirmed: false, refused: true }]);
  const s = priceSummaryOf(steps, 'couple', { today: TODAY });
  assert.equal(s.rows[0]!.state, 'due');
  assert.equal(s.rows[0]!.badge.text, 'Was due Oct 8', 'an unpaid, past-due instalment must say so');
  assert.equal(s.rows[0]!.badge.tone, 'late');
  assert.equal(s.paidPhp, 0);
  assert.equal(s.waiting, 0);
});

test('an amount the plan has not resolved is WORDS, and the total is then not stated', () => {
  const steps = computeStepper([inst(1, 'Reservation', 38_000, null), inst(2, 'Balance', null, null, { amount_kind: 'percent', percent_bps: 8000 })], []);
  const s = priceSummaryOf(steps, 'supplier', { today: TODAY });
  assert.equal(s.rows[1]!.amountPhp, null);
  assert.equal(s.rows[1]!.amountWords, '80% of the total');
  assert.equal(s.totalPhp, null, 'a total stated over an amount nobody resolved');
  assert.equal(s.leftPhp, 38_000, 'an unresolved amount was counted as ₱0 owed');
  assert.equal(s.rows[0]!.badge.text, 'Due', 'a due date was invented');
});

test('the order is the plan’s order, and a cleared plan says so', () => {
  // Handed out of order on purpose (a read that returns rows unsorted).
  const sorted = computeStepper(PLAN, []);
  const steps = [sorted[2]!, sorted[0]!, sorted[1]!];
  const s = priceSummaryOf(steps, 'couple', { clearedAt: '2026-12-05T00:00:00Z', today: TODAY });
  assert.deepEqual(s.rows.map((r) => r.seq), [1, 2, 3]);
  assert.equal(s.cleared, true);
});

test('Manila’s day decides "was due" — 23:30 UTC on Oct 8 is already Oct 9 in Manila', () => {
  assert.equal(priceToday(new Date('2026-10-08T23:30:00Z')), '2026-10-09');
});

test('THE FEE NEVER REACHES A COUPLE: no word of it in kind 26’s couple words or the Pay sheet', () => {
  for (const w of Object.values(PRICE_BADGE.couple)) assert.doesNotMatch(w, /fee|setnayan/i);
  for (const rel of ['lib/price-summary.ts', 'app/_components/price-summary.tsx', 'app/dashboard/[eventId]/vendors/_components/pay-sheet.tsx', 'app/dashboard/[eventId]/vendors/_components/booked-budget.tsx']) {
    const src = read(rel);
    assert.doesNotMatch(src, /booking[_ -]?fee|bookingFee|BOOKING_FEE|feeForecast|mintBookingFee/i, `${rel} names the booking fee`);
  }
});

test('ONE fold, two mounts: the Pay sheet and the customer card both draw kind 26 over priceSummaryOf', () => {
  const pay = read('app/dashboard/[eventId]/vendors/_components/pay-sheet.tsx');
  assert.match(pay, /<PriceSummary\b/);
  assert.match(pay, /priceSummaryOf\(state\.data\.plan\.steps, 'couple'/);
  assert.doesNotMatch(pay, /PaymentPlanStepper/, 'a second drawing of the same plan on the couple’s sheet');
  const fold = read('app/vendor-dashboard/clients/[eventId]/_components/customer-money-fold.tsx');
  assert.match(fold, /<PriceSummary\b/);
  assert.match(fold, /priceSummaryOf\(steps, 'supplier'/);
});

test('THE SUPPLIER ANSWERS ON THE CARD: the logged payment is confirmed or refused in place, and the card is redrawn', () => {
  const fold = read('app/vendor-dashboard/clients/[eventId]/_components/customer-money-fold.tsx');
  assert.match(fold, /<PendingPaymentAnswer payment=\{p\} threadId=\{threadId \?\? ''\} returnTo=\{cardPath\} \/>/);
  assert.match(fold, /const cardPath = `\/vendor-dashboard\/clients\/\$\{eventId\}`;/);
  // No second writer: the fold only mounts the thread page's own answer.
  assert.doesNotMatch(fold, /confirm_vendor_payment|refuse_vendor_payment|\.rpc\(|\.insert\(|\.update\(/);
  const card = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(card, /<CustomerMoneyFold\b/);
  assert.match(card, /pending=\{pendingPayments\}/);
  // The Quote tab is handed ONLY what waits on the supplier (H4: a refused payment is Setnayan's).
  assert.match(card, /pendingPayments=\{awaitingPayments\}/);
  assert.doesNotMatch(card, /Log &amp; confirm payments in chat/, 'the card sends the supplier away to answer');

  const live = read('app/vendor-dashboard/messages/[threadId]/_components/vendor-payment-live.tsx');
  assert.match(live, /\{returnTo \? <input type="hidden" name="return_to" value=\{returnTo\} \/> : null\}/);
  const actions = read('app/vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts');
  // Only the bare card path is honoured — the one-shape allowlist, never a free URL.
  assert.match(actions, /const to = lockAnswerReturnTo\(raw\);\s*return to\.startsWith\('\/vendor-dashboard\/clients\/'\) \? to : null;/);
  const confirm = actions.slice(actions.indexOf('export async function confirmVendorPayment('), actions.indexOf('export async function refuseVendorPayment('));
  const refuse = actions.slice(actions.indexOf('export async function refuseVendorPayment('), actions.indexOf('export async function clearVendorPaymentPlan('));
  for (const [name, fn] of [['confirm', confirm], ['refuse', refuse]] as const) {
    assert.match(fn, /const card = payConfirmReturnTo\(formData\.get\('return_to'\)\);\s*if \(card\) revalidatePath\(card\);/, `${name} does not redraw the card it was answered from`);
  }
});
