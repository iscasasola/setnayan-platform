/**
 * 🔒 EVERY FIXED SECTION SAYS WHERE IT IS EDITED (owner 2026-09-25: *"if not
 * editable then nothing to edit but the scene must be there"*).
 *
 * A fixed navigator tile either opens a Maker tool, or has nothing to edit in
 * the Maker and names where its content comes from, with a link there. The
 * defect this fences: the entourage tile was listed and locked, and tapping it
 * did nothing and said nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAKER_FIXED_LABEL, MAKER_FIXED_SOURCE, MAKER_FIXED_TOOL, type MakerFixedKey } from './maker-scene-list';

const KEYS = Object.keys(MAKER_FIXED_LABEL) as MakerFixedKey[];

test('there are fixed sections to check (the floor)', () => {
  assert.ok(KEYS.length >= 5, `expected at least 5 fixed sections, found ${KEYS.length}`);
});

test('every fixed section opens a tool OR says where it comes from — never neither', () => {
  const neither = KEYS.filter((k) => !MAKER_FIXED_TOOL[k] && !MAKER_FIXED_SOURCE[k]);
  assert.deepEqual(neither, [], `fixed sections that do nothing when tapped: ${neither.join(', ')}`);
});

test('a section with a tool does not also claim to have nothing to edit', () => {
  const both = KEYS.filter((k) => MAKER_FIXED_TOOL[k] && MAKER_FIXED_SOURCE[k]);
  assert.deepEqual(both, []);
});

test('the entourage says it comes from the guest list, and links there', () => {
  const src = MAKER_FIXED_SOURCE.entourage;
  assert.ok(src, 'the entourage has no source line');
  assert.match(src.text, /guest list/i);
  assert.equal(src.page, 'guests');
});
