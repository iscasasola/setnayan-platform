/**
 * Unit suite for the vendor on-the-day Papic capture tier + capture-points model
 * (owner-locked 2026-07-18). Invariants: with tokens retired (2026-07-21) the
 * interim base tier is EARNED only by a founder-comp accept (→ Ltd; else Lite), a
 * paid Unli upgrade wins, Lite is the 50-pt gift + video (owner 2026-07-22), the
 * points ledger (photo=1, clip=the shared ceiling) enforces each tier's budget, and the fee-scaled
 * allowance runs 50 pts (₱0) → 200 pts (₱4,000).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAPIC_CLIP_COST_MAX, PAPIC_POINTS_PER_PHOTO } from './papic-cameras';

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
  allowancePointsFor,
  VENDOR_PAPIC_BASE_GIFT_POINTS,
  VENDOR_PAPIC_MAX_POINTS,
  type VendorAcceptProvenance,
} from './vendor-papic-tier';

const prov = (p: Partial<VendorAcceptProvenance>): VendorAcceptProvenance => ({
  hasUnlock: false,
  founderComp: false,
  ...p,
});

test('capture points are DERIVED from the couple pool, not re-typed', () => {
  // 🚨 THIS TEST USED TO PIN 7 — and that is exactly how the drift survived.
  // vendor-papic-tier.ts said `clip: 7` while its own docblock said 8 in two
  // places and claimed to mirror the couple pool. The docblock was right and the
  // number was stale (the couple's clip moved 7 → 8 on 2026-07-29). A test that
  // hard-codes the same wrong number as the code is not a guard: it is a second
  // copy of the mistake, and it agreed with the bug for weeks of green CI.
  //
  // Pinned to the SHARED constant now, so the two meters cannot separate again.
  assert.equal(pointsForMedia('photo'), PAPIC_POINTS_PER_PHOTO);
  assert.equal(pointsForMedia('clip'), PAPIC_CLIP_COST_MAX);
  assert.equal(
    pointsSpent([{ media_type: 'photo' }, { media_type: 'clip' }, { media_type: 'photo' }]),
    2 * PAPIC_POINTS_PER_PHOTO + PAPIC_CLIP_COST_MAX,
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
  // The last clip that fits under the 50-point Lite ceiling, and the first that
  // does not — both derived, so a reprice moves them together.
  assert.deepEqual(canCapture('lite', 50 - PAPIC_CLIP_COST_MAX, 'clip'), { ok: true });
  assert.deepEqual(canCapture('lite', 50 - PAPIC_CLIP_COST_MAX + 1, 'clip'), {
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

test('canCapture: Ltd — a clip needs a whole clip of headroom', () => {
  assert.deepEqual(canCapture('ltd', 70 - PAPIC_CLIP_COST_MAX, 'clip'), { ok: true });
  assert.deepEqual(canCapture('ltd', 70 - PAPIC_CLIP_COST_MAX + 1, 'clip'), {
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

// ─────────────────────────────────────────────────────────────────────────────
// The fee actually reaching the allowance (owner 2026-07-22, wired 2026-08-26).
// `vendorPapicPointsForBookingFee` existed and was fully tested for over a month
// with NO application caller — every supplier got the flat tier number whatever
// they paid. These pin the wire, not just the arithmetic.
// ─────────────────────────────────────────────────────────────────────────────

test('an unread fee changes nothing — null is not "they paid nothing"', () => {
  // The mirror of fetchVendorPapicPointsSpent failing CLOSED: a metering outage
  // must never MINT points either.
  assert.equal(allowancePointsFor('lite', null), 50);
  assert.equal(allowancePointsFor('ltd', null), 70);
  assert.equal(captureAllowance('lite', 10, null).pointsLeft, 40);
});

test('the fee raises the allowance, proportionally', () => {
  assert.equal(allowancePointsFor('lite', 0), 50);
  assert.equal(allowancePointsFor('lite', 2000), 125);
  assert.equal(allowancePointsFor('lite', 4000), 200);
  assert.equal(allowancePointsFor('lite', 8000), 200, 'clamped at the ceiling');
  assert.equal(captureAllowance('lite', 10, 2000).pointsLeft, 115);
});

test('🚨 the fee can only ever RAISE — a comped supplier never loses points', () => {
  // A founder-comped supplier sits on ltd (70) having paid nothing. The fee
  // formula alone would hand them 50 and TAKE 20 POINTS AWAY. Nobody may lose
  // an allowance they already had because a wire was connected.
  assert.equal(allowancePointsFor('ltd', 0), 70, 'ltd must keep 70, not drop to the 50 floor');
  assert.equal(allowancePointsFor('ltd', 1000), 88, 'below ltd the tier still wins');
  assert.equal(allowancePointsFor('ltd', 2000), 125, 'above ltd the fee wins');
});

test('unlimited stays unlimited — null points is not a number to compare', () => {
  assert.equal(allowancePointsFor('unli', 4000), null);
  assert.equal(captureAllowance('unli', 999, 4000).pointsLeft, null);
  assert.deepEqual(canCapture('unli', 10_000, 'clip', 0), { ok: true });
});

test('canCapture spends against the RAISED cap, not the tier cap', () => {
  // 50-point lite, 48 spent, one clip costs 8 → refused on the tier number...
  assert.deepEqual(canCapture('lite', 48, 'clip', null), {
    ok: false,
    reason: 'out_of_points',
  });
  // ...and afforded once the fee they paid is known.
  assert.deepEqual(canCapture('lite', 48, 'clip', 4000), { ok: true });
});
