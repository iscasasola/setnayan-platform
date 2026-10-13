/**
 * SUPPLIERS TO REVIEW (owner 2026-10-07; 2026-10-12 #12 — a count of events,
 * admin-set, default 2, review only). The roll-up is pure; every rule runs here.
 *
 * SABOTAGE (2026-10-12): count a booking with a SETTLED fee → RED on test 2;
 * count bookings instead of distinct events → RED on test 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { suppliersToReview, type ReviewBookingRow } from './suppliers-to-review';

const b = (id: string, ev: string, vp: string, status = 'contracted'): ReviewBookingRow => ({
  eventVendorId: id,
  eventId: ev,
  vendorProfileId: vp,
  status,
});

test('a supplier with two booked events and no settled fee is listed at the default of 2', () => {
  const rows = suppliersToReview({
    bookings: [b('a1', 'e1', 'shop'), b('a2', 'e2', 'shop'), b('x1', 'e3', 'other')],
    payments: [{ eventVendorId: 'a1', amountPhp: 10000 }],
    charges: [{ eventVendorId: 'a2', status: 'pending', amountCentavos: 83750 }],
    minEvents: 2,
  });
  assert.deepEqual(rows, [{ vendorProfileId: 'shop', events: 2, paymentsPhp: 10000, owedCentavos: 83750 }]);
});

test('a SETTLED fee (paid or any waiver) takes the booking off the list', () => {
  for (const status of ['paid', 'waived_free5', 'waived_import', 'waived_promo']) {
    const rows = suppliersToReview({
      bookings: [b('a1', 'e1', 'shop'), b('a2', 'e2', 'shop')],
      payments: [],
      charges: [{ eventVendorId: 'a2', status, amountCentavos: 0 }],
      minEvents: 2,
    });
    assert.deepEqual(rows, [], `${status} still counted as unsettled`);
  }
});

test('events are counted, not booking rows; a payment alone makes a considering row count', () => {
  const rows = suppliersToReview({
    bookings: [
      b('a1', 'e1', 'shop'),
      b('a2', 'e1', 'shop'), // same event, second service
      b('a3', 'e2', 'shop', 'considering'), // not booked by status…
    ],
    payments: [{ eventVendorId: 'a3', amountPhp: 5000 }], // …but the couple paid
    charges: [],
    minEvents: 2,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.events, 2);
  const none = suppliersToReview({ bookings: [b('a1', 'e1', 'shop'), b('a2', 'e1', 'shop')], payments: [], charges: [], minEvents: 2 });
  assert.deepEqual(none, [], 'two rows on ONE event listed a supplier at a count of 2 events');
});

test('the count is the setting; an unusable one lists nobody rather than guessing', () => {
  const bookings = [b('a1', 'e1', 'shop'), b('a2', 'e2', 'shop'), b('a3', 'e3', 'shop')];
  assert.equal(suppliersToReview({ bookings, payments: [], charges: [], minEvents: 3 }).length, 1);
  assert.equal(suppliersToReview({ bookings, payments: [], charges: [], minEvents: 4 }).length, 0);
  assert.equal(suppliersToReview({ bookings, payments: [], charges: [], minEvents: Number.NaN }).length, 0);
  assert.equal(suppliersToReview({ bookings, payments: [], charges: [], minEvents: 0 }).length, 0);
});
