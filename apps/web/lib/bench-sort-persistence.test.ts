/**
 * Unit suite for bench sort persistence (Explore_Replan §13.3).
 *
 * The pure half of "remember which lens the couple chose": the storage key and
 * the parse. The `window.localStorage` access itself lives at the one call site
 * that owns it, guarded, so there is nothing here to mock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchSortStorageKey, parseBenchSort } from './bench-sort-persistence';

test('the key is namespaced and scoped to the event', () => {
  assert.equal(benchSortStorageKey('S89E-ABC123'), 'sn.bench.sort.S89E-ABC123');
  // Per EVENT, not per account — two events must never share a preference.
  assert.notEqual(benchSortStorageKey('S89E-AAA'), benchSortStorageKey('S89E-BBB'));
});

test('every shipped sort round-trips', () => {
  for (const key of ['fit', 'near', 'price', 'rating'] as const) {
    assert.equal(parseBenchSort(key), key);
  }
});

test('storage is untrusted — anything unrecognised parses to null', () => {
  // localStorage is client-writable, and a key can outlive the lens that wrote
  // it (e.g. a blocked lens shipped later and removed). Neither may resurrect a
  // sort mode the code no longer implements.
  assert.equal(parseBenchSort('budget'), null);
  assert.equal(parseBenchSort('demand'), null);
  assert.equal(parseBenchSort('FIT'), null);
  assert.equal(parseBenchSort(''), null);
  assert.equal(parseBenchSort(null), null);
  assert.equal(parseBenchSort(undefined), null);
});

test('nothing stored → null, so the caller keeps its default', () => {
  // The bench seeds `useState('fit')` and only overwrites it on a real hit, so
  // a first-time couple never sees the sort change after hydration.
  assert.equal(parseBenchSort(null), null);
});

test('a stored "near" is returned as-is — availability is NOT this layer’s job', () => {
  // The §15.2 gate is applied at render (`activeSort`), not here. Storing what
  // the couple actually chose is what lets the lens come back on its own once
  // their venue anchor exists again, instead of being silently forgotten.
  assert.equal(parseBenchSort('near'), 'near');
});
