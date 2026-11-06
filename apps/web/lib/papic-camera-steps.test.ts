/**
 * 📷 THE COMPLETE CAMERA'S ZOOM STEPS AND TAP-TO-FOCUS POINT (owner 2026-10-24,
 * `prototypes/papic_camera_complete_2026-10-24_fable.html`, pick 1: "2× shows on
 * every phone"; the selfie camera drops 0.5×).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { focusPointFromTap, zoomLabel, zoomSteps } from './papic-camera-steps';

test('the zoom steps include 2× on every phone, and drop 0.5× on the selfie camera', () => {
  assert.deepEqual(zoomSteps([1], 'environment'), [1, 2], 'a phone with one back camera still offers 2× (a crop)');
  assert.deepEqual(zoomSteps([0.5, 1], 'environment'), [0.5, 1, 2]);
  assert.deepEqual(zoomSteps([0.5, 1], 'user'), [1, 2], 'the selfie camera offers 0.5×');
  assert.deepEqual(zoomSteps([1], 'user'), [1, 2]);
  for (const hw of [[1], [0.5, 1]] as const) {
    for (const f of ['environment', 'user'] as const) assert.ok(zoomSteps(hw, f).includes(2), `${f} ${hw}: no 2×`);
  }
  assert.equal(zoomLabel(0.5), '.5');
  assert.equal(zoomLabel(2), '2');
});

test('a tap maps to the frame through object-cover, the 2× crop and the selfie mirror', () => {
  // A 1080×1920 portrait frame in a 390×600 box: object-cover crops the top and bottom.
  const base = { boxW: 390, boxH: 600, videoW: 1080, videoH: 1920, crop: 1, mirrored: false };
  const c = focusPointFromTap({ ...base, tapX: 195, tapY: 300 })!;
  assert.ok(Math.abs(c.x - 0.5) < 1e-9 && Math.abs(c.y - 0.5) < 1e-9, 'the centre is not the centre');
  const left = focusPointFromTap({ ...base, tapX: 0, tapY: 300 })!;
  assert.ok(Math.abs(left.x) < 1e-9);
  const mirrored = focusPointFromTap({ ...base, tapX: 0, tapY: 300, mirrored: true })!;
  assert.ok(Math.abs(mirrored.x - 1) < 1e-9, 'the selfie mirror is not undone');
  const cropped = focusPointFromTap({ ...base, tapX: 0, tapY: 300, crop: 2 })!;
  assert.ok(Math.abs(cropped.x - 0.25) < 1e-9, 'a 2× crop is not undone');
  assert.equal(focusPointFromTap({ ...base, videoW: 0, tapX: 1, tapY: 1 }), null);
});

test('in Snippet (object-contain) a tap maps onto the whole frame, and a tap on the bars focuses nothing', () => {
  // A 1080×1920 portrait frame contained in a 390×390 box: drawn 219.375 wide, centred, bars left and right.
  const base = { boxW: 390, boxH: 390, videoW: 1080, videoH: 1920, crop: 1, mirrored: false, fit: 'contain' as const };
  const top = focusPointFromTap({ ...base, tapX: 195, tapY: 0 })!;
  assert.ok(Math.abs(top.x - 0.5) < 1e-9 && Math.abs(top.y) < 1e-9, 'the top of the box is not the top of the frame');
  assert.equal(focusPointFromTap({ ...base, tapX: 10, tapY: 195 }), null, 'a tap on the bar picked a point');
  // The same tap read as cover lands somewhere else — the fit matters.
  const cover = focusPointFromTap({ ...base, fit: 'cover', tapX: 195, tapY: 0 })!;
  assert.ok(cover.y > 0.2, 'cover and contain read the same tap the same way');
});
