import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthdayMilestoneFromAge } from './birthday-milestone-from-age';

test('the owner’s own case answers without a question', () => {
  // 40, sex not on file — past BOTH debut ages, so it cannot be ambiguous.
  assert.equal(birthdayMilestoneFromAge(40), 'adult_regular');
  assert.equal(birthdayMilestoneFromAge(40, 'male'), 'adult_regular');
  assert.equal(birthdayMilestoneFromAge(40, 'female'), 'adult_regular');
});

test('the named child rungs win over the generic one', () => {
  assert.equal(birthdayMilestoneFromAge(1), '1st_birthday');
  assert.equal(birthdayMilestoneFromAge(7), '7th_birthday');
  for (const age of [2, 3, 5, 6, 8, 11, 12]) {
    assert.equal(birthdayMilestoneFromAge(age), 'kids_regular', `age ${age}`);
  }
});

test('the elder rungs are EXACT ages, never floors', () => {
  assert.equal(birthdayMilestoneFromAge(60), '60th');
  assert.equal(birthdayMilestoneFromAge(75), '75th');
  assert.equal(birthdayMilestoneFromAge(80), '80th');
  assert.equal(birthdayMilestoneFromAge(90), '90th');
  assert.equal(birthdayMilestoneFromAge(100), '100th');
  // A 61st is not a 60th. The ladder names 60, not "60 onwards" — and this is
  // where this function deliberately DISAGREES with birthdayWhoFromAge, whose
  // own option label says "60+".
  assert.equal(birthdayMilestoneFromAge(61), 'adult_regular');
  assert.equal(birthdayMilestoneFromAge(70), 'adult_regular');
});

test('🔴 a 21st is ASKED, because no rung can name it truthfully', () => {
  // The ladder makes 21 a man's debut and the field's only debut rung says
  // "18th (debut)". Answering it would put a wrong word in his mouth about his
  // own party; answering adult_regular would erase the milestone.
  assert.equal(birthdayMilestoneFromAge(21, 'male'), null);
  assert.equal(birthdayMilestoneFromAge(21), null);
  // A woman's 21st is past her debut and is an ordinary adult birthday.
  assert.equal(birthdayMilestoneFromAge(21, 'female'), 'adult_regular');
});

test('an 18th is the debut only where 18 IS the debut', () => {
  assert.equal(birthdayMilestoneFromAge(18, 'female'), '18th_debut');
  assert.equal(birthdayMilestoneFromAge(18), '18th_debut');
  // For a man the ladder's debut is 21, so his 18th is not the debut rung.
  assert.notEqual(birthdayMilestoneFromAge(18, 'male'), '18th_debut');
});

test('when no rung is true, it asks — it never guesses', () => {
  // A teenager below their debut: none of the ten rungs describes them.
  for (const age of [13, 15, 17]) {
    assert.equal(birthdayMilestoneFromAge(age), null, `age ${age}`);
  }
  // 19–20 with no sex on file are past a woman's debut and short of a man's.
  assert.equal(birthdayMilestoneFromAge(19), null);
  assert.equal(birthdayMilestoneFromAge(20), null);
  assert.equal(birthdayMilestoneFromAge(19, 'female'), 'adult_regular');
  // Nothing readable to reason from.
  assert.equal(birthdayMilestoneFromAge(null), null);
  assert.equal(birthdayMilestoneFromAge(undefined), null);
  assert.equal(birthdayMilestoneFromAge(0), null);
  assert.equal(birthdayMilestoneFromAge(-3), null);
  assert.equal(birthdayMilestoneFromAge(4.5), null);
  assert.equal(birthdayMilestoneFromAge(200), null);
});

test('every answer it gives is one of the field’s own options', () => {
  // The rungs are copied from specialty-catalog's birthday milestone_type. A
  // value outside this set renders as a raw key at a customer.
  const OPTIONS = new Set([
    '1st_birthday', '7th_birthday', 'kids_regular', '18th_debut',
    '60th', '75th', '80th', '90th', '100th', 'adult_regular',
  ]);
  for (let age = 1; age <= 130; age += 1) {
    for (const sex of [null, 'male', 'female'] as const) {
      const got = birthdayMilestoneFromAge(age, sex);
      if (got !== null) assert.ok(OPTIONS.has(got), `age ${age}/${sex} → ${got}`);
    }
  }
});
