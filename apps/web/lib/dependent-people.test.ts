/**
 * Unit suite for the dependent age fence + age-out (the load-bearing safety
 * logic of the counsel-gated dependent layer). Invariants: only <18 or >50 are
 * storable (18–50 blocked → invite, never register); a child record hands over
 * at 18 for everyone (owner-locked 2026-07-16 — PH age of majority, RA 6809;
 * the 18 F / 21 M split lives only in the debut MILESTONE ladder); elder
 * records never auto-hand-over.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fenceBand,
  isFenceEligible,
  handOverAge,
  shouldHandOver,
  isClaimEligible,
  claimBirthdateCutoff,
  isDependentSex,
  isDependentRelationship,
  isDependentKind,
  isPersonDependent,
  DEPENDENT_KINDS,
  DEPENDENT_KIND_LABELS,
  DEPENDENT_DATE_LABELS,
  NON_PERSON_DEPENDENT_KINDS,
} from './dependent-people';

const TODAY = '2026-07-12';

test('fenceBand: <18 is child, >50 is elder, 18–50 is blocked', () => {
  assert.equal(fenceBand('2020-01-01', TODAY), 'child'); // age 6
  assert.equal(fenceBand('1960-01-01', TODAY), 'elder'); // age 66
  assert.equal(fenceBand('1995-01-01', TODAY), 'blocked'); // age 31
});

test('fenceBand: the exact boundaries — 18 blocked, 50 blocked, 51 elder', () => {
  assert.equal(fenceBand('2008-07-12', TODAY), 'blocked'); // exactly 18 → not <18
  assert.equal(fenceBand('1976-07-12', TODAY), 'blocked'); // exactly 50 → not >50
  assert.equal(fenceBand('2008-07-13', TODAY), 'child'); // 17 (turns 18 tomorrow)
  assert.equal(fenceBand('1975-07-12', TODAY), 'elder'); // exactly 51 → >50
});

test('isFenceEligible: child + elder yes, blocked no', () => {
  assert.equal(isFenceEligible('2020-01-01', TODAY), true);
  assert.equal(isFenceEligible('1960-01-01', TODAY), true);
  assert.equal(isFenceEligible('1995-01-01', TODAY), false);
});

test('handOverAge: 18 for everyone regardless of sex', () => {
  assert.equal(handOverAge('female'), 18);
  assert.equal(handOverAge('male'), 18);
  assert.equal(handOverAge(null), 18);
});

test('shouldHandOver: everyone hands over at 18', () => {
  assert.equal(shouldHandOver('2008-07-12', 'female', TODAY), true); // turned 18
  assert.equal(shouldHandOver('2008-07-12', 'male', TODAY), true); // turned 18 — same age, no debut wait
  assert.equal(shouldHandOver('2008-07-13', 'male', TODAY), false); // still 17
});

test('shouldHandOver: an elder never hands over', () => {
  assert.equal(shouldHandOver('1960-01-01', null, TODAY), false);
});

test('isClaimEligible: 18+ claims — child at 18 yes, 17 no, elder yes, no birthday no', () => {
  assert.equal(isClaimEligible('2008-07-12', TODAY), true); // turned 18 today
  assert.equal(isClaimEligible('2008-07-13', TODAY), false); // still 17
  assert.equal(isClaimEligible('1960-01-01', TODAY), true); // elder — past majority day one
  assert.equal(isClaimEligible(null, TODAY), false); // no birthday = no age proof
});

test('claimBirthdateCutoff: today − 18 years, calendar-exact', () => {
  assert.equal(claimBirthdateCutoff('2026-07-12'), '2008-07-12');
  // Born ON the cutoff = exactly 18 → eligible (<= comparison); a day after = 17.
  assert.equal(isClaimEligible(claimBirthdateCutoff(TODAY), TODAY), true);
  // Leap day clamps to Feb 28 — born Mar 1 is still 17 on the leap day, so a
  // Mar 1 rollover would hand over a minor's profile a day early.
  assert.equal(claimBirthdateCutoff('2028-02-29'), '2010-02-28');
});

test('validators reject unknown values', () => {
  assert.equal(isDependentSex('female'), true);
  assert.equal(isDependentSex('other'), false);
  assert.equal(isDependentRelationship('child'), true);
  assert.equal(isDependentRelationship('pet'), false);
});

// ── the kind vocabulary (owner 2026-07-30: children · business · items · pets) ─

test('the kind vocabulary WIDENED — it did not replace anything', () => {
  // 'other' must keep working: rows may hold it and code branches on it.
  for (const k of ['person', 'pet', 'other']) {
    assert.ok(isDependentKind(k), `${k} must stay valid — this is a widening`);
    assert.ok((DEPENDENT_KINDS as readonly string[]).includes(k));
  }
  // …and the two the owner named that used to collapse into 'other'.
  assert.ok(isDependentKind('business'));
  assert.ok(isDependentKind('item'));
  assert.equal(isDependentKind('corporation'), false);
  assert.equal(isDependentKind(''), false);
  assert.equal(isDependentKind(null), false);
});

test('every kind has a label AND a date label — no unlabeled option can ship', () => {
  for (const k of DEPENDENT_KINDS) {
    assert.ok(DEPENDENT_KIND_LABELS[k]?.length, `${k} has no picker label`);
    assert.ok(DEPENDENT_DATE_LABELS[k]?.length, `${k} has no date label`);
  }
  // The split is the whole point: a business is not born, a car has no birthday.
  assert.notEqual(DEPENDENT_DATE_LABELS.business, DEPENDENT_DATE_LABELS.person);
  assert.notEqual(DEPENDENT_DATE_LABELS.item, DEPENDENT_DATE_LABELS.person);
});

test('NON_PERSON_DEPENDENT_KINDS is DERIVED — it can never drift from the vocabulary', () => {
  // The rehome/transfer-of-care query matches on this list. While it was typed by
  // hand as ['pet','other'], widening the vocabulary would have silently broken
  // transfers for every new kind. Asserting the derivation is what stops that.
  assert.deepEqual(
    [...NON_PERSON_DEPENDENT_KINDS].sort(),
    DEPENDENT_KINDS.filter((k) => k !== 'person')
      .slice()
      .sort(),
  );
  assert.ok(NON_PERSON_DEPENDENT_KINDS.includes('business'));
  assert.ok(NON_PERSON_DEPENDENT_KINDS.includes('item'));
  assert.ok(!(NON_PERSON_DEPENDENT_KINDS as readonly string[]).includes('person'));
});

test('isPersonDependent: unknown and missing read as PERSON — the stricter side', () => {
  // person is the column default and the legacy pre-discriminator value. Reading
  // an unrecognised row as a person APPLIES the fence/consent/majority rules
  // rather than waiving them, which is the only safe direction to fail in.
  assert.equal(isPersonDependent('person'), true);
  assert.equal(isPersonDependent(null), true);
  assert.equal(isPersonDependent(undefined), true);
  assert.equal(isPersonDependent('who knows'), false);
  for (const k of NON_PERSON_DEPENDENT_KINDS) {
    assert.equal(isPersonDependent(k), false, `${k} must not be treated as a person`);
  }
});

test('the age fence is a PERSON rule — it never runs on a business or a pet', () => {
  // A 12-year-old sari-sari store and a 3-year-old dog both land in the 'child'
  // band arithmetically. That is exactly why the fence is not applied by kind
  // here but by the CALLER (dependent-actions gates it on isPerson): the maths
  // is human maths, and a business must never be refused as "an adult who should
  // be invited instead", nor accepted as "a minor".
  assert.equal(fenceBand('2014-01-01', TODAY), 'child'); // a 12-year-old shop
  assert.equal(fenceBand('2000-01-01', TODAY), 'blocked'); // a 26-year-old car
  // The guard that matters: non-person kinds are not persons, so the caller skips.
  assert.equal(isPersonDependent('business'), false);
  assert.equal(isPersonDependent('item'), false);
});
