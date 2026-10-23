/**
 * GUARD — the Memories grid's columns follow the zoom like Apple Photos (owner 2026-10-23): phone 1 · 3 · 5 · 7
 * (3 to start), desktop 6 · 9 · 12 · 16 (9 to start), one step at a time, clamped, remembered under the prototype's
 * keys; a spread opens the photos up, a squeeze packs more in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESK_COLUMNS,
  PHONE_COLUMNS,
  ZOOM_KEY_DESK,
  ZOOM_KEY_PHONE,
  defaultFor,
  isDense,
  PINCH_FEWER_AT,
  PINCH_MORE_AT,
  gestureStep,
  liveScale,
  pinchScale,
  wheelScale,
  readColumns,
  stepColumns,
} from './gallery-zoom';

test('the steps are the approved ones, and each scale starts where the prototype starts', () => {
  assert.deepEqual([...PHONE_COLUMNS], [1, 3, 5, 7]);
  assert.deepEqual([...DESK_COLUMNS], [6, 9, 12, 16]);
  assert.equal(defaultFor('phone'), 3);
  assert.equal(defaultFor('desk'), 9);
  assert.equal(ZOOM_KEY_PHONE, 'sn-gallery-zoom');
  assert.equal(ZOOM_KEY_DESK, 'sn-gallery-zoom-desk');
});

test('a remembered value is used only when it is one of the steps', () => {
  assert.equal(readColumns('5', 'phone'), 5);
  assert.equal(readColumns('1', 'phone'), 1);
  assert.equal(readColumns('16', 'desk'), 16);
  for (const bad of [null, undefined, '', '4', '9', 'abc', '-3']) assert.equal(readColumns(bad, 'phone'), 3, String(bad));
  assert.equal(readColumns('5', 'desk'), 9, 'a phone value is not a desktop value');
});

test('one step at a time, clamped at both ends', () => {
  assert.equal(stepColumns(3, 1, 'phone'), 5);
  assert.equal(stepColumns(5, 1, 'phone'), 7);
  assert.equal(stepColumns(7, 1, 'phone'), 7);
  assert.equal(stepColumns(3, -1, 'phone'), 1);
  assert.equal(stepColumns(1, -1, 'phone'), 1);
  assert.equal(stepColumns(9, 1, 'desk'), 12);
  assert.equal(stepColumns(6, -1, 'desk'), 6);
  assert.equal(stepColumns(16, 1, 'desk'), 16);
  // A value off the scale (a desktop count on a phone after a resize) restarts from the default.
  assert.equal(stepColumns(9, 1, 'phone'), 5);
});

test('ONE step per gesture — past a clear threshold only, never several (owner: "The pinch changes too fast")', () => {
  assert.equal(PINCH_MORE_AT, 0.8);
  assert.equal(PINCH_FEWER_AT, 1.25);
  // A spread opens the photos up; a squeeze packs more in; anything between springs back.
  assert.equal(gestureStep(pinchScale(100, 130)), -1);
  assert.equal(gestureStep(pinchScale(100, 75)), 1);
  for (const d of [85, 95, 100, 110, 120]) assert.equal(gestureStep(pinchScale(100, d)), null, `${d}: a wobble zoomed`);
  // However far the fingers travel, the verdict is one step — the caller applies it once.
  assert.equal(gestureStep(pinchScale(100, 400)), -1);
  assert.equal(gestureStep(pinchScale(100, 10)), 1);
  assert.equal(gestureStep(Number.NaN), null);
  assert.equal(pinchScale(0, 100), 1);
});

test('a trackpad gesture sums its deltas, then steps once; one mouse notch is one step', () => {
  // Small pinch deltas summed over the gesture.
  const squeeze = Array.from({ length: 30 }, () => 1.2).reduce((a, b) => a + b, 0);
  assert.equal(gestureStep(wheelScale(squeeze)), 1);
  const spread = Array.from({ length: 30 }, () => -1.2).reduce((a, b) => a + b, 0);
  assert.equal(gestureStep(wheelScale(spread)), -1);
  assert.equal(gestureStep(wheelScale(8)), null, 'a nudge zoomed');
  // ⌃ + one wheel notch (≈100) — one step, and a huge flick is still one.
  assert.equal(gestureStep(wheelScale(100)), 1);
  assert.equal(gestureStep(wheelScale(5000)), 1);
});

test('mid-gesture the grid scales inside a sane band', () => {
  assert.equal(liveScale(3), 2);
  assert.equal(liveScale(0.1), 0.5);
  assert.equal(liveScale(1.1), 1.1);
  assert.equal(liveScale(Number.NaN), 1);
});

test('the names and marks give way on the dense steps only', () => {
  assert.equal(isDense(3), false);
  assert.equal(isDense(5), false);
  assert.equal(isDense(7), true);
  assert.equal(isDense(12), true);
});
