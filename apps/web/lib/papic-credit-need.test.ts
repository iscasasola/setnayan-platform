/**
 * GUARD — "How many do I need?" (owner 2026-10-23): the sum, the rung it lands on (exact · between · above the top),
 * and the two inputs it may never guess — a refused guest read and a per-guest number the couple never set.
 *
 * Sabotage (2026-10-23): `rungForNeed` picks the LARGEST rung that is below the need → red; `creditsNeeded` treats a
 * refused guest read as 0 → red. Restored → green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditsNeeded, rungForNeed } from './papic-credit-need';

const RUNGS = [{ points: 100 }, { points: 400 }, { points: 1000 }, { points: 2000 }];

test('the sum — guests × per guest − left, never below zero', () => {
  assert.equal(creditsNeeded({ coming: 150, perGuest: 10, left: 240 }), 1260);
  assert.equal(creditsNeeded({ coming: 10, perGuest: 10, left: 500 }), 0);
  assert.equal(creditsNeeded({ coming: 3, perGuest: 2.5, left: 0 }), 8);
});

test('never a guess: a refused guest read, no per-guest number, unread credits', () => {
  assert.equal(creditsNeeded({ coming: null, perGuest: 10, left: 0 }), null, 'a refused guest read was counted as nobody');
  assert.equal(creditsNeeded({ coming: 150, perGuest: null, left: 0 }), null, 'a per-guest number was invented');
  assert.equal(creditsNeeded({ coming: 150, perGuest: 10, left: null }), null);
});

test('the rung: exact · between · above the top · enough already', () => {
  assert.deepEqual(rungForNeed(RUNGS, 400), { index: 1, top: false, enough: false }, 'exact');
  assert.deepEqual(rungForNeed(RUNGS, 401), { index: 2, top: false, enough: false }, 'between → the next one up');
  assert.deepEqual(rungForNeed(RUNGS, 1), { index: 0, top: false, enough: false });
  assert.deepEqual(rungForNeed(RUNGS, 5000), { index: 3, top: true, enough: false }, 'above the top → the top, said');
  assert.deepEqual(rungForNeed(RUNGS, 0), { index: 0, top: false, enough: true });
  assert.deepEqual(rungForNeed([], 10), { index: 0, top: false, enough: false });
});
