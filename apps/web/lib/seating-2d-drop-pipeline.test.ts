/**
 * Pipeline-level regression — the 2D editor DROP obeys the snap-back rule (owner
 * 2026-07-17 · "we want the tables to be undroppable instead when overlap"), the
 * pixel-space TWIN of `seating-3d-drop-pipeline.test.ts`.
 *
 * The 2D editor drags in canvas PERCENT → PIXELS (poseAt uses rect.width/height,
 * gap = aisleM · pxPerMeter), while the 3D lab drags in METRES. Both feed the
 * SAME pure oracle (`dropAccepted` / `checkPlacement`), which is scale-
 * homogeneous — every length in one surface is the other's × pxPerMeter, and the
 * oracle only compares lengths. So the identical five drop scenarios must reach
 * the identical verdict in px space as in metre space: PARITY by construction.
 *
 * The commit both surfaces run on release:
 *   valid  → persist the release pose(s);
 *   invalid → NO drop — persist the drag-START pose(s) (in the editor: don't
 *             write; `positions`/state already holds start → the CSS bounce or
 *             the mesh lerp animates the element back).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tableGeometry,
  TABLE_FOOTPRINT_M,
  checkPlacement,
  footprintsOverlap,
  obbOf,
  dropAccepted,
  // NEW (owner 2026-07-17): the 2D editor's marker release (stage / dance /
  // cocktail) now routes through the SAME shared zone-drop rule — the bypass this
  // editor left open (only `kind === 'table'` ever validated).
  zoneDropViolation,
  zoneDropAccepted,
  stageZone,
  legalJoinPose,
  type WorldPose,
  type OracleZone,
  type OracleParams,
  type TableType,
  type TableShapeHint,
} from './seating';

// The 2D editor's canvas is percent-addressed but the oracle runs in PIXELS. Use
// a concrete metre scale so the numbers read like a real sized room: a 20×30 m
// room rendered at 40 px/m → an 800×1200 px canvas, the editor's default 0.6 m
// walkway → a 24 px aisle. (poseAt: scale = footprintPx.w / geo.box.w.)
const PPM = 40; // px per metre
const AISLE_M = 0.6;
const PARAMS: OracleParams = { gapPx: AISLE_M * PPM }; // = gapPxNow() in the editor
const NO_ZONES: OracleZone[] = [];

function scaleOf(type: TableType, shape: TableShapeHint, capacity: number): number {
  const footprintPx = TABLE_FOOTPRINT_M[type] * PPM;
  return footprintPx / tableGeometry(shape, Math.max(1, capacity)).box.w;
}
// A round_10 pose at a PIXEL centre — the 2D editor's poseAt(round_10) shape.
function roundPx(id: string, xPx: number, yPx: number): WorldPose {
  return {
    tableId: id,
    shape: 'round',
    capacity: 10,
    x: xPx,
    y: yPx,
    rot: 0,
    scale: scaleOf('round_10', 'round', 10),
    linkGroupId: null,
  };
}
function overlapWith(anchor: WorldPose, xPx: number, yPx: number): number {
  return footprintsOverlap(obbOf(roundPx('mover', xPx, yPx)), obbOf(anchor), 0);
}

// THE commit rule (identical to the 3D twin): valid persists the drop, invalid
// persists the drag-start pose(s).
function simulateDrop(
  start: WorldPose[],
  drop: WorldPose[],
  others: WorldPose[],
  zones: OracleZone[],
  params: OracleParams,
): { accepted: boolean; persisted: WorldPose[] } {
  const accepted = dropAccepted(drop, others, zones, params);
  return { accepted, persisted: accepted ? drop : start };
}

const ANCHOR_X = 400; // px
const CY = 400;
// x px for a mover whose centre sits `m` metres to the right of the anchor.
const xAt = (m: number) => ANCHOR_X + m * PPM;

test('(a) drop OVER another table is refused — the persisted pose EQUALS the drag START (nothing written)', () => {
  const anchor = roundPx('anchor', ANCHOR_X, CY);
  const start = roundPx('mover', xAt(4.0), CY); // 4 m clear → valid start
  assert.equal(checkPlacement(start, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, true);
  const drop = roundPx('mover', ANCHOR_X, CY); // released dead-centre on the anchor
  assert.ok(overlapWith(anchor, ANCHOR_X, CY) > 1.0 * PPM, 'precondition: deep overlap at the release');

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, false);
  assert.deepEqual(res.persisted, [start], 'write equals origin — the table returns to its drag-start pose');
});

test('(b) a valid release PERSISTS exactly the dropped pose', () => {
  const anchor = roundPx('anchor', ANCHOR_X, CY);
  const start = roundPx('mover', xAt(4.0), CY);
  const drop = roundPx('mover', xAt(4.6), CY); // still clears the aisle
  assert.equal(checkPlacement(drop, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, true);

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, true);
  assert.deepEqual(res.persisted, [drop]);
});

test('(c) a legacy-overlapping table dragged OUT to a valid pose PERSISTS (healing works)', () => {
  const anchor = roundPx('anchor', ANCHOR_X, CY);
  const start = roundPx('mover', xAt(1.7), CY); // deep legacy overlap = its drag-start spot
  assert.equal(checkPlacement(start, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, false);
  const drop = roundPx('mover', xAt(4.0), CY);

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, true);
  assert.deepEqual(res.persisted, [drop], 'the heal is written — no table can get MORE stuck');
});

test('(d) a legacy-overlapping table dropped at ANOTHER invalid spot returns to ITS start (never stucker)', () => {
  const anchor = roundPx('anchor', ANCHOR_X, CY);
  const start = roundPx('mover', xAt(1.7), CY);
  assert.equal(checkPlacement(start, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, false);
  const drop = roundPx('mover', xAt(1.0), CY); // dragged EVEN DEEPER — still invalid
  assert.equal(checkPlacement(drop, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, false);

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, false);
  assert.deepEqual(res.persisted, [start], 'returns to its OWN start, not the deeper spot');
});

test('(e) a welded GROUP with an invalid release returns as a UNIT (both members to their starts)', () => {
  // Two serpentines snapped tip-to-tip (a legal joint) = a connective unit that
  // `dropAccepted` exempts from itself (atLegalJoint) — built via the editor's
  // own `legalJoinPose`. Pixel space.
  const serpScale = scaleOf('serpentine', 'serpentine', 5);
  const mk = (id: string, x: number, y: number, rot: number): WorldPose => ({
    tableId: id, shape: 'serpentine', capacity: 5, x, y, rot, scale: serpScale, linkGroupId: 'unit',
  });
  const aStart = mk('a', 200, 600, 0);
  const cand = legalJoinPose(
    { shape: 'serpentine', capacity: 5, x: aStart.x, y: aStart.y, rot: 0, scale: serpScale },
    { shape: 'serpentine', capacity: 5, x: 260, y: 600, rot: 0, scale: serpScale },
    240,
  );
  assert.ok(cand, 'the two serpentines form a legal joint');
  const bStart = mk('b', cand!.x, cand!.y, cand!.rot);
  assert.equal(dropAccepted([aStart, bStart], [], NO_ZONES, PARAMS), true, 'a welded pair is valid by construction');

  // Rigidly shift +280 px in x; a third round table sits exactly where `a` lands.
  const SHIFT = 280;
  const aDrop = mk('a', aStart.x + SHIFT, aStart.y, 0);
  const bDrop = mk('b', bStart.x + SHIFT, bStart.y, cand!.rot);
  const third = roundPx('third', aDrop.x, aDrop.y);
  assert.ok(
    footprintsOverlap(obbOf(aDrop), obbOf(third), 0) > 0.5 * PPM,
    'precondition: the shifted unit overlaps the third table',
  );

  const res = simulateDrop([aStart, bStart], [aDrop, bDrop], [third], NO_ZONES, PARAMS);
  assert.equal(res.accepted, false, 'if ANY member collides, the whole unit is refused');
  assert.deepEqual(res.persisted, [aStart, bStart], 'the WHOLE unit returns to its start poses');
});

// ── (f) THE 2D MARKER BYPASS, in pixel space (owner 2026-07-17) ────────────────
// The 2D editor already DRAGGED the stage / dance / cocktail markers, but only
// `kind === 'table'` releases ever hit the oracle — a marker could be dropped
// straight onto a table. Now marker release routes through `zoneDropViolation`,
// pixel-space parity with the 3D lab's `placeZoneAt`.
const ROOM_W_PX = 800; // 20 m × 40 px/m
const ROOM_H_PX = 1200; // 30 m × 40 px/m
function stagePx(xPx: number, yPx: number): OracleZone {
  return stageZone(
    { stage_x: (xPx / ROOM_W_PX) * 100, stage_y: (yPx / ROOM_H_PX) * 100, stage_w: 24, stage_h: 16 },
    { width: ROOM_W_PX, height: ROOM_H_PX },
  );
}

test('(f) dragging the STAGE marker onto a table is now refused + names it (the 2D marker bypass, fixed)', () => {
  const t = roundPx('t9', ANCHOR_X, CY);
  const stage = stagePx(ANCHOR_X, CY); // stage dropped on top of the table
  const hit = zoneDropViolation(stage, [t], [], PARAMS);
  assert.ok(hit, 'a stage-over-a-table release is a violation in the 2D editor too');
  assert.equal(hit!.otherId, 't9', 'the refusal names the specific table');
  assert.equal(zoneDropAccepted(stage, [t], [], PARAMS), false);
  // Moved to a clear corner → accepted.
  assert.equal(zoneDropAccepted(stagePx(140, 120), [t], [], PARAMS), true);
});
