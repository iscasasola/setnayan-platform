/**
 * The couple's "booked" = confirmed AND the supplier's fee settled (owner
 * 2026-10-07 "no handshake, no confirmation of the event being booked to them";
 * 2026-10-12 #1, #14). The couple is never told about the fee — they see a
 * supplier who has not finished saying yes.
 *
 * SABOTAGE (2026-10-12): make an unsettled charge read 'booked' → RED on test 2;
 * make an unreadable fee read 'awaiting_supplier' → RED on test 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coupleBookingStanding,
  decidingCoupleFee,
  type CoupleBookingFacts,
} from './couple-booked-and-settled';

const base: CoupleBookingFacts = {
  status: 'contracted',
  onPlatform: true,
  handshaken: true,
  fee: { kind: 'charge', status: 'paid' },
};

test('a settled fee — paid or any waiver — is booked', () => {
  for (const status of ['paid', 'waived_free5', 'waived_import', 'waived_promo']) {
    assert.equal(coupleBookingStanding({ ...base, fee: { kind: 'charge', status } }, true), 'booked', status);
  }
});

test('an unsettled fee reads as the supplier not finished — never as booked', () => {
  for (const status of ['pending', 'failed', 'expired']) {
    assert.equal(
      coupleBookingStanding({ ...base, fee: { kind: 'charge', status } }, true),
      'awaiting_supplier',
      status,
    );
  }
});

test('no charge: booked when the supplier handshook (the fee is being made), waiting when they never did', () => {
  assert.equal(coupleBookingStanding({ ...base, fee: { kind: 'none' } }, true), 'booked');
  assert.equal(
    coupleBookingStanding({ ...base, handshaken: false, fee: { kind: 'none' } }, true),
    'awaiting_supplier',
    'a row the couple marked booked by themselves was shown as a confirmed booking',
  );
  assert.equal(
    coupleBookingStanding({ ...base, handshaken: false, fee: { kind: 'charge', status: 'cancelled_unbilled' } }, true),
    'awaiting_supplier',
    'a voided former charge counted as settled',
  );
});

test('fail open, and no fee system means as before', () => {
  assert.equal(coupleBookingStanding({ ...base, fee: { kind: 'unreadable' } }, true), 'booked');
  assert.equal(coupleBookingStanding({ ...base, fee: { kind: 'charge', status: 'pending' } }, false), 'booked');
  assert.equal(coupleBookingStanding({ ...base, onPlatform: false, fee: { kind: 'none' }, handshaken: false }, true), 'booked');
  assert.equal(coupleBookingStanding({ ...base, status: 'considering' }, true), 'not_booked');
});

test('the deciding fee: an unsettled primary wins; a void row is ignored', () => {
  assert.deepEqual(decidingCoupleFee([]), { kind: 'none' });
  assert.deepEqual(decidingCoupleFee(['cancelled_unbilled']), { kind: 'none' });
  assert.deepEqual(decidingCoupleFee(['paid', 'pending']), { kind: 'charge', status: 'pending' });
  assert.deepEqual(decidingCoupleFee(['cancelled_unbilled', 'waived_free5']), { kind: 'charge', status: 'waived_free5' });
});
