/**
 * Unit suite for the faith rite ladder. Owner-confirmed 2026-07-12: the Catholic
 * ladder includes First Communion AND Confirmation. Rites are age-windowed +
 * parish-dated; infant rites (binyag/aqiqah) surface while the child is <1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RITE_LADDER, upcomingRite, buildDependentRiteMoments, type DependentForRites } from './faith-rites';

test('the Catholic ladder has Binyag → First Communion → Confirmation', () => {
  const rites = (RITE_LADDER.catholic ?? []).map((r) => r.rite);
  assert.deepEqual(rites, ['baptism', 'first_communion', 'confirmation']);
});

test('a 6-year-old catholic child approaches First Communion (~7)', () => {
  const r = upcomingRite('catholic', '2019-09-21', '2026-07-12');
  assert.equal(r?.rite, 'first_communion');
  assert.equal(r?.dateISO, '2026-09-21'); // age-7 date
});

test('a 12-year-old catholic child approaches Confirmation (~13)', () => {
  const r = upcomingRite('catholic', '2013-05-01', '2025-08-01');
  assert.equal(r?.rite, 'confirmation');
});

test('an infant catholic surfaces Binyag (within the first year)', () => {
  const r = upcomingRite('catholic', '2026-05-20', '2026-07-12');
  assert.equal(r?.rite, 'baptism');
});

test('a Muslim infant surfaces Aqiqah', () => {
  const r = upcomingRite('muslim', '2026-06-01', '2026-07-12');
  assert.equal(r?.rite, 'aqiqah');
});

test('no religion → no rite; unknown religion → no rite', () => {
  assert.equal(upcomingRite(null, '2019-09-21', '2026-07-12'), null);
  assert.equal(upcomingRite('jedi', '2019-09-21', '2026-07-12'), null);
});

test('buildDependentRiteMoments: a catholic child yields a rite moment (eventId null)', () => {
  const dep: DependentForRites = { dependent_id: 'd1', name: 'Amara', birth_date: '2019-09-21', religion: 'catholic' };
  const [m] = buildDependentRiteMoments([dep], '2026-07-12');
  assert.ok(m);
  assert.equal(m.kind, 'milestone');
  assert.equal(m.label, 'Amara — First Communion');
  assert.equal(m.eventId, null);
});

test('buildDependentRiteMoments: no religion → no moment', () => {
  const dep: DependentForRites = { dependent_id: 'd2', name: 'No Faith', birth_date: '2019-09-21', religion: null };
  assert.equal(buildDependentRiteMoments([dep], '2026-07-12').length, 0);
});
