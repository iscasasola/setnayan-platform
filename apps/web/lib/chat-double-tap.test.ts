/**
 * 🔒 DOUBLE-TAP NEVER BLOCKS A SINGLE-TAP HEART (build brief 11 Nov 2026, guard 2).
 * Sabotage: make `bubbleTap` answer `heart: false` on a first tap (a "wait for the second tap" heart) → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bubbleTap, DOUBLE_TAP_MS, NO_TAP } from './chat-double-tap';
import { stripComments } from './strip-comments';

test('every tap hearts at once; only the second quick tap on the SAME bubble opens the picker', () => {
  const a = bubbleTap(NO_TAP, 'm1', 1000);
  assert.equal(a.heart, true);
  assert.equal(a.openPicker, false);
  const b = bubbleTap(a.next, 'm1', 1000 + DOUBLE_TAP_MS - 1);
  assert.equal(b.heart, true, 'the second tap takes the heart back');
  assert.equal(b.openPicker, true);
  // a third tap starts over — it is a heart, never another picker
  const c = bubbleTap(b.next, 'm1', 1000 + DOUBLE_TAP_MS);
  assert.deepEqual([c.heart, c.openPicker], [true, false]);
  // too slow, or another bubble → just a heart
  assert.equal(bubbleTap(a.next, 'm1', 1000 + DOUBLE_TAP_MS).openPicker, false);
  assert.equal(bubbleTap(a.next, 'm2', 1001).openPicker, false);
});

test("the stream's bubble hearts on every tap before it looks for a double", () => {
  const stream = stripComments(readFileSync(join(import.meta.dirname, '..', 'app/_components/chat-message-stream.tsx'), 'utf8'));
  const at = stream.indexOf('data-chat-heartable=""');
  assert.ok(at > 0, 'the heartable bubble is gone');
  const tag = stream.slice(stream.lastIndexOf('<div', at), at);
  assert.match(tag, /bubbleTap\(/, 'the bubble no longer reads the double-tap rule');
  // the heart is called unconditionally inside the tap branch — never behind `openPicker` or a timer
  assert.match(tag, /toggleHeart\(m\.message_id\);\s*if \(tap\.openPicker/, 'the heart moved behind the double-tap');
  assert.doesNotMatch(tag, /setTimeout/, 'a delayed heart');
});
