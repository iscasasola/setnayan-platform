import { test } from 'node:test';
import assert from 'node:assert/strict';
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
