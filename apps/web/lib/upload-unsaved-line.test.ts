/**
 * EXECUTES lib/upload-unsaved-line.ts. The tree-walk that proves every mount
 * names its button lives beside the widget:
 * app/_components/the-upload-names-its-button.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressBelow, unsavedLine, UNSAVED_PREFIX } from './upload-unsaved-line';

test('the widget owns the claim, the caller owns the next step', () => {
  assert.equal(unsavedLine('press Done below'), 'Not saved yet — press Done below');
  assert.equal(unsavedLine(pressBelow('Save')), 'Not saved yet — press Save below');
  assert.equal(
    unsavedLine('it goes in when you open your shop'),
    'Not saved yet — it goes in when you open your shop',
  );
  assert.ok(unsavedLine('x').startsWith(UNSAVED_PREFIX));
});

test('🔴 a caller pasting the whole old sentence does not get it twice', () => {
  assert.equal(unsavedLine('Not saved yet — press Save below'), 'Not saved yet — press Save below');
  assert.equal(unsavedLine('not saved yet - press Log below'), 'Not saved yet — press Log below');
});

test('an empty tail is refused — a claim with no next step is the defect in a smaller font', () => {
  assert.throws(() => unsavedLine('   '), /name the next step/);
  assert.throws(() => pressBelow(''), /label/);
});

test('pressBelow keeps the button’s own words, including its punctuation', () => {
  assert.equal(pressBelow('I’ve sent the payment'), 'press I’ve sent the payment below');
  assert.equal(pressBelow('  Open my shop — free '), 'press Open my shop — free below');
});
