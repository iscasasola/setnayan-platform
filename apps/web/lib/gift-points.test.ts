/**
 * 🎁 Gift points match the owner's ruled values (DECISION_LOG 15 Nov "GIFT POINTS = ONE POINT PER ₱10…" and
 * "Gift points · Event Pro = 600"). Sabotage seen red: drop the rounding (₱5,690 → 569) → red. The figures below are the RULING's, not prices: the app reads real prices from the catalogue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { giftPointsForPrice } from './gift-points';

test('every ruled value: ₱99 → 10 · ₱499 → 50 · ₱999 → 100 · ₱2,990 → 300 · ₱5,690 → 600 · ₱9,990 → 1,000', () => {
  for (const [price, points] of [
    [99, 10],
    [499, 50],
    [999, 100],
    [2990, 300],
    [5690, 600],
    [9990, 1000],
  ] as const) {
    assert.equal(giftPointsForPrice(price), points, `₱${price}`);
  }
});

test('no price, no points — never a guessed number', () => {
  for (const p of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(giftPointsForPrice(p), null);
});
