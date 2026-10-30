import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPIC_PHOTO_ASPECT, papicFrameAspect, papicFrameCrop } from './papic-viewfinder-crop';

const shape = (c: { sw: number; sh: number }) => c.sw / c.sh;
const NINE_SIXTEEN = 9 / 16;

test('the one Papic photo is 9:16 portrait (owner 2026-10-30: "9:16")', () => {
  assert.equal(PAPIC_PHOTO_ASPECT, NINE_SIXTEEN);
  assert.equal(papicFrameAspect({ width: 1440, height: 2560 }), NINE_SIXTEEN);
  assert.equal(papicFrameAspect({ width: 1080, height: 1440 }), NINE_SIXTEEN, 'a 3:4 portrait frame is not kept 9:16');
});

test('a 9:16 portrait frame is kept whole — the sensor frame the camera asks for', () => {
  assert.deepEqual(papicFrameCrop({ width: 1440, height: 2560 }), { sx: 0, sy: 0, sw: 1440, sh: 2560 });
  assert.deepEqual(papicFrameCrop({ width: 1080, height: 1920 }), { sx: 0, sy: 0, sw: 1080, sh: 1920 });
});

test('a 3:4 portrait frame (a camera with no 16:9 mode) keeps its centre 9:16 — the sides trimmed', () => {
  const c = papicFrameCrop({ width: 1080, height: 1440 });
  assert.equal(c.sh, 1440, 'the full height is kept');
  assert.equal(c.sw, 810);
  assert.equal(c.sx, 135, 'centred');
  assert.equal(c.sy, 0);
});

test('a frame narrower than 9:16 keeps its centre 9:16 — the top and bottom trimmed', () => {
  const c = papicFrameCrop({ width: 900, height: 2000 });
  assert.equal(c.sw, 900);
  assert.equal(c.sh, 1600);
  assert.equal(c.sy, 200, 'centred');
});

test('a phone held sideways makes the same frame turned with it: 16:9', () => {
  assert.equal(papicFrameAspect({ width: 2560, height: 1440 }), 16 / 9);
  assert.deepEqual(papicFrameCrop({ width: 2560, height: 1440 }), { sx: 0, sy: 0, sw: 2560, sh: 1440 });
  const c = papicFrameCrop({ width: 1440, height: 1080 });
  assert.equal(c.sw, 1440);
  assert.equal(c.sh, 810);
  assert.equal(c.sy, 135);
});

test('2× is the centre half of the 9:16 frame, still 9:16', () => {
  assert.deepEqual(papicFrameCrop({ width: 1440, height: 2560 }, 2), { sx: 360, sy: 640, sw: 720, sh: 1280 });
  const c = papicFrameCrop({ width: 1080, height: 1440 }, 2);
  assert.deepEqual(c, { sx: 338, sy: 360, sw: 405, sh: 720 });
  assert.ok(Math.abs(shape(c) - NINE_SIXTEEN) < 0.01);
});

test('every frame a phone can deliver, at 1× and 2×: inside the frame, centred, 9:16 (or 16:9 sideways)', () => {
  const frames = [
    { width: 1440, height: 2560 },
    { width: 1080, height: 1920 },
    { width: 1080, height: 1440 },
    { width: 720, height: 1280 },
    { width: 480, height: 640 },
    { width: 1280, height: 1280 },
    { width: 2560, height: 1440 },
    { width: 1920, height: 1080 },
    { width: 640, height: 480 },
  ];
  for (const f of frames) {
    for (const z of [1, 2]) {
      const c = papicFrameCrop(f, z);
      const at = `${f.width}×${f.height} @${z}×`;
      assert.ok(c.sx >= 0 && c.sy >= 0 && c.sx + c.sw <= f.width && c.sy + c.sh <= f.height, `outside the frame: ${at}`);
      assert.ok(Math.abs(c.sx * 2 + c.sw - f.width) <= 1 && Math.abs(c.sy * 2 + c.sh - f.height) <= 1, `not centred: ${at}`);
      const want = f.width > f.height ? 16 / 9 : NINE_SIXTEEN;
      assert.ok(Math.abs(shape(c) - want) < 0.01, `not the one frame: ${at} → ${c.sw}×${c.sh}`);
    }
  }
});
