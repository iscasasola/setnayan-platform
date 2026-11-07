/**
 * GUARD — a shop logo's align + zoom (owner, 2026-11-06 gate walk, A2): the Event Hub Maker photo control's OWN sets
 * and math (`lib/hub-canvas.ts`), stored beside the logo, drawn the same way everywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HUB_DEFAULT_FOCAL, HUB_DEFAULT_ZOOM, focalToObjectPosition } from './hub-canvas';
import {
  DEFAULT_LOGO_FRAME,
  LOGO_ZOOM_LABEL,
  OPEN_SHOP_LOGO_PATH,
  logoFrameColumns,
  logoFrameStyle,
  readLogoFrame,
} from './open-shop-logo';

test('the default frame is the Maker’s default (centre, as uploaded)', () => {
  assert.deepEqual(DEFAULT_LOGO_FRAME, { focal: HUB_DEFAULT_FOCAL, zoom: HUB_DEFAULT_ZOOM });
  assert.deepEqual(readLogoFrame(null), DEFAULT_LOGO_FRAME);
  assert.deepEqual(readLogoFrame({ logo_focal: null, logo_zoom: null }), DEFAULT_LOGO_FRAME);
});

test('reads the columns and the form fields alike; drops (never repairs) a value outside the sets', () => {
  assert.deepEqual(readLogoFrame({ logo_focal: 3, logo_zoom: 150 }), { focal: 3, zoom: 150 });
  assert.deepEqual(readLogoFrame({ logo_focal: '7', logo_zoom: '120' }), { focal: 7, zoom: 120 });
  assert.deepEqual(readLogoFrame({ logo_focal: 10, logo_zoom: 137 }), DEFAULT_LOGO_FRAME);
  assert.deepEqual(readLogoFrame({ logo_focal: 'x', logo_zoom: '' }), DEFAULT_LOGO_FRAME);
});

test('an untouched frame stores nothing (NULL), a moved one stores its numbers', () => {
  assert.deepEqual(logoFrameColumns(DEFAULT_LOGO_FRAME), { logo_focal: null, logo_zoom: null });
  assert.deepEqual(logoFrameColumns({ focal: 1, zoom: 120 }), { logo_focal: 1, logo_zoom: 120 });
});

test('every logo surface draws through focalToObjectPosition + the same zoom, from the same point', () => {
  assert.deepEqual(logoFrameStyle(null), { objectPosition: focalToObjectPosition(5) });
  const s = logoFrameStyle({ focal: 3, zoom: 150 });
  assert.equal(s.objectPosition, focalToObjectPosition(3));
  assert.equal(s.transform, 'scale(1.5)');
  assert.equal(s.transformOrigin, focalToObjectPosition(3));
});

test('the zoom words are the Maker’s, and the logo screen has one address', () => {
  assert.deepEqual(LOGO_ZOOM_LABEL, { 100: 'As it is', 120: 'Closer', 150: 'Closest' });
  assert.equal(OPEN_SHOP_LOGO_PATH, '/open-shop/logo');
});
