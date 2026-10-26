/**
 * The one viewer's gestures (owner 2026-10-27: "swiping left and right goes to the next or previous photo. swipe down
 * or up will close the preview" · "pinch zoom, swipe, button locations will stay the same"). Thresholds, as numbers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AXIS_LOCK_PX,
  CLOSE_PX,
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  SWIPE_PX,
  clampPan,
  clampScale,
  classifySwipe,
  doubleTapZoom,
  isDoubleTap,
  keyIntent,
  lockAxis,
  neighbour,
  pinchScale,
} from './photo-viewer-gestures';

const base = { ms: 400, scale: 1, hasPrev: true, hasNext: true } as const;

test('the first few pixels decide the axis; a drag with no neighbours is always vertical', () => {
  assert.equal(lockAxis(AXIS_LOCK_PX, 0, true), null, 'a 10px wobble decides nothing');
  assert.equal(lockAxis(30, 5, true), 'x');
  assert.equal(lockAxis(5, 30, true), 'y');
  assert.equal(lockAxis(30, 5, false), 'y', 'one photo: a sideways drag cannot move to a neighbour');
});

test('sideways past the threshold: left = next, right = previous', () => {
  assert.equal(classifySwipe({ ...base, axis: 'x', dx: -SWIPE_PX, dy: 0 }), 'next');
  assert.equal(classifySwipe({ ...base, axis: 'x', dx: SWIPE_PX, dy: 0 }), 'prev');
  assert.equal(classifySwipe({ ...base, axis: 'x', dx: -(SWIPE_PX - 1), dy: 0 }), 'none', 'short of the threshold, a slow drag stays');
});

test('a quick flick counts even when it is short', () => {
  assert.equal(classifySwipe({ ...base, ms: 60, axis: 'x', dx: -40, dy: 0 }), 'next');
  assert.equal(classifySwipe({ ...base, ms: 60, axis: 'y', dy: -40, dx: 0 }), 'close');
  assert.equal(classifySwipe({ ...base, ms: 60, axis: 'x', dx: -15, dy: 0 }), 'none', 'a tiny flick is a tap');
});

test('up OR down past the threshold closes', () => {
  assert.equal(classifySwipe({ ...base, axis: 'y', dx: 0, dy: CLOSE_PX }), 'close', 'down');
  assert.equal(classifySwipe({ ...base, axis: 'y', dx: 0, dy: -CLOSE_PX }), 'close', 'up');
  assert.equal(classifySwipe({ ...base, axis: 'y', dx: 0, dy: CLOSE_PX - 1 }), 'none');
});

test('no wrap at the ends: the first photo does not swipe to the last', () => {
  assert.equal(classifySwipe({ ...base, hasPrev: false, axis: 'x', dx: 200, dy: 0 }), 'none');
  assert.equal(classifySwipe({ ...base, hasNext: false, axis: 'x', dx: -200, dy: 0 }), 'none');
  assert.equal(neighbour(0, 5, -1), null);
  assert.equal(neighbour(4, 5, 1), null);
  assert.equal(neighbour(2, 5, 1), 3);
  assert.equal(neighbour(2, 5, -1), 1);
});

test('zoomed in, a drag is a pan — it never changes the photo or closes the viewer', () => {
  assert.equal(classifySwipe({ ...base, scale: 2, axis: 'x', dx: -300, dy: 0 }), 'none');
  assert.equal(classifySwipe({ ...base, scale: 2, axis: 'y', dx: 0, dy: 300 }), 'none');
});

test('pinch scales between 1× and the cap', () => {
  assert.equal(pinchScale(1, 100, 200), 2);
  assert.equal(pinchScale(2, 100, 50), 1);
  assert.equal(pinchScale(1, 100, 10_000), MAX_SCALE);
  assert.equal(pinchScale(1, 100, 10), 1, 'never smaller than the screen');
  assert.equal(pinchScale(1.5, 0, 50), 1.5, 'a zero start distance keeps the scale');
  assert.equal(clampScale(Number.NaN), 1);
});

test('a zoomed photo cannot be panned off the screen; at 1× it sits centred', () => {
  const stage = { w: 400, h: 800 };
  assert.deepEqual(clampPan({ x: 999, y: -999 }, 2, stage), { x: 200, y: -400 });
  assert.deepEqual(clampPan({ x: 50, y: 50 }, 1, stage), { x: 0, y: 0 });
});

test('double tap: in toward the tapped point, then back out to 1×', () => {
  const stage = { w: 400, h: 800, left: 0, top: 0 };
  const zin = doubleTapZoom(1, { x: 300, y: 400 }, stage);
  assert.equal(zin.scale, DOUBLE_TAP_SCALE);
  assert.ok(zin.pan.x < 0, 'a tap right of centre moves the photo left so that point stays under the finger');
  assert.equal(Math.abs(Math.round(zin.pan.y)), 0);
  const zout = doubleTapZoom(DOUBLE_TAP_SCALE, { x: 300, y: 400 }, stage);
  assert.deepEqual(zout, { scale: 1, pan: { x: 0, y: 0 } });
  assert.equal(isDoubleTap({ t: 0, x: 10, y: 10 }, { t: 200, x: 14, y: 12 }), true);
  assert.equal(isDoubleTap({ t: 0, x: 10, y: 10 }, { t: 500, x: 10, y: 10 }), false, 'too slow');
  assert.equal(isDoubleTap({ t: 0, x: 10, y: 10 }, { t: 100, x: 120, y: 10 }), false, 'too far apart');
  assert.equal(isDoubleTap(null, { t: 100, x: 10, y: 10 }), false);
});

test('desktop keys: ← previous, → next, Escape closes, anything else is not the viewer’s', () => {
  assert.equal(keyIntent('ArrowLeft'), 'prev');
  assert.equal(keyIntent('ArrowRight'), 'next');
  assert.equal(keyIntent('Escape'), 'close');
  assert.equal(keyIntent('a'), null);
});
