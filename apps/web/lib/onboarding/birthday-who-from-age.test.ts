import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  birthdayWhoFromAge,
  GOLDEN_MIN_AGE,
  KIDS_MAX_AGE,
} from './birthday-who-from-age';

test('the owner’s own case: 40 is an adult birthday, not a bracket to ask about', () => {
  // Read from production: his birth_date is 1986-12-16 and his sex is NOT on
  // file. 40 is above BOTH debut ages, so it resolves without one.
  assert.equal(birthdayWhoFromAge(40), 'adult');
  assert.equal(birthdayWhoFromAge(40, null), 'adult');
  assert.equal(birthdayWhoFromAge(40, 'male'), 'adult');
  assert.equal(birthdayWhoFromAge(40, 'female'), 'adult');
});

test('🚨 a thirteen-year-old is not an adult — the old cut-off said they were', () => {
  // The regression this rewrite exists for. A hand-picked line at 12 made every
  // teenager "An adult birthday", which is the owner's own correction pointed
  // the other way. No option is true of a 15-year-old, so the flow ASKS.
  for (const age of [13, 15, 17]) {
    assert.equal(birthdayWhoFromAge(age), null, `${age} must be asked about, not assumed`);
    assert.equal(birthdayWhoFromAge(age, 'male'), null);
    assert.equal(birthdayWhoFromAge(age, 'female'), null);
  }
});

test('the debut is the line, and it is a fact about the person', () => {
  // Owner: "that is an adult party since that is already above 21 (debut for
  // men)". A woman's debut is 18, so 19 is already her adult years; a man's is
  // 21, so 19 is not yet his.
  assert.equal(birthdayWhoFromAge(18, 'female'), 'milestone');
  assert.equal(birthdayWhoFromAge(19, 'female'), 'adult');
  assert.equal(birthdayWhoFromAge(21, 'male'), 'milestone');
  assert.equal(birthdayWhoFromAge(22, 'male'), 'adult');
  assert.equal(birthdayWhoFromAge(19, 'male'), null, 'short of his debut — ask');
});

test('an age whose meaning depends on a sex we do not hold is asked, never guessed', () => {
  // 19 and 20 are past a woman's debut and short of a man's.
  for (const age of [19, 20]) {
    assert.equal(birthdayWhoFromAge(age, null), null, `${age} is undecidable without a sex`);
  }
  // 18 and 21 are both debut ages in the unknown ladder, so they still resolve.
  assert.equal(birthdayWhoFromAge(18, null), 'milestone');
  assert.equal(birthdayWhoFromAge(21, null), 'milestone');
});

test('children and the golden years keep their own options', () => {
  assert.equal(birthdayWhoFromAge(1), 'kids');
  assert.equal(birthdayWhoFromAge(7), 'kids');
  assert.equal(birthdayWhoFromAge(KIDS_MAX_AGE), 'kids');
  assert.equal(birthdayWhoFromAge(GOLDEN_MIN_AGE), 'golden');
  assert.equal(birthdayWhoFromAge(GOLDEN_MIN_AGE - 1), 'adult');
  assert.equal(birthdayWhoFromAge(120), 'golden');
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

test('every age either resolves to a real option or is asked — never to a wrong one', () => {
  const legal = new Set(['kids', 'milestone', 'adult', 'golden']);
  let checked = 0;
  let asked = 0;
  for (const sex of ['female', 'male', null] as const) {
    for (let a = 1; a <= 130; a += 1) {
      const got = birthdayWhoFromAge(a, sex);
      if (got === null) asked += 1;
      else assert.ok(legal.has(got), `age ${a} (${sex}) produced ${got}`);
      // Nobody past a debut age may be filed as a child.
      if (a > 21) assert.notEqual(got, 'kids', `age ${a} must never be a kids' party`);
      // And nobody below one may be filed as an adult.
      if (a < 18) assert.notEqual(got, 'adult', `age ${a} must never be an adult birthday`);
      checked += 1;
    }
  }
  // Count what was examined — a loop that skips everything passes.
  assert.equal(checked, 390);
  assert.ok(asked > 0 && asked < checked, `the ask-band must be real but not everything (${asked})`);
});
