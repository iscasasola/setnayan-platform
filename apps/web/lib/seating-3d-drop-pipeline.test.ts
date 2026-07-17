/**
 * Pipeline-level regression — the 3D lab DROP does not persist a pose the oracle
 * rejects (owner 2026-07-17, live: "I dragged the round table on top of the
 * other … they just overlap. but both can still be clicked and picked up").
 *
 * PR #3349 proved two rounds *cannot* pass `checkPlacement` when placed
 * overlapping — but that validated the ORACLE, not the pointer PIPELINE. The
 * leak is in how the per-frame drag feeds the oracle: `onFloorMove` recomputed
 * the monotone-escape baseline (`curDepth`) EVERY FRAME from the running pose,
 * so a slow *continuous* drag ratchets ε deeper each frame — each step is
 * `≤ prevDepth + ε`, but `prevDepth` grows every frame, so the ceiling walks
 * inward and drives a round clean through its neighbour. `commitDrag` then
 * persists that pose with no single-table re-check.
 *
 * This suite reproduces the ACTUAL frame loop:
 *   (A) CHARACTERIZATION — the OLD running-depth resolver ratchets a clean-tight
 *       round straight through its neighbour (the bug, reproduced end-to-end).
 *   (B) FIX — the drag-start-anchored resolver (`resolveDragStep` +
 *       `dragEscapeBaseline`) NEVER lets total body penetration exceed
 *       startDepth + ε for the whole drag, so the same slow drag settles at
 *       contact, never a figure-8 — while OUT (healing a legacy overlap) is
 *       still always allowed.
 *
 * Both resolvers are exercised over the SAME pose builder the lab feeds the
 * oracle (`labRoundPose` — chair-inclusive round_10 footprint, metres).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tableGeometry,
  TABLE_FOOTPRINT_M,
  checkPlacement,
  penetrationDepth,
  footprintsOverlap,
  obbOf,
  // The extracted, testable decision core the OLD monotone-escape pipeline called
  // (kept as pure primitives; the editors no longer wire them — see § (D)).
  dragEscapeBaseline,
  escapeAccepts,
  resolveDragStep,
  // NEW — the snap-back COMMIT rule the pointer pipelines call on release
  // (owner 2026-07-17 · "undroppable when overlap"). `legalJoinPose` builds the
  // welded-pair pose for the group test.
  dropAccepted,
  legalJoinPose,
  type WorldPose,
  type OracleWorld,
  type OracleParams,
  type OracleZone,
  type TableType,
  type TableShapeHint,
} from './seating';

const ROOM = { w: 20, d: 30 }; // DEFAULT_ROOM_M — the lab's coordinate denominator.
const WALKWAY_M = 0.6; // the lab's default aisle.
const EPS_M = 0.02; // the plateau allowance (2 cm), matching the lab.

function scaleOfTable(type: TableType, shape: TableShapeHint, capacity: number): number {
  return TABLE_FOOTPRINT_M[type] / tableGeometry(shape, Math.max(1, capacity)).box.w;
}
// A round_10 pose at a room-percent centre — the lab's `oraclePose`, pxPerMeter=1.
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
const pctToWorldX = (xPct: number) => (xPct / 100) * ROOM.w;
const worldToPctX = (wx: number) => (wx / ROOM.w) * 100;
// Body overlap (metres) between the mover at a pct centre and the anchor.
function overlapWith(anchor: WorldPose, xPct: number, yPct: number): number {
  return footprintsOverlap(obbOf(labRoundPose('mover', xPct, yPct)), obbOf(anchor), 0);
}

// ── The OLD resolver: baseline RECOMPUTED from the running pose each frame ──────
// A faithful transcription of pre-fix `onFloorMove` (running curValid/curDepth).
function oldResolveStep(
  poseFor: (x: number, y: number) => WorldPose,
  desired: { x: number; y: number },
  cur: { x: number; y: number },
  world: OracleWorld,
  params: OracleParams,
): { x: number; y: number } {
  const curPose = poseFor(cur.x, cur.y);
  const curValid = checkPlacement(curPose, world, params).valid;
  const curDepth = curValid ? 0 : penetrationDepth(curPose, world); // ← RUNNING (the bug)
  const accept = (x: number, y: number): boolean => {
    const p = poseFor(x, y);
    if (checkPlacement(p, world, params).valid) return true;
    if (curValid) return false;
    return penetrationDepth(p, world) <= curDepth + EPS_M;
  };
  if (accept(desired.x, desired.y)) return { x: desired.x, y: desired.y };
  if (accept(desired.x, cur.y)) return { x: desired.x, y: cur.y };
  if (accept(cur.x, desired.y)) return { x: cur.x, y: desired.y };
  return { x: cur.x, y: cur.y };
}

// Drive a slow, CONTINUOUS drag of the mover from its start pct toward a world
// target, one small step/frame, returning the final settled pct pose.
function driveDrag(
  resolve: (desired: { x: number; y: number }, cur: { x: number; y: number }) => { x: number; y: number },
  startXPct: number,
  yPct: number,
  targetWorldX: number,
  stepM = 0.01,
): { x: number; y: number } {
  let cur = { x: startXPct, y: yPct };
  const startWx = pctToWorldX(startXPct);
  const dir = Math.sign(targetWorldX - startWx) || 1;
  const frames = Math.ceil(Math.abs(targetWorldX - startWx) / stepM) + 5;
  for (let f = 0; f < frames; f++) {
    // The pointer creeps toward the target; clamp so it never overshoots.
    const pointerWx = dir > 0
      ? Math.min(targetWorldX, startWx + dir * stepM * (f + 1))
      : Math.max(targetWorldX, startWx + dir * stepM * (f + 1));
    const desired = { x: worldToPctX(pointerWx), y: yPct };
    cur = resolve(desired, cur);
  }
  return cur;
}

// ===========================================================================
// (A) CHARACTERIZATION — the OLD running-depth resolver DRIVES THROUGH.
// ===========================================================================

test('(A) OLD running-depth pipeline ratchets a clean-tight round CLEAN THROUGH its neighbour (the bug)', () => {
  // Anchor at centre; mover starts 3.2 m away → walkway-tight (invalid) but
  // bodies separated (depth 0): the exact clean-looking layout the owner had.
  const anchor = labRoundPose('anchor', 50, 50);
  const world: OracleWorld = { others: [anchor], zones: [] };
  const params: OracleParams = { gapPx: WALKWAY_M };
  const startXPct = 50 + (3.2 / ROOM.w) * 100;
  assert.equal(
    checkPlacement(labRoundPose('mover', startXPct, 50), world, params).valid,
    false,
    'precondition: starts walkway-tight (invalid)',
  );
  assert.equal(overlapWith(anchor, startXPct, 50), 0, 'precondition: bodies separated at start');

  const final = driveDrag(
    (desired, cur) => oldResolveStep((x, y) => labRoundPose('mover', x, y), desired, cur, world, params),
    startXPct,
    50,
    anchor.x, // drag the pointer onto the anchor's centre
  );
  const overlap = overlapWith(anchor, final.x, final.y);
  // The running-depth ratchet drives the mover essentially on top of the anchor.
  assert.ok(overlap > 1.0, `expected deep interpenetration (figure-8), got ${overlap.toFixed(3)} m`);
});

// ===========================================================================
// (B) FIX — the drag-start-anchored resolver NEVER drives through.
// ===========================================================================

test('(B) start-anchored pipeline: the SAME slow drag settles at contact — total penetration ≤ ε', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const world: OracleWorld = { others: [anchor], zones: [] };
  const params: OracleParams = { gapPx: WALKWAY_M };
  const startXPct = 50 + (3.2 / ROOM.w) * 100;

  // Baseline captured ONCE at drag start (from the start pose), then held.
  const base = dragEscapeBaseline(labRoundPose('mover', startXPct, 50), world, params);
  assert.equal(base.startValid, false, 'started walkway-tight');
  assert.equal(base.startDepth, 0, 'started body-separated → startDepth 0');

  const final = driveDrag(
    (desired, cur) =>
      resolveDragStep((x, y) => labRoundPose('mover', x, y), desired, cur, world, params, base, EPS_M),
    startXPct,
    50,
    anchor.x,
  );
  const overlap = overlapWith(anchor, final.x, final.y);
  // Bounded by startDepth (0) + ε: the mover may graze to contact, never through.
  assert.ok(overlap <= base.startDepth + EPS_M + 1e-9, `penetration ${overlap.toFixed(4)} m must stay ≤ ε`);
  assert.ok(overlap < 0.05, `no figure-8: overlap ${overlap.toFixed(4)} m ≪ a table`);
});

test('(B) a fully-CLEAN round can never be dragged into ANY overlap (startValid → refuse all invalid)', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const world: OracleWorld = { others: [anchor], zones: [] };
  const params: OracleParams = { gapPx: WALKWAY_M };
  const startXPct = 50 + (4.0 / ROOM.w) * 100; // 4 m apart → fully valid (clears walkway)
  const base = dragEscapeBaseline(labRoundPose('mover', startXPct, 50), world, params);
  assert.equal(base.startValid, true, 'started fully clean');

  const final = driveDrag(
    (desired, cur) =>
      resolveDragStep((x, y) => labRoundPose('mover', x, y), desired, cur, world, params, base, EPS_M),
    startXPct,
    50,
    anchor.x,
  );
  // A clean table holds the aisle: the settled pose is still fully oracle-valid.
  assert.equal(checkPlacement(labRoundPose('mover', final.x, final.y), world, params).valid, true);
  assert.equal(overlapWith(anchor, final.x, final.y), 0, 'zero body overlap');
});

test('(B) healing still works — an already-overlapped round drags APART to a valid pose', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const world: OracleWorld = { others: [anchor], zones: [] };
  const params: OracleParams = { gapPx: WALKWAY_M };
  const startXPct = 50 + (1.7 / ROOM.w) * 100; // 1.7 m → deep legacy overlap
  const base = dragEscapeBaseline(labRoundPose('mover', startXPct, 50), world, params);
  assert.equal(base.startValid, false);
  assert.ok(base.startDepth > 1.0, 'starts deep in a legacy overlap');

  // Drag OUT toward a far-clear target (4 m past the anchor on the same side).
  const final = driveDrag(
    (desired, cur) =>
      resolveDragStep((x, y) => labRoundPose('mover', x, y), desired, cur, world, params, base, EPS_M),
    startXPct,
    50,
    pctToWorldX(50 + (4.0 / ROOM.w) * 100),
  );
  assert.equal(
    checkPlacement(labRoundPose('mover', final.x, final.y), world, params).valid,
    true,
    'the legacy overlap heals fully out',
  );
});

// ===========================================================================
// (C) The extracted predicate is anchored to the BASELINE, not the argument.
// ===========================================================================

test('(C) escapeAccepts judges against the fixed baseline (deeper-than-start is refused even step-by-step)', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const world: OracleWorld = { others: [anchor], zones: [] };
  const params: OracleParams = { gapPx: WALKWAY_M };
  const startXPct = 50 + (3.2 / ROOM.w) * 100; // tight, depth 0
  const base = dragEscapeBaseline(labRoundPose('mover', startXPct, 50), world, params);

  // A pose that body-overlaps by 0.1 m is > startDepth(0)+ε → refused, no matter
  // how gradually the drag arrived there.
  const deepXPct = 50 + ((2.8 - 0.1) / ROOM.w) * 100; // centres 2.7 m → 0.1 m overlap
  assert.ok(overlapWith(anchor, deepXPct, 50) > 0.05);
  assert.equal(escapeAccepts(labRoundPose('mover', deepXPct, 50), world, params, base, EPS_M), false);

  // A body-separated pose inside the walkway band (depth 0) is accepted (lateral
  // shuffle / heal-out is fine).
  const bandXPct = 50 + (3.0 / ROOM.w) * 100; // tight but no body overlap
  assert.equal(escapeAccepts(labRoundPose('mover', bandXPct, 50), world, params, base, EPS_M), true);
});

// ===========================================================================
// (D) SNAP-BACK DROP RULE (owner 2026-07-17 · "undroppable when overlap").
//     Supersedes the monotone-escape COMMIT semantics above: the in-drag pose
//     follows the pointer freely, and enforcement lives at RELEASE. `commitDrag`
//     (3D lab) / `onCanvasPointerUp` (2D editor) both call the SAME pure
//     `dropAccepted` rule — valid release persists, invalid release is NO drop
//     and returns to the drag-START pose (the mesh eases back / the CSS bounces
//     back). This models that exact commit at the pipeline level. The 2D twin is
//     `seating-2d-drop-pipeline.test.ts` (same rule, pixel space → parity).
// ===========================================================================

const PARAMS: OracleParams = { gapPx: WALKWAY_M };
const NO_ZONES: OracleZone[] = [];

// THE commit: valid → persist the release pose(s); invalid → persist the START
// pose(s) (in the editors: don't write; state already holds start → animate back).
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
const xAt = (metresFromCentre: number) => 50 + (metresFromCentre / ROOM.w) * 100;

test('(D)(a) drop OVER another table is refused — the persisted pose EQUALS the drag START (nothing written)', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const start = labRoundPose('mover', xAt(4.0), 50); // 4 m clear → a valid start
  assert.equal(checkPlacement(start, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, true);
  const drop = labRoundPose('mover', 50, 50); // released dead-centre on the anchor
  assert.ok(overlapWith(anchor, 50, 50) > 1.0, 'precondition: the release deeply overlaps the anchor');

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, false, 'an overlapping release is NOT accepted');
  assert.deepEqual(res.persisted, [start], 'write equals origin — the table returns to its drag-start pose');
});

test('(D)(b) a valid release PERSISTS exactly the dropped pose', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const start = labRoundPose('mover', xAt(4.0), 50);
  const drop = labRoundPose('mover', xAt(4.6), 50); // slid further out — still clears the walkway
  assert.equal(checkPlacement(drop, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, true);

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, true);
  assert.deepEqual(res.persisted, [drop], 'a legal drop is written as-is');
});

test('(D)(c) a legacy-overlapping table dragged OUT to a valid pose PERSISTS (healing works)', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const start = labRoundPose('mover', xAt(1.7), 50); // deep legacy overlap = its drag-start spot
  assert.equal(checkPlacement(start, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, false);
  const drop = labRoundPose('mover', xAt(4.0), 50); // dragged fully clear

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, true, 'a violating table CAN escape to a valid pose');
  assert.deepEqual(res.persisted, [drop], 'the heal is written — no table can get MORE stuck');
});

test('(D)(d) a legacy-overlapping table dropped at ANOTHER invalid spot returns to ITS start (never stucker)', () => {
  const anchor = labRoundPose('anchor', 50, 50);
  const start = labRoundPose('mover', xAt(1.7), 50); // its own legacy-overlap spot
  assert.equal(checkPlacement(start, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, false);
  const drop = labRoundPose('mover', xAt(1.0), 50); // dragged EVEN DEEPER — still invalid
  assert.equal(checkPlacement(drop, { others: [anchor], zones: NO_ZONES }, PARAMS).valid, false);

  const res = simulateDrop([start], [drop], [anchor], NO_ZONES, PARAMS);
  assert.equal(res.accepted, false);
  assert.deepEqual(res.persisted, [start], 'returns to its OWN start, not the deeper spot');
});

test('(D)(e) a welded GROUP with an invalid release returns as a UNIT (both members to their starts)', () => {
  // A genuine connective unit: two serpentines snapped tip-to-tip (a legal joint),
  // so `dropAccepted` exempts them from each other (atLegalJoint) — the join is
  // valid by construction. Build it via the same `legalJoinPose` the editors use.
  const serpScale = scaleOfTable('serpentine', 'serpentine', 5);
  const mk = (id: string, x: number, y: number, rot: number): WorldPose => ({
    tableId: id, shape: 'serpentine', capacity: 5, x, y, rot, scale: serpScale, linkGroupId: 'unit',
  });
  const aStart = mk('a', 5, 15, 0);
  const cand = legalJoinPose(
    { shape: 'serpentine', capacity: 5, x: aStart.x, y: aStart.y, rot: 0, scale: serpScale },
    { shape: 'serpentine', capacity: 5, x: 7, y: 15, rot: 0, scale: serpScale },
    12,
  );
  assert.ok(cand, 'the two serpentines form a legal joint');
  const bStart = mk('b', cand!.x, cand!.y, cand!.rot);
  // The welded pair alone is oracle-clean (sibling exempt via the legal joint).
  assert.equal(dropAccepted([aStart, bStart], [], NO_ZONES, PARAMS), true, 'a welded pair is valid by construction');

  // Rigidly shift the unit +7 m in x and drop a third round table exactly where
  // member `a` lands — so the release collides even though the joint is clean.
  const aDrop = mk('a', aStart.x + 7, aStart.y, 0);
  const bDrop = mk('b', bStart.x + 7, bStart.y, cand!.rot);
  const third = { ...labRoundPose('third', 50, 50), x: aDrop.x, y: aDrop.y };
  assert.ok(
    footprintsOverlap(obbOf(aDrop), obbOf(third), 0) > 0.5,
    'precondition: the shifted unit overlaps the third table',
  );

  const res = simulateDrop([aStart, bStart], [aDrop, bDrop], [third], NO_ZONES, PARAMS);
  assert.equal(res.accepted, false, 'if ANY member collides, the whole unit is refused');
  assert.deepEqual(res.persisted, [aStart, bStart], 'the WHOLE unit returns to its start poses');
});
