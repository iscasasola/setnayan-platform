/**
 * S2 · encoder-layout.ts — the geometry table itself, and its one hard invariant:
 * opposite corners on the same edge are the SAME distance from their edge.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REFERENCE_LAYOUT,
  LAYOUT_1080P,
  SCALE_1080P,
  REFERENCE_WIDTH,
  REFERENCE_HEIGHT,
  TOP_INSET,
  BOTTOM_INSET,
  SIDE_INSET,
  cornerBoxOrigin,
  scaleLayout,
} from './encoder-layout';

test('reference layout is exactly 1280×720 at scale 1', () => {
  assert.equal(REFERENCE_LAYOUT.width, REFERENCE_WIDTH);
  assert.equal(REFERENCE_LAYOUT.height, REFERENCE_HEIGHT);
  assert.equal(REFERENCE_LAYOUT.scale, 1);
  assert.equal(REFERENCE_LAYOUT.topInset, TOP_INSET);
});

test('1080p table is the reference scaled by exactly ×1.5, not a second hand-typed table', () => {
  assert.equal(SCALE_1080P, 1.5);
  assert.equal(LAYOUT_1080P.width, 1920);
  assert.equal(LAYOUT_1080P.height, 1080);
  assert.equal(LAYOUT_1080P.sideInset, SIDE_INSET * 1.5);
  assert.equal(LAYOUT_1080P.monogramMarkSize, Math.round(REFERENCE_LAYOUT.monogramMarkSize * 1.5));
});

test('SYMMETRY — left/right corners on the same edge sit the same distance from their edge', () => {
  const w = 64;
  const h = 64;
  const topLeft = cornerBoxOrigin('top-left', w, h, REFERENCE_LAYOUT);
  const topRight = cornerBoxOrigin('top-right', w, h, REFERENCE_LAYOUT);
  const bottomLeft = cornerBoxOrigin('bottom-left', w, h, REFERENCE_LAYOUT);
  const bottomRight = cornerBoxOrigin('bottom-right', w, h, REFERENCE_LAYOUT);

  // Same row on each edge.
  assert.equal(topLeft.y, topRight.y);
  assert.equal(bottomLeft.y, bottomRight.y);

  // Left inset === right inset, on BOTH edges — one constant, not two special cases.
  assert.equal(topLeft.x, SIDE_INSET);
  assert.equal(REFERENCE_LAYOUT.width - (topRight.x + w), SIDE_INSET);
  assert.equal(bottomLeft.x, SIDE_INSET);
  assert.equal(REFERENCE_LAYOUT.width - (bottomRight.x + w), SIDE_INSET);

  // Top inset and bottom inset are each their own single constant across both corners.
  assert.equal(topLeft.y, TOP_INSET);
  assert.equal(REFERENCE_LAYOUT.height - (bottomLeft.y + h), BOTTOM_INSET);
});

test('SYMMETRY — top-center is centered: equal box-edge distance to both side edges', () => {
  const w = 90;
  const h = 40;
  const center = cornerBoxOrigin('top-center', w, h, REFERENCE_LAYOUT);
  const distanceToLeftEdge = center.x;
  const distanceToRightEdge = REFERENCE_LAYOUT.width - (center.x + w);
  assert.equal(distanceToLeftEdge, distanceToRightEdge);
});

test('MUTATION — a bottom-right that forgets to subtract sideInset breaks symmetry (sabotage proof)', () => {
  // Sabotage: a broken cornerBoxOrigin that anchors bottom-right at the raw edge.
  function brokenCornerBoxOrigin(w: number) {
    return { x: REFERENCE_LAYOUT.width - w, y: REFERENCE_LAYOUT.height - BOTTOM_INSET - 64 };
  }
  const w = 64;
  const good = cornerBoxOrigin('bottom-right', w, 64, REFERENCE_LAYOUT);
  const broken = brokenCornerBoxOrigin(w);
  // The real function keeps the inset; the sabotage does not — proves the assertion
  // above (`REFERENCE_LAYOUT.width - (bottomRight.x + w) === SIDE_INSET`) is load-bearing.
  assert.notEqual(good.x, broken.x);
  assert.equal(REFERENCE_LAYOUT.width - (good.x + w), SIDE_INSET, 'real impl: symmetric');
  assert.equal(REFERENCE_LAYOUT.width - (broken.x + w), 0, 'sabotage: NOT symmetric — red if asserted equal');
});

test('scaleLayout(1) reproduces REFERENCE_LAYOUT field for field', () => {
  const identity = scaleLayout(1, REFERENCE_WIDTH, REFERENCE_HEIGHT);
  assert.deepEqual(identity, REFERENCE_LAYOUT);
});
