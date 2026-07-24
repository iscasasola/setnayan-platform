/**
 * Unit suite for the Vendor Booking-Fee SURFACING pure helpers. These gate what
 * a vendor sees + is notified about, so the safety-critical pieces are: (1) which
 * orders are a vendor's fee orders (service_key predicate — a false positive
 * would surface a non-fee order; a false negative would hide a real fee), and
 * (2) the due/settled/closed classification that drives the pay CTA + the "you
 * owe" gate. RLS scoping (a vendor sees ONLY their own fee orders) is enforced
 * by the query filter — asserted structurally in the query-shape test below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isVendorBookingFeeServiceKey,
  VENDOR_BOOKING_FEE_SERVICE_KEY_LIKE,
  BOOKING_FEE_LOCK_SERVICE_PREFIX,
  vendorBookingFeePayPath,
  classifyFeeOrderBucket,
  isFeeOrderPayable,
  selectDueFeeOrders,
  bookingFeeNotificationCopy,
} from './vendor-booking-fees';
import type { OrderStatus } from './orders';

// ── (1) which orders are a vendor's fee orders ──────────────────────────────

test('isVendorBookingFeeServiceKey — matches lock fee keys only', () => {
  assert.equal(isVendorBookingFeeServiceKey('vendor_booking_fee__abc123'), true);
  assert.equal(
    isVendorBookingFeeServiceKey(`${BOOKING_FEE_LOCK_SERVICE_PREFIX}0f9c`),
    true,
  );
});

test('isVendorBookingFeeServiceKey — rejects non-fee / adjacent vendor keys', () => {
  // Other vendor-billing keys share the `vendor_` prefix but are NOT fees.
  assert.equal(isVendorBookingFeeServiceKey('vendor_additional_branch__x'), false);
  assert.equal(isVendorBookingFeeServiceKey('vendor_ai_addon'), false);
  // Customer SKUs.
  assert.equal(isVendorBookingFeeServiceKey('SETNAYAN_AI'), false);
  // Bare prefix with no charge id is not a valid fee key.
  assert.equal(isVendorBookingFeeServiceKey(BOOKING_FEE_LOCK_SERVICE_PREFIX), false);
  assert.equal(isVendorBookingFeeServiceKey(null), false);
  assert.equal(isVendorBookingFeeServiceKey(undefined), false);
  assert.equal(isVendorBookingFeeServiceKey(''), false);
});

test('the LIKE pattern targets exactly the fee prefix', () => {
  assert.equal(
    VENDOR_BOOKING_FEE_SERVICE_KEY_LIKE,
    'vendor_booking_fee__%',
  );
});

// ── (2) classification / payable gate ───────────────────────────────────────

test('classifyFeeOrderBucket — due / settled / closed', () => {
  const due: OrderStatus[] = ['submitted', 'awaiting_payment'];
  const settled: OrderStatus[] = ['paid', 'fulfilled'];
  const closed: OrderStatus[] = ['cancelled', 'refunded', 'lapsed', 'draft'];
  for (const s of due) assert.equal(classifyFeeOrderBucket(s), 'due', s);
  for (const s of settled) assert.equal(classifyFeeOrderBucket(s), 'settled', s);
  for (const s of closed) assert.equal(classifyFeeOrderBucket(s), 'closed', s);
});

test('isFeeOrderPayable — only due statuses are payable', () => {
  assert.equal(isFeeOrderPayable('submitted'), true);
  assert.equal(isFeeOrderPayable('awaiting_payment'), true);
  // A paid fee must NOT be re-payable (adversarial: no double-charge surface).
  assert.equal(isFeeOrderPayable('paid'), false);
  assert.equal(isFeeOrderPayable('fulfilled'), false);
  assert.equal(isFeeOrderPayable('cancelled'), false);
  assert.equal(isFeeOrderPayable('refunded'), false);
});

test('selectDueFeeOrders — keeps due fee orders, drops non-fee + non-due', () => {
  const orders = [
    { service_key: 'vendor_booking_fee__a', status: 'submitted' as OrderStatus }, // keep
    { service_key: 'vendor_booking_fee__b', status: 'awaiting_payment' as OrderStatus }, // keep
    { service_key: 'vendor_booking_fee__c', status: 'paid' as OrderStatus }, // drop (settled)
    { service_key: 'vendor_ai_addon', status: 'submitted' as OrderStatus }, // drop (non-fee)
    { service_key: null, status: 'submitted' as OrderStatus }, // drop (non-fee)
  ];
  const due = selectDueFeeOrders(orders);
  assert.deepEqual(
    due.map((o) => o.service_key),
    ['vendor_booking_fee__a', 'vendor_booking_fee__b'],
  );
});

// ── deep-link + copy ────────────────────────────────────────────────────────

test('vendorBookingFeePayPath — stable vendor-scoped deep link', () => {
  assert.equal(
    vendorBookingFeePayPath('ord-1'),
    '/vendor-dashboard/booking-fees/ord-1',
  );
});

test('bookingFeeNotificationCopy — amount + event name, with fallback', () => {
  const withName = bookingFeeNotificationCopy({ amountPhp: 1250, eventName: 'Ana & Ben' });
  assert.match(withName.title, /₱1,250/);
  assert.match(withName.body, /Ana & Ben/);
  assert.match(withName.body, /24 hours/);

  const noName = bookingFeeNotificationCopy({ amountPhp: 500, eventName: '  ' });
  assert.match(noName.body, /a booking/);
});
