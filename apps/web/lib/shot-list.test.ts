/**
 * shot-list.test.ts — the pure half of the DAY-10 shot list sync, executed.
 *
 * The property that matters: the console must never present a list as one the
 * couple has unless it was READ FROM the table. `decideInitialShots` is the
 * single place that decides that, so it is run here against every input shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SHOTS,
  SHOT_LABEL_MAX,
  decideInitialShots,
  normalizeShotLabel,
  parseLocalShots,
  sortShotRows,
  type Shot,
  type ShotRow,
} from './shot-list';

const seed = (): Shot[] => DEFAULT_SHOTS.map((label, i) => ({ id: `seed_${i}`, label, done: false }));

function row(label: string, position: number, captured: string | null = null): ShotRow {
  return { item_id: `id_${label}`, vendor_profile_id: 'v1', label, position, captured_at: captured };
}

test('a saved list wins over the device copy, in position order, and is `server`', () => {
  const local: Shot[] = [{ id: 'l1', label: 'Local only', done: true }];
  const out = decideInitialShots(
    { state: 'ok', rows: [row('B', 2), row('A', 1, '2026-09-18T01:00:00Z')] },
    local,
    seed,
  );
  assert.equal(out.source, 'server');
  assert.deepEqual(out.shots, [
    { id: 'id_A', label: 'A', done: true },
    { id: 'id_B', label: 'B', done: false },
  ]);
});

test('nothing saved yet: a pre-sync device list is kept, and it is `unsaved` — never `server`', () => {
  const local: Shot[] = [{ id: 'l1', label: 'My own list', done: false }];
  const out = decideInitialShots({ state: 'ok', rows: [] }, local, seed);
  assert.equal(out.source, 'unsaved');
  assert.deepEqual(out.shots, local);
});

test('nothing saved and nothing local: the seed, still `unsaved`', () => {
  const out = decideInitialShots({ state: 'ok', rows: [] }, null, seed);
  assert.equal(out.source, 'unsaved');
  assert.equal(out.shots.length, DEFAULT_SHOTS.length);
  // An emptied device list is not a list worth keeping over the seed.
  assert.equal(decideInitialShots({ state: 'ok', rows: [] }, [], seed).shots.length, DEFAULT_SHOTS.length);
});

test('an unreadable table is `offline`, never `unsaved` or `server`', () => {
  const local: Shot[] = [{ id: 'l1', label: 'x', done: false }];
  assert.equal(decideInitialShots({ state: 'unreadable' }, local, seed).source, 'offline');
  assert.deepEqual(decideInitialShots({ state: 'unreadable' }, local, seed).shots, local);
  assert.equal(decideInitialShots({ state: 'unreadable' }, null, seed).shots.length, DEFAULT_SHOTS.length);
});

test('labels normalise to the column CHECK (1..140 after trim)', () => {
  assert.equal(normalizeShotLabel('   '), null);
  assert.equal(normalizeShotLabel(42), null);
  assert.equal(normalizeShotLabel('  First dance '), 'First dance');
  const long = normalizeShotLabel('x'.repeat(500));
  assert.equal(long?.length, SHOT_LABEL_MAX);
  // Every default fits the column, or the first save of a seed would be refused.
  for (const s of DEFAULT_SHOTS) assert.equal(normalizeShotLabel(s), s);
});

test('a corrupt device cache degrades to null or a filtered list, never throws', () => {
  assert.equal(parseLocalShots(null), null);
  assert.equal(parseLocalShots('{not json'), null);
  assert.equal(parseLocalShots('{"a":1}'), null);
  const out = parseLocalShots(JSON.stringify([{ id: 'a', label: ' Kiss ', done: 1 }, { label: '' }, null, 7]));
  assert.deepEqual(out, [{ id: 'a', label: 'Kiss', done: true }]);
});

test('sortShotRows is stable on position ties', () => {
  const sorted = sortShotRows([row('b', 0), row('a', 0), row('c', -1)]);
  assert.deepEqual(sorted.map((r) => r.label), ['c', 'a', 'b']);
});
