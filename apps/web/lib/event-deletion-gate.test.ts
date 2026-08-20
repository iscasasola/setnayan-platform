/**
 * Guard suite for the two decisions behind removing a celebration.
 *
 * These are the only parts of `deleteOwnEvent` that decide anything; the rest
 * is I/O. Both are tested for the direction that COSTS — a delete wrongly
 * allowed — not just the happy path.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  BOOKED_VENDOR_STATUSES,
  SETTLED_ORDER_STATUSES,
  confirmationMatches,
  deletionIsBlocked,
  supplierIsReleased,
  supplierWasPaid,
} from './event-deletion-gate';

/** Nothing anywhere — the only shape that may be deleted. */
const CLEAR = {
  settledOrders: 0,
  paymentRows: 0,
  receiptRows: 0,
  unsettledPaidSuppliers: 0,
};

test('the money gate fails CLOSED on an unmeasured read — on EVERY signal', () => {
  // 🔒 THE ONE THAT MATTERS. `null` is "we could not check", and the safe
  // answer to that is no. All three must fail closed independently: an
  // unreadable payments table is exactly as blinding as an unreadable orders
  // table, and a gate that only guards its first input is a gate with one hinge.
  assert.equal(deletionIsBlocked({ ...CLEAR, settledOrders: null }), true);
  assert.equal(deletionIsBlocked({ ...CLEAR, paymentRows: null }), true);
  assert.equal(deletionIsBlocked({ ...CLEAR, receiptRows: null }), true);
  assert.equal(
    deletionIsBlocked({ ...CLEAR, unsettledPaidSuppliers: null }),
    true,
  );
});

test('the money gate refuses when anything has been paid for', () => {
  assert.equal(deletionIsBlocked({ ...CLEAR, settledOrders: 1 }), true);
  assert.equal(deletionIsBlocked({ ...CLEAR, settledOrders: 12 }), true);
});

test('a cancelled-after-paid order STILL blocks, via its payment row', () => {
  // 🚨 THE BYPASS THIS FILE SHIPPED WITH. `cancelOrder` writes
  // status='cancelled' with no check on the status it leaves, and the RLS guard
  // behind it only constrains the NEW value — so a couple could cancel a PAID
  // order and walk the event past a status-only gate.
  //
  // The order now reads 'cancelled', so settledOrders is 0 and the old gate
  // said "go ahead". The payment row is what a couple cannot rewrite.
  assert.equal(
    deletionIsBlocked({ ...CLEAR, paymentRows: 1 }),
    true,
  );
});

test('a BIR receipt blocks on its own, whatever the order says', () => {
  // A sequential official-receipt serial. Deleting the celebration it belongs
  // to is not the couple's call, and no status flip may unlock it.
  assert.equal(
    deletionIsBlocked({ ...CLEAR, receiptRows: 1 }),
    true,
  );
});

test('the money gate allows when no money has moved anywhere', () => {
  // Prod today: every event has 0 settled orders, 0 payments, 0 receipts.
  assert.equal(deletionIsBlocked(CLEAR), false);
});

test('`lapsed` counts as money moved — it is only reachable from paid', () => {
  // lib/subscriptions.ts is the sole writer of 'lapsed' and it filters
  // `.eq('status','paid')`, so a lapsed order IS a paid order whose service
  // later expired. Omitting it let a once-paid celebration — possibly carrying
  // a receipt — be deleted by pressing a button.
  assert.ok(SETTLED_ORDER_STATUSES.includes('lapsed'));
});

test('a refund still counts as money moved', () => {
  // Not a behaviour of the function — a property of the STATUS LIST it is fed.
  // A refunded order is a record of money that moved and came back; it is still
  // a receipt somebody may need.
  assert.ok(SETTLED_ORDER_STATUSES.includes('refunded'));
  assert.ok(SETTLED_ORDER_STATUSES.includes('paid'));
  assert.ok(SETTLED_ORDER_STATUSES.includes('fulfilled'));
});

test('the settled list never counts intent as payment', () => {
  // `submitted` / `awaiting_payment` / `draft` are somebody having STARTED a
  // purchase. Prod holds exactly one such row — the owner's own unpaid ₱499
  // test order — and blocking on it would refuse the delete of a test event
  // that nobody has paid a peso for.
  for (const notMoney of [
    'draft',
    'submitted',
    'awaiting_payment',
    'cancelled',
  ]) {
    assert.ok(
      !(SETTLED_ORDER_STATUSES as readonly string[]).includes(notMoney),
      `${notMoney} is intent, not money`,
    );
  }
});

test('booked suppliers exclude the ones merely being considered', () => {
  // 32 of prod's 45 supplier rows are `considering` — a name typed into a list.
  // Counting those as "booked suppliers you will lose" would make the warning
  // frightening and wrong.
  for (const notBooked of ['considering', 'shortlisted']) {
    assert.ok(
      !(BOOKED_VENDOR_STATUSES as readonly string[]).includes(notBooked),
      `${notBooked} is not a booking`,
    );
  }
  assert.ok(BOOKED_VENDOR_STATUSES.includes('contracted'));
  assert.ok(BOOKED_VENDOR_STATUSES.includes('deposit_paid'));
});

test('the typed confirmation ignores case and surrounding space', () => {
  assert.equal(confirmationMatches('cale & ice', 'Cale & Ice'), true);
  assert.equal(confirmationMatches('  Cale & Ice  ', 'Cale & Ice'), true);
});

test('the typed confirmation refuses a near miss', () => {
  assert.equal(confirmationMatches('Cale and Ice', 'Cale & Ice'), false);
  assert.equal(confirmationMatches('Cale', 'Cale & Ice'), false);
  assert.equal(confirmationMatches('', 'Cale & Ice'), false);
});

test('an empty box can never delete a nameless event', () => {
  // 🪤 The one input a stray press produces is an empty box. If the event's own
  // display name is blank or whitespace, a naive equality check makes '' === ''
  // true and the confirmation step evaporates for exactly the event whose name
  // nobody could have typed.
  assert.equal(confirmationMatches('', ''), false);
  assert.equal(confirmationMatches('   ', '   '), false);
});

// ───────────────────────────────────────────────────────────────────────────
// SUPPLIERS THE COUPLE PAID DIRECTLY (owner 2026-08-21)
//
// "when a user decides to delete an event and they paid vendors. they can only
// delete it if the vendors with paid purchase accepts that this deletion. but
// if the event is already completed and they have completed their service for
// that event, the user can delete it anytime."
//
// ⚠ NONE of the three money signals above can see this. Setnayan never holds
// the couple→supplier money. Prod carries a wedding with 12 booked suppliers,
// 3 of them paid — and every Setnayan-side signal reads zero for it.
// ───────────────────────────────────────────────────────────────────────────

test('a paid supplier who has not finished BLOCKS the delete', () => {
  assert.equal(
    deletionIsBlocked({ ...CLEAR, unsettledPaidSuppliers: 3 }),
    true,
    'Prod’s "Maria & Jose" has exactly this shape: 3 suppliers paid a deposit ' +
      'for a wedding that has not happened. One press would erase their bookings.',
  );
});

test('a released supplier does not block — the event passed AND the job is confirmed', () => {
  assert.equal(
    supplierIsReleased({
      eventHasPassed: true,
      completionStatus: 'confirmed',
      vendorStatus: 'deposit_paid',
    }),
    true,
  );
});

test('BOTH halves are required — one alone never releases', () => {
  // The owner named both: "the event is already completed AND they have
  // completed their service".
  assert.equal(
    supplierIsReleased({
      eventHasPassed: false,
      completionStatus: 'confirmed',
      vendorStatus: null,
    }),
    false,
    'a job marked done for a celebration that has not happened yet is not finished',
  );
  assert.equal(
    supplierIsReleased({
      eventHasPassed: true,
      completionStatus: 'awaiting_vendor',
      vendorStatus: 'deposit_paid',
    }),
    false,
    'the day passing does not finish a supplier’s job for them',
  );
});

test('"vendor_marked" is a CLAIM, not a release', () => {
  // The ladder is awaiting_vendor → vendor_marked → confirmed/auto_confirmed.
  // Treating vendor_marked as finished lets the couple delete on the supplier's
  // own unconfirmed word — the opposite of the consent the owner asked for.
  assert.equal(
    supplierIsReleased({
      eventHasPassed: true,
      completionStatus: 'vendor_marked',
      vendorStatus: null,
    }),
    false,
  );
});

test('a DISPUTED completion never releases, whatever else is true', () => {
  // 🚨 The one state where deleting the evidence is least acceptable: the couple
  // and the supplier disagree about whether the job was done.
  assert.equal(
    supplierIsReleased({
      eventHasPassed: true,
      completionStatus: 'disputed',
      vendorStatus: 'complete',
    }),
    false,
    'a dispute was released because the older status enum said complete — the ' +
      'dispute check must win over every other signal',
  );
});

test('paid is read four ways, because a couple records it four ways', () => {
  const NONE = {
    vendorStatus: 'contracted',
    depositPaidPhp: 0,
    depositRecordedAt: null,
    hasLoggedPayment: false,
  };
  assert.equal(supplierWasPaid(NONE), false);
  assert.equal(supplierWasPaid({ ...NONE, vendorStatus: 'deposit_paid' }), true);
  assert.equal(supplierWasPaid({ ...NONE, depositPaidPhp: 5000 }), true);
  assert.equal(
    supplierWasPaid({ ...NONE, depositRecordedAt: '2026-08-01T00:00:00Z' }),
    true,
  );
  assert.equal(supplierWasPaid({ ...NONE, hasLoggedPayment: true }), true);
});
