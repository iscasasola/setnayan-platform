/**
 * 🔒 A7-05 (final check 25 Nov; drawing `prototypes/final-check-area-7_2026-11-25/` § 3, approved): on /pa3d and
 * /pa3d/try an up-or-down swipe scrolls the PAGE (touch-action: pan-y), and the room turns by a sideways drag or by the
 * two "Turn left / Turn right" rounds — one step each, Move 320 with the settle curve, a cut under reduced motion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MOVE_MS } from './motion-table';
import { TURN_MS, TURN_STEP_RAD, settleAt, turnAzimuthAt } from './plan3d-turn-step';

test('one tap turns one step, at the house Move speed', () => {
  assert.equal(TURN_MS, MOVE_MS);
  assert.equal(turnAzimuthAt(0, 1, TURN_MS, false), TURN_STEP_RAD);
  assert.equal(turnAzimuthAt(1, -1, TURN_MS * 2, false), 1 - TURN_STEP_RAD);
  assert.equal(turnAzimuthAt(0, 1, 0, false), 0);
});

test('the settle curve: starts at 0, ends at 1, eases out (more than half done at half time), never overshoots', () => {
  assert.equal(settleAt(0), 0);
  assert.equal(settleAt(1), 1);
  assert.ok(settleAt(0.5) > 0.5, 'not an ease-out');
  for (let t = 0; t <= 1; t += 0.05) assert.ok(settleAt(t) >= 0 && settleAt(t) <= 1.0001);
});

test('reduced motion cuts straight to the new angle', () => {
  assert.equal(turnAzimuthAt(0, -1, 10, true), -TURN_STEP_RAD);
});

test('the two public pages let the page scroll; every other room keeps today\'s drag', () => {
  const web = process.cwd();
  const scene = stripComments(readFileSync(join(web, 'app/_components/plan3d/plan3d-scene.tsx'), 'utf8'));
  assert.match(scene, /touchAction: pageScroll \? 'pan-y' : 'none'/);
  assert.match(scene, /pageScroll = false,/, 'the default changed for every room');
  const room = stripComments(readFileSync(join(web, 'app/(shell)/pa3d/_pa3d-room.tsx'), 'utf8'));
  assert.match(room, /\n\s+pageScroll\n/);
  assert.match(room, /label="Turn left"/);
  assert.match(room, /label="Turn right"/);
  assert.match(room, /hidden \[@media\(pointer:coarse\)\]:inline-flex/, 'the rounds show with a mouse too');
  assert.match(room, /Drag sideways or tap the arrows to look around\./);
});
