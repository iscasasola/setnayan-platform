/**
 * Regression suite — 3D round-vs-round collision (owner 2026-07-17 · figure-8
 * "two rounds interpenetrating" screenshot). Pins that:
 *
 *  1. the 3D bridge validates two rounds through a CHAIR-INCLUSIVE footprint
 *     (round_10 → r 1.4 m / Ø 2.8 m, the disc that spans the seat ring), so two
 *     cap-10 rounds closer than 2.8 m collide through the exact code path the lab
 *     uses (`oraclePose` scale + `checkPlacement`);
 *  2. the CREATE spawn (`firstFreeRoundSpawnPct`) never returns an overlapping
 *     pose — every candidate it emits is oracle-valid;
 *  3. the legacy-overlap flagged set (`layoutViolations`, the data the 3D
 *     warm-red ground ring consumes — identical to the 2D mount audit) marks a
 *     known-bad fixture and leaves a clean room empty;
 *  4. monotone-escape lets an already-overlapped round be dragged APART (out is
 *     always allowed) so the user can heal legacy data.
 *
 * These are the same pure helpers the 2D editor uses, run in METRES (the lab's
 * pxPerMeter folded to 1) — parity by construction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tableGeometry,
  TABLE_FOOTPRINT_M,
  checkPlacement,
  penetrationDepth,
  layoutViolations,
  firstFreeRoundSpawnPct,
  footprintsOverlap,
  obbOf,
  type WorldPose,
  type OracleZone,
  type TableType,
  type TableShapeHint,
} from './seating';

// ── The lab bridge, reproduced exactly (seating-lab-3d.tsx · oraclePose /
//    scaleOfTable, pxPerMeter folded to 1 = metres). This is the pose the 3D
//    move + create paths feed into the SHARED oracle. ──────────────────────────
const ROOM = { w: 20, d: 30 }; // DEFAULT_ROOM_M — the coordinate denominator.
const WALKWAY_M = 0.6; // the lab's default aisle (matches the 2D editor).

function scaleOfTable(type: TableType, shape: TableShapeHint, capacity: number): number {
  const footM = TABLE_FOOTPRINT_M[type];
  const geo = tableGeometry(shape, Math.max(1, capacity));
  return footM / geo.box.w;
}

// A round_10 pose at a room-percent centre, built the way the lab's oraclePose does.
function labRoundPose(id: string, xPct: number, yPct: number): WorldPose {
  return {
    tableId: id,
    shape: 'round',
    capacity: 10,
    x: (xPct / 100) * ROOM.w,
    y: (yPct / 100) * ROOM.d,
    rot: 0,
    scale: scaleOfTable('round_10', 'round', 10),
    linkGroupId: null,
  };
}

// Two round centres `metres` apart, both cap-10, at the room mid-line.
function twoRoundsMetresApart(metres: number): [WorldPose, WorldPose] {
  const dxPct = (metres / ROOM.w) * 100;
  return [labRoundPose('a', 50, 50), labRoundPose('b', 50 + dxPct, 50)];
}

// ===========================================================================
// (0) The footprint the 3D bridge actually feeds IS chair-inclusive.
// ===========================================================================

test('3D round footprint is CHAIR-INCLUSIVE — round_10 disc is Ø 2.8 m (r 1.4 m), the seat-ring span', () => {
  const geo = tableGeometry('round', 10);
  const scale = scaleOfTable('round_10', 'round', 10);
  // The disc radius is independent of the local px width — the box.w cancels:
  // (box.w/2)·(TABLE_FOOTPRINT_M/box.w) = TABLE_FOOTPRINT_M/2.
  const fp = obbOf(labRoundPose('a', 50, 50));
  const part = fp.parts[0]!;
  assert.equal(part.kind, 'circle');
  const r = (part as { r: number }).r;
  assert.ok(Math.abs(r - TABLE_FOOTPRINT_M.round_10 / 2) < 1e-9, `r=${r}`);
  assert.ok(Math.abs(r - 1.4) < 1e-9, `expected 1.4 m, got ${r}`);
  // Sanity: this is the same scale spawn uses, and it is NOT the table-only disc
  // (geo.box.w local px would be a much larger raw radius pre-scale).
  assert.ok(scale > 0 && scale < 1, `scale=${scale}`);
});

// ===========================================================================
// (a) The owner's figure-8 — two cap-10 rounds closer than the chair-inclusive
//     diameter — is INVALID through the exact lab code path.
// ===========================================================================

test('(a) two cap-10 rounds ~1.7 m apart (owner figure-8 ~40% overlap) → checkPlacement INVALID / overlap', () => {
  const [a, b] = twoRoundsMetresApart(1.7);
  const res = checkPlacement(b, { others: [a], zones: [] }, { gapPx: WALKWAY_M });
  assert.equal(res.valid, false);
  assert.equal(res.violations[0]?.kind, 'overlap');
  assert.ok((res.violations[0]?.depthPx ?? 0) > 1.0, 'deep body overlap expected');
});

test('(a) refusal band = the chair-inclusive diameter — invalid below 2.8 m, clear at/above (gap 0)', () => {
  const near = twoRoundsMetresApart(2.79);
  assert.equal(checkPlacement(near[1], { others: [near[0]], zones: [] }, { gapPx: 0 }).valid, false);
  const kiss = twoRoundsMetresApart(2.8);
  assert.equal(checkPlacement(kiss[1], { others: [kiss[0]], zones: [] }, { gapPx: 0 }).valid, true);
  const clear = twoRoundsMetresApart(3.0);
  assert.equal(checkPlacement(clear[1], { others: [clear[0]], zones: [] }, { gapPx: 0 }).valid, true);
});

test('(a) with the lab walkway (0.6 m) the refusal band widens — 3.2 m apart is still too close', () => {
  const [a, b] = twoRoundsMetresApart(3.2);
  assert.equal(checkPlacement(b, { others: [a], zones: [] }, { gapPx: WALKWAY_M }).valid, false);
  const [c, d] = twoRoundsMetresApart(3.45); // 2.8 + 0.6 + slack
  assert.equal(checkPlacement(d, { others: [c], zones: [] }, { gapPx: WALKWAY_M }).valid, true);
});

// ===========================================================================
// (b) CREATE spawn never returns an overlapping pose.
// ===========================================================================

// Rebuild the spawn's own pose from its returned percent (same scale it uses).
function spawnPose(x: number, y: number): WorldPose {
  return labRoundPose('__new__', x, y);
}

test('(b) spawn into an empty sized room lands the base spot (50, 55) and is oracle-valid', () => {
  const spawn = firstFreeRoundSpawnPct([], [], ROOM, WALKWAY_M);
  assert.deepEqual(spawn, { x: 50, y: 55 });
  const valid = checkPlacement(spawnPose(spawn!.x, spawn!.y), { others: [], zones: [] }, { gapPx: WALKWAY_M }).valid;
  assert.equal(valid, true);
});

test('(b) base blocked → spawn spirals to a NON-overlapping, oracle-valid spot', () => {
  // A round sitting on the base spawn spot forces the spiral off-centre.
  const blocker = labRoundPose('blk', 50, 55);
  const spawn = firstFreeRoundSpawnPct([blocker], [], ROOM, WALKWAY_M);
  assert.ok(spawn, 'a spot must be found in a nearly-empty room');
  assert.notDeepEqual(spawn, { x: 50, y: 55 });
  const pose = spawnPose(spawn!.x, spawn!.y);
  // Fully oracle-valid AND zero body overlap with the blocker.
  assert.equal(checkPlacement(pose, { others: [blocker], zones: [] }, { gapPx: WALKWAY_M }).valid, true);
  assert.equal(footprintsOverlap(obbOf(pose), obbOf(blocker), 0), 0);
});

test('(b) dense grid of rounds → every spawn the spiral returns is overlap-free vs ALL existing', () => {
  // Pack a coarse grid of rounds spaced just past the chair-inclusive diameter.
  const others: WorldPose[] = [];
  let n = 0;
  for (let gx = 15; gx <= 85; gx += 18) {
    for (let gy = 15; gy <= 85; gy += 22) {
      others.push(labRoundPose(`t${n++}`, gx, gy));
    }
  }
  const spawn = firstFreeRoundSpawnPct(others, [], ROOM, WALKWAY_M);
  if (spawn) {
    const pose = spawnPose(spawn.x, spawn.y);
    assert.equal(checkPlacement(pose, { others, zones: [] }, { gapPx: WALKWAY_M }).valid, true);
    for (const o of others) {
      assert.equal(footprintsOverlap(obbOf(pose), obbOf(o), 0), 0, `spawn overlaps ${o.tableId}`);
    }
  }
  // null is also acceptable (dense room → client-grid fallback); it must NEVER
  // return an overlapping pose, which the assertions above enforce when non-null.
});

test('(b) spawn respects a no-go zone — never lands a round inside the dance floor', () => {
  const zones: OracleZone[] = [{ id: 'dance', x: 0.5 * ROOM.w, y: 0.55 * ROOM.d, w: 6, h: 6 }];
  const spawn = firstFreeRoundSpawnPct([], zones, ROOM, WALKWAY_M);
  assert.ok(spawn, 'a spot outside the dance floor must exist');
  const pose = spawnPose(spawn!.x, spawn!.y);
  assert.equal(checkPlacement(pose, { others: [], zones }, { gapPx: WALKWAY_M }).valid, true);
});

// ===========================================================================
// (c) The legacy-overlap flagged set (the data the warm-red 3D ring consumes).
//     Mirrors the lab's `violatingIds` = new Set(layoutViolations(...).map(id)).
// ===========================================================================

function flaggedSet(poses: WorldPose[], zones: OracleZone[]): Set<string> {
  return new Set(layoutViolations(poses, zones, WALKWAY_M).map((r) => r.tableId));
}

test('(c) known-bad fixture — the two interpenetrating rounds are flagged, a clean third is not', () => {
  const a = labRoundPose('overlap-a', 40, 50);
  const b = labRoundPose('overlap-b', 40 + (1.7 / ROOM.w) * 100, 50); // 1.7 m → deep overlap
  const clean = labRoundPose('clean', 85, 50); // far corner, no neighbour
  const flagged = flaggedSet([a, b, clean], []);
  assert.ok(flagged.has('overlap-a'));
  assert.ok(flagged.has('overlap-b'));
  assert.ok(!flagged.has('clean'));
  assert.equal(flagged.size, 2);
});

test('(c) a fully-legal room flags NOTHING (no false red rings)', () => {
  // Three rounds each clearing the diameter + walkway.
  const poses = [labRoundPose('r0', 20, 30), labRoundPose('r1', 55, 30), labRoundPose('r2', 88, 30)];
  assert.equal(flaggedSet(poses, []).size, 0);
});

// ===========================================================================
// (4) Monotone escape — an already-overlapped round can be dragged APART.
//     Reproduces the lab drag's accept() predicate for a legacy overlap.
// ===========================================================================

test('(4) an overlapped round can always move to REDUCE penetration (out is allowed); moving deeper is refused', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const world = { others: [anchor], zones: [] as OracleZone[] };

  const startX = 50 + (1.7 / ROOM.w) * 100; // 1.7 m apart → overlapping
  const cur = labRoundPose('mover', startX, 50);
  const curValid = checkPlacement(cur, world, { gapPx: WALKWAY_M }).valid;
  assert.equal(curValid, false, 'precondition: starts in a legacy overlap');
  const curDepth = penetrationDepth(cur, world);

  // The lab's accept(): valid → yes; else (stuck) non-worsening within ε.
  const epsM = 0.02;
  const accept = (p: WorldPose): boolean => {
    if (checkPlacement(p, world, { gapPx: WALKWAY_M }).valid) return true;
    if (curValid) return false;
    return penetrationDepth(p, world) <= curDepth + epsM;
  };

  // OUT (further from the anchor) — penetration shrinks → accepted.
  const outStep = labRoundPose('mover', startX + (0.3 / ROOM.w) * 100, 50);
  assert.equal(accept(outStep), true, 'moving apart must always be allowed');

  // IN (toward the anchor) — penetration grows → refused.
  const inStep = labRoundPose('mover', startX - (0.3 / ROOM.w) * 100, 50);
  assert.equal(accept(inStep), false, 'moving deeper into the overlap must be refused');

  // All the way out to a clean pose is of course accepted (and valid).
  const healed = labRoundPose('mover', 50 + (3.5 / ROOM.w) * 100, 50);
  assert.equal(accept(healed), true);
  assert.equal(checkPlacement(healed, world, { gapPx: WALKWAY_M }).valid, true);
});
