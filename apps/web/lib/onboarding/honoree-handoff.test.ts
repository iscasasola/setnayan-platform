/**
 * The create → onboarding honoree carry — freshness window.
 *
 * The storage half is guarded by `typeof window === 'undefined'` and cannot run
 * under node:test; the decision it turns on is this pure predicate, so that is
 * what is asserted — including the clock-went-backwards case, where a stamp from
 * the future must read as STALE rather than as freshly written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HONOREE_HANDOFF_TTL_MS, isHandoffFresh } from './honoree-handoff';

const NOW = 1_800_000_000_000;

test('a stamp inside the window is fresh', () => {
  assert.equal(isHandoffFresh(NOW, NOW), true);
  assert.equal(isHandoffFresh(NOW - 1000, NOW), true);
  assert.equal(isHandoffFresh(NOW - (HONOREE_HANDOFF_TTL_MS - 1), NOW), true);
});

test('a stamp at or past the window is stale', () => {
  assert.equal(isHandoffFresh(NOW - HONOREE_HANDOFF_TTL_MS, NOW), false);
  assert.equal(isHandoffFresh(NOW - 60 * 60 * 1000, NOW), false);
});

test('a stamp from the future is a clock change, not a fresh value', () => {
  assert.equal(isHandoffFresh(NOW + 1, NOW), false);
});

test('a non-numeric or absent stamp is never fresh', () => {
  assert.equal(isHandoffFresh(undefined, NOW), false);
  assert.equal(isHandoffFresh(null, NOW), false);
  assert.equal(isHandoffFresh('1800000000000', NOW), false);
  assert.equal(isHandoffFresh(Number.NaN, NOW), false);
});
