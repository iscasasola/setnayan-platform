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
  serpentineChairs,
  serpentineBand,
  BOOTH_FOOTPRINT_M,
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
