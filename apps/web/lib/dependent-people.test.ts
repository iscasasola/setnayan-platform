/**
 * Unit suite for the dependent age fence + age-out (the load-bearing safety
 * logic of the counsel-gated dependent layer). Invariants: only <18 or >50 are
 * storable (18–50 blocked → invite, never register); a child record hands over
 * at 18 (F) / 21 (M); elder records never hand over.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fenceBand,
  isFenceEligible,
  handOverAge,
  shouldHandOver,
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

test('handOverAge: female 18, male 21, unknown 18', () => {
  assert.equal(handOverAge('female'), 18);
  assert.equal(handOverAge('male'), 21);
  assert.equal(handOverAge(null), 18);
});

test('shouldHandOver: a girl hands over at 18, a boy at 21', () => {
  assert.equal(shouldHandOver('2008-07-12', 'female', TODAY), true); // turned 18
  assert.equal(shouldHandOver('2008-07-12', 'male', TODAY), false); // 18, boy waits for 21
  assert.equal(shouldHandOver('2005-07-12', 'male', TODAY), true); // turned 21
});

test('shouldHandOver: an elder never hands over', () => {
  assert.equal(shouldHandOver('1960-01-01', null, TODAY), false);
});

test('validators reject unknown values', () => {
  assert.equal(isDependentSex('female'), true);
  assert.equal(isDependentSex('other'), false);
  assert.equal(isDependentRelationship('child'), true);
  assert.equal(isDependentRelationship('pet'), false);
});
