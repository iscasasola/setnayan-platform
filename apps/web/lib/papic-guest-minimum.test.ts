/**
 * A MINIMUM IS A PROMISE, AND A PROMISE HAS TO BE PAYABLE.
 *
 * Every other number on the allotment sheet is a CEILING — the most one guest
 * may take. The shipped `splitTheRest` docblock records what that means
 * (measured 2026-09-16): nothing is held back for anybody, every credit comes
 * out of one pot first come first served, so **no guest is guaranteed
 * anything.** This is the other half.
 *
 * 🔑 THE ASYMMETRY IS THE WHOLE BUILD. A ceiling nobody can reach costs nothing
 * — it never binds, and nobody was told about it. A minimum the pot cannot
 * cover is a sentence spoken to every guest at once and broken for all of them,
 * discovered one at a time at the party. So this one is checked, and the
 * SHORTFALL is named: "add 4,000 credits" is actionable, "that will not work"
 * is not.
 *
 * Run: cd apps/web && npx tsx --test lib/papic-guest-minimum.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOTMENT_STORAGE,
  guestMinimumVerdict,
  summariseMinimum,
} from './papic-guest-allotments';

test('AN UNPAYABLE MINIMUM IS CAUGHT, AND THE SHORTFALL IS NAMED', () => {
  /*
    120 guests promised 80 credits each is 9,600 credits. A celebration holding
    5,600 is 4,000 short — and 4,000 is a number they can buy.

    Sabotage to watch this go red: compare `floorPoints` against the pot instead
    of `floorPoints × guestCount`. That reads "80 ≤ 5,600, fine" and ships the
    broken promise.
  */
  const v = guestMinimumVerdict({ floorPoints: 80, guestCount: 120, pot: 5_600 });
  assert.equal(v.status, 'short');
  assert.equal(v.status === 'short' && v.promised, 9_600);
  assert.equal(v.status === 'short' && v.shortfall, 4_000);
  assert.match(summariseMinimum(v), /4,000 short/);
  assert.match(summariseMinimum(v), /add 4,000 credits/);
});

test('A PAYABLE MINIMUM SAYS SO WITHOUT A WARNING', () => {
  const v = guestMinimumVerdict({ floorPoints: 40, guestCount: 120, pot: 5_600 });
  assert.equal(v.status, 'payable');
  assert.equal(v.status === 'payable' && v.promised, 4_800);
  assert.doesNotMatch(summariseMinimum(v), /short/);

  // Exactly affordable is affordable — a boundary a `<` would get wrong.
  assert.equal(
    guestMinimumVerdict({ floorPoints: 50, guestCount: 100, pot: 5_000 }).status,
    'payable',
  );
  assert.equal(
    guestMinimumVerdict({ floorPoints: 50, guestCount: 100, pot: 4_999 }).status,
    'short',
  );
});

test('NO MINIMUM SAYS NOTHING AT ALL — and a blank is not a zero', () => {
  assert.equal(guestMinimumVerdict({ floorPoints: null, guestCount: 120, pot: 0 }).status, 'none');
  assert.equal(summariseMinimum({ status: 'none' }), '');
  // 0 would mean "nobody may shoot", which is what the capture window is for.
  assert.equal(guestMinimumVerdict({ floorPoints: 0, guestCount: 120, pot: 9_999 }).status, 'none');
});

test('NOT KNOWABLE IS NOT "FINE" — an empty guest list says nothing', () => {
  assert.equal(guestMinimumVerdict({ floorPoints: 80, guestCount: 0, pot: 9_999 }).status, 'unknown');
  assert.equal(summariseMinimum({ status: 'unknown' }), '');
});

test('THE MINIMUM HAS ITS OWN STORAGE KEY AND IT IS NOT THE CEILING’S', () => {
  /*
    ⚠ THREE NUMBERS ON THIS SURFACE CALL THEMSELVES SOMETHING LIKE "per guest",
    and the module's own docblock records that two of them are both 150. A
    fourth that reused a name would be the same defect again, so the minimum
    gets `floor` and is asserted to be distinct from every other key.
  */
  assert.equal(ALLOTMENT_STORAGE.floor, 'papic_guest_spend_floor_points');
  const keys = [
    ALLOTMENT_STORAGE.enabled,
    ALLOTMENT_STORAGE.everyoneElse,
    ALLOTMENT_STORAGE.releasedAt,
    ALLOTMENT_STORAGE.floor,
  ];
  assert.equal(new Set(keys).size, keys.length, 'no two allotment columns may share a name');
  assert.notEqual(
    ALLOTMENT_STORAGE.floor,
    'points_per_guest',
    'that name is taken by the pool multiplier and means something else',
  );
});
