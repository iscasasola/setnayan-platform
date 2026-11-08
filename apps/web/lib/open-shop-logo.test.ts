/**
 * GUARD — a shop logo's frame (owner 7 Nov, prototype v21, A3: "drag and pinch to zoom"): x / y 0–100 and zoom 100–300
 * (`lib/picture-frame.ts`), stored beside the logo in three columns, drawn the same way everywhere — and the circle can
 * never show an empty edge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOGO_FRAME,
  LOGO_FRAME_INPUTS,
  OPEN_SHOP_LOGO_PATH,
  formCarriesLogoFrame,
  logoFrameColumns,
  logoFrameStyle,
  readLogoFrame,
  readLogoFrameFromForm,
} from './open-shop-logo';
import {
  DEFAULT_PICTURE_FRAME,
  PICTURE_ZOOM_MAX,
  PICTURE_ZOOM_MIN,
  panPictureFrame,
  storedPictureFrame,
  zoomPictureFrameAt,
  type PictureFrame,
} from './picture-frame';

test('the default frame is centred, as uploaded — and an empty row reads as it', () => {
  assert.deepEqual(DEFAULT_LOGO_FRAME, { x: 50, y: 50, zoom: 100 });
  assert.deepEqual(DEFAULT_LOGO_FRAME, DEFAULT_PICTURE_FRAME);
  assert.deepEqual(readLogoFrame(null), DEFAULT_LOGO_FRAME);
  assert.deepEqual(readLogoFrame({ logo_focal_x: null, logo_focal_y: null, logo_zoom: null }), DEFAULT_LOGO_FRAME);
});

test('a stored frame reads back; anything outside its range — or not whole — is dropped per value, never repaired', () => {
  assert.deepEqual(readLogoFrame({ logo_focal_x: 0, logo_focal_y: 100, logo_zoom: 300 }), { x: 0, y: 100, zoom: 300 });
  assert.deepEqual(readLogoFrame({ logo_focal_x: '12', logo_focal_y: '88', logo_zoom: '175' }), { x: 12, y: 88, zoom: 175 });
  assert.deepEqual(readLogoFrame({ logo_focal_x: 101, logo_focal_y: -1, logo_zoom: 99 }), DEFAULT_LOGO_FRAME);
  assert.deepEqual(readLogoFrame({ logo_focal_x: 20.5, logo_focal_y: 'x', logo_zoom: 301 }), DEFAULT_LOGO_FRAME);
  assert.deepEqual(readLogoFrame({ logo_focal_x: 20, logo_focal_y: 'x', logo_zoom: 301 }), { x: 20, y: 50, zoom: 100 });
});

test('the form posts under the column names; a form without the control is told apart', () => {
  assert.deepEqual(LOGO_FRAME_INPUTS, { x: 'logo_focal_x', y: 'logo_focal_y', zoom: 'logo_zoom' });
  const fd = new FormData();
  assert.equal(formCarriesLogoFrame(fd), false);
  fd.set('logo_focal_x', '30');
  fd.set('logo_focal_y', '70');
  fd.set('logo_zoom', '140');
  assert.equal(formCarriesLogoFrame(fd), true);
  assert.deepEqual(readLogoFrameFromForm(fd), { x: 30, y: 70, zoom: 140 });
});

test('the columns: NULL for each default value, whole numbers otherwise', () => {
  assert.deepEqual(logoFrameColumns(DEFAULT_LOGO_FRAME), { logo_focal_x: null, logo_focal_y: null, logo_zoom: null });
  assert.deepEqual(logoFrameColumns({ x: 12.4, y: 50, zoom: 187.6 }), { logo_focal_x: 12, logo_focal_y: null, logo_zoom: 188 });
  assert.deepEqual(storedPictureFrame({ x: -3, y: 140, zoom: 999 }), { x: 0, y: 100, zoom: 300 });
});

test('the style: object-position x% y%, and a zoom scales about that same point', () => {
  assert.deepEqual(logoFrameStyle(null), { objectPosition: '50% 50%' });
  assert.deepEqual(logoFrameStyle({ x: 20, y: 80, zoom: 150 }), {
    objectPosition: '20% 80%',
    transform: 'scale(1.5)',
    transformOrigin: '20% 80%',
  });
});

/** The picture's left / top edge in circle px for a frame — the geometry the CSS above draws (cover, then scale). */
function edges(f: PictureFrame, D: number, aspect: number) {
  const W = D * Math.max(1, aspect);
  const H = D * Math.max(1, 1 / aspect);
  const z = f.zoom / 100;
  return { left: (f.x / 100) * (D - W * z), top: (f.y / 100) * (D - H * z), W: W * z, H: H * z };
}

test('no gesture can open an empty edge: after any drag / pinch the picture still covers the circle', () => {
  const D = 148;
  for (const aspect of [0.5, 0.8, 1, 1.6, 3]) {
    let f: PictureFrame = DEFAULT_PICTURE_FRAME;
    const box = { size: D, aspect };
    const moves: Array<[string, number, number, number?]> = [
      ['pan', 400, -400],
      ['zoom', 0, 0, 260],
      ['pan', -900, 900],
      ['zoom', 10, 140, 120],
      ['pan', 33, 12],
      ['zoom', 148, 0, 999],
      ['zoom', 70, 70, 1],
    ];
    for (const [kind, a, b, z] of moves) {
      f = kind === 'pan' ? panPictureFrame(f, box, a, b) : zoomPictureFrameAt(f, box, z!, a, b);
      const e = edges(f, D, aspect);
      assert.ok(e.left <= 0.001 && e.top <= 0.001, `aspect ${aspect}: an edge opened on the left/top (${JSON.stringify(f)})`);
      assert.ok(e.left + e.W >= D - 0.001 && e.top + e.H >= D - 0.001, `aspect ${aspect}: an edge opened right/bottom`);
      assert.ok(f.zoom >= PICTURE_ZOOM_MIN && f.zoom <= PICTURE_ZOOM_MAX);
    }
  }
});

test('the picture follows the finger, and a pinch keeps the point under the fingers still', () => {
  const box = { size: 100, aspect: 2 }; // wide: 100 px of horizontal slack at zoom 100
  const moved = panPictureFrame(DEFAULT_PICTURE_FRAME, box, -10, 0);
  assert.ok(moved.x > 50, 'dragging left shows more of the right side');
  assert.equal(moved.y, 50, 'no vertical slack at zoom 100 on a wide picture → y does not move');
  const z = zoomPictureFrameAt(DEFAULT_PICTURE_FRAME, box, 200, 25, 25);
  const before = edges(DEFAULT_PICTURE_FRAME, 100, 2);
  const after = edges(z, 100, 2);
  const u0 = (25 - before.left) / before.W;
  const u1 = (25 - after.left) / after.W;
  assert.ok(Math.abs(u0 - u1) < 0.01, `the point under (25,25) drifted: ${u0} → ${u1}`);
});

test('the screen after "Open my shop"', () => {
  assert.equal(OPEN_SHOP_LOGO_PATH, '/open-shop/logo');
});
