import test from 'node:test';
import assert from 'node:assert/strict';
import { viewfinderCrop } from './papic-viewfinder-crop';

test('a portrait frame in a square box keeps the square the screen showed', () => {
  // 1080×1920 front camera in a 390×390 viewfinder → the middle 1080×1080.
  assert.deepEqual(viewfinderCrop({ width: 1080, height: 1920 }, { width: 390, height: 390 }), {
    sx: 0,
    sy: 420,
    sw: 1080,
    sh: 1080,
  });
});

test('the box’s own shape is kept, whatever it is', () => {
  const c = viewfinderCrop({ width: 1080, height: 1920 }, { width: 390, height: 300 });
  assert.equal(c.sw, 1080);
  assert.ok(Math.abs(c.sw / c.sh - 390 / 300) < 0.01, `${c.sw}×${c.sh}`);
  assert.equal(c.sy, Math.round((1920 - c.sh) / 2), 'centred');
});

test('2× narrows the shown region about its centre', () => {
  const c = viewfinderCrop({ width: 1080, height: 1920 }, { width: 390, height: 390 }, 2);
  assert.deepEqual(c, { sx: 270, sy: 690, sw: 540, sh: 540 });
});

test('no box measured → the whole frame (the old behaviour), never nothing', () => {
  assert.deepEqual(viewfinderCrop({ width: 1080, height: 1920 }, null), { sx: 0, sy: 0, sw: 1080, sh: 1920 });
  assert.deepEqual(viewfinderCrop({ width: 1080, height: 1920 }, { width: 0, height: 0 }), {
    sx: 0,
    sy: 0,
    sw: 1080,
    sh: 1920,
  });
});
