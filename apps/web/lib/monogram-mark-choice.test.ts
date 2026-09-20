/**
 * lib/monogram-mark-choice.test.ts — keeping both marks, using one.
 *
 * The property: switching to the designed mark must NEVER destroy the uploaded
 * file, and "live" must have exactly one representation so no read site has to
 * know two spellings of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUploadedMarkOff, setUploadedMarkOff, isMarkChoice } from './monogram-mark-choice';

const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h1v1z" fill="#B08D57"/></svg>';

test('an unstamped mark is LIVE — every mark uploaded before today is unchanged', () => {
  assert.equal(isUploadedMarkOff(MARK), false);
  assert.equal(isUploadedMarkOff(null), false);
  assert.equal(isUploadedMarkOff(undefined), false);
  assert.equal(isUploadedMarkOff(''), false);
});

test('switching off keeps every byte of the artwork', () => {
  const off = setUploadedMarkOff(MARK, true);
  assert.equal(isUploadedMarkOff(off), true);
  // The file itself is untouched — only the root tag gained an attribute. This
  // is the whole point: the old route back to a designed mark DELETED the
  // uploaded column, so changing your mind meant uploading the file again.
  assert.ok(off.includes('<path d="M0 0h1v1z" fill="#B08D57"/>'), 'the artwork must survive the switch');
  assert.equal(off.replace(' data-mark="off"', ''), MARK, 'nothing but the marker may change');
});

test('switching back REMOVES the marker rather than writing data-mark="on"', () => {
  /* One representation for "live". Two spellings would mean every read site has
   * to know both, and a mark uploaded before this feature would compare
   * unequal to one switched back on today. */
  const back = setUploadedMarkOff(setUploadedMarkOff(MARK, true), false);
  assert.equal(back, MARK);
  assert.equal(isUploadedMarkOff(back), false);
  assert.ok(!back.includes('data-mark'), 'no marker at all when live');
});

test('re-stamping does not accumulate attributes', () => {
  let s = MARK;
  for (let i = 0; i < 5; i++) s = setUploadedMarkOff(s, true);
  assert.equal((s.match(/data-mark=/g) ?? []).length, 1);
});

test('a nested <svg> cannot switch the couple’s monogram off', () => {
  const nested = '<svg viewBox="0 0 10 10"><svg data-mark="off" viewBox="0 0 5 5"></svg></svg>';
  assert.equal(isUploadedMarkOff(nested), false, 'only the ROOT tag decides');
});

test('an unknown data-mark value means LIVE, not off', () => {
  // Fail toward showing the couple's chosen mark, never toward hiding it.
  assert.equal(isUploadedMarkOff('<svg data-mark="maybe" viewBox="0 0 10 10"></svg>'), false);
  assert.equal(isUploadedMarkOff('<svg data-mark="" viewBox="0 0 10 10"></svg>'), false);
});

test('the stamp coexists with the ink stamp', () => {
  /* Both features write the root tag. If one clobbered the other, choosing
   * "use my designed mark" would silently reset the colour choice on the
   * uploaded one, and the couple would find it changed when they switched
   * back. */
  const inked = MARK.replace('<svg', '<svg data-ink="palette"');
  const off = setUploadedMarkOff(inked, true);
  assert.ok(off.includes('data-ink="palette"'), 'the ink choice must survive a mark switch');
  assert.ok(off.includes('data-mark="off"'));
  const back = setUploadedMarkOff(off, false);
  assert.ok(back.includes('data-ink="palette"'), 'and survive switching back');
  assert.ok(!back.includes('data-mark'));
});

test('isMarkChoice accepts only the two real choices', () => {
  assert.equal(isMarkChoice('upload'), true);
  assert.equal(isMarkChoice('studio'), true);
  for (const bad of ['', 'both', 'none', null, undefined, 0]) {
    assert.equal(isMarkChoice(bad), false, `${String(bad)} must not be a choice`);
  }
});
