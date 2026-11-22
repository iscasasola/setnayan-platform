/**
 * 📦 Card Maker part 7 — the per-unit card's words (lib/per-unit-price.ts). Asserts the exact line a couple reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perUnitPriceLine, unitWord, unitWordFor } from './per-unit-price';

test('no word reads "unit"; a Custom word carries into the line', () => {
  assert.equal(unitWord(null), 'unit');
  assert.equal(unitWord('  '), 'unit');
  assert.equal(perUnitPriceLine({ base: 12500, initial: 5, extra: 2500, word: null }), '₱12,500 for 5 units · +₱2,500/unit');
  assert.equal(perUnitPriceLine({ base: 3500, initial: 10, extra: 350, word: 'chair' }), '₱3,500 for 10 chairs · +₱350/chair');
});

test('one of them is singular; a word ending in s is left as typed', () => {
  assert.equal(unitWordFor(1, 'table'), 'table');
  assert.equal(unitWordFor(2, 'glass'), 'glass');
  assert.equal(perUnitPriceLine({ base: 900, initial: 1, extra: null, word: 'set' }), '₱900 for 1 set');
});

test('no base price is no line, never ₱0', () => {
  assert.equal(perUnitPriceLine({ base: null, initial: 5, extra: 100, word: null }), null);
  assert.equal(perUnitPriceLine({ base: 0, initial: 5, extra: 100, word: null }), null);
});
