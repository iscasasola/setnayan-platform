// Stories §16.9 — camera-move engine tests.
//
// Pure math, no DOM. Verifies the deterministic transform envelope: a move is
// identical every render, ends differ from starts, overscan never drops below
// 1 (so pan/roll can't reveal the frame edge), parallax separates by depth, and
// the beat punch decays to 1 between beats. Runs under `tsx --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEase,
  cameraAt,
  depthAdjust,
  parallaxStrength,
  beatPunch,
  beatPunchAtDownbeats,
  resolveFocus,
  toSvgTransform,
  defaultMoveForIndex,
  defaultCameraMove,
  type CameraMove,
} from './stories-camera-move';

const A: CameraMove = { type: 'push_in', amount: 0.6, ease: 'in_out' };

test('applyEase clamps to [0,1] and smoothsteps endpoints', () => {
  assert.equal(applyEase(-1), 0);
  assert.equal(applyEase(2), 1);
  assert.equal(applyEase(0), 0);
  assert.equal(applyEase(1), 1);
  assert.ok(applyEase(0.5, 'in_out') > 0.49 && applyEase(0.5, 'in_out') < 0.51);
  assert.equal(applyEase(0.5, 'linear'), 0.5);
});

test('cameraAt is deterministic — same inputs, same transform', () => {
  assert.deepEqual(cameraAt(A, 0.42), cameraAt(A, 0.42));
});

test('push_in scales up over progress, never below overscan', () => {
  const start = cameraAt(A, 0);
  const end = cameraAt(A, 1);
  assert.ok(end.scale > start.scale, 'pushes in');
  assert.ok(start.scale >= 1, 'overscan keeps scale >= 1');
});

test('pan holds scale > 1 and translates across center', () => {
  const move: CameraMove = { type: 'pan_r', amount: 1, ease: 'linear' };
  const start = cameraAt(move, 0);
  const end = cameraAt(move, 1);
  assert.ok(start.scale > 1, 'pan overscans so edges never show');
  assert.ok(Math.sign(start.tx) !== Math.sign(end.tx), 'pans through center');
});

test('roll rotates through zero and stays scaled to cover corners', () => {
  const move: CameraMove = { type: 'roll_cw', amount: 1, ease: 'linear' };
  assert.ok(cameraAt(move, 0).rot < 0 && cameraAt(move, 1).rot > 0);
  assert.ok(cameraAt(move, 0.5).scale > 1.1, 'enough scale to hide rotated corners');
});

test('orbit_feel combines push + pan + roll', () => {
  const move: CameraMove = { type: 'orbit_feel', amount: 1, ease: 'linear' };
  const mid = cameraAt(move, 0.25);
  assert.ok(mid.scale > 1, 'has zoom');
  assert.notEqual(mid.tx, 0, 'has pan');
  assert.notEqual(mid.rot, 0, 'has roll');
});

test('depthAdjust: strength 0 is identity; near layer moves more than far', () => {
  const cam = cameraAt({ type: 'pan_r', amount: 1, ease: 'linear' }, 0);
  assert.deepEqual(depthAdjust(cam, 0.8, 0), cam, 'no parallax = identity');
  const far = depthAdjust(cam, 0.0, 1);
  const near = depthAdjust(cam, 1.0, 1);
  assert.ok(Math.abs(near.tx) > Math.abs(far.tx), 'near layer translates more');
});

test('parallaxStrength maps the enum', () => {
  assert.equal(parallaxStrength('none'), 0);
  assert.equal(parallaxStrength('subtle'), 0.5);
  assert.equal(parallaxStrength('strong'), 1);
});

test('beatPunch peaks just after a downbeat and decays to 1', () => {
  const onBeat = beatPunch(0, 120);
  const between = beatPunch(0.25, 120); // 120bpm => 0.5s/beat, 0.25s in
  assert.ok(onBeat > 1, 'punch on the beat');
  assert.equal(between, 1, 'fully decayed mid-beat');
});

test('toSvgTransform emits a valid transform string', () => {
  const s = toSvgTransform({ scale: 1.2, tx: 4, ty: 0, rot: 1.5 }, 180, 320);
  assert.match(s, /translate\(4 0\)/);
  assert.match(s, /scale\(1\.2\)/);
  assert.match(s, /rotate\(1\.5\)/);
});

test('default moves cycle and wrap on negative index', () => {
  assert.equal(defaultMoveForIndex(0), 'push_in');
  assert.equal(defaultMoveForIndex(6), defaultMoveForIndex(0));
  assert.equal(defaultMoveForIndex(-1), defaultMoveForIndex(5));
  const m = defaultCameraMove(1);
  assert.equal(m.type, 'orbit_feel');
  assert.equal(m.parallax, 'subtle');
  assert.equal(m.auto_reframe, true);
});

test('beatPunchAtDownbeats peaks on a downbeat and decays; 1 with no grid', () => {
  const beats = [0, 0.5, 1.0, 1.5];
  assert.equal(beatPunchAtDownbeats(2.0, []), 1, 'no downbeats → no punch');
  assert.ok(beatPunchAtDownbeats(1.0, beats) > 1, 'punch right on a downbeat');
  assert.equal(beatPunchAtDownbeats(1.3, beats), 1, 'decayed before the next beat');
  // before the first downbeat there is nothing to punch from
  assert.equal(beatPunchAtDownbeats(-0.2, beats), 1);
});

test('resolveFocus: center when off, portrait-biased default, clamps subject', () => {
  const off: CameraMove = { type: 'push_in', amount: 0.5, auto_reframe: false };
  assert.deepEqual(resolveFocus(off), { x: 0.5, y: 0.5 });
  const on: CameraMove = { type: 'push_in', amount: 0.5, auto_reframe: true };
  assert.equal(resolveFocus(on).y < 0.5, true, 'default biases slightly up');
  const focused = resolveFocus(on, { x: 1.4, y: -0.2 });
  assert.equal(focused.x, 1, 'clamps x into [0,1]');
  assert.equal(focused.y, 0, 'clamps y into [0,1]');
  assert.deepEqual(resolveFocus(undefined), { x: 0.5, y: 0.5 });
});
