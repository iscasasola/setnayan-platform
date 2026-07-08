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
  seatApproachPath,
  seatWorld,
  pctToWorld,
  tableDims,
  tableAvoidR,
  pushOutOfDiscs,
  separateAgents,
  firstFreeSeatAtTable,
  walkVector,
  walkSpawnPoint,
  contentBounds,
  checkPlacement,
  reconcileGrouping,
  DEFAULT_ROOM,
  VENUE_OBJECT_CATALOG,
  venueObjectDims,
  sceneObjectObstacles,
  boothObstacles,
  signObstacles,
  cocktailObstacles,
  boothApproach,
  boothTypeLabel,
  chairLocalPositions,
  worldSeatPose,
  approachPoint,
  rotateLocal,
  rotateLocalRad,
  boothFacingY,
  serpentineChairs,
  serpentineBand,
  BOOTH_FOOTPRINT_M,
  tableFootprintDiscs,
  chairObstacles,
  chairObstaclesForWalk,
  dropDiscsContaining,
  inSeatApproachCorridor,
  CHAIR_OBSTACLE_R,
  buildObstacleGrid,
  obstaclesNear,
  danceFloorRect,
  pointInZone,
  clampPointToZone,
  type ObstacleDisc,
  type Lab3DFloor,
  type Lab3DTable,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
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
  // B (1) + stage (1) + entrance posts (2) — A skipped, dance disabled.
  assert.equal(obs.length, 4);
  // The stage disc sits at the top of the room (yPct 8 → negative z); the
  // entrance posts (collision pass 2026-07-08) come after it in the array.
  const stage = obs.find((o) => o.c.z < -5);
  assert.ok(stage, 'stage obstacle is at the top of the room');
  assert.ok(stage!.r > 0);
});

test('floorObstacles: adds the dance floor only when enabled', () => {
  const tables = [table('A', 30, 50)];
  assert.equal(floorObstacles(floor(true), tables, ROOM, ['A']).length, 4, 'A skipped → dance + stage + entrance posts');
  assert.equal(floorObstacles(floor(false), tables, ROOM, ['A']).length, 3, 'A skipped, no dance → stage + entrance posts');
});

test('floorObstacles: skipDanceFloor drops the dance disc (dance-destined walk reaches the floor)', () => {
  const tables = [table('A', 30, 50)];
  const f = floor(true);
  const d = danceFloorRect(f, ROOM)!;
  // Default: the dance disc is present (ordinary roam rounds the floor).
  const withDance = floorObstacles(f, tables, ROOM, [], {});
  const danceDisc = withDance.find((o) => Math.hypot(o.c.x - d.cx, o.c.z - d.cz) < 1e-9);
  assert.ok(danceDisc, 'dance disc present by default');
  // Skipped: the same set minus exactly that one disc — a dance walk can reach it.
  const skipped = floorObstacles(f, tables, ROOM, [], { skipDanceFloor: true });
  assert.equal(skipped.length, withDance.length - 1, 'exactly one fewer disc when skipped');
  assert.ok(
    !skipped.some((o) => Math.hypot(o.c.x - d.cx, o.c.z - d.cz) < 1e-9),
    'the dropped disc is the dance-floor disc',
  );
  // skipDanceFloor is a no-op when there's no dance floor to drop.
  assert.equal(
    floorObstacles(floor(false), tables, ROOM, [], { skipDanceFloor: true }).length,
    floorObstacles(floor(false), tables, ROOM, [], {}).length,
    'no dance floor → skip is a harmless no-op',
  );
});

test('danceFloorRect + pointInZone + clampPointToZone: hit test matches the mural rect', () => {
  const f = floor(true); // dance at xPct 50, yPct 55, wPct 20, hPct 20 in a 20×20 room
  const rect = danceFloorRect(f, ROOM);
  assert.ok(rect, 'enabled → a rect');
  // 20% of 20 m = 4 m wide/deep → half-extents 2 m, centred at (0, +1).
  assert.ok(Math.abs(rect!.hw - 2) < 1e-9, 'half-width 2 m');
  assert.ok(Math.abs(rect!.hd - 2) < 1e-9, 'half-depth 2 m');
  assert.ok(Math.abs(rect!.cx - 0) < 1e-9, 'centre x = 0');
  assert.ok(Math.abs(rect!.cz - 1) < 1e-9, 'centre z = +1');
  // Disabled → null (no hit test, no clamp target).
  assert.equal(danceFloorRect(floor(false), ROOM), null);
  // A point at the centre is inside; a point well outside is not.
  assert.ok(pointInZone({ x: 0, z: 1 }, rect!), 'centre is inside');
  assert.ok(!pointInZone({ x: 8, z: 8 }, rect!), 'far corner is outside');
  // A point on the very edge is inside at inset 0, outside once inset in.
  assert.ok(pointInZone({ x: 2, z: 1 }, rect!), 'edge inside at inset 0');
  assert.ok(!pointInZone({ x: 2, z: 1 }, rect!, 0.3), 'edge outside once inset');
  // Clamp pulls an outside tap onto the floor (inset from the lip).
  const clamped = clampPointToZone({ x: 9, z: 1 }, rect!, 0.3);
  assert.ok(pointInZone(clamped, rect!), 'clamped point lands on the floor');
  assert.ok(clamped.x <= 2 - 0.3 + 1e-9, 'clamped inside the inset edge');
});

test('floorObstacles: entrance posts become discs only when the entrance is enabled', () => {
  const f = floor(false);
  const posts = floorObstacles(f, [], ROOM, []).filter((o) => o.c.z > 5);
  // yPct 96 in a 20 m room → z ≈ +9.2; two r 0.2 posts at ±0.55 m.
  assert.equal(posts.length, 2, 'two entrance post discs');
  assert.ok(Math.abs(posts[0]!.c.x - posts[1]!.c.x) > 1.0, 'posts flank the doorway gap');
  const off = { ...f, entrance: { ...f.entrance, enabled: false } };
  assert.equal(floorObstacles(off, [], ROOM, []).filter((o) => o.c.z > 5).length, 0, 'disabled → no post discs');
});

test('floorObstacles: skips every id passed (swap excludes both tables)', () => {
  const tables = [table('A', 30, 50), table('B', 70, 50), table('C', 50, 80)];
  const obs = floorObstacles(floor(false), tables, ROOM, ['A', 'B', undefined]);
  // Only C (1) + stage (1) + entrance posts (2); A and B skipped, undefined ignored.
  assert.equal(obs.length, 4);
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

test('walk sampling: the INTERPOLATED path (chords + per-frame re-clamp) never enters a table', () => {
  // Regression for the owner-reported "person walks THROUGH the table, not
  // around it" (2026-07-03). The old test only checked path WAYPOINTS; the
  // artefact was the straight chord a walker interpolates between two
  // disc-edge-clamped waypoints dipping back inside the disc. The Plan3D walker
  // fixes it by re-clamping every sampled frame out of the obstacle discs
  // (Plan3DScene <Walker>: `pushOutOfDiscs(sample.p, discs)`). Reproduce that
  // here over the whole eased walk and assert zero incursion.
  const bodyR = 0.24;
  // A table dead-centre between the entrance and the far seat — the worst case.
  const obstacles = [{ c: { x: 0, z: 0 }, r: 3 }];
  const path = steerPath({ x: -9, z: 0 }, { x: 9, z: 0 }, obstacles, bodyR);
  const clampDiscs = obstacles.map((d) => ({ c: d.c, r: d.r + bodyR }));

  // Mirror the component's per-frame sampling: arc-length even sample of the
  // eased t, then re-clamp — checked at fine resolution across the whole walk.
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z));
  }
  const total = cum[cum.length - 1]!;
  const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
  let breachedWithoutReclamp = false;
  for (let f = 0; f <= 240; f++) {
    const t = smoother(f / 240);
    const targetLen = t * total;
    let seg = 0;
    while (seg < cum.length - 2 && cum[seg + 1]! < targetLen) seg++;
    const localT = (targetLen - cum[seg]!) / (cum[seg + 1]! - cum[seg]! || 1);
    const a = path[seg]!;
    const b = path[seg + 1]!;
    const sampled = { x: a.x + (b.x - a.x) * localT, z: a.z + (b.z - a.z) * localT };
    // WITHOUT the re-clamp the interpolated chord can dip inside the table
    // (the actual bug). WITH it, never.
    for (const disc of obstacles) {
      if (Math.hypot(sampled.x - disc.c.x, sampled.z - disc.c.z) < disc.r + bodyR - 1e-3) {
        breachedWithoutReclamp = true;
      }
    }
    const p = pushOutOfDiscs(sampled, clampDiscs);
    for (const disc of obstacles) {
      const d = Math.hypot(p.x - disc.c.x, p.z - disc.c.z);
      assert.ok(d >= disc.r - 1e-6, `frame ${f} landed inside the table (dist ${d.toFixed(3)} < r ${disc.r})`);
    }
  }
  // The counter-proof: for the worst-case straight-through table the raw chords
  // DO breach — so the per-frame re-clamp is load-bearing, not decoration.
  assert.ok(breachedWithoutReclamp, 'expected raw chords to breach so the re-clamp is proven necessary');
});

test('seatApproachPath: walks AROUND the guest\'s own table and ends exactly at the chair', () => {
  // Regression for the owner-reported "person still walks THROUGH the table, not
  // around it, when [I say] take me to my seat" (2026-07-03). The naive path
  // DROPPED the destination table from the obstacle set so a walker "could reach
  // its chair" — but that let the straight line from the entrance cut clean
  // across the tabletop to a far-side seat. seatApproachPath keeps the table IN
  // the set, routes to an approach point just outside it, then steps in.
  const room = { w: 20, d: 20 };
  const t = table('A', 50, 50); // round_10, dead-centre of the room
  const centre = pctToWorld(t.xPct, t.yPct, room); // (0, 0)
  // Seat 0 sits on the FAR (−z / top) side of a round table; the entrance is at
  // the bottom (+z) — so the straight line runs right through the table centre.
  const farSeat = 0;
  const chair = seatWorld(t, farSeat, room);
  const entrance = pctToWorld(50, 96, room); // bottom-centre
  assert.ok(chair.z < 0 && entrance.z > 0, 'seat is on the far side of the table');

  // The FULL obstacle set — destination table PRESENT (the whole fix).
  const obstacles = [{ c: centre, r: tableAvoidR(t) }];
  const path = seatApproachPath(entrance, t, farSeat, room, obstacles, 0.2);

  // (a) Ends exactly on the chair, starts exactly at the entrance.
  assert.deepEqual(path[path.length - 1], chair);
  assert.deepEqual(path[0], entrance);

  // (b) No point ever enters the physical tabletop — the walker went AROUND it.
  const topR = tableDims(t.shape, t.capacity).w / 2; // 0.75 m for round_10
  for (let i = 0; i < path.length; i++) {
    const d = Math.hypot(path[i]!.x - centre.x, path[i]!.z - centre.z);
    assert.ok(d >= topR - 1e-6, `waypoint ${i} (dist ${d.toFixed(3)}) crosses the tabletop (r=${topR})`);
  }

  // (c) Counter-proof: the naive straight entrance→chair line (what the old
  // skip-the-table code produced) DOES pass through the tabletop — so routing
  // around it is load-bearing, not decoration.
  let straightBreaches = false;
  for (let f = 0; f <= 100; f++) {
    const s = f / 100;
    const x = entrance.x + (chair.x - entrance.x) * s;
    const z = entrance.z + (chair.z - entrance.z) * s;
    if (Math.hypot(x - centre.x, z - centre.z) < topR) straightBreaches = true;
  }
  assert.ok(straightBreaches, 'the naive straight line must breach the tabletop');
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

test('boothObstacles: one disc per booth at the fixed booth footprint + clearance', () => {
  const booths: Lab3DBooth[] = [
    { id: 'a', kind: 'photo_booth', label: 'Booth', xPct: 50, yPct: 50 },
    { id: 'b', kind: 'mobile_bar', label: 'Bar', xPct: 100, yPct: 100 },
  ];
  const discs = boothObstacles(booths, ROOM);
  assert.equal(discs.length, 2);
  const wantR = Math.max(BOOTH_FOOTPRINT_M.w, BOOTH_FOOTPRINT_M.d) / 2 + 0.4;
  assert.ok(Math.abs(discs[0]!.r - wantR) < 1e-9, 'radius = half-footprint + 0.4 clearance');
  assert.deepEqual(discs[0]!.c, { x: 0, z: 0 }, 'centre-of-room booth → world origin');
  assert.deepEqual(discs[1]!.c, { x: 10, z: 10 }, '(100,100) pct → bottom-right corner');
});

test('signObstacles: one small disc per sign post', () => {
  const signs: Lab3DSign[] = [
    { id: 's1', label: 'Restrooms', xPct: 0, yPct: 50, rotationDeg: 90 },
  ];
  const discs = signObstacles(signs, ROOM);
  assert.equal(discs.length, 1);
  assert.ok(discs[0]!.r > 0 && discs[0]!.r < 0.6, 'a slim clearance disc');
  assert.deepEqual(discs[0]!.c, { x: -10, z: 0 }, '(0,50) pct → left wall midpoint');
});

test('cocktailObstacles: null → empty; enabled → a ring of perimeter discs', () => {
  assert.deepEqual(cocktailObstacles(null, ROOM), [], 'no room → no discs');
  const discs = cocktailObstacles(
    { xPct: 50, yPct: 50, wPct: 40, hPct: 40, label: 'Cocktails' },
    ROOM,
  );
  assert.ok(discs.length >= 8, 'traces the four walls with overlapping discs');
  // 40% of 20 = 8 m wide/deep → half-span 4 m each way; every disc sits on the
  // rectangle's edge, so |x|≤4 and |z|≤4 (corners are at the 4,4 diagonal).
  for (const d of discs) {
    assert.ok(d.r > 0, 'each perimeter disc has a positive radius');
    assert.ok(Math.abs(d.c.x) <= 4 + 1e-9 && Math.abs(d.c.z) <= 4 + 1e-9, 'discs sit on the room perimeter');
  }
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

test('walkSpawnPoint: a camera already inside the room keeps its spot', () => {
  // Drop-in-where-you-are is preserved — no clamp, no entrance snap.
  assert.deepEqual(walkSpawnPoint({ x: 2, z: 3 }, ROOM, { x: 0, z: 9.2 }, []), { x: 2, z: 3 });
});

test('walkSpawnPoint: a zoomed-out camera spawns just inside the entrance, clear of the posts', () => {
  // The orbit camera at max zoom sits far outside the room (the void bug).
  const entrance = pctToWorld(50, 96, ROOM); // {0, 9.2} — on the +z edge
  const obs = floorObstacles(floor(false), [], ROOM, []); // stage + 2 entrance posts
  const p = walkSpawnPoint({ x: 0, z: 40 }, ROOM, entrance, obs);
  // 1.5 m from the doorway toward the room centre → inside, facing the party.
  assert.ok(Math.abs(Math.hypot(p.x - entrance.x, p.z - entrance.z) - 1.5) < 1e-9, 'steps ~1.5 m inward');
  assert.ok(Math.abs(p.x) <= 10 && Math.abs(p.z) <= 10, 'inside the room rectangle');
  for (const post of obs.filter((o) => o.c.z > 5)) {
    assert.ok(Math.hypot(p.x - post.c.x, p.z - post.c.z) >= post.r, 'clear of the doorway posts');
  }
});

test('walkSpawnPoint: outside with no entrance clamps into the room with a wall margin', () => {
  const p = walkSpawnPoint({ x: 30, z: -25 }, ROOM, null, []);
  assert.deepEqual(p, { x: 9.2, z: -9.2 }, '0.8 m inside the nearest walls');
});

test('walkSpawnPoint: never spawns inside an obstacle disc', () => {
  // Camera hovering over a table: the spawn is expelled to the disc edge.
  const disc = { c: { x: 2, z: 3 }, r: 1.5 };
  const p = walkSpawnPoint({ x: 2.5, z: 3 }, ROOM, null, [disc]);
  assert.ok(Math.hypot(p.x - disc.c.x, p.z - disc.c.z) >= disc.r - 1e-9, 'pushed clear of the table');
});

test('walkSpawnPoint: disc overlapping the doorway cannot expel the spawn through the wall', () => {
  // Dance-floor/buffet disc parked over the entrance: the 1.5 m step-in point
  // (0, 7.7) sits inside it, and radial expulsion points OUT of the room
  // ((0, 10.5) — the void). The interior-biased re-expulsion must land the
  // spawn inside the room AND clear of the disc.
  const entrance = { x: 0, z: 9.2 };
  const disc = { c: { x: 0, z: 7 }, r: 3.5 };
  const p = walkSpawnPoint({ x: 0, z: 40 }, ROOM, entrance, [disc]);
  assert.ok(Math.abs(p.x) <= 10 && Math.abs(p.z) <= 10, 'inside the room rectangle');
  assert.ok(Math.hypot(p.x - disc.c.x, p.z - disc.c.z) >= disc.r - 1e-9, 'clear of the disc');
});

test('walkSpawnPoint: wall-adjacent disc in the no-entrance clamp branch stays in-room', () => {
  // Camera far outside, no entrance → clamp lands at (9.2, 0) inside a table
  // disc hugging the +x wall; radial expulsion would exit at (10.8, 0).
  const disc = { c: { x: 8.5, z: 0 }, r: 2.3 };
  const p = walkSpawnPoint({ x: 40, z: 0 }, ROOM, null, [disc]);
  assert.ok(Math.abs(p.x) <= 10 && Math.abs(p.z) <= 10, 'inside the room rectangle');
  assert.ok(Math.hypot(p.x - disc.c.x, p.z - disc.c.z) >= disc.r - 1e-9, 'clear of the disc');
});

test('walkSpawnPoint: inside camera over a wall-adjacent disc stays in-room', () => {
  // Properly-inside camera (9.5 ≤ hw − 0.4) hovering over a table against the
  // wall; radial expulsion would exit at (10.35, 0).
  const disc = { c: { x: 8.8, z: 0 }, r: 1.55 };
  const p = walkSpawnPoint({ x: 9.5, z: 0 }, ROOM, null, [disc]);
  assert.ok(Math.abs(p.x) <= 10 && Math.abs(p.z) <= 10, 'inside the room rectangle');
  assert.ok(Math.hypot(p.x - disc.c.x, p.z - disc.c.z) >= disc.r - 1e-9, 'clear of the disc');
});

test('walkSpawnPoint: near-wall camera INSIDE the room never teleports to the entrance', () => {
  // 0.2 m from the +x wall — inside the rectangle but past the 0.4 m inset.
  // With an entrance on the opposite wall, the spawn must stay the user's
  // spot (clamped ≤ 0.8 m off the wall), not jump cross-room to the doorway.
  const entrance = { x: 0, z: 9.2 };
  const p = walkSpawnPoint({ x: 9.8, z: -5 }, ROOM, entrance, []);
  assert.deepEqual(p, { x: 9.2, z: -5 }, 'kept the spot, nudged off the wall');
});

test('walkSpawnPoint: degenerate tiny room stays finite and inside', () => {
  const tiny = { w: 0.5, d: 0.5 };
  const clamped = walkSpawnPoint({ x: 100, z: 100 }, tiny, null, []);
  assert.deepEqual(clamped, { x: 0, z: 0 }, 'margins floor at 0 → room centre, no inverted bounds');
  // Entrance step overshooting the centre of a 0.5 m room clamps back in too.
  const doored = walkSpawnPoint({ x: 100, z: 100 }, tiny, { x: 0.25, z: 0 }, []);
  assert.ok(Number.isFinite(doored.x) && Number.isFinite(doored.z), 'no NaN');
  assert.ok(Math.abs(doored.x) <= 0.25 && Math.abs(doored.z) <= 0.25, 'still inside the tiny room');
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


test('boothTypeLabel: catalog types get their human label, unknown kinds title-case', () => {
  assert.equal(boothTypeLabel('mobile_bar'), 'Mobile bar');
  assert.equal(boothTypeLabel('photo_booth'), 'Photo booth');
  assert.equal(boothTypeLabel('dessert_station'), 'Dessert station');
  // custom / unassigned collapse to a plain "Booth".
  assert.equal(boothTypeLabel('custom'), 'Booth');
  assert.equal(boothTypeLabel('unassigned'), 'Booth');
  // A future/unknown type still reads (title-cased slug), never throws.
  assert.equal(boothTypeLabel('coffee_cart'), 'Coffee Cart');
});

// ── SeatPose facing (promoted into the pure engine) ─────────────────────────
// faceY is the seated guest's GAZE in walkVector's heading convention: yaw θ ↔
// world vector (sinθ, cosθ). These helpers compare facings as vectors so ±π
// wrap never produces a false failure.
const headingOf = (faceY: number) => ({ x: Math.sin(faceY), z: Math.cos(faceY) });
const nearVec = (a: { x: number; z: number }, b: { x: number; z: number }, eps = 1e-9) =>
  Math.hypot(a.x - b.x, a.z - b.z) < eps;

test('SeatPose round: every gaze converges on the table centre (3 o\'clock seat faces 9 o\'clock)', () => {
  const poses = chairLocalPositions('round', 8);
  assert.equal(poses.length, 8);
  for (const p of poses) {
    // Gaze = the unit vector from the seat back at the local origin.
    const len = Math.hypot(p.x, p.z);
    assert.ok(nearVec(headingOf(p.faceY), { x: -p.x / len, z: -p.z / len }), 'gaze points at the table centre');
  }
  // Clock check on the top-down canvas (12 o'clock = −z): seat index cap/4 sits
  // at 3 o'clock (+x) and must look at 9 o'clock (−x) — faceY −π/2.
  const three = poses[2]!;
  assert.ok(three.x > 0 && Math.abs(three.z) < 1e-9, 'seat 2 of 8 is the 3 o\'clock chair');
  assert.ok(nearVec(headingOf(three.faceY), { x: -1, z: 0 }), '3 o\'clock seat faces 9 o\'clock');
});

test('SeatPose sweetheart: the couple faces the room straight-on (+z)', () => {
  for (const p of chairLocalPositions('sweetheart', 2)) {
    assert.equal(p.faceY, 0, 'sweetheart gaze is exactly +z');
    assert.ok(p.z < 0, 'the couple sits behind the table (−z), looking over it');
  }
});

test('SeatPose banquet rows: seats gaze straight across the table by row sign', () => {
  for (const shape of ['long_banquet', 'family_head'] as const) {
    for (const cap of [7, 8]) {
      const poses = chairLocalPositions(shape, cap);
      assert.equal(poses.length, cap);
      for (const p of poses) {
        if (p.z < 0) assert.ok(nearVec(headingOf(p.faceY), { x: 0, z: 1 }), `${shape} −z row looks +z`);
        else assert.ok(nearVec(headingOf(p.faceY), { x: 0, z: -1 }), `${shape} +z row looks −z`);
      }
      // Both rows are actually populated (facing rule exercises both signs).
      assert.ok(poses.some((p) => p.z < 0) && poses.some((p) => p.z > 0));
    }
  }
});

test('serpentineChairs regression: reference values unchanged (positions + chair-yaw faceY)', () => {
  // The serpentine is the REFERENCE facing implementation — this pins its exact
  // output (recomputed from the locked band constants: RI 0.95 · RO 1.55 ·
  // 104° sweep · 0.5 m chair gap · outer-first fill 3+2) so the SeatPose
  // promotion provably did not move a single chair or spin a single backrest.
  const SWEEP = (104 * Math.PI) / 180;
  const { centre } = serpentineBand();
  const expectAlong = (count: number, r: number, inset: number, outward: boolean) => {
    const half = SWEEP / 2 - inset;
    const seats: { x: number; z: number; faceY: number }[] = [];
    for (let i = 0; i < count; i++) {
      const phi = count === 1 ? 0 : -half + (2 * half * i) / (count - 1);
      const p = { x: r * Math.sin(phi), z: -r * Math.cos(phi) };
      const faceY = outward ? Math.atan2(p.x, p.z) : Math.atan2(-p.x, -p.z);
      seats.push({ x: p.x + centre.x, z: p.z + centre.z, faceY });
    }
    return seats;
  };
  const expected = [
    ...expectAlong(3, 1.55 + 0.5, 0.18, true),
    ...expectAlong(2, 0.95 - 0.5, 0.36, false),
  ];
  const got = serpentineChairs(5);
  assert.equal(got.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.ok(Math.abs(got[i]!.x - expected[i]!.x) < 1e-12, `seat ${i} x unchanged`);
    assert.ok(Math.abs(got[i]!.z - expected[i]!.z) < 1e-12, `seat ${i} z unchanged`);
    assert.ok(Math.abs(got[i]!.faceY - expected[i]!.faceY) < 1e-12, `seat ${i} faceY unchanged`);
  }
});

test('SeatPose serpentine: same chairs as the reference, gaze = the π flip of the chair yaw, onto the band', () => {
  const ref = serpentineChairs(5);
  const poses = chairLocalPositions('serpentine', 5);
  const { centre } = serpentineBand();
  assert.equal(poses.length, ref.length);
  for (let i = 0; i < ref.length; i++) {
    // Positions are the reference's, byte-for-byte.
    assert.equal(poses[i]!.x, ref[i]!.x);
    assert.equal(poses[i]!.z, ref[i]!.z);
    // SerpSeat.faceY is the chair yaw (backrest heading) the instanced renderer
    // consumes; the promoted pose carries the sitter's GAZE — its exact π flip,
    // the same flip SeatedAvatar applies to the figure rig.
    const back = headingOf(ref[i]!.faceY);
    assert.ok(nearVec(headingOf(poses[i]!.faceY), { x: -back.x, z: -back.z }), `seat ${i} gaze = backrest + π`);
  }
  // Semantics: outer chairs (first 3) gaze AT the curvature centre — onto the
  // band; inner chairs (last 2) gaze away from it — also onto the band.
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i]!;
    const toCentre = { x: centre.x - p.x, z: centre.z - p.z };
    const len = Math.hypot(toCentre.x, toCentre.z);
    const want = i < 3
      ? { x: toCentre.x / len, z: toCentre.z / len }
      : { x: -toCentre.x / len, z: -toCentre.z / len };
    assert.ok(nearVec(headingOf(p.faceY), want, 1e-9), `seat ${i} gazes onto the band`);
  }
});

test('worldSeatPose: rotation composes facing by the same yaw the mesh gets (90° spin shifts every gaze 90°)', () => {
  const room = { w: 20, d: 20 };
  const spun: Lab3DTable = { ...table('A', 50, 50), rotationDeg: 90 };
  const flat: Lab3DTable = { ...spun, rotationDeg: 0 };
  for (let s = 0; s < spun.capacity; s++) {
    const local = chairLocalPositions(spun.shape, spun.capacity)[s]!;
    const world = worldSeatPose(spun, s, room);
    // Position parity with the existing seatWorld pipeline (unchanged math).
    const viaSeatWorld = seatWorld(spun, s, room);
    assert.deepEqual({ x: world.x, z: world.z }, { x: viaSeatWorld.x, z: viaSeatWorld.z });
    assert.equal(viaSeatWorld.faceY, world.faceY, 'seatWorld carries the same promoted facing');
    // The gaze vector rotates by EXACTLY the transform the chair mesh gets —
    // rotateLocal is the render-parity rotation, so run the local gaze through it.
    const wantHeading = rotateLocal(headingOf(local.faceY), spun.rotationDeg);
    assert.ok(nearVec(headingOf(world.faceY), wantHeading), `seat ${s} gaze follows the table spin`);
    // And the unrotated table keeps the local facing untouched.
    assert.ok(nearVec(headingOf(worldSeatPose(flat, s, room).faceY), headingOf(local.faceY)));
  }
});

test('approachPoint: distM behind the chair, on the far side from the table', () => {
  // Hand-checkable case: a seat 2 m up-canvas (−z) of a table at the origin
  // gazes +z back at it (faceY 0) — so "behind the chair" is further −z.
  const seat = { x: 0, z: -2, faceY: 0 };
  assert.deepEqual(approachPoint(seat, 0.5), { x: 0, z: -2.5 }, 'walker stands 0.5 m behind the chair');
  // Default distance is 0.55 m.
  const def = approachPoint(seat);
  assert.ok(Math.abs(def.z - -2.55) < 1e-12 && def.x === 0);
  // Real geometry: every round seat's approach point is FARTHER from the table
  // centre than the seat itself (never on the tabletop), on the seat's radial.
  const room = { w: 20, d: 20 };
  const t = table('A', 50, 50);
  for (let s = 0; s < t.capacity; s++) {
    const pose = worldSeatPose(t, s, room);
    const ap = approachPoint(pose);
    const seatDist = Math.hypot(pose.x, pose.z);
    const apDist = Math.hypot(ap.x, ap.z);
    assert.ok(Math.abs(apDist - (seatDist + 0.55)) < 1e-9, `seat ${s} approach sits 0.55 m further out on the radial`);
  }
});

test('boothApproach: walk-up point sits outside the booth avoidance ring, on the room-centre side, facing the booth', () => {
  const room = { w: 20, d: 30 };
  // A booth on the right wall (x=90%, y=48%) — like the demo's sample bar.
  const booth = { xPct: 90, yPct: 48 };
  const c = pctToWorld(booth.xPct, booth.yPct, room);
  const { point, faceY } = boothApproach(booth, room);
  // Outside the avoidance disc boothObstacles builds (radius + walker slack).
  const avoidR = Math.max(BOOTH_FOOTPRINT_M.w, BOOTH_FOOTPRINT_M.d) / 2 + 0.4;
  const dist = Math.hypot(point.x - c.x, point.z - c.z);
  assert.ok(dist > avoidR, `approach point must clear the avoidance ring (${dist} <= ${avoidR})`);
  // On the room-centre side of the booth: closer to the origin than the booth is.
  assert.ok(Math.hypot(point.x, point.z) < Math.hypot(c.x, c.z));
  // Facing points from the approach point back at the booth centre.
  const expect = Math.atan2(c.x - point.x, c.z - point.z);
  assert.ok(Math.abs(faceY - expect) < 1e-9);

  // Degenerate: a booth dead-centre still gets a sane approach (front-of-house).
  const centre = boothApproach({ xPct: 50, yPct: 50 }, room);
  assert.ok(Number.isFinite(centre.point.x) && Number.isFinite(centre.point.z));
  assert.ok(Math.hypot(centre.point.x, centre.point.z) > avoidR);
});

// The world heading a booth group's front (+z) points after `rotation.y = θ`.
function frontHeading(theta: number): { x: number; z: number } {
  return { x: Math.sin(theta), z: Math.cos(theta) };
}

test('boothFacingY: a perimeter booth turns its FRONT toward the room centre (cardinal walls)', () => {
  const room = { w: 20, d: 30 };
  // Left wall (small xPct) → front points +x (into the room from the left wall).
  const left = frontHeading(boothFacingY({ xPct: 2, yPct: 50 }, room));
  assert.ok(left.x > 0.999 && Math.abs(left.z) < 1e-6, `left → +x, got ${JSON.stringify(left)}`);
  // Right wall → front points −x.
  const right = frontHeading(boothFacingY({ xPct: 98, yPct: 50 }, room));
  assert.ok(right.x < -0.999 && Math.abs(right.z) < 1e-6, `right → −x, got ${JSON.stringify(right)}`);
  // Top wall (small yPct) → front points +z (yaw ≈ 0).
  const top = boothFacingY({ xPct: 50, yPct: 2 }, room);
  assert.ok(Math.abs(top) < 1e-6, `top → yaw ≈ 0, got ${top}`);
  const topH = frontHeading(top);
  assert.ok(topH.z > 0.999 && Math.abs(topH.x) < 1e-6, `top → +z, got ${JSON.stringify(topH)}`);
  // Bottom wall (large yPct) → front points −z (yaw ≈ ±π).
  const bottom = boothFacingY({ xPct: 50, yPct: 98 }, room);
  assert.ok(Math.abs(Math.abs(bottom) - Math.PI) < 1e-6, `bottom → yaw ≈ π, got ${bottom}`);
  const botH = frontHeading(bottom);
  assert.ok(botH.z < -0.999 && Math.abs(botH.x) < 1e-6, `bottom → −z, got ${JSON.stringify(botH)}`);
});

test('boothFacingY: a dead-centre booth yaws 0 (front-of-house +z), matching boothApproach', () => {
  const room = { w: 20, d: 30 };
  assert.equal(boothFacingY({ xPct: 50, yPct: 50 }, room), 0);
});

test('boothFacingY: front faces the room centre ↔ boothApproach approaches from that same side', () => {
  const room = { w: 20, d: 30 };
  for (const booth of [
    { xPct: 90, yPct: 48 },
    { xPct: 12, yPct: 20 },
    { xPct: 50, yPct: 4 },
    { xPct: 33, yPct: 95 },
  ]) {
    const c = pctToWorld(booth.xPct, booth.yPct, room);
    const yaw = boothFacingY(booth, room);
    // Booth front points from the booth centre toward the origin (unit vector).
    const front = frontHeading(yaw);
    const toCentre = { x: -c.x / Math.hypot(c.x, c.z), z: -c.z / Math.hypot(c.x, c.z) };
    assert.ok(
      Math.abs(front.x - toCentre.x) < 1e-9 && Math.abs(front.z - toCentre.z) < 1e-9,
      `front must aim at room centre for ${JSON.stringify(booth)}`,
    );
    // boothApproach stands on the room-centre (front) side, never wall-side:
    // the approach point is displaced from the booth ALONG the booth's front.
    const { point } = boothApproach(booth, room);
    const disp = { x: point.x - c.x, z: point.z - c.z };
    const dlen = Math.hypot(disp.x, disp.z);
    assert.ok(
      front.x * (disp.x / dlen) + front.z * (disp.z / dlen) > 0.999,
      `approach point must lie on the booth's front (room) side for ${JSON.stringify(booth)}`,
    );
  }
});

test('rotateLocalRad: matches rotateLocal under the degree→radian convention (ry = −deg·π/180)', () => {
  const p = { x: 1.3, z: -0.7 };
  for (const deg of [0, 30, 90, 145, -60, 180]) {
    const a = rotateLocal(p, deg);
    const b = rotateLocalRad(p, (-deg * Math.PI) / 180);
    assert.ok(Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.z - b.z) < 1e-12, `mismatch at ${deg}°`);
  }
  // Rotating a booth-local offset by the booth's own yaw lands it on the world
  // heading the booth's front points (a purely-forward offset stays forward).
  const room = { w: 20, d: 30 };
  const yaw = boothFacingY({ xPct: 90, yPct: 48 }, room);
  const fwd = rotateLocalRad({ x: 0, z: 1 }, yaw);
  assert.ok(Math.abs(fwd.x - Math.sin(yaw)) < 1e-12 && Math.abs(fwd.z - Math.cos(yaw)) < 1e-12);
});

// ── Avoidance engine v2: true footprints · chair discs · grid · prediction ──

/** A long banquet table for the footprint tests. */
function banquet(deg: number): Lab3DTable {
  return {
    id: 'B',
    label: 'B',
    type: 'long_banquet_10',
    shape: 'long_banquet',
    capacity: 10,
    removedSeats: [],
    xPct: 50,
    yPct: 50,
    rotationDeg: deg,
    linkGroupId: null,
  };
}

test('tableFootprintDiscs: capsule covers a banquet\'s corners (rotated too) yet stays tight across the short axis', () => {
  for (const deg of [0, 35]) {
    const t = banquet(deg);
    const discs = tableFootprintDiscs(t, ROOM);
    assert.ok(discs.length >= 3 && discs.length <= 4, `banquet gets 3–4 discs (got ${discs.length})`);
    const dims = tableDims(t.shape, t.capacity); // 3.0 × 0.85
    // (a) Every tabletop CORNER (rotated through the same transform the mesh
    // gets) sits INSIDE the disc union with real depth — a corner-grazing point
    // is expelled, the owner-watched clip.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const c = rotateLocal({ x: (sx * dims.w) / 2, z: (sz * dims.d) / 2 }, deg);
        const cover = Math.max(...discs.map((d) => d.r - Math.hypot(c.x - d.c.x, c.z - d.c.z)));
        assert.ok(cover > 0.15, `corner (${sx},${sz}) at ${deg}° covered with depth (got ${cover.toFixed(3)})`);
        const pushed = pushOutOfDiscs(c, discs);
        assert.ok(pushed.x !== c.x || pushed.z !== c.z, 'a point ON the corner is pushed out');
      }
    }
    // (b) Tightness — the whole point of multi-disc: a spot 1.6 m off the LONG
    // side (old bounding disc r = 3/2 + 0.8 = 2.3 swallowed it) is walkable.
    const side = rotateLocal({ x: 0, z: 1.6 }, deg);
    assert.deepEqual(pushOutOfDiscs(side, discs), side, 'the aisle beside the long edge stays walkable');
    assert.ok(Math.hypot(side.x, side.z) < tableAvoidR(t), 'that spot was inside the old bounding disc');
  }
});

test('banquet corner regression: an interpolated walk grazing the end corner never enters the tabletop', () => {
  // The owner watched corners get clipped: a chord aimed just past a banquet's
  // END corner used to cut the tabletop. Mirror the walker's real pipeline —
  // steerPath + per-frame pushOutOfDiscs re-clamp — against the capsule discs
  // and assert zero incursion into the ROTATED tabletop rectangle.
  const bodyR = 0.24;
  const deg = 30;
  const t = banquet(deg);
  const dims = tableDims(t.shape, t.capacity);
  const discs = tableFootprintDiscs(t, ROOM);
  // A straight line through the end-corner region of the rotated table: run it
  // through a point just INSIDE the corner so the naive chord provably breaches.
  const graze = rotateLocal({ x: dims.w / 2 - 0.15, z: dims.d / 2 - 0.1 }, deg);
  const start = { x: graze.x - 6, z: graze.z - 0.2 };
  const end = { x: graze.x + 6, z: graze.z + 0.2 };
  const insideTop = (p: { x: number; z: number }): boolean => {
    // Undo the table spin (rotateLocal by −deg inverts it) → axis-aligned test.
    const local = rotateLocal(p, -deg);
    return Math.abs(local.x) < dims.w / 2 - 1e-6 && Math.abs(local.z) < dims.d / 2 - 1e-6;
  };
  // Counter-proof: the raw straight line DOES cross the tabletop.
  let straightBreaches = false;
  for (let f = 0; f <= 200; f++) {
    const s = f / 200;
    if (insideTop({ x: start.x + (end.x - start.x) * s, z: start.z + (end.z - start.z) * s })) {
      straightBreaches = true;
    }
  }
  assert.ok(straightBreaches, 'the naive straight line must cross the tabletop for this to regress anything');
  // The real pipeline: steer, then sample chords finely with the per-frame re-clamp.
  const path = steerPath(start, end, discs, bodyR);
  for (let i = 0; i < path.length - 1; i++) {
    for (let f = 0; f <= 20; f++) {
      const s = f / 20;
      const raw = {
        x: path[i]!.x + (path[i + 1]!.x - path[i]!.x) * s,
        z: path[i]!.z + (path[i + 1]!.z - path[i]!.z) * s,
      };
      const p = pushOutOfDiscs(raw, discs, { x: 1, z: 0 }, bodyR);
      assert.ok(!insideTop(p), `chord sample ${i}+${s} entered the tabletop at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
    }
  }
});

test('tableFootprintDiscs: round/sweetheart keep one disc; serpentine strings the band and opens the concave pocket', () => {
  const round = tableFootprintDiscs(table('R', 50, 50), ROOM);
  assert.equal(round.length, 1);
  assert.ok(Math.abs(round[0]!.r - tableAvoidR(table('R', 50, 50))) < 1e-9, 'round disc = tableAvoidR, unchanged');
  const sweet: Lab3DTable = { ...table('S', 50, 50), shape: 'sweetheart', type: 'sweetheart', capacity: 2 };
  assert.equal(tableFootprintDiscs(sweet, ROOM).length, 1);

  const serp: Lab3DTable = { ...table('P', 50, 50), shape: 'serpentine', type: 'serpentine', capacity: 5 };
  const discs = tableFootprintDiscs(serp, ROOM);
  assert.ok(discs.length >= 4, `serpentine strings ≥4 discs along the band (got ${discs.length})`);
  // Every point of the band's CENTRELINE is covered (walkers can't cross the band)…
  const { centre } = serpentineBand();
  const SWEEP = (104 * Math.PI) / 180;
  const rm = (0.95 + 1.55) / 2;
  for (let i = 0; i <= 12; i++) {
    const phi = -SWEEP / 2 + (SWEEP * i) / 12;
    const p = { x: rm * Math.sin(phi) + centre.x, z: -rm * Math.cos(phi) + centre.z };
    const cover = Math.max(...discs.map((d) => d.r - Math.hypot(p.x - d.c.x, p.z - d.c.z)));
    assert.ok(cover > 0, `band centreline sample ${i} is covered`);
  }
  // …but the concave pocket (the curvature centre) is finally WALKABLE — the
  // old bbox bounding disc (tableAvoidR ≈ 2 m) blanketed it.
  const pocket = { x: centre.x, z: centre.z };
  assert.deepEqual(pushOutOfDiscs(pocket, discs), pocket, 'the concave pocket is open');
  assert.ok(Math.hypot(pocket.x, pocket.z) < tableAvoidR(serp), 'the pocket was inside the old bounding disc');
});

test('floorObstacles: emits multi-disc footprints per table (capsule banquet + single round + stage)', () => {
  const tables = [banquet(0), table('R', 20, 20)];
  const obs = floorObstacles(floor(false), tables, ROOM, []);
  const banquetDiscs = tableFootprintDiscs(banquet(0), ROOM).length;
  assert.equal(obs.length, banquetDiscs + 1 + 1 + 2, 'banquet capsule + round disc + stage + entrance posts');
  // Skipping the banquet drops ALL of its footprint discs.
  assert.equal(floorObstacles(floor(false), tables, ROOM, ['B']).length, 4);
});

test('chairObstacles: a disc per chair; destination chair + approach corridor excluded; removed seats skipped', () => {
  const room = { w: 20, d: 20 };
  const t = table('A', 50, 50); // round_10 at the origin
  const all = chairObstacles(t, room);
  assert.equal(all.length, 10, 'one disc per chair, occupied or not');
  for (let i = 0; i < 10; i++) {
    const pose = worldSeatPose(t, i, room);
    assert.deepEqual(all[i]!.c, { x: pose.x, z: pose.z }, `disc ${i} sits on its chair`);
    assert.equal(all[i]!.r, CHAIR_OBSTACLE_R);
  }
  // Removed (deleted) chairs have nothing to bump into.
  assert.equal(chairObstacles({ ...t, removedSeats: [3, 7] }, room).length, 8);
  // Destination seat: its own disc goes away…
  const dest = 0;
  const seat = worldSeatPose(t, dest, room);
  const forWalk = chairObstacles(t, room, { destinationSeat: dest });
  assert.equal(forWalk.length, 9, 'destination chair excluded');
  assert.ok(!forWalk.some((d) => Math.hypot(d.c.x - seat.x, d.c.z - seat.z) < 1e-9));
  // …and the walker's hand-off spot (approachPoint) is clear of every kept disc,
  // so the sit walk can actually stand there.
  const ap = approachPoint(seat);
  for (const d of forWalk) {
    assert.ok(Math.hypot(ap.x - d.c.x, ap.z - d.c.z) >= d.r, 'approach point clear of chair discs');
    assert.ok(!inSeatApproachCorridor(d.c, seat), 'no kept chair sits in the approach corridor');
  }
  // Out-of-range destination clamps exactly like worldSeatPose (chair 9 here).
  const clamped = chairObstacles(t, room, { destinationSeat: 99 });
  const chair9 = worldSeatPose(t, 9, room);
  assert.ok(!clamped.some((d) => Math.hypot(d.c.x - chair9.x, d.c.z - chair9.z) < 1e-9));
});

test('inSeatApproachCorridor: behind-the-chair strip only — the table side and the flanks stay obstacles', () => {
  const seat = { x: 0, z: -2, faceY: 0 }; // gazes +z at a table; "behind" is −z
  assert.ok(inSeatApproachCorridor(approachPoint(seat), seat), 'the approachPoint is in the corridor');
  assert.ok(inSeatApproachCorridor({ x: 0.3, z: -3 }, seat), 'a chair crowding the strip is in it');
  assert.ok(!inSeatApproachCorridor({ x: 1.2, z: -2.6 }, seat), 'a flank neighbour is not');
  assert.ok(!inSeatApproachCorridor({ x: 0, z: -1.2 }, seat), 'the table side (+faceY) is not');
  assert.ok(!inSeatApproachCorridor({ x: 0, z: -3.9 }, seat), 'beyond the corridor length is not');
});

test('chairObstaclesForWalk: dest-table exclusions + neighbouring corridor crowders dropped; unknown dest → all chairs', () => {
  const A = table('A', 50, 50); // round_10 at the origin
  const dest = 0;
  const seat = worldSeatPose(A, dest, ROOM);
  // Ring radius of a round_10's chairs — measured, not assumed.
  const ringR = Math.hypot(seat.x, seat.z);
  // Park table B straight down the seat-0 approach corridor, close enough that
  // B's nearest chair crowds the hand-off strip (~0.8 m behind the dest chair).
  const bx = seat.x - Math.sin(seat.faceY) * (0.8 + ringR);
  const bz = seat.z - Math.cos(seat.faceY) * (0.8 + ringR);
  const B = table('B', (bx / ROOM.w + 0.5) * 100, (bz / ROOM.d + 0.5) * 100);
  const bAll = chairObstacles(B, ROOM);
  const crowders = bAll.filter((d) => inSeatApproachCorridor(d.c, seat));
  assert.ok(crowders.length >= 1, 'the placement must put a B chair in the corridor for this to prove anything');
  const out = chairObstaclesForWalk([A, B], ROOM, { tableId: 'A', seatNumber: dest });
  // A goes through chairObstacles' own destinationSeat handling…
  const aKept = chairObstacles(A, ROOM, { destinationSeat: dest });
  // …and B loses exactly its corridor crowders — nothing else.
  assert.equal(out.length, aKept.length + bAll.length - crowders.length);
  assert.ok(!out.some((d) => inSeatApproachCorridor(d.c, seat)), 'no kept chair crowds the corridor');
  assert.ok(!out.some((d) => Math.hypot(d.c.x - seat.x, d.c.z - seat.z) < 1e-9), 'the destination chair is gone');
  // Unknown dest table (guest row raced a table delete) → every chair,
  // unfiltered — strictly more conservative, never a crash.
  assert.equal(chairObstaclesForWalk([A, B], ROOM, { tableId: 'ghost', seatNumber: 0 }).length, 20);
});

test('separateAgents predictive: head-on walkers pass right-shifted, never overlap — reactive-only mirrors deadlock', () => {
  const SPEED = 1.4;
  const DT = 1 / 30;
  const MIN = 0.6;
  type Sim = { pos: Vec2p; target: Vec2p };
  type Vec2p = { x: number; z: number };
  const run = (withVel: boolean) => {
    const sims: Sim[] = [
      { pos: { x: 0, z: -3 }, target: { x: 0, z: 3 } },
      { pos: { x: 0, z: 3 }, target: { x: 0, z: -3 } },
    ];
    let minPair = Infinity;
    const trace: Vec2p[][] = [[], []];
    for (let f = 0; f < 300; f++) {
      const desired = sims.map((s) => {
        const dx = s.target.x - s.pos.x;
        const dz = s.target.z - s.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = Math.min(dist, SPEED * DT);
        const vx = dist > 1e-9 ? (dx / dist) * SPEED : 0;
        const vz = dist > 1e-9 ? (dz / dist) * SPEED : 0;
        const next = dist > 1e-9
          ? { x: s.pos.x + (dx / dist) * step, z: s.pos.z + (dz / dist) * step }
          : { x: s.pos.x, z: s.pos.z };
        return withVel ? { ...next, vel: { x: vx, z: vz } } : next;
      });
      const sep = separateAgents(desired, MIN);
      sims.forEach((s, i) => {
        s.pos = sep[i]!;
        trace[i]!.push(sep[i]!);
      });
      minPair = Math.min(minPair, Math.hypot(sep[1]!.x - sep[0]!.x, sep[1]!.z - sep[0]!.z));
    }
    return { sims, minPair, trace };
  };

  // WITH velocities: they anticipate, sidestep, pass, and both arrive.
  const pred = run(true);
  assert.ok(pred.minPair >= MIN - 1e-9, `never closer than minDist (got ${pred.minPair.toFixed(3)})`);
  for (const [i, s] of pred.sims.entries()) {
    const remaining = Math.hypot(s.pos.x - s.target.x, s.pos.z - s.target.z);
    assert.ok(remaining < 0.5, `agent ${i} reached its target (remaining ${remaining.toFixed(2)})`);
  }
  // Pass-on-the-RIGHT: agent 0 walks +z (its right is +x); agent 1 walks −z
  // (its right is −x). Each detours to its own right.
  assert.ok(Math.max(...pred.trace[0]!.map((p) => p.x)) > 0.05, 'agent 0 detoured to ITS right (+x)');
  assert.ok(Math.min(...pred.trace[1]!.map((p) => p.x)) < -0.05, 'agent 1 detoured to ITS right (−x)');

  // Counter-proof: WITHOUT velocities the mirrored pair has no symmetry-breaker
  // — both stay pinned to the x=0 line and neither ever gets past the other.
  const reactive = run(false);
  for (const t of reactive.trace) for (const p of t) assert.ok(Math.abs(p.x) < 1e-9, 'reactive mirror stays on the line');
  const stuck = Math.hypot(
    reactive.sims[0]!.pos.x - reactive.sims[0]!.target.x,
    reactive.sims[0]!.pos.z - reactive.sims[0]!.target.z,
  );
  assert.ok(stuck > 1, `reactive-only deadlocks short of the target (remaining ${stuck.toFixed(2)}) — the right-bias is load-bearing`);
});

test('spatial hash: obstaclesNear finds every reaching disc; grid fast paths match brute force bit-for-bit', () => {
  // Deterministic PRNG (mulberry32) — the parity claim must not be flaky.
  const mulberry32 = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = mulberry32(0x5e7a1);
  const discs: ObstacleDisc[] = [];
  for (let i = 0; i < 60; i++) {
    discs.push({
      c: { x: (rand() - 0.5) * 30, z: (rand() - 0.5) * 30 },
      r: 0.3 + rand() * 1.7,
    });
  }
  const grid = buildObstacleGrid(discs);
  const bodyR = 0.24;
  for (let k = 0; k < 150; k++) {
    const p = { x: (rand() - 0.5) * 34, z: (rand() - 0.5) * 34 };
    const reach = rand() * 0.6;
    const near = obstaclesNear(grid, p, reach);
    // Completeness: every disc whose inflated radius reaches p is returned.
    for (const d of discs) {
      if (Math.hypot(p.x - d.c.x, p.z - d.c.z) < d.r + reach) {
        assert.ok(near.includes(d), 'obstaclesNear misses a reaching disc');
      }
    }
    // Order: insertion order, so fast-path mutation sequences match brute force.
    for (let i = 1; i < near.length; i++) {
      assert.ok(discs.indexOf(near[i - 1]!) < discs.indexOf(near[i]!), 'near set keeps insertion order');
    }
    // pushOutOfDiscs parity: grid + inflateR ≡ brute-force pre-inflated array.
    const inflated = discs.map((d) => ({ c: d.c, r: d.r + bodyR }));
    assert.deepEqual(
      pushOutOfDiscs(p, grid, { x: 1, z: 0 }, bodyR),
      pushOutOfDiscs(p, inflated),
      'grid push == brute-force push',
    );
  }
  // steerPath parity on whole walks across the random scene.
  for (let k = 0; k < 12; k++) {
    const s = { x: -16, z: (rand() - 0.5) * 30 };
    const e = { x: 16, z: (rand() - 0.5) * 30 };
    assert.deepEqual(steerPath(s, e, grid, bodyR), steerPath(s, e, discs, bodyR), 'grid steer == brute-force steer');
  }
  // And the real room stays cheap: a 15-table/150-chair scene's grid query
  // returns a small neighbourhood, not the whole set.
  const roomTables = Array.from({ length: 15 }, (_, i) => table(`T${i}`, 10 + (i % 5) * 20, 15 + Math.floor(i / 5) * 30));
  const roomDiscs = [
    ...floorObstacles(floor(true), roomTables, ROOM, []),
    ...roomTables.flatMap((t) => chairObstacles(t, ROOM)),
  ];
  assert.ok(roomDiscs.length >= 160, `full room carries the advertised disc count (got ${roomDiscs.length})`);
  const roomGrid = buildObstacleGrid(roomDiscs);
  const sample = obstaclesNear(roomGrid, { x: 0, z: 0 }, bodyR);
  assert.ok(sample.length < roomDiscs.length / 4, `query is local (${sample.length} of ${roomDiscs.length})`);
});

test('BIG_DISC_R split: oversized discs skip the buckets, are always candidates, and stop poisoning the query reach', () => {
  // A stage-class disc (r 3.6 — max(stageW,stageD)/2 + 0.6 for a 6 m stage)
  // used to set grid.maxR, dragging EVERY per-frame query's scan square up to
  // ~15 m; now it rides outside the buckets and small queries stay local.
  const small: ObstacleDisc[] = [
    { c: { x: -8, z: -8 }, r: 1.0 },
    { c: { x: 8, z: 8 }, r: 1.2 },
    { c: { x: 0, z: 6 }, r: 0.3 },
  ];
  const stage = { c: { x: 0, z: -7 }, r: 3.6 };
  const grid = buildObstacleGrid([...small, stage]);
  assert.ok(grid.maxR <= 1.2 + 1e-9, 'maxR covers gridded discs only');
  assert.deepEqual(grid.big, [3], 'the stage disc is indexed as big');
  // Always a candidate — even from the far corner with zero reach…
  const far = obstaclesNear(grid, { x: 9, z: 9 }, 0);
  assert.ok(far.includes(stage), 'big disc is unconditionally in every query');
  // …while the query stays local: the far small discs are not dragged in.
  assert.ok(!far.some((d) => d === small[0]), 'far small disc is culled');
  // Parity: grid results (push + steer) still match brute force bit-for-bit
  // across a walk that crosses the stage disc.
  const all = [...small, stage];
  const bodyR = 0.24;
  const inflated = all.map((d) => ({ c: d.c, r: d.r + bodyR }));
  for (const p of [{ x: 0, z: -7 }, { x: 0.4, z: -5 }, { x: -8, z: -7.6 }, { x: 9, z: 9 }]) {
    assert.deepEqual(
      pushOutOfDiscs(p, grid, { x: 1, z: 0 }, bodyR),
      pushOutOfDiscs(p, inflated),
      'grid push == brute push with a big disc present',
    );
  }
  assert.deepEqual(
    steerPath({ x: -9, z: -7 }, { x: 9, z: -7 }, grid, bodyR),
    steerPath({ x: -9, z: -7 }, { x: 9, z: -7 }, all, bodyR),
    'grid steer == brute steer straight through the stage line',
  );
});

test('dropDiscsContaining: only the disc(s) reaching the point go away — the rest of a capsule stays solid', () => {
  const discs: ObstacleDisc[] = [
    { c: { x: 0, z: 0 }, r: 1.0 }, // contains p
    { c: { x: 2.5, z: 0 }, r: 1.0 }, // clear of p
    { c: { x: 0, z: 1.2 }, r: 1.0 }, // clear bare, contains p once body-inflated
  ];
  const p = { x: 0, z: 0.1 };
  assert.deepEqual(dropDiscsContaining(discs, p), [discs[1], discs[2]]);
  assert.deepEqual(dropDiscsContaining(discs, p, 0.24), [discs[1]], 'inflateR widens the containment test');
  assert.deepEqual(dropDiscsContaining(discs, { x: 9, z: 9 }), discs, 'a clear point drops nothing');
});

test('approach corridor width: a 14-seat banquet keeps BOTH flanking chairs solid (pitch 0.547 > half-width)', () => {
  const t14: Lab3DTable = {
    id: 'B14', label: 'B14', type: 'long_banquet_14', shape: 'long_banquet',
    capacity: 14, removedSeats: [], xPct: 50, yPct: 50, rotationDeg: 0, linkGroupId: null,
  };
  const dest = 3; // interior seat on the −z row (perSide 7)
  const out = chairObstacles(t14, ROOM, { destinationSeat: dest });
  // ONLY the destination chair is excluded — at 0.55 half-width the corridor
  // swallowed both same-row neighbours too (3 exclusions), leaving nothing to
  // clamp a crowd-mode shove out of the adjacent seat backs.
  assert.equal(out.length, 13, 'exactly one chair (the destination) is excluded');
  for (const n of [dest - 1, dest + 1]) {
    const pose = worldSeatPose(t14, n, ROOM);
    assert.ok(
      out.some((d) => Math.hypot(d.c.x - pose.x, d.c.z - pose.z) < 1e-9),
      `flanking chair ${n} stays an obstacle`,
    );
  }
});

test('separateAgents: grid-culled big casts match the O(n²) sweep bit-for-bit', () => {
  const mulberry32 = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = mulberry32(0xc0ffee);
  const MIN = 0.5;
  // Reference: the documented v2 sweep (coincident / reactive / predictive
  // with the 0.4 s lookahead · 0.35 gain · 0.9 right bias), restated here so
  // the grid cull is pinned against the algorithm, not against itself.
  const brute = (agents: readonly ({ x: number; z: number; vel?: { x: number; z: number } })[]): { x: number; z: number }[] => {
    const out = agents.map((a) => ({ x: a.x, z: a.z }));
    const evade = (v: { x: number; z: number } | undefined, ax: number, az: number) => {
      const speed = v ? Math.hypot(v.x, v.z) : 0;
      if (!v || speed < 1e-6) return { x: ax, z: az };
      const bx = ax + 0.9 * (v.z / speed);
      const bz = az + 0.9 * (-v.x / speed);
      const bl = Math.hypot(bx, bz) || 1;
      return { x: bx / bl, z: bz / bl };
    };
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j]!.x - out[i]!.x;
        const dz = out[j]!.z - out[i]!.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-6) {
          out[i]!.x -= MIN / 2;
          out[j]!.x += MIN / 2;
          continue;
        }
        if (dist < MIN) {
          const push = (MIN - dist) / 2;
          out[i]!.x -= (dx / dist) * push;
          out[i]!.z -= (dz / dist) * push;
          out[j]!.x += (dx / dist) * push;
          out[j]!.z += (dz / dist) * push;
          continue;
        }
        const vi = agents[i]!.vel;
        const vj = agents[j]!.vel;
        if (!vi && !vj) continue;
        const pdx = dx + ((vj?.x ?? 0) - (vi?.x ?? 0)) * 0.4;
        const pdz = dz + ((vj?.z ?? 0) - (vi?.z ?? 0)) * 0.4;
        const pdist = Math.hypot(pdx, pdz);
        if (pdist >= MIN) continue;
        const ux = pdist > 1e-6 ? pdx / pdist : dx / dist;
        const uz = pdist > 1e-6 ? pdz / pdist : dz / dist;
        const push = ((MIN - pdist) / 2) * 0.35;
        const di = evade(vi, -ux, -uz);
        const dj = evade(vj, ux, uz);
        out[i]!.x += di.x * push;
        out[i]!.z += di.z * push;
        out[j]!.x += dj.x * push;
        out[j]!.z += dj.z * push;
      }
    }
    return out;
  };
  // 80 agents (well past the grid threshold): a milling cluster + spread-out
  // walkers with velocities + pinned (velocity-less) sitters.
  const agents: ({ x: number; z: number; vel?: { x: number; z: number } })[] = [];
  for (let i = 0; i < 80; i++) {
    const clustered = i % 4 === 0;
    const a: { x: number; z: number; vel?: { x: number; z: number } } = {
      x: clustered ? (rand() - 0.5) * 1.5 : (rand() - 0.5) * 20,
      z: clustered ? (rand() - 0.5) * 1.5 : (rand() - 0.5) * 20,
    };
    if (i % 3 !== 0) a.vel = { x: (rand() - 0.5) * 3, z: (rand() - 0.5) * 3 };
    agents.push(a);
  }
  assert.deepEqual(separateAgents(agents, MIN), brute(agents), 'grid cull == full sweep');
});

test('separateAgents: predictive push is a per-second rate under deltaS (halves at 120 Hz), reactive stays as-is', () => {
  // Head-on pair 1 m apart closing at 1.5 m/s each → projected conflict, no
  // current overlap: pure predictive push.
  const mk = () => [
    { x: 0, z: 0, vel: { x: 0, z: 1.5 } },
    { x: 0.01, z: 1, vel: { x: 0, z: -1.5 } }, // slight x offset so the axis is stable
  ];
  const MIN = 0.6;
  const base = separateAgents(mk(), MIN);
  const at60 = separateAgents(mk(), MIN, 1 / 60);
  const at120 = separateAgents(mk(), MIN, 1 / 120);
  const disp = (r: { x: number; z: number }[]) => Math.hypot(r[0]!.x - 0, r[0]!.z - 0);
  assert.ok(disp(base) > 1e-6, 'the pair does conflict predictively');
  assert.ok(Math.abs(disp(at60) - disp(base)) < 1e-12, '60 fps delta == the untimed reference');
  assert.ok(Math.abs(disp(at120) - disp(base) / 2) < 1e-12, 'a 120 Hz frame applies half the push');
  // Reactive (overlapping) pairs are delta-independent — the hard guarantee.
  const overlap = () => [{ x: 0, z: 0 }, { x: 0.2, z: 0 }];
  assert.deepEqual(separateAgents(overlap(), MIN, 1 / 120), separateAgents(overlap(), MIN));
});
