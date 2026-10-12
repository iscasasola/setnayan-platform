/**
 * THE LAUNCH OFFER — the pure rules and the words (owner 2026-10-08; 2026-10-12
 * #3–#6). The money decision is SQL's (`the-launch-offer.db.test.ts`); this
 * holds what the app computes and says about it.
 *
 * SABOTAGE (2026-10-12): make `launchProEndsAt` count cycles with Math.ceil →
 * RED on the boundary case; drop the launch arm from `waivedFeeCopy` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAUNCH_PRO_END_CASES,
  isoToManilaLocal,
  launchOfferIsOpen,
  launchProEndsAt,
  launchProEndsAtNow,
  manilaLocalToIso,
  type LaunchOfferSettings,
} from './launch-offer';
import { launchProWindow, resolveVendorDealTier, LAUNCH_PRO_WINDOW_ID } from './promo-free-windows';
import { bookingFeeForecast, waivedFeeReceiptCopy } from './booking-fee-disclosure';
import { BOOKING_FEE } from './booking-fee';
import { BANNED_LAUNCH_WINDOW_SHAPE } from './commission-promise';

const OPEN: LaunchOfferSettings = {
  enabled: true,
  cap: 2000,
  papicCredits: 50,
  cycleDays: 28,
  startedAt: '2026-10-15T00:00:00.000Z',
  closedAt: null,
  proEndsAt: null,
  used: 12,
};

test('free Pro ends at the end of the cycle running — every case in the shared table', () => {
  for (const c of LAUNCH_PRO_END_CASES) {
    assert.equal(launchProEndsAt(c.startedAt, c.at, c.cycleDays), c.expect, c.name);
  }
  assert.equal(launchProEndsAt('2026-10-15T00:00:00Z', '2026-10-20T00:00:00Z', null), null, 'no cycle → no date, never a guess');
});

test('open means: on, not closed, started, and under the cap', () => {
  const at = Date.parse('2026-10-20T00:00:00Z');
  assert.equal(launchOfferIsOpen(OPEN, at), true);
  assert.equal(launchOfferIsOpen({ ...OPEN, enabled: false }, at), false);
  assert.equal(launchOfferIsOpen({ ...OPEN, closedAt: '2026-10-19T00:00:00Z' }, at), false);
  assert.equal(launchOfferIsOpen({ ...OPEN, used: 2000 }, at), false, 'the 2,001st is not free');
  assert.equal(launchOfferIsOpen({ ...OPEN, startedAt: '2026-10-21T00:00:00Z' }, at), false);
  assert.equal(launchOfferIsOpen({ ...OPEN, cap: null }, at), false, 'no cap → fails closed (the fee is charged)');
});

test('the shown Pro end: stamped once closed; rolling while open; none while off', () => {
  const at = Date.parse('2026-11-14T00:00:00Z');
  assert.equal(launchProEndsAtNow(OPEN, at), '2026-12-10T00:00:00.000Z');
  assert.equal(
    launchProEndsAtNow({ ...OPEN, closedAt: '2026-10-20T00:00:00Z', proEndsAt: '2026-11-12T00:00:00.000Z' }, at),
    '2026-11-12T00:00:00.000Z',
  );
  assert.equal(launchProEndsAtNow({ ...OPEN, enabled: false }, at), null);
});

test('free Pro is a vendor deal the shared resolver grants to a VERIFIED supplier only', () => {
  const at = Date.parse('2026-10-20T00:00:00Z');
  const w = launchProWindow(OPEN, at);
  assert.ok(w, 'an open offer produced no Pro window');
  assert.equal(w!.promo_window_id, LAUNCH_PRO_WINDOW_ID);
  assert.equal(w!.promoted_vendor_tier, 'pro');
  assert.equal(
    resolveVendorDealTier([w!], { verification_state: 'verified', last_verified_at: null, created_at: null }, at),
    'pro',
  );
  assert.equal(
    resolveVendorDealTier([w!], { verification_state: 'pending', last_verified_at: null, created_at: null }, at),
    null,
  );
  // After free Pro's end, nothing.
  const closed = { ...OPEN, closedAt: '2026-10-19T00:00:00Z', proEndsAt: '2026-11-12T00:00:00.000Z' };
  const after = Date.parse('2026-11-13T00:00:00Z');
  const w2 = launchProWindow(closed, after);
  assert.equal(
    resolveVendorDealTier(w2 ? [w2] : [], { verification_state: 'verified', last_verified_at: null, created_at: null }, after),
    null,
    'free Pro outlived its one end date',
  );
  assert.equal(launchProWindow({ ...OPEN, enabled: false }, at), null);
});

test('admin times are Manila time, both ways', () => {
  assert.equal(manilaLocalToIso('2026-10-15T09:00'), '2026-10-15T01:00:00.000Z');
  assert.equal(isoToManilaLocal('2026-10-15T01:00:00.000Z'), '2026-10-15T09:00');
  assert.equal(manilaLocalToIso('not a date'), null);
  assert.equal(isoToManilaLocal(null), '');
});

test('the receipt and the forecast name the fee, the offer and the credits — never "commission while we launch"', () => {
  const receipt = waivedFeeReceiptCopy({
    chargeId: 'c',
    eventId: 'e',
    coupleName: 'Rosa & Ben',
    computedPhp: 2500,
    ordinal: null,
    waivedOn: '2026-10-20',
    reason: 'launch',
    launchNumber: 12,
    launchCredits: 50,
  });
  assert.match(receipt.title, /₱2,500\.00 — waived for Rosa & Ben/);
  assert.match(receipt.body, /booking 12 of the Setnayan launch offer/);
  assert.match(receipt.body, /did not use up any of your free bookings/);
  assert.match(receipt.body, /50 Papic credits/);
  assert.doesNotMatch(receipt.body, /booking \d+ of your first/);

  const forecast = bookingFeeForecast(
    { kind: 'launch_offer', schedule: BOOKING_FEE, cap: 2000, papicCredits: 50, isFrozen: false, number: null },
    50_000,
  );
  assert.ok(forecast);
  assert.match(forecast!.headline, /₱2,500\.00 — free with the launch offer/);
  assert.match(forecast!.detail, /first 2,000 bookings are free/);
  assert.match(forecast!.detail, /50 Papic credits/);
  for (const words of [receipt.title, receipt.body, forecast!.headline, forecast!.detail]) {
    assert.doesNotMatch(words, BANNED_LAUNCH_WINDOW_SHAPE);
    assert.doesNotMatch(words, /commission/i, 'the launch offer is about the FEE');
  }
});
