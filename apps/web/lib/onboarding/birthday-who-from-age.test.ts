import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  birthdayWhoFromAge,
  GOLDEN_MIN_AGE,
  KIDS_MAX_AGE,
  MILESTONE_AGES,
} from './birthday-who-from-age';

test('the owner’s own case: 40 is an adult birthday, not a bracket to ask about', () => {
  assert.equal(birthdayWhoFromAge(40), 'adult');
});

test('each option gets the ages its own label claims', () => {
  assert.equal(birthdayWhoFromAge(1), 'kids');
  assert.equal(birthdayWhoFromAge(7), 'kids');
  assert.equal(birthdayWhoFromAge(KIDS_MAX_AGE), 'kids');
  assert.equal(birthdayWhoFromAge(KIDS_MAX_AGE + 1), 'adult');
  for (const a of MILESTONE_AGES) assert.equal(birthdayWhoFromAge(a), 'milestone');
  assert.equal(birthdayWhoFromAge(GOLDEN_MIN_AGE), 'golden');
  assert.equal(birthdayWhoFromAge(GOLDEN_MIN_AGE - 1), 'adult');
  assert.equal(birthdayWhoFromAge(120), 'golden');
});

test('milestone beats golden is impossible, and the boundaries do not overlap', () => {
  // 18 and 21 are both below GOLDEN_MIN_AGE and above KIDS_MAX_AGE, so no age
  // can satisfy two branches — pinned so moving a constant cannot create an
  // ambiguous age that silently resolves by branch order.
  for (const a of MILESTONE_AGES) {
    assert.ok(a > KIDS_MAX_AGE, `${a} must not also be a kids' age`);
    assert.ok(a < GOLDEN_MIN_AGE, `${a} must not also be a golden age`);
  }
});

test('nothing is guessed from a value we do not actually have', () => {
  for (const bad of [null, undefined, 0, -1, 40.5, 131, Number.NaN, '40' as unknown as number]) {
    assert.equal(
      birthdayWhoFromAge(bad as number | null),
      null,
      `${String(bad)} must leave the question standing, not fill it in`,
    );
  }
});

test('every age 1..130 resolves to a real option', () => {
  const legal = new Set(['kids', 'milestone', 'adult', 'golden']);
  let checked = 0;
  for (let a = 1; a <= 130; a += 1) {
    const got = birthdayWhoFromAge(a);
    assert.ok(got && legal.has(got), `age ${a} produced ${String(got)}`);
    checked += 1;
  }
  // Count what was examined — a loop that skips everything passes.
  assert.equal(checked, 130);
});
