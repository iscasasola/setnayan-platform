/**
 * THE ONE-BODY PIN for the public guest walk.
 *
 * A token-holding guest used to see **two of themselves**: `GuestTable` drew a
 * seated accent figure at their own chair the moment the page opened, while
 * `GuestAvatar` walked a second copy of them across the room to that same
 * chair — and, because `seatApproachPath` ends ON the chair, the walker
 * finished standing inside the seated one. The on-screen hint promised "tap
 * your gold seat to sit" while the surface mounted no `SitController` at all.
 *
 * Nothing failed. Every piece worked exactly as written; they were merely all
 * true at once. That is the shape of defect a source guard exists for, and why
 * this file asserts about the RENDER GRAPH rather than about a return value.
 *
 * Four properties, each of which alone re-creates the bug if it regresses:
 *
 *   1. the own seat draws NO body — the gold ring marks it, the walker fills it
 *   2. the seat walk stops BESIDE the chair (approachPoint), not on it
 *   3. the walker goes bodyless while the sit clip owns the body
 *   4. the table registers a `tableId`, or the chair cannot be pulled back
 *
 * ⚠ WHAT THIS FILE CANNOT DO: none of it proves the sit LOOKS right. The
 * choreography is visual and this is a text guard. It pins that there is
 * exactly one body and that the hand-off is wired — not that the clip reads
 * well on screen.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { approachPoint } from './seating-3d';
import { SIT_TIMING } from '@/app/_components/plan3d/kit/sit-controller';

const SIT_APPROACH_M = SIT_TIMING.APPROACH_M;

const SRC = readFileSync(
  join(import.meta.dirname, '..', 'app', '[slug]', 'venue', '_components', 'guest-venue-3d.tsx'),
  'utf8',
);

/** The `mine` branch of GuestTable's chair map — from the branch to its close. */
function ownSeatBranch(): string {
  const start = SRC.indexOf('if (mine) {');
  assert.ok(start > 0, 'could not find the own-seat branch — has GuestTable been restructured?');
  // Slice to the next chair-map statement so the window faces the branch only.
  const end = SRC.indexOf('const photoUrl', start);
  assert.ok(end > start, 'own-seat branch has no visible end');
  return SRC.slice(start, end);
}

test('the own seat draws a marker, never a body', () => {
  const branch = ownSeatBranch();
  assert.ok(
    !/SeatedFigure|<Figure|ChibiFigure/.test(branch),
    'the own seat renders a figure again — that is the second copy of the guest',
  );
  assert.match(branch, /ringGeometry/, 'the own seat must still be marked by its gold ring');
});

test('the seat walk stops beside the chair, not on it', () => {
  assert.match(
    SRC,
    /p\[p\.length - 1\] = approachPoint\(sp, SIT_TIMING\.APPROACH_M\)/,
    'the seat walk must retarget its last waypoint to the approach point — ' +
      'seatApproachPath ends ON the chair, which is where the walker used to stop',
  );
});

test('the walker goes bodyless while the sit clip owns the body', () => {
  assert.match(SRC, /bodyHidden \? null :/, 'the walker must be able to hide its body');
  assert.match(SRC, /bodyHidden=\{sit !== null\}/, 'the walker must hide it exactly while sitting');
  // It must HIDE, not unmount: unmounting resets the walker's tracked position
  // and teleports the guest to the entrance when they next stand up.
  assert.ok(
    !/\{sit \? null : \(?\s*<GuestAvatar/.test(SRC),
    'the walker must stay MOUNTED during the sit (hidden), or standing up teleports the guest',
  );
});

test('the table registers a tableId, or the chair can never be pulled back', () => {
  const chairs = SRC.slice(SRC.indexOf('<InstancedChairs'), SRC.indexOf('{chairs.map('));
  assert.match(
    chairs,
    /tableId=\{table\.id\}/,
    'InstancedChairs must register a tableId — without it detachChair() no-ops ' +
      'and the guest sits straight through a chair that never moves',
  );
});

test('a SitController is actually mounted on this surface', () => {
  assert.match(SRC, /<SitController/, 'the surface promises "tap your gold seat to sit"');
  assert.match(SRC, /arrivePose="run"/, "the walker renders the run cycle — the blend must start there");
});

// ── The geometry the retarget relies on. Pure, so assert it rather than trust it.
test('approachPoint really lands clear of the chair, behind the seated gaze', () => {
  // Every gaze direction around a round table, as plain seat poses — the
  // property is about the vector, not about any particular table fixture.
  for (let deg = 0; deg < 360; deg += 15) {
    const faceY = (deg * Math.PI) / 180;
    const seat = { x: 4.2, z: -1.7, faceY };
    const ap = approachPoint(seat, SIT_APPROACH_M);
    const d = Math.hypot(ap.x - seat.x, ap.z - seat.z);
    assert.ok(
      Math.abs(d - SIT_APPROACH_M) < 1e-9,
      `gaze ${deg}°: approach point is ${d.toFixed(3)} m from the chair, expected ${SIT_APPROACH_M}`,
    );
    // It must sit BEHIND the chair (opposite the gaze), never in front — in
    // front is the TABLE, and the walker would arrive on the tabletop.
    const gazeX = Math.sin(faceY);
    const gazeZ = Math.cos(faceY);
    const dot = (ap.x - seat.x) * gazeX + (ap.z - seat.z) * gazeZ;
    assert.ok(
      dot < 0,
      `gaze ${deg}°: approach point is on the TABLE side of the chair (dot ${dot.toFixed(3)})`,
    );
  }
});

// The walker's retarget and the controller's step-in must agree on ONE
// distance, or the figure steps a gap it isn't standing in. SIT_TIMING says so
// in a comment ("MUST mirror approachPoint's 0.55 m default"); pin it.
test('the walk retarget and the sit step-in use the same 0.55 m', () => {
  assert.equal(SIT_TIMING.APPROACH_M, 0.55, 'SIT_TIMING.APPROACH_M drifted');
  const seat = { x: 0, z: 0, faceY: 0 };
  assert.deepEqual(
    approachPoint(seat, SIT_TIMING.APPROACH_M),
    approachPoint(seat),
    "approachPoint's default no longer matches SIT_TIMING.APPROACH_M — " +
      'the walker would stop somewhere the sit clip does not expect',
  );
});
