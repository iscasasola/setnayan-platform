/**
 * Unit suite for the vendor on-the-day Papic capture tier + capture-points model
 * (owner-locked 2026-07-18). Invariants: with tokens retired (2026-07-21) the
 * interim base tier is EARNED only by a founder-comp accept (→ Ltd; else Lite), a
 * paid Unli upgrade wins, Lite is the 50-pt gift + video (owner 2026-07-22), the
 * points ledger (photo=1, clip=7) enforces each tier's budget, and the fee-scaled
 * allowance runs 50 pts (₱0) → 200 pts (₱4,000).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pointsForMedia,
  pointsSpent,
  tierSpec,
  captureAllowance,
  canCapture,
  baseTierFromProvenance,
  resolveVendorPapicTier,
  tierReadout,
  vendorPapicPointsForBookingFee,
  VENDOR_PAPIC_BASE_GIFT_POINTS,
  VENDOR_PAPIC_MAX_POINTS,
  type VendorAcceptProvenance,
} from './vendor-papic-tier';

const prov = (p: Partial<VendorAcceptProvenance>): VendorAcceptProvenance => ({
  hasUnlock: false,
  founderComp: false,
  ...p,
});

test('capture points: photo=1, clip=7', () => {
  assert.equal(pointsForMedia('photo'), 1);
  assert.equal(pointsForMedia('clip'), 7);
  assert.equal(
    pointsSpent([{ media_type: 'photo' }, { media_type: 'clip' }, { media_type: 'photo' }]),
    9,
  );
  assert.equal(pointsSpent([]), 0);
});

test('tier specs: Lite 50/video, Ltd 70/video, Unli unlimited', () => {
  // Owner 2026-07-22: free documentation is 50 pts + video (was 20/photos-only).
  assert.deepEqual(
    { p: tierSpec('lite').points, v: tierSpec('lite').allowVideo },
    { p: 50, v: true },
  );
  assert.deepEqual(
    { p: tierSpec('ltd').points, v: tierSpec('ltd').allowVideo },
    { p: 70, v: true },
  );
  assert.equal(tierSpec('unli').points, null);
  assert.equal(tierSpec('unli').allowVideo, true);
});

test('base tier: no unlock → Lite (the floor)', () => {
  assert.equal(baseTierFromProvenance(prov({ hasUnlock: false })), 'lite');
});

test('base tier: founder-comp accept → Ltd (as-if-paid, non-token)', () => {
  assert.equal(
    baseTierFromProvenance(prov({ hasUnlock: true, founderComp: true })),
    'ltd',
  );
});

test('base tier: ordinary booked accept (not founder) → Lite (tokens retired)', () => {
  assert.equal(
    baseTierFromProvenance(prov({ hasUnlock: true, founderComp: false })),
    'lite',
  );
});

test('resolve: a PAID Unli upgrade wins over any base tier', () => {
  assert.equal(resolveVendorPapicTier(prov({ hasUnlock: false }), true), 'unli');
  assert.equal(
    resolveVendorPapicTier(prov({ hasUnlock: true, founderComp: true }), true),
    'unli',
  );
});

test('resolve: no upgrade → the derived base tier', () => {
  assert.equal(
    resolveVendorPapicTier(prov({ hasUnlock: true, founderComp: true }), false),
    'ltd',
  );
  assert.equal(resolveVendorPapicTier(prov({ hasUnlock: true }), false), 'lite');
});

test('fee-scaled points: ₱0 → 50 (gift floor), ₱4,000 → 200 (ceiling)', () => {
  assert.equal(vendorPapicPointsForBookingFee(0), VENDOR_PAPIC_BASE_GIFT_POINTS);
  assert.equal(vendorPapicPointsForBookingFee(0), 50);
  assert.equal(vendorPapicPointsForBookingFee(4000), VENDOR_PAPIC_MAX_POINTS);
  assert.equal(vendorPapicPointsForBookingFee(4000), 200);
});

test('fee-scaled points: proportional in between, capped above the ceiling', () => {
  assert.equal(vendorPapicPointsForBookingFee(2000), 125); // halfway → 50 + 75
  assert.equal(vendorPapicPointsForBookingFee(1000), 88); // 50 + 37.5 → round
  assert.equal(vendorPapicPointsForBookingFee(8000), 200); // clamped at the ceiling
});

test('fee-scaled points: junk fee (negative / NaN) → the gift floor', () => {
  assert.equal(vendorPapicPointsForBookingFee(-500), 50);
  assert.equal(vendorPapicPointsForBookingFee(Number.NaN), 50);
});

test('canCapture: Lite now allows clips (documentation is photos + video)', () => {
  assert.deepEqual(canCapture('lite', 0, 'clip'), { ok: true });
  assert.deepEqual(canCapture('lite', 0, 'photo'), { ok: true });
  // A clip costs 7 pts, so 43 spent + a 7-pt clip = 50 (still fits); 44 overflows.
  assert.deepEqual(canCapture('lite', 43, 'clip'), { ok: true });
  assert.deepEqual(canCapture('lite', 44, 'clip'), {
    ok: false,
    reason: 'out_of_points',
  });
});

test('canCapture: Lite runs out at 50 points', () => {
  assert.deepEqual(canCapture('lite', 49, 'photo'), { ok: true });
  assert.deepEqual(canCapture('lite', 50, 'photo'), {
    ok: false,
    reason: 'out_of_points',
  });
});

test('canCapture: Ltd — a clip needs 7 points of headroom', () => {
  assert.deepEqual(canCapture('ltd', 63, 'clip'), { ok: true }); // 63 + 7 = 70
  assert.deepEqual(canCapture('ltd', 64, 'clip'), {
    ok: false,
    reason: 'out_of_points',
  });
  // ...but a single photo still fits at 69.
  assert.deepEqual(canCapture('ltd', 69, 'photo'), { ok: true });
  assert.deepEqual(canCapture('ltd', 70, 'photo'), {
    ok: false,
    reason: 'out_of_points',
  });
});

test('canCapture: Unli is unlimited (photos + clips, any count)', () => {
  assert.deepEqual(canCapture('unli', 10_000, 'clip'), { ok: true });
  assert.deepEqual(canCapture('unli', 10_000, 'photo'), { ok: true });
});

test('captureAllowance: points left clamps at 0, unlimited stays null', () => {
  assert.deepEqual(captureAllowance('lite', 5), {
    tier: 'lite',
    allowVideo: true,
    pointsCap: 50,
    pointsSpent: 5,
    pointsLeft: 45,
  });
  assert.equal(captureAllowance('lite', 999).pointsLeft, 0);
  assert.equal(captureAllowance('unli', 999).pointsLeft, null);
  // Negative/garbage spent is clamped to 0.
  assert.equal(captureAllowance('ltd', -3).pointsSpent, 0);
});

test('tierReadout: human badge strings', () => {
  assert.equal(tierReadout('lite'), 'Papic Lite · 50 pts · photos + video');
  assert.equal(tierReadout('ltd'), 'Papic Ltd · 70 pts · photos + video');
  assert.equal(tierReadout('unli'), 'Papic Unli · unlimited');
});
