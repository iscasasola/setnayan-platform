import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clipPillLabel, formatClipDuration } from './clip-duration-label';

test('a measured clip reads as minutes and seconds', () => {
  assert.equal(formatClipDuration(24), '0:24');
  assert.equal(formatClipDuration(5), '0:05');
  assert.equal(formatClipDuration(60), '1:00');
  assert.equal(formatClipDuration(95), '1:35');
});

test('FLOOR, never round — a 30.9s probe of a 30s cap must not print 0:31', () => {
  // The picker accepts up to cap + 0.9 because container metadata rounds up.
  // Rounding here would print a number ABOVE the cap the same screen states.
  assert.equal(formatClipDuration(30.9), '0:30');
  assert.equal(formatClipDuration(30.0), '0:30');
  assert.equal(formatClipDuration(4.9), '0:04');
});

test('an unreadable duration stays unknown — never 0, never the cap', () => {
  assert.equal(formatClipDuration(null), null);
  assert.equal(formatClipDuration(undefined), null);
  assert.equal(formatClipDuration(Number.NaN), null);
  assert.equal(formatClipDuration(Number.POSITIVE_INFINITY), null);
  assert.equal(formatClipDuration(-3), null);
});

test('the pill falls back to the WORD, not to 0:00', () => {
  assert.equal(clipPillLabel(24), '0:24');
  assert.equal(clipPillLabel(null), 'clip');
  assert.equal(clipPillLabel(Number.NaN), 'clip');
  // 0:00 would read as an empty or broken upload; a zero-length probe is not
  // a length anyone wants printed on their card.
  assert.notEqual(clipPillLabel(null), '0:00');
});

test('zero is a real measurement and is NOT the unknown sentinel', () => {
  // Distinct from null on purpose: a genuinely 0-second probe is a different
  // fact from "could not read it", and collapsing them hides one of the two.
  assert.equal(formatClipDuration(0), '0:00');
});
