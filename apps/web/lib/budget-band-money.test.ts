import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BAND_ROUNDING_PHP,
  BAND_SPREAD_HIGH,
  BAND_SPREAD_LOW,
  bandMedianPerHeadPhp,
  bandRangePhp,
  bandReachBudgetPhp,
} from '@/lib/budget-band-money';
import { BUDGET_BANDS_FALLBACK } from '@/lib/budget-bands-shared';

// ── bandRangePhp — the range the couple is actually shown ──────────────────

test('classic at 150 guests reproduces the range the onboarding prints', () => {
  // med 5000/head → 0.8×5000×150 = ₱600,000 · 1.2×5000×150 = ₱900,000.
  assert.deepEqual(bandRangePhp(5000, 150), { lowPhp: 600_000, highPhp: 900_000 });
});

test('the spread constants are the ones the arithmetic uses', () => {
  const med = 5000;
  const pax = 200;
  const r = bandRangePhp(med, pax);
  assert.equal(r?.lowPhp, Math.round((med * BAND_SPREAD_LOW * pax) / BAND_ROUNDING_PHP) * BAND_ROUNDING_PHP);
  assert.equal(r?.highPhp, Math.round((med * BAND_SPREAD_HIGH * pax) / BAND_ROUNDING_PHP) * BAND_ROUNDING_PHP);
});

test('a small celebration still gets a real range, never a collapsed one', () => {
  // Both ends round to ₱0 at this size; the range must still be a range.
  const r = bandRangePhp(2000, 10);
  assert.ok(r);
  assert.ok(r.highPhp > r.lowPhp, 'high must exceed low');
  assert.equal(r.highPhp, r.lowPhp + BAND_ROUNDING_PHP);
});

test('no ceiling and no guests are UNKNOWN, never ₱0', () => {
  // ₱0 would read as "this couple can afford nothing" and sink every shop.
  assert.equal(bandRangePhp(0, 150), null); // no_limit carries med 0
  assert.equal(bandRangePhp(5000, 0), null);
  assert.equal(bandRangePhp(5000, null), null);
  assert.equal(bandRangePhp(null, 150), null);
  assert.equal(bandRangePhp(undefined, undefined), null);
});

test('a nonsense median or guest count is unknown, not a number', () => {
  assert.equal(bandRangePhp(Number.NaN, 150), null);
  assert.equal(bandRangePhp(5000, Number.POSITIVE_INFINITY), null);
  assert.equal(bandRangePhp(-5000, 150), null);
});

// ── bandReachBudgetPhp — reach fails OPEN (high), never closed ─────────────

test('the reach budget is the TOP of the band, so nobody is sunk by an estimate', () => {
  const r = bandRangePhp(5000, 150)!;
  assert.equal(bandReachBudgetPhp(5000, 150), r.highPhp);
  assert.ok(bandReachBudgetPhp(5000, 150)! > r.lowPhp);
});

test('the reach budget rises with the band and with the guest count', () => {
  const essentials = bandReachBudgetPhp(2000, 150)!;
  const luxury = bandReachBudgetPhp(15000, 150)!;
  assert.ok(luxury > essentials);
  assert.ok(bandReachBudgetPhp(5000, 300)! > bandReachBudgetPhp(5000, 150)!);
});

test('unknown stays unknown', () => {
  assert.equal(bandReachBudgetPhp(null, 150), null);
  assert.equal(bandReachBudgetPhp(0, 150), null);
});

// ── bandMedianPerHeadPhp — the ladder lookup ───────────────────────────────

test('every priced band in the shipped ladder resolves to its median', () => {
  for (const band of BUDGET_BANDS_FALLBACK) {
    const med = bandMedianPerHeadPhp(BUDGET_BANDS_FALLBACK, band.value);
    if (band.med > 0) assert.equal(med, band.med, `${band.value} should resolve`);
    else assert.equal(med, null, `${band.value} has no ceiling and must be null`);
  }
});

test('the legacy `nolimit` spelling resolves the same way as `no_limit`', () => {
  // create-event still normalises this spelling; both must mean "no ceiling".
  assert.equal(bandMedianPerHeadPhp(BUDGET_BANDS_FALLBACK, 'nolimit'), null);
  assert.equal(bandMedianPerHeadPhp(BUDGET_BANDS_FALLBACK, 'no_limit'), null);
});

test('an unknown or empty band is unknown, never a default guess', () => {
  assert.equal(bandMedianPerHeadPhp(BUDGET_BANDS_FALLBACK, 'gilded'), null);
  assert.equal(bandMedianPerHeadPhp(BUDGET_BANDS_FALLBACK, ''), null);
  assert.equal(bandMedianPerHeadPhp(BUDGET_BANDS_FALLBACK, null), null);
  assert.equal(bandMedianPerHeadPhp([], 'classic'), null);
});

test('a band whose median is missing from the DB row is unknown', () => {
  assert.equal(bandMedianPerHeadPhp([{ value: 'classic', med: 0 }], 'classic'), null);
});
