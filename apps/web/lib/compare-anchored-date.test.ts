/**
 * compare-anchored-date.test.ts — B5's pure core, exercised for real.
 *
 * The derivation is injected (see the module docblock), so these are genuine
 * behavioural assertions, not source-string checks. Each names the regression
 * it prevents.
 *
 * MUTATION-CHECKED (occurrence counts printed in the PR body): deleting the
 * `if (!fit) continue` guard turns "an unreadable calendar is never reported
 * booked" red; deleting `seen.add` turns "one vendor is named once" red;
 * flipping `fit === 'booked'` to `!==` turns the booked-name assertions red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { anchoredDateByColumn } from './compare-anchored-date';

const nameOf = (id: string) => ({ v1: 'Alba Studios', v2: 'Kusina Rosa', v3: 'Tala Blooms' })[id] ?? id;

test('a plan whose connected vendors are all free says so', () => {
  const out = anchoredDateByColumn({
    columns: [{ key: 'current', picks: [{ vendorId: 'v1' }, { vendorId: 'v2' }] }],
    dateFit: new Map([
      ['v1', 'free'],
      ['v2', 'free'],
    ] as const),
    nameOf,
  });
  assert.equal(out.current.checkedCount, 2);
  assert.deepEqual(out.current.bookedNames, []);
});

test('a booked vendor is NAMED — the whole reason the row exists', () => {
  // An affordable plan can still be impossible. The couple has to know which
  // supplier to swap, not merely that something is wrong.
  const out = anchoredDateByColumn({
    columns: [{ key: 'current', picks: [{ vendorId: 'v1' }, { vendorId: 'v2' }] }],
    dateFit: new Map([
      ['v1', 'free'],
      ['v2', 'booked'],
    ] as const),
    nameOf,
  });
  assert.deepEqual(out.current.bookedNames, ['Kusina Rosa']);
  assert.equal(out.current.checkedCount, 2);
});

test('AN UNREADABLE CALENDAR IS NEVER REPORTED BOOKED', () => {
  // Rule 1. A vendor absent from the map is off-platform or a flaked read. This
  // row names a real supplier to the couple hiring them, so an absence must
  // never become an accusation — it is not even counted as checked.
  const out = anchoredDateByColumn({
    columns: [{ key: 'current', picks: [{ vendorId: 'v1' }, { vendorId: 'ghost' }] }],
    dateFit: new Map([['v1', 'free']] as const),
    nameOf,
  });
  assert.equal(out.current.checkedCount, 1, 'the unknown vendor is not counted as checked');
  assert.deepEqual(out.current.bookedNames, [], 'and is certainly not named as booked');
});

test('a column with no connected vendors reports nothing to say', () => {
  // Renders the dash, not a false "everyone here is free" — which would be a
  // promise about calendars nobody read.
  const out = anchoredDateByColumn({
    columns: [{ key: 'current', picks: [{ vendorId: 'ghost' }, {}] }],
    dateFit: new Map([['v1', 'free']] as const),
    nameOf,
  });
  assert.equal(out.current.checkedCount, 0);
  assert.deepEqual(out.current.bookedNames, []);
});

test('ONE VENDOR IS ONE CALENDAR — picked twice, named once', () => {
  // Rule 2. A supplier covering two categories is one booking question.
  // Without the dedupe this reads "Alba Studios, Alba Studios booked that day".
  const out = anchoredDateByColumn({
    columns: [{ key: 'current', picks: [{ vendorId: 'v1' }, { vendorId: 'v1' }] }],
    dateFit: new Map([['v1', 'booked']] as const),
    nameOf,
  });
  assert.equal(out.current.checkedCount, 1);
  assert.deepEqual(out.current.bookedNames, ['Alba Studios']);
});

test('every column gets its own verdict, saved plans and Current alike', () => {
  // The row is per-COLUMN; a saved plan that avoids the booked vendor is
  // exactly the comparison the panel exists to surface.
  const out = anchoredDateByColumn({
    columns: [
      { key: 'plan-a', picks: [{ vendorId: 'v1' }, { vendorId: 'v3' }] },
      { key: 'current', picks: [{ vendorId: 'v2' }, { vendorId: 'v3' }] },
    ],
    dateFit: new Map([
      ['v1', 'booked'],
      ['v2', 'free'],
      ['v3', 'free'],
    ] as const),
    nameOf,
  });
  assert.deepEqual(out['plan-a'].bookedNames, ['Alba Studios']);
  assert.deepEqual(out.current.bookedNames, [], 'Current dodges the clash — that is the comparison');
  assert.equal(Object.keys(out).length, 2);
});

test('multiple booked vendors are all named, in pick order', () => {
  const out = anchoredDateByColumn({
    columns: [{ key: 'current', picks: [{ vendorId: 'v2' }, { vendorId: 'v1' }] }],
    dateFit: new Map([
      ['v1', 'booked'],
      ['v2', 'booked'],
    ] as const),
    nameOf,
  });
  assert.deepEqual(out.current.bookedNames, ['Kusina Rosa', 'Alba Studios']);
});
