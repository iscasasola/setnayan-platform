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
  allowVideoFor,
  VENDOR_PAPIC_VIDEO_MIN_POINTS,
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
  assert.equal(vendorPapicPointsForBookingFee(0), 50, 'the floor: paid nothing, still gifted 50');
  // ⚖ ONE SHOT PER ₱5 (owner 2026-08-26). The old 50→200-at-₱4,000 curve was
  // sized for a supplier documenting the day; the allowance is now for
  // UPLOADING THEIR FINISHED WORK, and 200 cannot hold a wedding gallery.
  assert.equal(vendorPapicPointsForBookingFee(1500), 300, '₱30k package → ₱1,500 fee');
  assert.equal(vendorPapicPointsForBookingFee(2500), 500, '₱50k package → ₱2,500 fee');
  assert.equal(vendorPapicPointsForBookingFee(4000), 800, 'the video threshold sits here');
  assert.equal(vendorPapicPointsForBookingFee(10_000), VENDOR_PAPIC_MAX_POINTS);
  assert.equal(vendorPapicPointsForBookingFee(20_000), 2000, 'clamped — a ₱2M booking mints no windfall');
  assert.equal(vendorPapicPointsForBookingFee(-500), 50, 'nonsense earns the floor, never a windfall');
  assert.equal(vendorPapicPointsForBookingFee(Number.NaN), 50);
});

test('canCapture: a clip needs the VIDEO THRESHOLD first, then the points', () => {
  // ⚠ REWRITTEN 2026-08-26. This used to read "Lite now allows clips" and
  // asserted a clip at the bare 50-point floor. Owner: *"800 credits will allow
  // them to take videos."* Below 800 the refusal is video_not_allowed, and it
  // is checked BEFORE affordability — being told "out of points" when the real
  // answer is "video isn't unlocked yet" sends a supplier to buy shots that
  // would not have helped.
  assert.deepEqual(canCapture('lite', 0, 'clip'), {
    ok: false,
    reason: 'video_not_allowed',
  });
  assert.deepEqual(canCapture('lite', 0, 'photo'), { ok: true }, 'photos never need the threshold');

  // With a fee that clears 800, the clip arithmetic applies as before — the last
  // clip that fits, and the first that does not. Both derived from the cap and
  // the clip cost, so a reprice moves them together.
  const CAP = 800; // = a ₱4,000 fee at one shot per ₱5
  assert.deepEqual(canCapture('lite', CAP - PAPIC_CLIP_COST_MAX, 'clip', 4000), { ok: true });
  assert.deepEqual(canCapture('lite', CAP - PAPIC_CLIP_COST_MAX + 1, 'clip', 4000), {
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

test('canCapture: Ltd — a clip needs a whole clip of headroom, once video is unlocked', () => {
  // ⚠ The clip half now needs a fee that clears the 800 video threshold; the
  // ltd tier's own 70 points never could. The PHOTO half is untouched and still
  // proves the bare tier's ceiling exactly where it always did.
  assert.deepEqual(canCapture('ltd', 0, 'clip'), {
    ok: false,
    reason: 'video_not_allowed',
  }, 'ltd on its own 70 points is below the video threshold');

  const CAP = 800;
  assert.deepEqual(canCapture('ltd', CAP - PAPIC_CLIP_COST_MAX, 'clip', 4000), { ok: true });
  assert.deepEqual(canCapture('ltd', CAP - PAPIC_CLIP_COST_MAX + 1, 'clip', 4000), {
    ok: false,
    reason: 'out_of_points',
  });

  // ...and a single photo still fits at 69 on the bare tier.
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
  // ⚠ allowVideo is FALSE here, and that is the change of 2026-08-26, not a
  // regression: video now unlocks at 800 points and this supplier has 50. It
  // used to be `true` on every tier, which is why canCapture's
  // video_not_allowed branch could never fire.
  assert.deepEqual(captureAllowance('lite', 5), {
    tier: 'lite',
    allowVideo: false,
    pointsCap: 50,
    pointsSpent: 5,
    pointsLeft: 45,
  });
  // …and with a fee that clears the threshold, it comes back.
  assert.equal(captureAllowance('lite', 5, 4000).allowVideo, true);
  assert.equal(captureAllowance('lite', 5, 4000).pointsLeft, 795);
  assert.equal(captureAllowance('lite', 999).pointsLeft, 0);
  assert.equal(captureAllowance('unli', 999).pointsLeft, null);
  // Negative/garbage spent is clamped to 0.
  assert.equal(captureAllowance('ltd', -3).pointsSpent, 0);
});

test('tierReadout: human badge strings', () => {
  // Bare tier = what they get having paid nothing: the floor, photos only.
  assert.equal(tierReadout('lite'), 'Papic Lite · 50 photos');
  assert.equal(tierReadout('ltd'), 'Papic Ltd · 70 photos');
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
  assert.equal(allowancePointsFor('lite', 2000), 400);
  assert.equal(allowancePointsFor('lite', 4000), 800);
  assert.equal(allowancePointsFor('lite', 8000), 1600);
  assert.equal(allowancePointsFor('lite', 20_000), 2000, 'clamped at the ceiling');
  assert.equal(captureAllowance('lite', 10, 2000).pointsLeft, 390);
});

test('🚨 the fee can only ever RAISE — a comped supplier never loses points', () => {
  // A founder-comped supplier sits on ltd (70) having paid nothing. The fee
  // formula alone would hand them 50 and TAKE 20 POINTS AWAY. Nobody may lose
  // an allowance they already had because a wire was connected.
  assert.equal(allowancePointsFor('ltd', 0), 70, 'ltd must keep 70, not drop to the 50 floor');
  assert.equal(allowancePointsFor('ltd', 100), 70, 'below ltd the tier still wins');
  assert.equal(allowancePointsFor('ltd', 2000), 400, 'above ltd the fee wins');
});

test('unlimited stays unlimited — null points is not a number to compare', () => {
  assert.equal(allowancePointsFor('unli', 4000), null);
  assert.equal(captureAllowance('unli', 999, 4000).pointsLeft, null);
  assert.deepEqual(canCapture('unli', 10_000, 'clip', 0), { ok: true });
});

test('canCapture spends against the RAISED cap, not the tier cap', () => {
  // 50-point lite, 48 spent, one clip costs 8 → refused on the tier number...
  // Below the video threshold a clip is refused for that reason FIRST...
  assert.deepEqual(canCapture('lite', 48, 'clip', null), {
    ok: false,
    reason: 'video_not_allowed',
  });
  // ...and at 800 points (a ₱4,000 fee) it is both allowed and affordable.
  assert.deepEqual(canCapture('lite', 48, 'clip', 4000), { ok: true });
});

test('🚨 video unlocks at 800 credits, and not before', () => {
  // Owner 2026-08-26: "800 credits will allow them to take videos."
  // ⚠ Until this, `allowVideo` was `true` on EVERY tier, so canCapture's
  // video_not_allowed branch could never fire — a rule nothing enforced.
  assert.equal(VENDOR_PAPIC_VIDEO_MIN_POINTS, 800);
  assert.equal(allowVideoFor('lite', 2500), false, '500 shots — photos only');
  assert.equal(allowVideoFor('lite', 3995), false, 'just under the line');
  assert.equal(allowVideoFor('lite', 4000), true, 'exactly 800 — video');
  assert.equal(allowVideoFor('lite', null), false, 'an unread fee grants no video either');
  assert.equal(allowVideoFor('unli', 0), true, 'unlimited has no threshold to clear');
});

test('what a supplier READS matches what they get', () => {
  // The readout is the third surface. On the bare tier it said "50 pts" to
  // somebody with 800 — a screen contradicting the two beside it.
  assert.equal(tierReadout('lite', 2500), 'Papic Lite · 500 photos');
  assert.equal(tierReadout('lite', 4000), 'Papic Lite · 800 pts · photos + video');
  assert.equal(tierReadout('unli', 0), 'Papic Unli · unlimited');
});
