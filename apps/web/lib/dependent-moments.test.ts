/**
 * Unit suite for the dependent milestone moments (Phase 3 family graph). Derives
 * a child's next ladder milestone into a Year-view moment. Pure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDependentMoments, type DependentForMoments } from './dependent-moments';

const base: DependentForMoments = { dependent_id: 'd1', name: 'Amara', birth_date: '2019-09-21', sex: 'female' };

test('a 6-year-old girl surfaces her lucky-7th milestone', () => {
  const [m] = buildDependentMoments([base], '2026-07-12');
  assert.ok(m);
  assert.equal(m.kind, 'milestone');
  assert.equal(m.dateISO, '2026-09-21');
  assert.equal(m.label, 'Amara turns 7 — lucky 7');
  assert.equal(m.isMilestone, true);
  assert.equal(m.eventId, null); // suggestion — go-signal creates the event
});

test('a boy debuts at 21 (label reads "debut")', () => {
  const boy: DependentForMoments = { dependent_id: 'd2', name: 'Leo', birth_date: '2005-11-02', sex: 'male' };
  const [m] = buildDependentMoments([boy], '2026-01-01');
  assert.ok(m);
  assert.equal(m.label, 'Leo’s debut'); // his 21st
  assert.equal(m.dateISO, '2026-11-02');
});

test('an elder surfaces the 60th', () => {
  const elder: DependentForMoments = { dependent_id: 'd3', name: 'Lolo', birth_date: '1967-03-03', sex: null };
  const [m] = buildDependentMoments([elder], '2026-07-12', { withinDays: 400 });
  assert.ok(m);
  assert.equal(m.label, 'Lolo’s 60th');
});

test('the milestone ladder is HUMAN — a business never gets a debut', () => {
  // A 12-year-old sari-sari store would otherwise reach 18 and print
  // "Aling Nena's Store's debut". The ladder is skipped for every non-person
  // kind; a missing kind still reads as person (the column default + legacy rows).
  const shop: DependentForMoments = {
    dependent_id: 'b1',
    name: 'Aling Nena’s Store',
    birth_date: '2009-03-04', // turns 18 on 2027-03-04
    sex: null,
    dependent_kind: 'business',
  };
  assert.equal(buildDependentMoments([shop], '2026-07-12', { withinDays: 400 }).length, 0);
  for (const kind of ['pet', 'item', 'other']) {
    assert.equal(
      buildDependentMoments([{ ...shop, dependent_kind: kind }], '2026-07-12', { withinDays: 400 }).length,
      0,
      kind,
    );
  }
  // Same row as a person — or with no kind at all — still surfaces the debut.
  assert.equal(
    buildDependentMoments([{ ...shop, dependent_kind: 'person' }], '2026-07-12', { withinDays: 400 }).length,
    1,
  );
  assert.equal(
    buildDependentMoments([{ ...shop, dependent_kind: null }], '2026-07-12', { withinDays: 400 }).length,
    1,
  );
});

test('no birthdate → no moment; sorted soonest-first', () => {
  const nobirth: DependentForMoments = { dependent_id: 'd4', name: 'No Date', birth_date: null, sex: null };
  assert.equal(buildDependentMoments([nobirth], '2026-07-12').length, 0);

  const two = buildDependentMoments(
    [
      { dependent_id: 'a', name: 'A', birth_date: '2020-12-25', sex: 'female' }, // 7th far
      base, // Amara 7th Sep 21 2026 (sooner)
    ],
    '2026-07-12',
  );
  assert.equal(two[0]?.dateISO, '2026-09-21');
});
