import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOnboardingPrefill,
  partitionOnboardingPrefill,
  EMPTY_PREFILL,
} from './prefill';
import type { SelfPersonalization } from '../self-personalization';

// A user with nothing on file — the "ask everything" baseline.
const BLANK: SelfPersonalization = {
  religion: null,
  civilStatus: null,
  birthdate: null,
  gender: null,
};

test('christening · Catholic religion → catholic_baptism, rite skipped', () => {
  const p = deriveOnboardingPrefill('christening', {
    ...BLANK,
    religion: 'catholic',
  });
  assert.equal(p.answers.rite_type, 'catholic_baptism');
  assert.deepEqual(p.skip, ['rite_type']);
  assert.equal(p.provenance.rite_type, 'religion');
});

test('christening · Born-Again (christian) → infant_dedication', () => {
  const p = deriveOnboardingPrefill('christening', {
    ...BLANK,
    religion: 'christian',
  });
  assert.equal(p.answers.rite_type, 'infant_dedication');
  assert.deepEqual(p.skip, ['rite_type']);
});

test('christening · Iglesia ni Cristo (inc) → infant_dedication', () => {
  const p = deriveOnboardingPrefill('christening', {
    ...BLANK,
    religion: 'inc',
  });
  assert.equal(p.answers.rite_type, 'infant_dedication');
});

test('christening · Muslim → no rite prefill (Aqiqah not modeled), asks rite', () => {
  const p = deriveOnboardingPrefill('christening', {
    ...BLANK,
    religion: 'muslim',
  });
  assert.equal(p.answers.rite_type, undefined);
  assert.deepEqual(p.skip, []);
});

test('christening · no religion on file → nothing prefilled/skipped', () => {
  const p = deriveOnboardingPrefill('christening', BLANK);
  assert.deepEqual(p.answers, {});
  assert.deepEqual(p.skip, []);
  assert.deepEqual(p.provenance, {});
});

test('non-christening type → no self-fact derivation yet (birthday)', () => {
  const p = deriveOnboardingPrefill('birthday', {
    ...BLANK,
    religion: 'catholic',
    birthdate: '2019-01-01',
  });
  assert.deepEqual(p.answers, {});
  assert.deepEqual(p.skip, []);
});

test('debut · subject facts are People-gated → no self-derived prefill', () => {
  const p = deriveOnboardingPrefill('debut', {
    ...BLANK,
    gender: 'female',
    birthdate: '2008-01-01',
  });
  assert.deepEqual(p.answers, {});
  assert.deepEqual(p.skip, []);
});

test('EMPTY_PREFILL is a stable empty shape', () => {
  assert.deepEqual(EMPTY_PREFILL, { answers: {}, skip: [], provenance: {} });
});

// ---- partitionOnboardingPrefill (routes answers to the right state bag) ----

test('partition · specialty-field answer → specialty bag (christening rite)', () => {
  const prefill = deriveOnboardingPrefill('christening', {
    ...BLANK,
    religion: 'catholic',
  });
  const parts = partitionOnboardingPrefill(prefill, ['after', 'scale'], [
    'rite_type',
    'officiant_parish',
  ]);
  assert.deepEqual(parts.specialty, { rite_type: 'catholic_baptism' });
  assert.deepEqual(parts.details, {});
});

test('partition · tq_ question answer → details bag', () => {
  const prefill = { answers: { after: 'lunch' }, skip: ['after'], provenance: {} };
  const parts = partitionOnboardingPrefill(prefill, ['after', 'scale'], ['rite_type']);
  assert.deepEqual(parts.details, { after: 'lunch' });
  assert.deepEqual(parts.specialty, {});
});

test('partition · answer matching neither is dropped', () => {
  const prefill = { answers: { ghost_field: 'x' }, skip: [], provenance: {} };
  const parts = partitionOnboardingPrefill(prefill, ['after'], ['rite_type']);
  assert.deepEqual(parts, { details: {}, specialty: {} });
});

test('partition · empty prefill → empty bags', () => {
  const parts = partitionOnboardingPrefill(EMPTY_PREFILL, ['after'], ['rite_type']);
  assert.deepEqual(parts, { details: {}, specialty: {} });
});
