/** F-A-02 (admin walk 13 Nov 2026): a booking fee paid through its order counts under Booking fees, once. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueStatement, splitPaidRevenue } from './revenue-statement';

test('a paid booking-fee ORDER is a booking fee, not a software sale — and a paid charge is not counted twice', () => {
  const split = splitPaidRevenue(
    [
      { service_key: 'SETNAYAN_AI', requested_total_php: '2499.00' },
      { service_key: 'vendor_booking_fee__6a8e0ec9-b829-43ab-a2e2-bcba7062b59c', requested_total_php: '837.50' },
    ],
    [
      { charge_id: '6a8e0ec9-b829-43ab-a2e2-bcba7062b59c', amount_charged_centavos: 83750 },
      { charge_id: '11111111-1111-1111-1111-111111111111', amount_charged_centavos: 5000 },
    ],
  );
  assert.deepEqual(split, { softwarePhp: 2499, paidOrderCount: 1, bookingFeePhp: 887.5, paidFeeCount: 2, paidFeeOrderCount: 1 });
  const s = revenueStatement({ ...split, refundedPhp: 0, receiptCount: 1, receiptPhp: 2499 });
  assert.equal(s.netPhp, 3386.5);
  assert.equal(s.unreceiptedOrderCount, 1, 'the fee order is still an order a receipt can be owed for');
});
