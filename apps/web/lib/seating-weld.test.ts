/**
 * CONNECTIVE SNAP POSITIONING (owner ruling 2026-07-16 — linking DEFERRED).
 *
 * This PR connects tables by DRAG-SNAP POSITIONING, not by linking. Dragging a
 * chainable table (long_banquet / family_head / serpentine) so its end nears
 * another chainable end magnetically snaps it to the pose where the two ends
 * CONNECT CLEANLY: coincident endpoints, tangent-continuous, no overlap, no gap,
 * seam seats de-duplicated. On drop the snapped x/y/rotation persists via the
 * ORDINARY move path — the two stay INDEPENDENT tables (no link_group_id) that
 * merely sit connected, and the oracle accepts the joint as valid ADJACENCY
 * purely from geometry (no link/exemption crutch).
 *
 * These pin: (a) serpentine connect, (b) banquet + cross-family connect,
 * (c) reload keeps them connected from their own coords, (d) the adjacency is
 * geometric — poses carry NO link_group_id, (e) rounds never connect (collide).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  obbOf,
  footprintsOverlap,
  checkPlacement,
  legalJoinPose,
  isLegalJoint,
  atLegalJoint,
  tableGeometry,
  rotatePoint,
  serpentineEndsWorld,
  rectEndsWorld,
  type WorldPose,
} from './seating';

type Shape = WorldPose['shape'];

// A world pose carrying NO link group — connection must hold on geometry alone.
function wpose(shape: Shape, capacity: number, x: number, y: number, rot: number, id: string, scale = 1): WorldPose {
  return { tableId: id, shape, capacity, x, y, rot, scale, linkGroupId: null };
}
const jp = (shape: Shape, capacity: number, x: number, y: number, rot: number, scale = 1) => ({
  shape,
  capacity,
  x,
  y,
  rot,
  scale,
});
function seatWorld(p: { shape: Shape; capacity: number; x: number; y: number; rot: number; scale: number }) {
  return tableGeometry(p.shape, p.capacity).seats.map((s) => {
    const r = rotatePoint({ x: s.x * p.scale, y: s.y * p.scale }, p.rot);
    return { x: p.x + r.x, y: p.y + r.y };
  });
}
const rectHalfLen = (cap: number) => tableGeometry('long_banquet', cap).hub.w / 2;
// Min distance between any seat of A and any seat of B (a "doubled" seam seat).
function minSeatGap(a: ReturnType<typeof seatWorld>, b: ReturnType<typeof seatWorld>) {
  let m = Infinity;
  for (const p of a) for (const q of b) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y));
  return m;
}

// ===========================================================================
// (a) Serpentine → serpentine: clean connect, valid by geometry, no doubled seam
// ===========================================================================

test('CONNECT: dragging serpentine B toward A snaps to a clean joint — ends coincident, valid, no doubled seam', () => {
  const A = jp('serpentine', 5, 500, 500, 0);
  // Rough drop ~a wedge to the right (as a drag would land it near A's end).
  const B = legalJoinPose(A, jp('serpentine', 5, 690, 500, 0), 260);
  assert.ok(B, 'a near-end drop snaps to a legal joint');
  // Ends coincident (tips touch) + tangent-continuous (legal joint rotation).
  const tipsA = serpentineEndsWorld({ ...A });
  const tipsB = serpentineEndsWorld({ x: B!.x, y: B!.y, rot: B!.rot, scale: 1 });
  const near = Math.min(...tipsA.flatMap((p) => tipsB.map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
  assert.ok(near <= 6, `ends coincident (${near.toFixed(1)}px)`);
  assert.ok(isLegalJoint(A, jp('serpentine', 5, B!.x, B!.y, B!.rot), 40), 'tangent-continuous legal joint');
  // No doubled seam seat.
  assert.ok(minSeatGap(seatWorld(A), seatWorld({ ...jp('serpentine', 5, B!.x, B!.y, B!.rot) })) > 20, 'no doubled seam seat');
  // Collision-CLEAN with NO link/exemption: both poses carry linkGroupId null.
  const poseA = wpose('serpentine', 5, A.x, A.y, A.rot, 'A');
  const poseB = wpose('serpentine', 5, B!.x, B!.y, B!.rot, 'B');
  assert.equal(checkPlacement(poseB, { others: [poseA], zones: [] }, { gapPx: 0 }).valid, true, 'clean joint = valid adjacency');
});

// ===========================================================================
// (b) Banquet↔banquet + cross-family banquet↔serpentine
// ===========================================================================

test('CONNECT: two banquets snap flush — ends coincident, no doubled seam, checkPlacement valid (no link)', () => {
  const A = jp('long_banquet', 10, 500, 500, 0);
  const B = legalJoinPose(A, jp('long_banquet', 10, 500 + tableGeometry('long_banquet', 10).box.w, 500, 0), 400);
  assert.ok(B, 'flush end-to-end snap');
  const endsA = rectEndsWorld({ ...A, halfLen: rectHalfLen(10) });
  const endsB = rectEndsWorld({ x: B!.x, y: B!.y, rot: B!.rot, halfLen: rectHalfLen(10) });
  const near = Math.min(...endsA.flatMap((p) => endsB.map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
  assert.ok(near <= 6, `tabletops meet flush (${near.toFixed(1)}px)`);
  assert.ok(minSeatGap(seatWorld(A), seatWorld({ ...jp('long_banquet', 10, B!.x, B!.y, B!.rot) })) > 20, 'no doubled seam seat');
  const res = checkPlacement(
    wpose('long_banquet', 10, B!.x, B!.y, B!.rot, 'B'),
    { others: [wpose('long_banquet', 10, A.x, A.y, A.rot, 'A')], zones: [] },
    { gapPx: 0 },
  );
  assert.equal(res.valid, true, 'flush banquets are valid adjacency (no link exemption)');
});

test('CONNECT: a serpentine snaps onto a banquet end (cross-family) — coincident + valid, no link', () => {
  const A = jp('long_banquet', 10, 500, 500, 0);
  const bEnd = rectEndsWorld({ ...A, halfLen: rectHalfLen(10) })[0]!;
  const B = legalJoinPose(A, jp('serpentine', 5, bEnd.x + 120, bEnd.y, 0), 320);
  assert.ok(B, 'cross-family straight→curve connect is offered');
  const tips = serpentineEndsWorld({ x: B!.x, y: B!.y, rot: B!.rot, scale: 1 });
  assert.ok(Math.min(...tips.map((t) => Math.hypot(t.x - bEnd.x, t.y - bEnd.y))) <= 6, 'a serpentine tip meets the banquet end');
  assert.ok(minSeatGap(seatWorld(A), seatWorld({ ...jp('serpentine', 5, B!.x, B!.y, B!.rot) })) > 20, 'no doubled seam seat');
  assert.equal(
    checkPlacement(
      wpose('serpentine', 5, B!.x, B!.y, B!.rot, 'B'),
      { others: [wpose('long_banquet', 10, A.x, A.y, A.rot, 'A')], zones: [] },
      { gapPx: 0 },
    ).valid,
    true,
    'cross-family joint is valid adjacency',
  );
});

// ===========================================================================
// (c) Reload keeps them connected from each table's OWN persisted coords
// ===========================================================================

test('CONNECT persists like an ordinary move: reload (own %→px coords) keeps the joint', () => {
  const rect = { width: 1000, height: 1000 };
  const A = jp('serpentine', 5, 400, 400, 0);
  const B = legalJoinPose(A, jp('serpentine', 5, 400, 640, 180), 260)!; // S-bend
  // Persist BOTH tables' own coords as canvas-% (the ordinary move path), reload.
  const toPct = (v: number, span: number) => (v / span) * 100;
  const reload = (p: { x: number; y: number; rot: number }) =>
    jp('serpentine', 5, (toPct(p.x, rect.width) / 100) * rect.width, (toPct(p.y, rect.height) / 100) * rect.height, p.rot);
  const rA = reload(A);
  const rB = reload(B);
  assert.ok(isLegalJoint(rA, rB, 40), 'still a legal joint after a save/load round-trip');
  assert.equal(
    checkPlacement(wpose('serpentine', 5, rB.x, rB.y, rB.rot, 'B'), { others: [wpose('serpentine', 5, rA.x, rA.y, rA.rot, 'A')], zones: [] }, { gapPx: 0 }).valid,
    true,
    'reloaded pair still reads as clean adjacency',
  );
});

// ===========================================================================
// (d) The adjacency is GEOMETRIC — no link_group_id anywhere
// ===========================================================================

test('CONNECT adjacency is geometry-only: atLegalJoint holds with NO link_group_id; a non-joint overlap does not', () => {
  const A = jp('serpentine', 5, 500, 500, 0);
  const B = legalJoinPose(A, jp('serpentine', 5, 690, 500, 0), 260)!;
  // Poses carry no link group — the exemption comes purely from the joint geometry.
  assert.equal(atLegalJoint(A, jp('serpentine', 5, B.x, B.y, B.rot)), true, 'clean joint → adjacency (no link)');
  assert.equal(atLegalJoint(A, jp('serpentine', 5, 470, 500, 0)), false, 'a shoved overlap is NOT adjacency');
});

// ===========================================================================
// (e) Rounds never connect — standalone furniture, always collide
// ===========================================================================

test('CONNECT: round tables never snap/connect and two overlapping rounds always collide', () => {
  const A = jp('round', 10, 500, 500, 0);
  assert.equal(legalJoinPose(A, jp('round', 10, 560, 500, 0), 400), null, 'round is non-connectable');
  assert.equal(atLegalJoint(A, jp('round', 10, 560, 500, 0)), false, 'no round adjacency exemption');
  const geo = tableGeometry('round', 10).box;
  const res = checkPlacement(
    wpose('round', 10, geo.w * 0.4, 0, 0, 'B'),
    { others: [wpose('round', 10, 0, 0, 0, 'A')], zones: [] },
    { gapPx: 0 },
  );
  assert.equal(res.valid, false, 'two overlapping rounds collide — no exemption path');
});

test('CONNECT: overlapping serpentine footprints still collide (only a real joint is exempt)', () => {
  assert.ok(footprintsOverlap(obbOf(wpose('serpentine', 5, 0, 0, 0, 'a')), obbOf(wpose('serpentine', 5, 40, 0, 0, 'b')), 0) > 0);
});
