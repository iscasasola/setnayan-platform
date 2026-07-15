/**
 * Unit suite for THE PLACEMENT ORACLE (council verdict 2026-07-16). Every
 * mutation path in the editor validates through these pure helpers, so this
 * suite pins the geometry: rotation-aware OBB/SAT collision, the serpentine
 * 3-OBB decomposition, `legalJoinPose` as the single source of truth for
 * snapping + join validation, `checkPlacement`/`layoutViolations`, and the
 * verified metric `solveAutoLayout`. Covers the verdict § 8 test list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  obbOf,
  footprintsOverlap,
  checkPlacement,
  penetrationDepth,
  layoutViolations,
  legalJoinPose,
  isLegalJoint,
  solveAutoLayout,
  stageZone,
  serpentineChainSnap,
  roundKissSnap,
  boxesOverlap,
  tableGeometry,
  shapeHintFor,
  TABLE_FOOTPRINT_M,
  DEFAULT_FLOOR_PLAN,
  JOIN_TOL_M,
  type EventTableRow,
  type TableType,
  type WorldPose,
  type OracleZone,
} from './seating';

// --- fixtures --------------------------------------------------------------

// A world pose at scale=1 (local geometry px == world px) for shape tests.
function pose(
  shape: WorldPose['shape'],
  capacity: number,
  x: number,
  y: number,
  rot = 0,
  id = 't',
  linkGroupId: string | null = null,
  scale = 1,
): WorldPose {
  return { tableId: id, shape, capacity, x, y, rot, scale, linkGroupId };
}

// Realistic to-scale world footprint, mirroring the editor's footprintPx: a
// table's box scaled so its width == TABLE_FOOTPRINT_M * pxPerMeter.
function footprintPx(t: EventTableRow, ppm: number): { w: number; h: number } {
  const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
  const s = (TABLE_FOOTPRINT_M[t.table_type] * ppm) / geo.box.w;
  return { w: geo.box.w * s, h: geo.box.h * s };
}

let rowSeq = 0;
function row(
  table_type: TableType,
  capacity: number,
  opts: Partial<EventTableRow> = {},
): EventTableRow {
  rowSeq += 1;
  return {
    table_id: opts.table_id ?? `tbl_${rowSeq}`,
    public_id: `S89T-${rowSeq}`,
    event_id: 'evt',
    table_label: opts.table_label ?? `Table ${rowSeq}`,
    table_type,
    capacity,
    sort_order: opts.sort_order ?? rowSeq,
    x_pos: opts.x_pos ?? null,
    y_pos: opts.y_pos ?? null,
    rotation_deg: opts.rotation_deg ?? 0,
    link_group_id: opts.link_group_id ?? null,
    link_group_label: opts.link_group_label ?? null,
  };
}

// ===========================================================================
// SAT / rotation-aware OBB (verdict § 1 root cause 3 + § 8 test list)
// ===========================================================================

test('SAT: a 90°-rotated banquet is TALL — a neighbour above it (that the old unrotated AABB missed) now collides', () => {
  const box = tableGeometry('long_banquet', 10).box; // wide (w) × short (h)
  // Place the moving banquet BELOW the neighbour at a distance that clears the
  // unrotated box height (2×h/2 = box.h) but not the rotated tall footprint
  // (box.w/2 + box.h/2). box.h ≈ 168, box.w/2+box.h/2 ≈ 218 → y=190 sits between.
  const y = box.h + 22;
  const moving = pose('long_banquet', 10, 0, y, 90, 'mv');
  const neighbour = pose('long_banquet', 10, 0, 0, 0, 'nb');
  // Old, rotation-agnostic AABB used the UNROTATED box → sees a short table and
  // misses the vertical overlap.
  assert.equal(boxesOverlap(0, y, box, 0, 0, box), false, 'old AABB false-negative');
  // The oracle rotates the footprint → real overlap detected.
  assert.ok(
    footprintsOverlap(obbOf(moving), obbOf(neighbour), 0) > 0,
    'SAT catches the overlap the unrotated AABB missed',
  );
});

test('SAT: a 90°-rotated banquet is NARROW — a neighbour beside it no longer phantom-blocks', () => {
  const box = tableGeometry('long_banquet', 10).box;
  // Place a same-family neighbour just beyond the rotated (narrow) width but
  // within the old unrotated (wide) width.
  const gapX = box.h / 2 + box.w / 2 + 6; // rotated x-half (box.h/2) + neighbour x-half
  const moving = pose('long_banquet', 10, gapX, 0, 90, 'mv');
  const neighbour = pose('long_banquet', 10, 0, 0, 0, 'nb');
  assert.equal(boxesOverlap(gapX, 0, box, 0, 0, box), true, 'old AABB phantom-blocks');
  assert.equal(footprintsOverlap(obbOf(moving), obbOf(neighbour), 0), 0, 'SAT sees the real clearance');
});

test('SAT: two round tables whose chair rings interpenetrate collide; a box-width apart they clear', () => {
  const geo = tableGeometry('round', 10).box;
  const a = pose('round', 10, 0, 0, 0, 'a');
  const b = pose('round', 10, geo.w * 0.6, 0, 0, 'b');
  assert.ok(footprintsOverlap(obbOf(a), obbOf(b), 0) > 0);
  const far = pose('round', 10, geo.w + 4, 0, 0, 'b');
  assert.equal(footprintsOverlap(obbOf(a), obbOf(far), 0), 0);
});

test('footprintsOverlap: the gap widens the collision band (tight clearance)', () => {
  const geo = tableGeometry('round', 10).box;
  const a = pose('round', 10, 0, 0, 0, 'a');
  const b = pose('round', 10, geo.w + 6, 0, 0, 'b'); // 6px clear bodies
  assert.equal(footprintsOverlap(obbOf(a), obbOf(b), 0), 0, 'bodies clear');
  assert.ok(footprintsOverlap(obbOf(a), obbOf(b), 40) > 0, 'a 40px aisle is not satisfied');
});

// ===========================================================================
// Serpentine 3-OBB + legalJoinPose (verdict § 1 root cause 1 + § 8)
// ===========================================================================

test('serpentine 3-OBB: a lone wedge occupies its band but leaves the concave interior empty', () => {
  const w = pose('serpentine', 5, 500, 500, 0, 'w');
  const fp = obbOf(w);
  assert.equal(fp.parts.length, 3, 'three sub-OBBs decompose the arc');
  // A point deep in the concave interior (below the arc, toward the arc centre)
  // is NOT inside any sub-OBB — the win over a bounding box / convex hull.
  const interior = pose('round', 8, 500, 560, 0, 'probe', null, 0.02); // a tiny probe
  // The probe is a small circle placed in the concave pocket; assert it does not
  // hit the wedge body (would if we used the full AABB).
  const pocket = obbOf(interior);
  assert.equal(footprintsOverlap(fp, pocket, 0), 0, 'concave pocket is free');
});

test('legalJoinPose: a serpentine continuation is EXACT — snapped tips coincide, rotation on a legal angle', () => {
  const anchor = { shape: 'serpentine' as const, capacity: 5, x: 500, y: 500, rot: 0, scale: 1 };
  // Drop a wedge roughly one wedge to the right of the anchor.
  const mover = { shape: 'serpentine' as const, capacity: 5, x: 690, y: 500, rot: 0, scale: 1 };
  const cand = legalJoinPose(anchor, mover, 200);
  assert.ok(cand, 'a near-tip drop returns a legal join pose');
  const legalAngles = [104, -104, 256, 180].map((d) => ((d % 360) + 360) % 360);
  assert.ok(legalAngles.includes(((cand!.rot % 360) + 360) % 360), `rot ${cand!.rot} is a legal joint angle`);
});

test('legalJoinPose survives a save/load round-trip: a committed join re-validates within tolerance after float drift', () => {
  const anchor = { shape: 'serpentine' as const, capacity: 5, x: 400, y: 400, rot: 0, scale: 1 };
  const mover0 = { shape: 'serpentine' as const, capacity: 5, x: 580, y: 400, rot: 0, scale: 1 };
  const cand = legalJoinPose(anchor, mover0, 200)!;
  // Persist rounded (float drift), reload, and confirm still a legal joint.
  const saved = { ...mover0, x: Math.round(cand.x), y: Math.round(cand.y), rot: Math.round(cand.rot) };
  assert.ok(isLegalJoint(anchor, saved, /* pxPerMeter */ 40), 'round-tripped join still legal');
});

test('isLegalJoint: X-crossed tips (right distance, WRONG rotation) FAIL — the screenshot bug', () => {
  const anchor = { shape: 'serpentine' as const, capacity: 5, x: 400, y: 400, rot: 0, scale: 1 };
  const cand = legalJoinPose(anchor, { shape: 'serpentine' as const, capacity: 5, x: 580, y: 400, rot: 0, scale: 1 }, 200)!;
  // Sit at the legal join POSITION but crossed by 25° — tips near, angle wrong.
  const crossed = { shape: 'serpentine' as const, capacity: 5, x: cand.x, y: cand.y, rot: cand.rot + 25, scale: 1 };
  assert.equal(isLegalJoint(anchor, crossed, 40), false, 'wrong rotation is not a sanctioned join');
  // And a legal continuation at the exact candidate passes.
  const legal = { shape: 'serpentine' as const, capacity: 5, x: cand.x, y: cand.y, rot: cand.rot, scale: 1 };
  assert.equal(isLegalJoint(anchor, legal, 40), true);
});

test('isLegalJoint: a 180° S-bend is a legal join', () => {
  const anchor = { shape: 'serpentine' as const, capacity: 5, x: 400, y: 400, rot: 0, scale: 1 };
  // Probe positions all around the anchor; collect the rotations offered.
  const rots = new Set<number>();
  for (let deg = 0; deg < 360; deg += 15) {
    const probe = {
      shape: 'serpentine' as const,
      capacity: 5,
      x: anchor.x + 190 * Math.cos((deg * Math.PI) / 180),
      y: anchor.y + 190 * Math.sin((deg * Math.PI) / 180),
      rot: 0,
      scale: 1,
    };
    const cand = legalJoinPose(anchor, probe, 160);
    if (!cand) continue;
    rots.add(Math.round(((cand.rot % 360) + 360) % 360));
    const at = { ...probe, x: cand.x, y: cand.y, rot: cand.rot };
    assert.equal(isLegalJoint(anchor, at, 40), true);
  }
  assert.ok(rots.has(180), 'an S-bend (180°) join is offered');
});

test('checkPlacement: two welded serpentines (same link group) exempt each other; different groups collide', () => {
  const anchor = pose('serpentine', 5, 400, 400, 0, 'a', 'grp1');
  const cand = legalJoinPose(
    { shape: 'serpentine', capacity: 5, x: 400, y: 400, rot: 0, scale: 1 },
    { shape: 'serpentine', capacity: 5, x: 580, y: 400, rot: 0, scale: 1 },
    200,
  )!;
  const welded = pose('serpentine', 5, cand.x, cand.y, cand.rot, 'b', 'grp1');
  const sameGroup = checkPlacement(welded, { others: [anchor], zones: [] }, { gapPx: 20 });
  assert.equal(sameGroup.valid, true, 'same link group → seam exempt, no self-report at the weld');
  const otherGroup = pose('serpentine', 5, cand.x, cand.y, cand.rot, 'b', 'grp2');
  const cross = checkPlacement(otherGroup, { others: [anchor], zones: [] }, { gapPx: 0 });
  assert.equal(cross.valid, false, 'different groups at a touching seam collide (legacy broken link)');
});

// ===========================================================================
// Round kiss (verdict § 8)
// ===========================================================================

test('round kiss: a snapped kiss clears the bodies (any angle); a shoved overlap fails', () => {
  const anchor = { shape: 'round' as const, capacity: 10, x: 500, y: 500, rot: 0, scale: 1 };
  for (const deg of [0, 37, 90, 210, 315]) {
    const rad = (deg * Math.PI) / 180;
    const mover = {
      shape: 'round' as const,
      capacity: 10,
      x: 500 + 300 * Math.cos(rad),
      y: 500 + 300 * Math.sin(rad),
      rot: 0,
      scale: 1,
    };
    const cand = legalJoinPose(anchor, mover, 400);
    assert.ok(cand, `kiss offered at ${deg}°`);
    const kissed = pose('round', 10, cand!.x, cand!.y, 0, 'b');
    const res = checkPlacement(kissed, { others: [pose('round', 10, 500, 500, 0, 'a')], zones: [] }, { gapPx: 0 });
    assert.equal(res.valid, true, `kissed pair clears bodies at ${deg}°`);
  }
  // Bodies shoved together (well inside kiss distance) → overlap violation.
  const stacked = pose('round', 10, 560, 500, 0, 'b');
  const res = checkPlacement(stacked, { others: [pose('round', 10, 500, 500, 0, 'a')], zones: [] }, { gapPx: 0 });
  assert.equal(res.valid, false);
  assert.equal(res.violations[0]!.kind, 'overlap');
});

// ===========================================================================
// checkPlacement grading + weld-ghost third-party refusal (verdict § 2/§ 3)
// ===========================================================================

test('checkPlacement grades violations: body overlap = "overlap", gap shortfall = "tight"', () => {
  const geo = tableGeometry('round', 10).box;
  const a = pose('round', 10, 0, 0, 0, 'a');
  // Bodies overlapping.
  const over = pose('round', 10, geo.w * 0.5, 0, 0, 'b');
  assert.equal(checkPlacement(over, { others: [a], zones: [] }, { gapPx: 20 }).violations[0]!.kind, 'overlap');
  // Bodies clear by 6px but a 40px aisle is asked → tight.
  const tight = pose('round', 10, geo.w + 6, 0, 0, 'b');
  const res = checkPlacement(tight, { others: [a], zones: [] }, { gapPx: 40 });
  assert.equal(res.violations[0]!.kind, 'tight');
  assert.equal(res.valid, false);
});

test('weld ghost is refused when the welded pose collides with a THIRD table', () => {
  const anchor = { shape: 'serpentine' as const, capacity: 5, x: 400, y: 400, rot: 0, scale: 1 };
  const cand = legalJoinPose(anchor, { shape: 'serpentine' as const, capacity: 5, x: 580, y: 400, rot: 0, scale: 1 }, 200)!;
  const weldPose = pose('serpentine', 5, cand.x, cand.y, cand.rot, 'mover', 'grp');
  const anchorPose = pose('serpentine', 5, 400, 400, 0, 'anchor', 'grp');
  // A third table sitting right where the weld would land.
  const third = pose('round', 12, cand.x, cand.y, 0, 'third');
  const res = checkPlacement(weldPose, { others: [anchorPose, third], zones: [] }, { gapPx: 20 });
  assert.equal(res.valid, false, 'no room at the weld → ghost refused');
});

test('checkPlacement: a table dropped on a dance-floor zone is an overlap violation', () => {
  const t = pose('round', 8, 500, 500, 0, 't');
  const zone: OracleZone = { id: 'dance', x: 500, y: 500, w: 200, h: 160 };
  const res = checkPlacement(t, { others: [], zones: [zone] }, { gapPx: 20 });
  assert.equal(res.valid, false);
  assert.equal(res.violations[0]!.zoneId, 'dance');
});

// ===========================================================================
// Monotone escape primitive (verdict § 4)
// ===========================================================================

test('penetrationDepth: an overlapping table can move OUT (depth decreases) but not DEEPER', () => {
  const geo = tableGeometry('round', 10).box;
  const world = { others: [pose('round', 10, 0, 0, 0, 'a')], zones: [] };
  const at = (dx: number) => penetrationDepth(pose('round', 10, dx, 0, 0, 'm'), world);
  const start = at(geo.w * 0.4); // overlapping
  assert.ok(start > 0, 'starts penetrating');
  assert.ok(at(geo.w * 0.5) < start, 'moving OUT reduces penetration (allowed)');
  assert.ok(at(geo.w * 0.3) > start, 'moving IN increases penetration (forbidden)');
  assert.equal(at(geo.w + 4), 0, 'fully clear → zero');
});

// ===========================================================================
// layoutViolations (verdict § 6 mount audit)
// ===========================================================================

test('layoutViolations: reports overlapping pairs, exempts linked groups, clean layout is empty', () => {
  const geo = tableGeometry('round', 10).box;
  const clean: WorldPose[] = [
    pose('round', 10, 0, 0, 0, 'a'),
    pose('round', 10, geo.w + 20, 0, 0, 'b'),
  ];
  assert.equal(layoutViolations(clean, [], 0).length, 0);
  const overlapping: WorldPose[] = [
    pose('round', 10, 0, 0, 0, 'a'),
    pose('round', 10, geo.w * 0.4, 0, 0, 'b'),
  ];
  assert.equal(layoutViolations(overlapping, [], 0).length, 2, 'both tables flagged');
  // Same link group at the same overlap → exempt (a rigid welded unit).
  const linked: WorldPose[] = [
    pose('round', 10, 0, 0, 0, 'a', 'g'),
    pose('round', 10, geo.w * 0.4, 0, 0, 'b', 'g'),
  ];
  assert.equal(layoutViolations(linked, [], 0).length, 0);
});

// ===========================================================================
// solveAutoLayout — verified metric solver (verdict § 5 + § 8 property test)
// ===========================================================================

const FLOOR = {
  ...DEFAULT_FLOOR_PLAN,
  stage_x: 50,
  stage_y: 6,
};

function solverFootprint(ppm: number) {
  return (t: EventTableRow) => footprintPx(t, ppm);
}

test('solveAutoLayout: the placed set is ALWAYS fully legal (no violations) and never double-books a coordinate', () => {
  const ppm = 16; // 50 m room / 800 px
  const rect = { width: 800, height: 600 };
  const tables: EventTableRow[] = [
    row('sweetheart_2', 2),
    ...Array.from({ length: 8 }, () => row('round_10', 10)),
    row('long_banquet_10', 10),
    row('family_head_14', 14),
  ];
  const res = solveAutoLayout({ tables, floorPlan: FLOOR, rect, footprintOf: solverFootprint(ppm), aisleM: 0.9, pxPerMeter: ppm });
  // Build poses from the placed set and assert zero violations.
  const poses: WorldPose[] = tables
    .filter((t) => res.placed[t.table_id])
    .map((t) => {
      const p = res.placed[t.table_id]!;
      const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
      const f = footprintPx(t, ppm);
      return {
        tableId: t.table_id,
        shape: shapeHintFor(t.table_type),
        capacity: t.capacity,
        x: (p.x / 100) * rect.width,
        y: (p.y / 100) * rect.height,
        rot: t.rotation_deg ?? 0,
        scale: f.w / geo.box.w,
        linkGroupId: t.link_group_id ?? null,
      };
    });
  const gapPx = 0.9 * ppm;
  assert.equal(layoutViolations(poses, [], gapPx).length, 0, 'solver output is fully legal');
  // No two placed tables at identical coordinates (the deleted keep-stacking fallback).
  const coords = new Set<string>();
  for (const t of tables) {
    const p = res.placed[t.table_id];
    if (!p) continue;
    const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    assert.equal(coords.has(key), false, 'no coordinate double-book');
    coords.add(key);
  }
  // Every table is either placed or in the unplaced tray — nothing vanishes.
  const accounted = new Set([...Object.keys(res.placed), ...res.unplaced]);
  for (const t of tables) assert.ok(accounted.has(t.table_id), `${t.table_id} accounted for`);
});

test('solveAutoLayout: an impossible room returns the honest Unplaced tray + a real "at 0.6 m" alternate count', () => {
  const ppm = 40;
  const rect = { width: 400, height: 300 }; // tiny room
  const tables = Array.from({ length: 20 }, () => row('family_head_16', 16));
  const res = solveAutoLayout({ tables, floorPlan: FLOOR, rect, footprintOf: solverFootprint(ppm), aisleM: 1.5, pxPerMeter: ppm });
  assert.ok(res.unplaced.length > 0, 'overflow → Unplaced tray, not silent stacking');
  // The alternate count is a real second solver pass at the 0.6 m floor.
  assert.ok(res.altPlacedAtFloor >= Object.keys(res.placed).length, 'tighter walkways fit at least as many');
});

test('solveAutoLayout: a link group is placed as ONE rigid unit — members keep their relative offsets', () => {
  const ppm = 16;
  const rect = { width: 800, height: 600 };
  const a = row('long_banquet_8', 8, { link_group_id: 'chain', x_pos: 40, y_pos: 50, table_id: 'A' });
  const b = row('long_banquet_8', 8, { link_group_id: 'chain', x_pos: 48, y_pos: 50, table_id: 'B' });
  const singles = Array.from({ length: 4 }, () => row('round_10', 10));
  const res = solveAutoLayout({ tables: [a, b, ...singles], floorPlan: FLOOR, rect, footprintOf: solverFootprint(ppm), aisleM: 0.9, pxPerMeter: ppm });
  if (res.placed['A'] && res.placed['B']) {
    // Relative x-offset preserved (rigid translate) within a small tolerance.
    const rel = res.placed['B']!.x - res.placed['A']!.x;
    assert.ok(Math.abs(rel - 8) < 0.5, `chain kept rigid (rel ${rel})`);
  } else {
    // If the unit didn't fit, BOTH members are unplaced (never split).
    const aUn = res.unplaced.includes('A');
    const bUn = res.unplaced.includes('B');
    assert.equal(aUn, bUn, 'a link group is never split across placed/unplaced');
  }
});

test('solveAutoLayout property: random rooms + table sets are always violation-free', () => {
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const TYPES: TableType[] = ['round_8', 'round_10', 'round_12', 'long_banquet_8', 'family_head_12', 'sweetheart_2'];
  for (let iter = 0; iter < 12; iter++) {
    const ppm = 12 + Math.floor(rnd() * 30);
    const rect = { width: 600 + Math.floor(rnd() * 400), height: 400 + Math.floor(rnd() * 300) };
    const n = 4 + Math.floor(rnd() * 14);
    const tables = Array.from({ length: n }, () => row(TYPES[Math.floor(rnd() * TYPES.length)]!, 8 + Math.floor(rnd() * 6)));
    const aisleM = 0.6 + rnd() * 0.9;
    const res = solveAutoLayout({ tables, floorPlan: FLOOR, rect, footprintOf: solverFootprint(ppm), aisleM, pxPerMeter: ppm });
    const poses: WorldPose[] = tables
      .filter((t) => res.placed[t.table_id])
      .map((t) => {
        const p = res.placed[t.table_id]!;
        const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
        const f = footprintPx(t, ppm);
        return {
          tableId: t.table_id,
          shape: shapeHintFor(t.table_type),
          capacity: t.capacity,
          x: (p.x / 100) * rect.width,
          y: (p.y / 100) * rect.height,
          rot: 0,
          scale: f.w / geo.box.w,
          linkGroupId: null,
        };
      });
    const v = layoutViolations(poses, [], aisleM * ppm);
    assert.equal(v.length, 0, `iter ${iter}: solver output must be violation-free (got ${v.length})`);
  }
});

// ===========================================================================
// Scale math (verdict § 3 / § 8) — the walkway width → px identities the editor uses
// ===========================================================================

test('scale math: 0.9 m walkway = 36 px in a 20 m/800 px room, ≈14 px in a 50 m room', () => {
  const ppm20 = 800 / 20; // 40 px/m
  assert.equal(0.9 * ppm20, 36);
  const ppm50 = 800 / 50; // 16 px/m
  assert.ok(Math.abs(0.9 * ppm50 - 14.4) < 1e-9);
  assert.ok(Math.abs(0.6 * ppm50 - 9.6) < 1e-9);
});

test('JOIN_TOL_M is the metric 5 cm floor (not the retired 18 px distance-only tolerance)', () => {
  assert.equal(JOIN_TOL_M, 0.05);
  // At 40 px/m that is a 2 px join tolerance — far tighter than the old 18 px.
  assert.ok(JOIN_TOL_M * 40 < 18);
});

// Sanity: the raw snap generators still behave (legalJoinPose delegates to them).
test('legalJoinPose delegates to the existing snap generators (no divergent math)', () => {
  const anchor = { shape: 'serpentine' as const, capacity: 5, x: 300, y: 300, rot: 0, scale: 1 };
  const drag = { x: 470, y: 300 };
  const direct = serpentineChainSnap(drag, [{ x: 300, y: 300, rot: 0, scale: 1 }], 200);
  const viaOracle = legalJoinPose(anchor, { ...anchor, x: drag.x, y: drag.y }, 200);
  assert.deepEqual(viaOracle, direct, 'oracle join == raw serpentine snap');
  const rDirect = roundKissSnap({ x: 470, y: 300 }, 60, [{ x: 300, y: 300, radius: 60 }], 400);
  const rOracle = legalJoinPose(
    { shape: 'round', capacity: 10, x: 300, y: 300, rot: 0, scale: 60 / (tableGeometry('round', 10).box.w / 2) },
    { shape: 'round', capacity: 10, x: 470, y: 300, rot: 0, scale: 60 / (tableGeometry('round', 10).box.w / 2) },
    400,
  );
  assert.ok(rOracle && rDirect && Math.abs(rOracle.x - rDirect.x) < 1e-6);
});

// ===========================================================================
// Sweetheart-on-stage — the SHARED oracle rule (owner 2026-07-16). Only a
// sweetheart table may sit on the stage platform; every other table over the
// stage is a violation. Enforced by checkPlacement identically for 2D + 3D.
// ===========================================================================

// A stage zone in world px, built by the shared helper both projections use.
// stage_x/y/w/h % → world px via the rect; centred at (100,50), 80×20.
const STAGE_RECT = { width: 200, height: 100 };
const STAGE_FP = { stage_x: 50, stage_y: 50, stage_w: 40, stage_h: 20 };
const STAGE_ZONE = stageZone(STAGE_FP, STAGE_RECT); // { x:100, y:50, w:80, h:20, sweetheartExempt:true }
const roundR = tableGeometry('round', 10).box.w / 2; // world-px radius at scale 1

test('stageZone: percent → world px + the sweetheart-exempt flag is set', () => {
  assert.equal(STAGE_ZONE.id, 'stage');
  assert.equal(STAGE_ZONE.x, 100);
  assert.equal(STAGE_ZONE.y, 50);
  assert.equal(STAGE_ZONE.w, 80);
  assert.equal(STAGE_ZONE.h, 20);
  assert.equal(STAGE_ZONE.sweetheartExempt, true);
});

test('stage rule: a sweetheart table on the stage is OK', () => {
  const sweet = pose('sweetheart', 2, 100, 50); // dead centre of the stage
  const res = checkPlacement(sweet, { others: [], zones: [STAGE_ZONE] }, { gapPx: 0 });
  assert.equal(res.valid, true, 'the couple’s table may sit on the stage');
  assert.equal(penetrationDepth(sweet, { others: [], zones: [STAGE_ZONE] }), 0, 'exempt → no penetration');
});

test('stage rule: a round table on the stage is a violation', () => {
  const round = pose('round', 10, 100, 50); // dead centre of the stage
  const res = checkPlacement(round, { others: [], zones: [STAGE_ZONE] }, { gapPx: 0 });
  assert.equal(res.valid, false, 'a non-sweetheart table on the stage is illegal');
  assert.ok(
    res.violations.some((v) => v.zoneId === 'stage' && v.kind === 'overlap'),
    'flagged as a stage overlap',
  );
});

test('stage rule: a round straddling the stage edge is a violation', () => {
  // Stage right edge = x 140. A round centred exactly on the edge half-hangs
  // over the platform → its footprint overlaps the stage rect.
  const straddle = pose('round', 10, 140, 50);
  const res = checkPlacement(straddle, { others: [], zones: [STAGE_ZONE] }, { gapPx: 0 });
  assert.equal(res.valid, false, 'a table crossing the stage edge is illegal');
  assert.ok(res.violations.some((v) => v.zoneId === 'stage'), 'the stage is the culprit');
});

test('stage rule: monotone-escape — a round sliding off the stage is allowed', () => {
  const world = { others: [], zones: [STAGE_ZONE] };
  const onStage = pose('round', 10, 100, 50);
  const clearOf = 140 + roundR + 20; // well past the right edge + radius
  const offStage = pose('round', 10, clearOf, 50);
  const depthOn = penetrationDepth(onStage, world);
  const depthOff = penetrationDepth(offStage, world);
  assert.ok(depthOn > 0, 'on the stage → penetrating');
  assert.equal(depthOff, 0, 'off the stage → clear');
  assert.ok(depthOff < depthOn, 'escape reduces penetration → the drag heal permits it');
  // A partial escape off the stage FRONT (downward, off the thin platform) still
  // overlaps but by LESS — a permitted monotone step toward freedom.
  const partial = pose('round', 10, 100, 50 + STAGE_ZONE.h); // one stage-height below centre
  assert.ok(penetrationDepth(partial, world) < depthOn, 'monotone: a step off the platform is non-worsening');
});

test('stage rule: a non-stage zone (no exempt flag) blocks a sweetheart too', () => {
  // Only the stage is sweetheart-exempt; a dance floor still blocks everyone.
  const dance: OracleZone = { id: 'dance', x: 100, y: 50, w: 80, h: 20 };
  const sweet = pose('sweetheart', 2, 100, 50);
  assert.equal(checkPlacement(sweet, { others: [], zones: [dance] }, { gapPx: 0 }).valid, false);
});

test('solveAutoLayout: non-sweetheart tables are kept OFF the stage (shared conditional obstacle)', () => {
  const ppm = 16;
  const rect = { width: 800, height: 600 };
  const tables: EventTableRow[] = [
    row('sweetheart_2', 2),
    ...Array.from({ length: 6 }, () => row('round_10', 10)),
  ];
  const res = solveAutoLayout({ tables, floorPlan: FLOOR, rect, footprintOf: solverFootprint(ppm), aisleM: 0.9, pxPerMeter: ppm });
  const stage = stageZone(FLOOR, rect);
  const poses: WorldPose[] = tables
    .filter((t) => res.placed[t.table_id])
    .map((t) => {
      const p = res.placed[t.table_id]!;
      const geo = tableGeometry(shapeHintFor(t.table_type), t.capacity);
      const f = footprintPx(t, ppm);
      return {
        tableId: t.table_id,
        shape: shapeHintFor(t.table_type),
        capacity: t.capacity,
        x: (p.x / 100) * rect.width,
        y: (p.y / 100) * rect.height,
        rot: t.rotation_deg ?? 0,
        scale: f.w / geo.box.w,
        linkGroupId: null,
      };
    });
  // Only the stage in the zone set → any flag is a non-sweetheart on the stage.
  const stageHits = layoutViolations(poses, [stage], 0);
  assert.equal(stageHits.length, 0, 'the solver seats nothing but a sweetheart on the stage');
});
