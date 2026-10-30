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

test('a landscape frame in a square box keeps the middle square', () => {
  // 1920×1080 back camera held sideways in a 390×390 viewfinder → the middle 1080×1080.
  assert.deepEqual(viewfinderCrop({ width: 1920, height: 1080 }, { width: 390, height: 390 }), {
    sx: 420,
    sy: 0,
    sw: 1080,
    sh: 1080,
  });
});

test('a landscape frame in a tall box keeps a tall slice of the middle', () => {
  const c = viewfinderCrop({ width: 1920, height: 1080 }, { width: 390, height: 700 });
  assert.equal(c.sh, 1080, 'the full height is shown');
  assert.ok(Math.abs(c.sw / c.sh - 390 / 700) < 0.01, `${c.sw}×${c.sh}`);
  assert.equal(c.sx, Math.round((1920 - c.sw) / 2), 'centred');
});

test('a portrait frame in a box exactly its shape keeps the whole frame', () => {
  assert.deepEqual(viewfinderCrop({ width: 1080, height: 1920 }, { width: 390, height: 693.33 }), {
    sx: 0,
    sy: 0,
    sw: 1080,
    sh: 1920,
  });
});

test('a square frame in a square box is kept whole; 2× takes its centre half', () => {
  assert.deepEqual(viewfinderCrop({ width: 1080, height: 1080 }, { width: 390, height: 390 }), {
    sx: 0,
    sy: 0,
    sw: 1080,
    sh: 1080,
  });
  assert.deepEqual(viewfinderCrop({ width: 1080, height: 1080 }, { width: 390, height: 390 }, 2), {
    sx: 270,
    sy: 270,
    sw: 540,
    sh: 540,
  });
});

test('2× on a landscape frame in a square box is the centre of the shown square', () => {
  assert.deepEqual(viewfinderCrop({ width: 1920, height: 1080 }, { width: 390, height: 390 }, 2), {
    sx: 690,
    sy: 270,
    sw: 540,
    sh: 540,
  });
});

test('every crop stays inside the frame and keeps the box’s shape', () => {
  const frames = [
    { width: 1080, height: 1920 },
    { width: 1920, height: 1080 },
    { width: 1280, height: 1280 },
    { width: 720, height: 1280 },
  ];
  const boxes = [
    { width: 390, height: 390 },
    { width: 390, height: 520 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ];
  for (const f of frames) {
    for (const b of boxes) {
      for (const z of [1, 2]) {
        const c = viewfinderCrop(f, b, z);
        const at = `${f.width}×${f.height} in ${b.width}×${b.height} @${z}×`;
        assert.ok(c.sx >= 0 && c.sy >= 0 && c.sx + c.sw <= f.width && c.sy + c.sh <= f.height, `outside the frame: ${at}`);
        assert.ok(Math.abs(c.sw / c.sh - b.width / b.height) < 0.01, `not the box’s shape: ${at} → ${c.sw}×${c.sh}`);
      }
    }
  }
});
