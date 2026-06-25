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
