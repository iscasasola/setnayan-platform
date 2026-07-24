/**
 * Unit suite for vendor registration-number normalization + parsing — the
 * anti-farm identity key. These are pure functions; the DB partial-unique
 * index is what actually enforces uniqueness, but the normalizer is what makes
 * two "different-looking" numbers collide, so it is the safety-critical piece.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeRegistrationNumber,
  cleanRegistrationNumberRaw,
  parseRegistrationNumber,
  REGISTRATION_NUMBER_MIN_LENGTH,
  REGISTRATION_NUMBER_MAX_LENGTH,
} from './vendor-registration-number';

test('normalize: strips dashes/spaces/case so equivalent TINs collide', () => {
  const a = normalizeRegistrationNumber('123-456-789-000');
  const b = normalizeRegistrationNumber('123 456 789 000');
  const c = normalizeRegistrationNumber('123456789000');
  assert.equal(a, '123456789000');
  assert.equal(a, b);
  assert.equal(a, c);
});

test('normalize: uppercases alphanumeric (DTI/SEC) identities', () => {
  assert.equal(normalizeRegistrationNumber('dti-cn-1234567'), 'DTICN1234567');
  assert.equal(
    normalizeRegistrationNumber('DTI CN 1234567'),
    normalizeRegistrationNumber('dtiCn1234567'),
  );
});

test('normalize: rejects blank / non-string / too-short as null', () => {
  assert.equal(normalizeRegistrationNumber(''), null);
  assert.equal(normalizeRegistrationNumber('   '), null);
  assert.equal(normalizeRegistrationNumber('-- --'), null);
  assert.equal(normalizeRegistrationNumber(null), null);
  assert.equal(normalizeRegistrationNumber(undefined), null);
  // 4 usable chars < floor of 5.
  assert.equal(normalizeRegistrationNumber('1-2-3-4'), null);
});

test('normalize: exactly at the floor is accepted', () => {
  const atFloor = '1'.repeat(REGISTRATION_NUMBER_MIN_LENGTH);
  assert.equal(normalizeRegistrationNumber(atFloor), atFloor);
});

test('normalize: clamps absurdly long input to the max length', () => {
  const huge = '9'.repeat(500);
  const out = normalizeRegistrationNumber(huge);
  assert.equal(out?.length, REGISTRATION_NUMBER_MAX_LENGTH);
});

test('cleanRaw: trims + drops blanks, keeps the human formatting', () => {
  assert.equal(cleanRegistrationNumberRaw('  123-456-789-000  '), '123-456-789-000');
  assert.equal(cleanRegistrationNumberRaw('   '), null);
  assert.equal(cleanRegistrationNumberRaw(null), null);
});

test('parse: empty vs too_short vs ok are distinguished', () => {
  assert.deepEqual(parseRegistrationNumber('  '), { ok: false, reason: 'empty' });
  assert.deepEqual(parseRegistrationNumber('1-2-3'), { ok: false, reason: 'too_short' });
  assert.deepEqual(parseRegistrationNumber(' 123-456-789-000 '), {
    ok: true,
    raw: '123-456-789-000',
    normalized: '123456789000',
  });
});
