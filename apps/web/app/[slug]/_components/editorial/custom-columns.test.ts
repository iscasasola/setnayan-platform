/**
 * Guard — a column the couple wrote themselves.
 *
 * Two things are being defended here. `draft_json` is a JSONB column a couple's
 * own browser can write through PostgREST, so nothing read out of it is trusted;
 * and the order list must never be able to conjure a column that does not exist.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  readCustomColumns,
  customColumnKey,
  customColumnId,
  MAX_CUSTOM_COLUMNS,
  CUSTOM_COLUMN_TITLE_MAX,
  CUSTOM_COLUMN_BODY_MAX,
  sectionOrderToPersist,
} from './custom-columns';
import { resolveSectionOrder, EDITORIAL_ORDERABLE_KEYS } from './editorial-order';

const col = (id: string, title = 'The Dog', body = 'He wore a bow tie.') => ({ id, title, body });

test('a well-formed column is read back', () => {
  const got = readCustomColumns({ customColumns: [col('dogs1')] });
  assert.deepEqual(got, [{ id: 'dogs1', title: 'The Dog', body: 'He wore a bow tie.' }]);
});

test('an absent or non-array value is no columns, never a throw', () => {
  for (const bad of [null, undefined, {}, { customColumns: 'nope' }, { customColumns: 7 }]) {
    assert.deepEqual(readCustomColumns(bad), [], `threw or guessed on ${JSON.stringify(bad)}`);
  }
});

test('a column with no title is dropped — a blank heading is not a column', () => {
  assert.deepEqual(readCustomColumns({ customColumns: [col('dogs1', '   ')] }), []);
});

test('a column with no body is dropped — a heading over nothing is not a column', () => {
  assert.deepEqual(readCustomColumns({ customColumns: [col('dogs1', 'The Dog', '  ')] }), []);
});

test('an over-long title or body is DROPPED, not silently cut in half', () => {
  const longTitle = 'x'.repeat(CUSTOM_COLUMN_TITLE_MAX + 1);
  const longBody = 'y'.repeat(CUSTOM_COLUMN_BODY_MAX + 1);
  assert.deepEqual(readCustomColumns({ customColumns: [col('dogs1', longTitle)] }), []);
  assert.deepEqual(readCustomColumns({ customColumns: [col('dogs1', 'ok', longBody)] }), []);
  // …and the limits themselves are legal, so the boundary is inclusive.
  assert.equal(readCustomColumns({ customColumns: [col('dogs1', 'x'.repeat(CUSTOM_COLUMN_TITLE_MAX))] }).length, 1);
});

test('a forged id cannot escape its namespace', () => {
  // `a:b` would produce the key `custom:a:b`; `''` would produce the bare
  // prefix, which is a prefix of EVERY custom key.
  for (const bad of ['a:b', '', 'AB12', 'ab', 'x'.repeat(25), 'has space', 'dogs-1']) {
    assert.deepEqual(readCustomColumns({ customColumns: [col(bad)] }), [], `admitted id ${JSON.stringify(bad)}`);
  }
});

test('duplicate ids collapse to the first', () => {
  const got = readCustomColumns({ customColumns: [col('dogs1', 'First'), col('dogs1', 'Second')] });
  assert.equal(got.length, 1);
  assert.equal(got[0]!.title, 'First');
});

test('the count is capped', () => {
  const many = Array.from({ length: MAX_CUSTOM_COLUMNS + 4 }, (_, i) => col(`col${i}0`));
  assert.equal(readCustomColumns({ customColumns: many }).length, MAX_CUSTOM_COLUMNS);
});

test('a key round-trips, and only a real key yields an id', () => {
  assert.equal(customColumnId(customColumnKey('dogs1')), 'dogs1');
  assert.equal(customColumnId('gallery'), null);
  assert.equal(customColumnId('custom:'), null, 'the bare prefix is a key matching everything');
  assert.equal(customColumnId('custom:a:b'), null);
});

// ── the resolver ────────────────────────────────────────────────────────────

test('with no custom ids passed, a custom key is dropped exactly as today', () => {
  const out = resolveSectionOrder(['custom:dogs1', 'gallery']);
  assert.ok(!out.includes('custom:dogs1' as never), 'a caller that knows nothing about columns rendered one');
  assert.deepEqual([...out].sort(), [...EDITORIAL_ORDERABLE_KEYS].sort());
});

test('a custom key with no column behind it is dropped — a deleted column leaves no empty block', () => {
  const out = resolveSectionOrder(['custom:gone1', 'gallery'], ['dogs1']);
  assert.ok(!out.includes('custom:gone1' as never));
  assert.ok(out.includes('custom:dogs1' as never), 'the column that DOES exist was lost');
});

test('a column keeps the position the couple dragged it to', () => {
  const out = resolveSectionOrder(['custom:dogs1', 'chapters'], ['dogs1']);
  assert.equal(out[0], 'custom:dogs1');
  assert.equal(out[1], 'chapters');
});

test('a column never dragged appends instead of vanishing', () => {
  const out = resolveSectionOrder(['chapters'], ['dogs1']);
  assert.ok(out.includes('custom:dogs1' as never), 'a written column with no saved position disappeared');
  assert.equal(out[out.length - 1], 'custom:dogs1');
});

test('every shipped section still renders once, whatever the columns do', () => {
  const out = resolveSectionOrder(['custom:dogs1', 'custom:dogs1', 'gallery'], ['dogs1', 'cats2']);
  for (const k of EDITORIAL_ORDERABLE_KEYS) {
    assert.equal(out.filter((x) => x === k).length, 1, `${k} rendered ${out.filter((x) => x === k).length} times`);
  }
  assert.equal(out.filter((x) => x === 'custom:dogs1').length, 1, 'a duplicated custom key rendered twice');
});

test('the locked-close keys still never appear', () => {
  const out = resolveSectionOrder(['fromTheCouple', 'song', 'custom:dogs1'], ['dogs1']);
  assert.ok(!out.includes('fromTheCouple' as never));
  assert.ok(!out.includes('song' as never));
});


// ── what gets STORED ────────────────────────────────────────────────────────
// The branch these cover can silently delete everything a couple arranged.

const CANON = ['a', 'b', 'c'] as const;

test('an untouched default order stores nothing', () => {
  assert.equal(sectionOrderToPersist(['a', 'b', 'c'], CANON, []), null);
  assert.equal(sectionOrderToPersist(['a'], CANON, []), null, 'a prefix of the default is still the default');
});

test('a rearranged order is stored', () => {
  assert.deepEqual(sectionOrderToPersist(['c', 'a', 'b'], CANON, []), ['c', 'a', 'b']);
});

test('a couple with a column always has their arrangement stored', () => {
  // Shipped sections in canonical order with their column at the end. This is
  // the case that LOOKS like the default; it is not, because the column's
  // position lives nowhere else. Throwing it away would move their own writing
  // without them touching anything.
  const got = sectionOrderToPersist(['a', 'b', 'c', 'custom:dogs1'], CANON, ['dogs1']);
  assert.deepEqual(got, ['a', 'b', 'c', 'custom:dogs1']);
});

test('a custom key with no column being saved is not stored', () => {
  assert.deepEqual(sectionOrderToPersist(['c', 'a', 'custom:gone1'], CANON, []), ['c', 'a']);
  assert.deepEqual(sectionOrderToPersist(['c', 'a', 'custom:gone1'], CANON, ['dogs1']), ['c', 'a']);
});

test('unknown keys, dupes and non-strings never reach storage', () => {
  assert.deepEqual(sectionOrderToPersist(['c', 'c', 'nope', 7, null, 'a'] as unknown[], CANON, []), ['c', 'a']);
});

test('a non-array is stored as nothing, never a throw', () => {
  assert.equal(sectionOrderToPersist(null, CANON, []), null);
  assert.equal(sectionOrderToPersist('nope' as unknown as unknown[], CANON, []), null);
});
