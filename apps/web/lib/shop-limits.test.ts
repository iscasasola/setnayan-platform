/**
 * Locks the multi-business dial (M1, owner-locked 2026-07-09): the concept is
 * available but capped — one user owns at most MAX_SHOPS_PER_USER shops "for
 * now", openable later. This suite pins the cap at 1 and the boundary logic so
 * the dial can't drift silently, and so raising it above 1 is a deliberate edit
 * (which must ship with the deferred RLS/routing flip — see shop-limits.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SHOPS_PER_USER, canOpenAnotherShop } from './shop-limits';

test('the cap is 1 for now (owner-locked)', () => {
  assert.equal(MAX_SHOPS_PER_USER, 1);
});

test('a user with no shops may open one', () => {
  assert.equal(canOpenAnotherShop(0), true);
});

test('a user already at the cap may not open another', () => {
  assert.equal(canOpenAnotherShop(MAX_SHOPS_PER_USER), false);
  assert.equal(canOpenAnotherShop(1), false);
});

test('the boundary tracks the cap wherever it is set', () => {
  // Below the cap → allowed; at or above → blocked. Guards against a future
  // off-by-one when the dial is raised.
  for (let owned = 0; owned < MAX_SHOPS_PER_USER; owned++) {
    assert.equal(canOpenAnotherShop(owned), true, `owned=${owned} should be allowed`);
  }
  assert.equal(canOpenAnotherShop(MAX_SHOPS_PER_USER), false);
  assert.equal(canOpenAnotherShop(MAX_SHOPS_PER_USER + 1), false);
});
