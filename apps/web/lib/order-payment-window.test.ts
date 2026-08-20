/**
 * order-payment-window.test.ts — the deadline a buyer is given is the deadline
 * that is enforced.
 *
 * ⚠ EVERY ASSERTION IS TIMEZONE-PROOF ON PURPOSE. CI runs in UTC, which is the
 * one clock where this repo's date bugs cancel out — a DATE column once put a
 * 12 December wedding on the 11th for every reader west of Greenwich, and the
 * tests agreed with it because the fixtures were wrong in the same direction.
 * The suite below is run under four zones in CI-equivalent commands, and the
 * deadline sentence is asserted to name a Manila date regardless of the reader.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENT_WINDOW_DAYS,
  PAYMENT_REMINDER_AFTER_DAYS,
  UNPAID_ORDER_STATUSES,
  isCustomerOrder,
  paymentDueAt,
  daysLeftToPay,
  paymentWindowHasClosed,
  paymentDeadlineSentence,
  paymentDeadlineShort,
} from './order-payment-window';

const DAY = 24 * 60 * 60 * 1000;
const placed = new Date('2026-08-20T09:30:00Z');

test('the window is the owner-set fifteen days', () => {
  assert.equal(PAYMENT_WINDOW_DAYS, 15);
  // Halfway, so a nudged buyer still has a full pay cycle to act.
  assert.equal(PAYMENT_REMINDER_AFTER_DAYS, 7);
});

test('the deadline is fifteen days after the order was placed', () => {
  const due = paymentDueAt(placed);
  assert.equal(due.getTime() - placed.getTime(), 15 * DAY);
});

test('the window closes ON the deadline, not a day either side', () => {
  const due = paymentDueAt(placed);
  assert.equal(paymentWindowHasClosed(due, new Date(due.getTime() - 1)), false);
  assert.equal(paymentWindowHasClosed(due, due), true);
  assert.equal(paymentWindowHasClosed(due, new Date(due.getTime() + 1)), true);
});

test('days left counts down and goes negative once it has passed', () => {
  const due = paymentDueAt(placed);
  assert.equal(daysLeftToPay(due, placed), 15);
  assert.equal(daysLeftToPay(due, new Date(placed.getTime() + 14 * DAY)), 1);
  assert.ok(daysLeftToPay(due, new Date(due.getTime() + 2 * DAY)) < 0);
});

test('the sentence a buyer reads is built from the constant, not typed', () => {
  const s = paymentDeadlineSentence(paymentDueAt(placed));
  assert.ok(
    s.includes(String(PAYMENT_WINDOW_DAYS)),
    `the deadline sentence must name the window itself, got: ${s}`,
  );
  // The date it names is the SEPTEMBER 4 deadline, in Manila, whatever zone the
  // reader is in. 20 Aug 09:30Z + 15d = 4 Sep 09:30Z = 4 Sep 17:30 in Manila.
  assert.ok(s.includes('September 4, 2026'), `expected a Manila date, got: ${s}`);
});

test('a deadline late in the Manila day is not reported as the day before', () => {
  // 16:30Z is 00:30 the NEXT day in Manila. A reader in London must still be
  // told the Manila date, because that is the day the business acts on.
  const lateOrder = new Date('2026-08-20T16:30:00Z');
  const s = paymentDeadlineSentence(paymentDueAt(lateOrder));
  assert.ok(s.includes('September 5, 2026'), `expected the Manila day, got: ${s}`);
});

test('the short form never tells somebody they have time when they do not', () => {
  const due = paymentDueAt(placed);
  assert.equal(paymentDeadlineShort(due, placed), '15 days left to pay');
  // Any part of the final 24 hours is "the last day" — including 12 hours out,
  // which a ceiling would otherwise round up to a reassuring "1 day left".
  assert.equal(paymentDeadlineShort(due, new Date(due.getTime() - 1 * DAY)), 'Last day to pay');
  assert.equal(paymentDeadlineShort(due, new Date(due.getTime() - DAY / 2)), 'Last day to pay');
  // The two functions must agree AT the boundary, not one either side of it.
  assert.equal(paymentDeadlineShort(due, due), 'Payment window closed');
  assert.equal(paymentWindowHasClosed(due, due), true);
  assert.equal(
    paymentDeadlineShort(due, new Date(due.getTime() + 5 * DAY)),
    'Payment window closed',
  );
});

test('only orders actually waiting for money are in scope', () => {
  assert.deepEqual([...UNPAID_ORDER_STATUSES], ['submitted', 'awaiting_payment']);
  // A settled, cancelled or lapsed order must never appear here — `lapsed` in
  // particular belongs to the SUBSCRIPTION clock (orders.expires_at), which is
  // a different column and a different meaning.
  for (const settled of ['paid', 'fulfilled', 'cancelled', 'refunded', 'lapsed']) {
    assert.ok(
      !(UNPAID_ORDER_STATUSES as readonly string[]).includes(settled),
      `${settled} must not be swept`,
    );
  }
});

test('vendor orders are deliberately out of scope', () => {
  assert.equal(isCustomerOrder('SETNAYAN_AI'), true);
  assert.equal(isCustomerOrder('PAPIC_CREDITS'), true);
  assert.equal(isCustomerOrder(null), true);
  assert.equal(isCustomerOrder('vendor_pro_weekly'), false);
  assert.equal(isCustomerOrder('vendor_booking_fee'), false);
});
