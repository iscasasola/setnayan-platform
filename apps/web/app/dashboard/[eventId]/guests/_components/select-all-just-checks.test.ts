import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { guestSelection, readGuestSelection } from './guest-selection-store';

/**
 * ⚖ Owner 2026-09-21, after select-all drew 79 name chips: *"do not show this
 * when we click on the select all. just put a check. and pressing it will
 * deselect everything as well."*
 */

test('select-all marks the selection, and unticking a few keeps it marked', () => {
  const state = readGuestSelection;
  guestSelection.clear();
  guestSelection.selectAllInView(['a', 'b', 'c']);
  assert.equal(state().viaAll, true, 'select-all did not mark the selection');
  guestSelection.toggle('b');
  assert.deepEqual(state().ids, ['a', 'c']);
  assert.equal(state().viaAll, true, 'unticking one after select-all brought the chip wall back');
  guestSelection.setAll(['a']);
  assert.equal(state().viaAll, true, 'pruning after a delete forgot where the selection came from');
  guestSelection.clear();
  assert.equal(state().viaAll, false, 'an empty selection kept the select-all mark');
  guestSelection.toggle('a');
  assert.equal(state().viaAll, false, 'a hand pick must show its chip');
  guestSelection.clear();
});

const src = (f: string) =>
  stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', f), 'utf8'));

test('the name chips render only for a hand-built selection', () => {
  const bar = src('guest-list-multiselect.tsx');
  const chips = bar.indexOf('from the selection`}');
  assert.ok(chips > -1, 'the chip list is gone — this guard is pointing at nothing');
  const gate = bar.lastIndexOf('{viaAll ? null : (', chips);
  assert.ok(gate > -1 && chips - gate < 2000, 'the chips render after select-all again');
});

test('the header box clears ANY selection, and select-all goes through selectAllInView', () => {
  const bar = src('guest-list-multiselect.tsx');
  assert.match(bar, /const toggleAll = \(\) =>\s*selectedIds\.length > 0 \? guestSelection\.clear\(\) : guestSelection\.selectAllInView\(allIds\);/);
  const mobile = src('mobile-guest-carousel.tsx');
  assert.match(mobile, /allSelected \|\| someSelected\s*\? guestSelection\.clear\(\)\s*: guestSelection\.selectAllInView\(allVisibleIds\)/);
});
