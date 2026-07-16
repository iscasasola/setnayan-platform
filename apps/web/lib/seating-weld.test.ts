/**
 * Reproduction + coverage suite for the WELD / COMBINE subsystem
 * (owner report 2026-07-16: "when they combine, they do not stay combined";
 * follow-up: long-banquet combine overlaps + doubled seam chairs; directive:
 * long and serpentine must be able to link cross-family).
 *
 * These pin the invariants the verdict (Seat_Plan_Spacing_Linking_Council_
 * Verdict_2026-07-16) assumes but the shipped code violated:
 *   1. The collision exemption is PAIRWISE (a member collides with a groupmate
 *      it is NOT directly welded to) — not a blanket same-group pass.
 *   2. A welded pose persists as the joined coordinates across a save/load
 *      round-trip, so "combined stays combined".
 *   3. Rect-run + cross-family seams don't double a chair at the junction.
 *   4. The chainable set spans {long_banquet, family_head, serpentine}; any two
 *      chainable shapes may weld end-to-end (incl. rect↔serpentine); round and
 *      sweetheart never chain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  obbOf,
  footprintsOverlap,
  checkPlacement,
  layoutViolations,
  legalJoinPose,
  isLegalJoint,
  tableGeometry,
  shapeHintFor,
  rotatePoint,
  serpentineEndsWorld,
  rectEndsWorld,
  TABLE_FOOTPRINT_M,
  type WorldPose,
  type TableType,
} from './seating';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
type Shape = WorldPose['shape'];

function wpose(
  shape: Shape,
  capacity: number,
  x: number,
  y: number,
  rot: number,
  id: string,
  linkGroupId: string | null = null,
  scale = 1,
): WorldPose {
  return { tableId: id, shape, capacity, x, y, rot, scale, linkGroupId };
}

const jp = (shape: Shape, capacity: number, x: number, y: number, rot: number, scale = 1) => ({
  shape,
  capacity,
  x,
  y,
  rot,
  scale,
});

// World-space seat centres of a table at a pose (mirrors the editor render).
function seatWorld(p: { shape: Shape; capacity: number; x: number; y: number; rot: number; scale: number }) {
  const geo = tableGeometry(p.shape, p.capacity);
  return geo.seats.map((s) => {
    const r = rotatePoint({ x: s.x * p.scale, y: s.y * p.scale }, p.rot);
    return { x: p.x + r.x, y: p.y + r.y };
  });
}

// ===========================================================================
// 1. PAIRWISE, NOT BLANKET — a stacked groupmate is still a collision
// ===========================================================================

test('WELD: a third table STACKED on a welded pair (same group, not welded) is a VIOLATION — exemption is pairwise', () => {
  const g = 'grp-1';
  const anchor = jp('serpentine', 5, 500, 500, 0);
  const cand = legalJoinPose(anchor, jp('serpentine', 5, 690, 500, 0), 240);
  assert.ok(cand, 'the two serpentines weld end-to-end');
  const a = wpose('serpentine', 5, anchor.x, anchor.y, anchor.rot, 'a', g);
  const b = wpose('serpentine', 5, cand!.x, cand!.y, cand!.rot, 'b', g);
  // A third member of the SAME group dropped right on top of A — grossly
  // overlapping, NOT at a legal joint with anyone.
  const stacked = wpose('serpentine', 5, anchor.x, anchor.y, anchor.rot, 'c', g);
  const viol = layoutViolations([a, b, stacked], [], 0);
  const ids = viol.map((v) => v.tableId);
  assert.ok(ids.includes('c'), 'the stacked groupmate must be flagged (blanket exemption is the bug)');
});

test('WELD: two PARALLEL banquet rows in the same group, overlapping, are a VIOLATION', () => {
  const g = 'grp-2';
  const box = tableGeometry('long_banquet', 10).box;
  // Two rows one on top of the other, far closer than their (chair-inclusive)
  // height — a real interpenetration, and NOT an end-to-end weld.
  const a = wpose('long_banquet', 10, 500, 500, 0, 'a', g);
  const b = wpose('long_banquet', 10, 500, 500 + box.h * 0.4, 0, 'b', g);
  assert.ok(footprintsOverlap(obbOf(a), obbOf(b), 0) > 0, 'the rows physically overlap');
  const viol = layoutViolations([a, b], [], 0);
  assert.ok(viol.length > 0, 'overlapping same-group rows must be flagged');
});

test('WELD: a genuinely welded pair does NOT self-report a seam overlap', () => {
  const g = 'grp-3';
  const anchor = jp('serpentine', 5, 500, 500, 0);
  const cand = legalJoinPose(anchor, jp('serpentine', 5, 690, 500, 0), 240)!;
  const a = wpose('serpentine', 5, anchor.x, anchor.y, anchor.rot, 'a', g);
  const b = wpose('serpentine', 5, cand.x, cand.y, cand.rot, 'b', g);
  const viol = layoutViolations([a, b], [], 0);
  assert.equal(viol.length, 0, 'a legal seam is exempt (no false positive)');
});

// ===========================================================================
// 2. PERSISTENCE — combined stays combined across a save/load round-trip
// ===========================================================================

test('WELD: a serpentine S-bend weld persists — reloaded % coords keep the tips coincident', () => {
  const anchor = jp('serpentine', 5, 400, 400, 0);
  // Opposite-curvature drop (the smile/frown screenshot): an S-bend join.
  const cand = legalJoinPose(anchor, jp('serpentine', 5, 400, 640, 180), 260);
  assert.ok(cand, 'opposite-curvature serpentines offer an S-bend weld');
  // Simulate the persist the editor does: store as canvas-% then reload.
  const rect = { width: 1000, height: 1000 };
  const xPct = (cand!.x / rect.width) * 100;
  const yPct = (cand!.y / rect.height) * 100;
  const reloaded = jp(
    'serpentine',
    5,
    (xPct / 100) * rect.width,
    (yPct / 100) * rect.height,
    cand!.rot,
  );
  assert.ok(isLegalJoint(anchor, reloaded, 40), 'the persisted weld is still a legal joint on reload');
});

// ===========================================================================
// 3. SEAM SEATING — no doubled chair at a junction
// ===========================================================================

test('WELD: two banquets welded flush share NO doubled seam seat', () => {
  const anchor = jp('long_banquet', 10, 500, 500, 0);
  const g = tableGeometry('long_banquet', 10);
  const halfLen = g.hub.w / 2; // tabletop half-length (chair overhang excluded)
  const cand = legalJoinPose(anchor, jp('long_banquet', 10, 500 + g.box.w, 500, 0), 400);
  assert.ok(cand, 'the banquets weld end-to-end');
  const sa = seatWorld(anchor);
  const sb = seatWorld({ ...jp('long_banquet', 10, cand!.x, cand!.y, cand!.rot) });
  // No seat from B may sit on top of a seat from A (a "doubled" chair). The
  // seam columns should stay ~a chair-gap apart, never < a chair-radius.
  let minGap = Infinity;
  for (const p of sa) for (const q of sb) minGap = Math.min(minGap, Math.hypot(p.x - q.x, p.y - q.y));
  assert.ok(minGap > 20, `seam chairs must not double up (min inter-table seat gap ${minGap.toFixed(1)}px)`);
  void halfLen;
});

// ===========================================================================
// 4. CHAINABLE SET — cross-family rect↔serpentine welds; round never chains
// ===========================================================================

test('WELD: a serpentine can weld end-to-end onto a banquet (cross-family straight→curve)', () => {
  // Banquet run along the x-axis; drop a serpentine just past its right end.
  const banquet = jp('long_banquet', 10, 500, 500, 0);
  const bEnd = rectEndsWorld({
    x: banquet.x,
    y: banquet.y,
    rot: banquet.rot,
    halfLen: tableGeometry('long_banquet', 10).hub.w / 2,
  })[0]!; // +x end
  const mover = jp('serpentine', 5, bEnd.x + 120, bEnd.y, 0);
  const cand = legalJoinPose(banquet, mover, 300);
  assert.ok(cand, 'cross-family rect→serpentine weld must be offered');
  // The serpentine, at the candidate pose, has a tip coincident with the
  // banquet end within tolerance.
  const tips = serpentineEndsWorld({ x: cand!.x, y: cand!.y, rot: cand!.rot, scale: 1 });
  const near = Math.min(...tips.map((t) => Math.hypot(t.x - bEnd.x, t.y - bEnd.y)));
  assert.ok(near <= 6, `a serpentine tip meets the banquet end (${near.toFixed(1)}px)`);
});

test('WELD: a banquet can weld onto a serpentine tip (cross-family curve→straight)', () => {
  const serp = jp('serpentine', 5, 500, 500, 0);
  const tip = serpentineEndsWorld({ x: serp.x, y: serp.y, rot: serp.rot, scale: 1 })[0]!;
  const mover = jp('long_banquet', 10, tip.x + 140, tip.y, 0);
  const cand = legalJoinPose(serp, mover, 320);
  assert.ok(cand, 'cross-family serpentine→rect weld must be offered');
  const ends = rectEndsWorld({
    x: cand!.x,
    y: cand!.y,
    rot: cand!.rot,
    halfLen: tableGeometry('long_banquet', 10).hub.w / 2,
  });
  const near = Math.min(...ends.map((e) => Math.hypot(e.x - tip.x, e.y - tip.y)));
  assert.ok(near <= 6, `a banquet end meets the serpentine tip (${near.toFixed(1)}px)`);
});

test('WELD: a banquet welded to a serpentine shares NO doubled seam seat', () => {
  const serp = jp('serpentine', 5, 500, 500, 0);
  const tip = serpentineEndsWorld({ x: serp.x, y: serp.y, rot: serp.rot, scale: 1 })[0]!;
  const mover = jp('long_banquet', 10, tip.x + 150, tip.y, 0);
  const cand = legalJoinPose(serp, mover, 340)!;
  const sa = seatWorld(serp);
  const sb = seatWorld({ ...jp('long_banquet', 10, cand.x, cand.y, cand.rot) });
  let minGap = Infinity;
  for (const p of sa) for (const q of sb) minGap = Math.min(minGap, Math.hypot(p.x - q.x, p.y - q.y));
  assert.ok(minGap > 20, `cross-family seam chairs must not double up (min gap ${minGap.toFixed(1)}px)`);
});

test('WELD: a round table is NOT chainable onto a serpentine', () => {
  const serp = jp('serpentine', 5, 500, 500, 0);
  const round = jp('round', 10, 560, 500, 0);
  assert.equal(legalJoinPose(serp, round, 300), null, 'round↔serpentine never joins');
  assert.equal(legalJoinPose(round, serp, 300), null, 'serpentine↔round never joins');
});

void TABLE_FOOTPRINT_M;
void shapeHintFor;
void ({} as TableType);
