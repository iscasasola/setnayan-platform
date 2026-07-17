/**
 * Unit suite for the vendor on-the-day Papic capture tier + capture-points model
 * (owner-locked 2026-07-18). Invariants: the tier is EARNED by the token path
 * (founder-comp or a spent/held token → Ltd; else Lite), a paid Unli upgrade
 * wins, Lite is photos-only, and the points ledger (photo=1, clip=3) enforces
 * each tier's budget.
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
  type VendorAcceptProvenance,
} from './vendor-papic-tier';

const prov = (p: Partial<VendorAcceptProvenance>): VendorAcceptProvenance => ({
  hasUnlock: false,
  founderComp: false,
  tokensBurned: 0,
  hasActiveHold: false,
  ...p,
});

test('capture points: photo=1, clip=3', () => {
  assert.equal(pointsForMedia('photo'), 1);
  assert.equal(pointsForMedia('clip'), 3);
  assert.equal(
    pointsSpent([{ media_type: 'photo' }, { media_type: 'clip' }, { media_type: 'photo' }]),
    5,
  );
  assert.equal(pointsSpent([]), 0);
});

test('tier specs: Lite 20/photos-only, Ltd 70/video, Unli unlimited', () => {
  assert.deepEqual(
    { p: tierSpec('lite').points, v: tierSpec('lite').allowVideo },
    { p: 20, v: false },
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

test('base tier: founder-comp accept → Ltd (as-if-paid)', () => {
  assert.equal(
    baseTierFromProvenance(prov({ hasUnlock: true, founderComp: true, tokensBurned: 0 })),
    'ltd',
  );
});

test('base tier: token burned (live or consumed hold) → Ltd', () => {
  assert.equal(
    baseTierFromProvenance(prov({ hasUnlock: true, tokensBurned: 1 })),
    'ltd',
  );
});

test('base tier: reserved (held) token, not yet consumed → Ltd', () => {
  assert.equal(
    baseTierFromProvenance(prov({ hasUnlock: true, tokensBurned: 0, hasActiveHold: true })),
    'ltd',
  );
});

test('base tier: unlock exists but no token spent + not founder → Lite', () => {
  assert.equal(
    baseTierFromProvenance(prov({ hasUnlock: true, tokensBurned: 0, hasActiveHold: false })),
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
  assert.equal(resolveVendorPapicTier(prov({ hasUnlock: true, tokensBurned: 2 }), false), 'ltd');
  assert.equal(resolveVendorPapicTier(prov({ hasUnlock: true }), false), 'lite');
});

test('canCapture: Lite blocks clips (photos-only)', () => {
  assert.deepEqual(canCapture('lite', 0, 'clip'), {
    ok: false,
    reason: 'video_not_allowed',
  });
  assert.deepEqual(canCapture('lite', 0, 'photo'), { ok: true });
});

test('canCapture: Lite runs out at 20 photos', () => {
  assert.deepEqual(canCapture('lite', 19, 'photo'), { ok: true });
  assert.deepEqual(canCapture('lite', 20, 'photo'), {
    ok: false,
    reason: 'out_of_points',
  });
});

test('canCapture: Ltd — a clip needs 3 points of headroom', () => {
  assert.deepEqual(canCapture('ltd', 67, 'clip'), { ok: true }); // 67 + 3 = 70
  assert.deepEqual(canCapture('ltd', 68, 'clip'), {
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
    allowVideo: false,
    pointsCap: 20,
    pointsSpent: 5,
    pointsLeft: 15,
  });
  assert.equal(captureAllowance('lite', 999).pointsLeft, 0);
  assert.equal(captureAllowance('unli', 999).pointsLeft, null);
  // Negative/garbage spent is clamped to 0.
  assert.equal(captureAllowance('ltd', -3).pointsSpent, 0);
});

test('tierReadout: human badge strings', () => {
  assert.equal(tierReadout('lite'), 'Papic Lite · 20 photos');
  assert.equal(tierReadout('ltd'), 'Papic Ltd · 70 pts · photos + video');
  assert.equal(tierReadout('unli'), 'Papic Unli · unlimited');
});
