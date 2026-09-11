/**
 * isNewToSetnayan / NEW_TO_SETNAYAN_LABEL — the shared "does this shop have
 * anything to average yet" predicate (lib/reviews.ts), added for the owner
 * ruling 2026-09-11: "A shop with no reviews shows 'New', never '☆ 0.0 · 0'".
 *
 * `vendor_market_stats.avg_rating_overall` is `COALESCE(..., 0)` at the
 * database layer, never NULL, so a 0-review shop's rating IS 0 — a bare
 * `rating != null` check treats that 0 as a real average. This predicate is
 * the one place that decision is made correctly.
 *
 * Run: `pnpm test:unit` (globs lib/**\/*.test.ts + app/**\/*.test.ts, tsx --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isNewToSetnayan, NEW_TO_SETNAYAN_LABEL, formatStarRating } from './reviews';

test('exact copy is "New to Setnayan"', () => {
  assert.equal(NEW_TO_SETNAYAN_LABEL, 'New to Setnayan');
});

test('0 rating + 0 reviews (the COALESCE default for a brand-new shop) is new', () => {
  assert.equal(isNewToSetnayan(0, 0), true);
});

test('null rating + null reviews (nothing measured at all) is new', () => {
  assert.equal(isNewToSetnayan(null, null), true);
  assert.equal(isNewToSetnayan(undefined, undefined), true);
});

test('a positive rating with a positive count is NOT new', () => {
  assert.equal(isNewToSetnayan(4.8, 12), false);
  assert.equal(isNewToSetnayan(1, 1), false);
});

test('a positive rating but somehow a 0/null count is still new (never trust rating alone)', () => {
  assert.equal(isNewToSetnayan(4.8, 0), true);
  assert.equal(isNewToSetnayan(4.8, null), true);
});

test('a 0 rating but somehow a positive count is still new (never trust count alone)', () => {
  assert.equal(isNewToSetnayan(0, 5), true);
});

test('formatStarRating is unaffected (still used for the ≥1-review case)', () => {
  assert.equal(formatStarRating(4.8), '4.8');
  assert.equal(formatStarRating(0), '—');
});
