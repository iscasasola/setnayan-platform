/**
 * Unit suite for the pure face-embedding helpers (Node built-in test runner via
 * tsx — `pnpm test:unit`). Covers the deterministic geometry/normalization that
 * feeds the recognition model; the ONNX inference itself lives in the browser
 * module face-embed.ts and is validated on-device.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { l2normalize, squareCropBox, FACE_CROP_MARGIN } from './face-embed-core';

test('l2normalize: unit-length output, magnitude 1', () => {
  const out = l2normalize([3, 4]); // norm 5
  assert.ok(Math.abs(out[0]! - 0.6) < 1e-12);
  assert.ok(Math.abs(out[1]! - 0.8) < 1e-12);
  const mag = Math.sqrt(out.reduce((s, v) => s + v * v, 0));
  assert.ok(Math.abs(mag - 1) < 1e-12, 'magnitude is 1');
});

test('l2normalize: zero vector stays zero (no signal)', () => {
  assert.deepEqual(l2normalize([0, 0, 0]), [0, 0, 0]);
});

test('squareCropBox: a centered box → centered square grown by the margin', () => {
  // box 40x40 at (80,80) in a 200x200 image; margin 0.25 → size 50, centered at (100,100)
  const crop = squareCropBox({ originX: 80, originY: 80, width: 40, height: 40 }, 200, 200, 0.25);
  assert.deepEqual(crop, { x: 75, y: 75, size: 50 });
});

test('squareCropBox: a box at the edge is clamped fully inside the image', () => {
  const crop = squareCropBox({ originX: 0, originY: 0, width: 40, height: 40 }, 200, 200, 0.25);
  // size 50, but centered at (20,20) would start at -5 → clamped to 0
  assert.deepEqual(crop, { x: 0, y: 0, size: 50 });
});

test('squareCropBox: crop never exceeds the image, even for a huge box', () => {
  const crop = squareCropBox({ originX: 10, originY: 10, width: 300, height: 300 }, 200, 200, 0.25);
  assert.equal(crop?.size, 200, 'capped to the smaller image dimension');
  assert.equal(crop?.x, 0);
  assert.equal(crop?.y, 0);
});

test('squareCropBox: uses the larger side of a non-square box', () => {
  // 40x80 box → base = 80 * (1+0.25) = 100
  const crop = squareCropBox({ originX: 50, originY: 50, width: 40, height: 80 }, 400, 400, FACE_CROP_MARGIN);
  assert.equal(crop?.size, 100);
});

test('squareCropBox: non-positive image → null', () => {
  assert.equal(squareCropBox({ originX: 0, originY: 0, width: 10, height: 10 }, 0, 100), null);
});
