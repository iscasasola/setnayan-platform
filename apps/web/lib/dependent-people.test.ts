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
