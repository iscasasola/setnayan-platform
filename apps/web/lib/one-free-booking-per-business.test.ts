/**
 * 🛡 ONE FREE FIRST BOOKING PER BUSINESS, NOT PER ACCOUNT — the TypeScript half.
 *
 * ⚖ OWNER, 2026-11-06 (DECISION_LOG "ONE FREE FIRST BOOKING PER BUSINESS, NOT PER
 * ACCOUNT — THE NEW-ACCOUNT LOOPHOLE IS CLOSED AT THE VERIFICATION DESK").
 * The money itself is decided in SQL and pinned by
 * `tests/db/one-free-first-booking-per-business.db.test.ts`; this file pins the
 * TS twins that SAY it — the supplier's forecast and the admin desk.
 *
 *   1 · FAIL CLOSED: only the exact word `available` lets a booking be free.
 *   2 · the pure lock decision bills a second account of the same business.
 *   3 · the supplier is told WHY, without a self-contradicting "number 1".
 *   4 · the desk: a refused match read is "could not check", never "no match".
 *   5 · the wiring: the forecast asks the SAME SQL the charge asks; the desk
 *       reads the SAME match function and renders the note.
 *
 * SABOTAGE (2026-11-07, each reverted): `businessMayTakeFreeBooking` changed to
 * `raw !== 'used_by_business'` (fail open) → test 1 + 2 RED; the business RPC
 * call removed from `resolveBookingFeeStanding` → test 5 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  businessMayTakeFreeBooking,
  decideLockFee,
  readBusinessFreeStanding,
  readFreeHeldBack,
} from './booking-fee-lock';
import { bookingFeeForecast } from './booking-fee-disclosure';
import { BOOKING_FEE } from './booking-fee';
import { buildFreeBookingMatches, matchedOnText } from './business-free-booking-match';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

test('1 · fail closed — only `available` permits a free booking', () => {
  assert.equal(businessMayTakeFreeBooking('available'), true);
  for (const v of ['used_by_business', 'unreadable', 'AVAILABLE', '', null, undefined, true, 1, {}]) {
    assert.equal(businessMayTakeFreeBooking(v), false, `${JSON.stringify(v)} granted a free booking`);
  }
  assert.equal(readBusinessFreeStanding('used_by_business'), 'used_by_business');
  assert.equal(readBusinessFreeStanding('something new'), 'unreadable');
  assert.equal(readBusinessFreeStanding(null), 'unreadable');
  assert.equal(readFreeHeldBack('business_already_used'), 'business_already_used');
  assert.equal(readFreeHeldBack('nope'), null);
});

test('2 · a second account of the same business is billed; a new business is not', () => {
  const base = { flagEnabled: true, verified: true, bookingOrdinal: 1, agreedTotalPhp: 100_000 } as const;
  const newBusiness = decideLockFee({ ...base, businessFree: 'available' });
  assert.equal(newBusiness.free, true);
  assert.equal(newBusiness.feePhp, 0);

  for (const businessFree of ['used_by_business', 'unreadable'] as const) {
    const d = decideLockFee({ ...base, businessFree });
    assert.equal(d.free, false, `${businessFree}: a free booking was granted`);
    assert.ok(d.feePhp > 0, `${businessFree}: no fee`);
    assert.equal(d.createOrder, true, `${businessFree}: no bill issued`);
  }
});

test('3 · the supplier reads why — and never "was on us; this would be number 1"', () => {
  const projected = bookingFeeForecast(
    { kind: 'billable', ordinal: 1, ordinalIsFrozen: false, schedule: BOOKING_FEE, freeHeldBack: 'business_already_used' },
    50_000,
  );
  assert.ok(projected);
  assert.match(projected.detail, /already used its free first booking from Setnayan under another account/);
  assert.doesNotMatch(projected.detail, /this would be number 1/);
  assert.match(projected.headline, /payable if they book/);

  const failedClosed = bookingFeeForecast(
    { kind: 'billable', ordinal: 1, ordinalIsFrozen: true, schedule: BOOKING_FEE, freeHeldBack: 'business_check_unreadable' },
    50_000,
  );
  assert.ok(failedClosed);
  assert.match(failedClosed.detail, /could not confirm this is your business.s first booking/);

  // During a promotion the booking is free anyway — the line must not say it carries the fee.
  const promo = bookingFeeForecast(
    { kind: 'promo_window', ordinal: 1, ordinalIsFrozen: false, schedule: BOOKING_FEE, endsAt: null, freeHeldBack: 'business_already_used' },
    50_000,
  );
  assert.ok(promo);
  assert.doesNotMatch(promo.detail, /carr(y|ies) the fee/);

  // No other shop is ever named to the supplier.
  assert.doesNotMatch(projected.detail + failedClosed.detail, /S89|shop "/);
});

test('4 · the desk: a refused read is "could not check", never "no match"', () => {
  const failed = buildFreeBookingMatches({ reviewedIds: ['a'], rows: null, names: {}, withheldRows: null });
  assert.equal(failed.a!.shops, null);
  assert.equal(failed.a!.withheld, null);

  const none = buildFreeBookingMatches({ reviewedIds: ['a'], rows: [], names: {}, withheldRows: [] });
  assert.deepEqual(none.a!.shops, []);

  const m = buildFreeBookingMatches({
    reviewedIds: ['a'],
    rows: [
      { vendor_profile_id: 'a', other_vendor_profile_id: 'z', matched_on: ['phone'], other_took_free: false },
      { vendor_profile_id: 'a', other_vendor_profile_id: 'b', matched_on: ['phone', 'registration_number', 'junk'], other_took_free: true },
    ],
    names: { b: 'Bulgogi Catering' },
    withheldRows: [
      { vendor_profile_id: 'a', free_booking_withheld_reason: 'business_already_used' },
      { vendor_profile_id: 'a', free_booking_withheld_reason: 'business_check_unreadable' },
      { vendor_profile_id: 'a', free_booking_withheld_reason: null, is_free_booking: true },
    ],
  });
  const shops = m.a!.shops!;
  assert.equal(shops[0]!.vendorProfileId, 'b', 'the shop holding the free booking is listed first');
  assert.equal(shops[0]!.tookFree, true);
  assert.deepEqual(shops[0]!.matchedOn, ['phone', 'registration_number']);
  assert.equal(shops[1]!.businessName, 'A shop (name not readable)');
  assert.deepEqual(m.a!.withheld, { alreadyUsed: 1, checkUnreadable: 1, selfTookFree: true });
  assert.equal(matchedOnText(['phone', 'registration_number']), 'phone and registration number');
});

test('5 · the forecast and the desk read the same SQL the charge reads', () => {
  const server = stripComments(readFileSync(join(WEB, 'lib/booking-fee-disclosure.server.ts'), 'utf8'));
  assert.match(server, /rpc\('booking_fee_business_free_standing'/, 'the forecast no longer asks the business');
  assert.match(server, /businessMayTakeFreeBooking\(/, 'the forecast does not use the strict predicate');
  assert.match(server, /free_booking_withheld_reason/, 'a frozen held-back booking is not read');

  const page = stripComments(readFileSync(join(WEB, 'app/admin/verify/page.tsx'), 'utf8'));
  assert.match(page, /rpc\('booking_fee_business_matches'/, 'the desk does not read the match');
  assert.match(page, /<FreeBookingMatchNote match=\{freeBookingMatch\}/, 'the desk does not render the match');
});
