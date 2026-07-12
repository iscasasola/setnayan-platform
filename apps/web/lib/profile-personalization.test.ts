/**
 * Unit suite for the optional self-profile fields. Invariants: validators accept
 * only the known sensitive-PI values, normalization degrades to null (never
 * throws), and the consent-transition logic stamps on first value, clears on
 * withdrawal, and never re-dates an unchanged value.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CIVIL_STATUSES,
  RELIGIONS,
  CIVIL_STATUS_LABELS,
  RELIGION_LABELS,
  isCivilStatus,
  isReligion,
  normalizeCivilStatus,
  normalizeReligion,
  consentPatch,
} from './profile-personalization';

const NOW = '2026-07-12T00:00:00.000Z';

test('civil-status validator accepts the set, rejects the rest', () => {
  for (const s of CIVIL_STATUSES) assert.equal(isCivilStatus(s), true);
  assert.equal(isCivilStatus('divorced'), false); // no civil divorce in PH
  assert.equal(isCivilStatus(''), false);
  assert.equal(isCivilStatus(null), false);
});

test('religion validator accepts the set, rejects the rest', () => {
  for (const r of RELIGIONS) assert.equal(isReligion(r), true);
  assert.equal(isReligion('jedi'), false);
  assert.equal(isReligion('civil'), false); // civil is a ceremony type, not a religion
});

test('every value has a label', () => {
  for (const s of CIVIL_STATUSES) assert.ok(CIVIL_STATUS_LABELS[s]);
  for (const r of RELIGIONS) assert.ok(RELIGION_LABELS[r]);
});

test('normalization degrades unknown/empty to null, never throws', () => {
  assert.equal(normalizeCivilStatus('married'), 'married');
  assert.equal(normalizeCivilStatus(''), null);
  assert.equal(normalizeCivilStatus('bogus'), null);
  assert.equal(normalizeReligion('catholic'), 'catholic');
  assert.equal(normalizeReligion(undefined), null);
});

test('consentPatch: stamps on first value', () => {
  assert.deepEqual(consentPatch('catholic', null, NOW), { consent_at: NOW });
});

test('consentPatch: clears on withdrawal', () => {
  assert.deepEqual(consentPatch(null, 'catholic', NOW), { consent_at: null });
});

test('consentPatch: unchanged value leaves consent untouched (no re-date)', () => {
  assert.deepEqual(consentPatch('catholic', 'catholic', NOW), {});
  assert.deepEqual(consentPatch('muslim', 'catholic', NOW), {}); // value changed but still consented
  assert.deepEqual(consentPatch(null, null, NOW), {});
});
