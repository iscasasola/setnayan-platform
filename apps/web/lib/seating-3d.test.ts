/**
 * Unit suite for the 3D seat-plan walk obstacles (Populate-Play · "don't cross
 * objects"). Two invariants:
 *   1. floorObstacles() returns a disc for every NON-skipped table plus the
 *      stage, and the dance floor only when it's enabled.
 *   2. steerPath() hard-clears its discs — every interior waypoint ends up
 *      OUTSIDE every obstacle, so a walker bends around the stage / a big table
 *      instead of grazing through it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  floorObstacles,
  steerPath,
  pushOutOfDiscs,
  separateAgents,
  firstFreeSeatAtTable,
  walkVector,
  contentBounds,
  checkPlacement,
  reconcileGrouping,
  DEFAULT_ROOM,
  VENUE_OBJECT_CATALOG,
  venueObjectDims,
  sceneObjectObstacles,
  type Lab3DFloor,
  type Lab3DTable,
  type Lab3DSceneObject,
} from './seating-3d';

const ROOM = { w: 20, d: 20 };

function floor(danceEnabled: boolean): Lab3DFloor {
  return {
    venueWidthM: 20,
    venueLengthM: 20,
    stage: { xPct: 50, yPct: 8, wPct: 30, hPct: 8 },
    entrance: { enabled: true, xPct: 50, yPct: 96 },
    dance: { enabled: danceEnabled, xPct: 50, yPct: 55, wPct: 20, hPct: 20 },
    published: false,
  };
}

function table(id: string, xPct: number, yPct: number): Lab3DTable {
  return {
    id,
    label: id,
    type: 'round_10',
    shape: 'round',
    capacity: 10,
    removedSeats: [],
    xPct,
    yPct,
    rotationDeg: 0,
    linkGroupId: null,
  };
}

test('floorObstacles: skips the destination table, always adds the stage', () => {
  const tables = [table('A', 30, 50), table('B', 70, 50)];
  const obs = floorObstacles(floor(false), tables, ROOM, ['A']);
  // B (1) + stage (1) — A skipped, dance disabled.
  assert.equal(obs.length, 2);
  // The stage disc sits at the top of the room (yPct 8 → negative z).
  const stage = obs[obs.length - 1]!;
  assert.ok(stage.c.z < -5, 'stage obstacle is at the top of the room');
  assert.ok(stage.r > 0);
});

test('floorObstacles: adds the dance floor only when enabled', () => {
  const tables = [table('A', 30, 50)];
  assert.equal(floorObstacles(floor(true), tables, ROOM, ['A']).length, 2, 'A skipped → dance + stage');
  assert.equal(floorObstacles(floor(false), tables, ROOM, ['A']).length, 1, 'A skipped, no dance → stage only');
});

test('floorObstacles: skips every id passed (swap excludes both tables)', () => {
  const tables = [table('A', 30, 50), table('B', 70, 50), table('C', 50, 80)];
  const obs = floorObstacles(floor(false), tables, ROOM, ['A', 'B', undefined]);
  // Only C (1) + stage (1); A and B skipped, undefined ignored.
  assert.equal(obs.length, 2);
});

test('steerPath hard-clears its discs: no interior waypoint stays inside an obstacle', () => {
  const obstacle = { c: { x: 0, z: 0 }, r: 3 };
  const path = steerPath({ x: -9, z: 0 }, { x: 9, z: 0 }, [obstacle], 0);
  assert.ok(path.length > 4);
  for (let i = 1; i < path.length - 1; i++) {
    const d = Math.hypot(path[i]!.x - obstacle.c.x, path[i]!.z - obstacle.c.z);
    assert.ok(d >= obstacle.r - 1e-6, `waypoint ${i} (dist ${d.toFixed(3)}) must clear the disc (r=${obstacle.r})`);
  }
  // Endpoints stay exact (the entrance + the target chair are never moved).
  assert.deepEqual(path[0], { x: -9, z: 0 });
  assert.deepEqual(path[path.length - 1], { x: 9, z: 0 });
});

test('pushOutOfDiscs: moves a point inside a disc to its edge, leaves outside points', () => {
  const discs = [{ c: { x: 0, z: 0 }, r: 2 }];
  const inside = pushOutOfDiscs({ x: 0.5, z: 0 }, discs);
  assert.ok(Math.abs(Math.hypot(inside.x, inside.z) - 2) < 1e-9, 'inside point lands on the edge');
  const outside = pushOutOfDiscs({ x: 5, z: 0 }, discs);
  assert.deepEqual(outside, { x: 5, z: 0 }, 'outside point untouched');
});

test('pushOutOfDiscs: dead-centre point escapes along the perpendicular', () => {
  const out = pushOutOfDiscs({ x: 0, z: 0 }, [{ c: { x: 0, z: 0 }, r: 2 }], { x: 0, z: 1 });
  assert.deepEqual(out, { x: 0, z: 2 });
});

test('separateAgents: pushes a too-close pair apart; leaves a far pair alone', () => {
  const close = separateAgents([{ x: 0, z: 0 }, { x: 0.2, z: 0 }], 0.6);
  assert.ok(Math.hypot(close[1]!.x - close[0]!.x, close[1]!.z - close[0]!.z) >= 0.6 - 1e-9);
  const far = separateAgents([{ x: 0, z: 0 }, { x: 3, z: 0 }], 0.6);
  assert.deepEqual(far, [{ x: 0, z: 0 }, { x: 3, z: 0 }]);
});

test('separateAgents: coincident agents are separated deterministically', () => {
  const out = separateAgents([{ x: 1, z: 1 }, { x: 1, z: 1 }], 0.5);
  assert.ok(Math.hypot(out[1]!.x - out[0]!.x, out[1]!.z - out[0]!.z) >= 0.5 - 1e-9);
});

test('VENUE_OBJECT_CATALOG: kinds unique, positive footprints, dims lookup + fallback', () => {
  const kinds = VENUE_OBJECT_CATALOG.map((o) => o.kind);
  assert.equal(new Set(kinds).size, kinds.length, 'kinds are unique');
  for (const o of VENUE_OBJECT_CATALOG) {
    assert.ok(o.w > 0 && o.d > 0, `${o.kind} has a positive footprint`);
    assert.ok(o.label.length > 0, `${o.kind} has a label`);
  }
  assert.deepEqual(venueObjectDims('buffet'), { w: 3.0, d: 0.9 });
  assert.deepEqual(venueObjectDims('not_a_kind'), { w: 1, d: 1 }, 'unknown kind → 1×1 fallback');
});

test('sceneObjectObstacles: one disc per object, radius = half-footprint + clearance', () => {
  const objs: Lab3DSceneObject[] = [
    { id: 'a', kind: 'buffet', label: null, xPct: 50, yPct: 50, rotationDeg: 0 }, // 3.0×0.9
    { id: 'b', kind: 'plant', label: null, xPct: 0, yPct: 0, rotationDeg: 0 }, // 0.8×0.8
  ];
  const discs = sceneObjectObstacles(objs, ROOM);
  assert.equal(discs.length, 2);
  assert.ok(Math.abs(discs[0]!.r - (3.0 / 2 + 0.4)) < 1e-9, 'buffet disc uses the long side');
  // plant at (0,0) pct → top-left world corner of a 20×20 room.
  assert.deepEqual(discs[1]!.c, { x: -10, z: -10 });
});

test('firstFreeSeatAtTable: lowest seat skipping removed + occupied; -1 when full', () => {
  assert.equal(firstFreeSeatAtTable(10, [], []), 0, 'empty table → seat 0');
  assert.equal(firstFreeSeatAtTable(10, [], [0, 1, 2]), 3, 'skips occupied');
  assert.equal(firstFreeSeatAtTable(10, [0, 1], [2]), 3, 'skips removed + occupied');
  assert.equal(firstFreeSeatAtTable(4, [], [0, 1, 2, 3]), -1, 'full → -1');
  assert.equal(firstFreeSeatAtTable(4, [99, -1], [1]), 0, 'out-of-range removed ignored');
});

test('walkVector: forward follows yaw, strafe is 90° right of it', () => {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  // yaw 0 faces +z: forward → +z, strafe right → +x.
  let v = walkVector(0, 0, 1);
  assert.ok(near(v.dx, 0) && near(v.dz, 1), 'yaw0 forward → +z');
  v = walkVector(0, 1, 0);
  assert.ok(near(v.dx, 1) && near(v.dz, 0), 'yaw0 strafe → +x');
  // yaw 90°: forward → +x, strafe right → -z.
  v = walkVector(Math.PI / 2, 0, 1);
  assert.ok(near(v.dx, 1) && near(v.dz, 0), 'yaw90 forward → +x');
  v = walkVector(Math.PI / 2, 1, 0);
  assert.ok(near(v.dx, 0) && near(v.dz, -1), 'yaw90 strafe → -z');
});

test('contentBounds: empty board falls back to the room; spread tables grow the span', () => {
  const empty = contentBounds([], ROOM);
  assert.deepEqual({ cx: empty.cx, cz: empty.cz }, { cx: 0, cz: 0 });
  assert.equal(empty.span, 20, 'empty → room span');
  // Two tables at the far corners of a free board (pct well beyond 0–100).
  const wide = contentBounds([{ xPct: -100, yPct: 50 }, { xPct: 300, yPct: 50 }], ROOM);
  // x at pct -100 → (-1.5)*20 = -30 (−2 margin); pct 300 → (2.5)*20 = 50 (+2 margin).
  assert.ok(wide.span > 80, `free spread grows the span (got ${wide.span})`);
  assert.ok(Math.abs(wide.cx - 10) < 1e-9, 'centre tracks the content midpoint');
});

test('DEFAULT_ROOM matches the 2D editor free-board venue (20×30)', () => {
  assert.deepEqual({ w: DEFAULT_ROOM.w, d: DEFAULT_ROOM.d }, { w: 20, d: 30 });
});

test('checkPlacement: blocks overlap, dance-floor tables, non-sweetheart on stage', () => {
  const stage = { cx: 0, cz: -10, hw: 4, hd: 2 };
  const dance = { cx: 0, cz: 0, hw: 3, hd: 3 };
  const table = (x: number, z: number, sweet = false) =>
    ({ x, z, r: 1.5, isTable: true, isSweetheart: sweet });

  // Clear spot, nothing nearby → ok.
  assert.equal(checkPlacement(table(10, 10), [], stage, dance).ok, true);

  // Overlaps an existing item.
  const over = checkPlacement(table(10, 10), [{ x: 10.5, z: 10, r: 1.5 }], stage, dance);
  assert.equal(over.ok, false);
  assert.match((over as { reason: string }).reason, /overlap/i);

  // Table on the dance floor → blocked.
  const onDance = checkPlacement(table(0, 0), [], stage, dance);
  assert.equal(onDance.ok, false);
  assert.match((onDance as { reason: string }).reason, /dance/i);

  // Non-sweetheart on the stage → blocked; sweetheart → allowed.
  assert.equal(checkPlacement(table(0, -10, false), [], stage, dance).ok, false);
  assert.equal(checkPlacement(table(0, -10, true), [], stage, dance).ok, true);

  // A non-table object on the dance floor is fine (rule is tables-only).
  assert.equal(checkPlacement({ x: 0, z: 0, r: 1, isTable: false, isSweetheart: false }, [], stage, dance).ok, true);
});

test('reconcileGrouping: patches link group + label on known rows, leaves position fields, preserves identity', () => {
  const local = [
    { id: 'A', linkGroupId: null, label: 'Table 1', xPct: 10, yPct: 20 },
    { id: 'B', linkGroupId: null, label: 'Table 2', xPct: 80, yPct: 20 },
    { id: 'C', linkGroupId: null, label: 'Table 3', xPct: 50, yPct: 80 },
  ];
  // Server linked A+B into one unit "Head Table" — C unchanged.
  const server = [
    { id: 'A', linkGroupId: 'g1', label: 'Head Table' },
    { id: 'B', linkGroupId: 'g1', label: 'Head Table' },
    { id: 'C', linkGroupId: null, label: 'Table 3' },
  ];
  const out = reconcileGrouping(local, server);
  assert.equal(out[0]!.linkGroupId, 'g1');
  assert.equal(out[0]!.label, 'Head Table');
  assert.equal(out[1]!.linkGroupId, 'g1');
  // Position fields are untouched (the drag optimism survives the reconcile).
  assert.equal(out[0]!.xPct, 10);
  assert.equal(out[1]!.xPct, 80);
  // C is identical → unchanged reference.
  assert.equal(out[2], local[2]);
  // No grouping change → same array reference (no needless re-render).
  assert.equal(reconcileGrouping(local, local.map((t) => ({ id: t.id, linkGroupId: t.linkGroupId, label: t.label }))), local);
})
