/**
 * THE PROOF SUITE (Seat_Plan_2D3D_Sync_Council_Verdict_2026-07-16 · § 6).
 *
 * Merge-gated (runs in the required `test:unit` CI job, which globs every
 * `lib` test). Proves that the List, the 2D Plan and the 3D Plan are ONE model in
 * three projections: same room doc → both projection paths → identical world
 * poses within epsilon, including the connected S-bend the owner screenshotted.
 *
 * Anti-tautology (§ 6): tests enter through each view's REAL seam —
 *   · the 2D path uses `editorWorldPose` + the canvas-px→oracle→pct math the
 *     editor's render/drag actually call (`fitRoomToCell`/`canvasPxToPctM`);
 *   · the 3D path uses `pctToWorldM` + `legalJoinPoseM`, the lab's own helpers.
 * Re-forking either view's inline math therefore fails CI even if the shared lib
 * is intact.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROOM_M,
  roomBoxM,
  pctToWorldM,
  worldToPctM,
  metricGeometry,
  metricScale,
  metricPoseM,
  legalJoinPose,
  legalJoinPoseM,
  validateChainJointM,
  isLegalJoint,
  resolveHomePcts,
  fitRoomToCell,
  canvasPxToPctM,
  pctToCanvasPxM,
  editorWorldPose,
  serpentineChainSnap,
  serpentineFrame,
  rotatePoint,
  defaultTablePosition,
  weldCommitBatch,
  JOIN_TOL_M,
  type PoseM,
  type TableType,
} from './seating';
import { serpentineBand } from './seating-3d';
import { GOLDEN_ROOMS, GOLDEN_SIZED, GOLDEN_FREE, type GoldenTableRow } from './seating-golden-room.fixture';

const near = (a: number, b: number, eps: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg}: |${a} − ${b}| = ${Math.abs(a - b)} > ${eps}`);

// ── Real 2D-editor seam helpers (the exact math the render + drag call) ──────
function fitFor(room: { w: number; d: number }, canvasW: number) {
  return fitRoomToCell(room, canvasW, (canvasW * room.d) / room.w);
}
/** A table's world pose from the 2D editor's canvas-px seam (letterbox → px). */
function pose2Dpx(row: GoldenTableRow, room: { w: number; d: number }, canvasW: number): PoseM {
  const fit = fitFor(room, canvasW);
  const px = pctToCanvasPxM(row.x_pos!, row.y_pos!, fit);
  return {
    shape: metricPoseM(row, 0, 0, room).shape,
    capacity: row.capacity,
    x: px.x,
    y: px.y,
    rot: row.rotation_deg,
    scale: metricScale(row.table_type, row.capacity) * fit.pxPerMeter,
  };
}
/** Tips of a serpentine pose, in the pose's OWN units (metres for a metric pose,
 *  px for a px pose) — the local frame tip scaled by `pose.scale`, so the same
 *  helper serves both projections. */
function serpTipsM(pose: PoseM): Array<{ x: number; y: number }> {
  const f = serpentineFrame();
  return [f.endPlus, f.endMinus].map((t) => {
    const r = rotatePoint({ x: t.x * pose.scale, y: t.y * pose.scale }, pose.rot);
    return { x: pose.x + r.x, y: pose.y + r.y };
  });
}
function minTipGap(a: PoseM, b: PoseM): number {
  let m = Infinity;
  for (const p of serpTipsM(a)) for (const q of serpTipsM(b)) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y));
  return m;
}

// ===========================================================================
// T1 — Projection identity + round-trip (prompt requirement)
// ===========================================================================
test('T1 · pctToWorldM ∘ worldToPctM round-trips (< 1e-9 m) in both rooms', () => {
  for (const gr of GOLDEN_ROOMS) {
    const room = roomBoxM(gr.floor);
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() * 4 - 1.5) * room.w;
      const z = (Math.random() * 4 - 1.5) * room.d;
      const pct = worldToPctM(x, z, room);
      const back = pctToWorldM(pct.xPct, pct.yPct, room);
      near(back.x, x, 1e-9, `${gr.name} x`);
      near(back.z, z, 1e-9, `${gr.name} z`);
    }
  }
});

test('T1 · save-in-2D → project-to-3D: editorWorldPose ≡ pctToWorldM per row (< 1e-6 m)', () => {
  for (const gr of GOLDEN_ROOMS) {
    const room = roomBoxM(gr.floor);
    for (const t of gr.tables) {
      if (t.x_pos == null || t.y_pos == null) continue; // null rows → T6
      const threeD = pctToWorldM(t.x_pos, t.y_pos, room);
      for (const canvasW of [375, 768, 1400]) {
        const twoD = editorWorldPose(t, gr.floor, canvasW);
        near(twoD.x, threeD.x, 1e-6, `${gr.name}/${t.table_id} x @${canvasW}`);
        near(twoD.z, threeD.z, 1e-6, `${gr.name}/${t.table_id} z @${canvasW}`);
      }
    }
  }
});

// ===========================================================================
// T2 — Canvas independence (the Gun-B bug class dies here)
// ===========================================================================
test('T2 · editorWorldPose is identical at canvasW 1400 vs 375 (< 1e-6 m)', () => {
  for (const gr of GOLDEN_ROOMS) {
    for (const t of gr.tables) {
      if (t.x_pos == null || t.y_pos == null) continue;
      const big = editorWorldPose(t, gr.floor, 1400);
      const small = editorWorldPose(t, gr.floor, 375);
      near(big.x, small.x, 1e-6, `${gr.name}/${t.table_id} x`);
      near(big.z, small.z, 1e-6, `${gr.name}/${t.table_id} z`);
    }
  }
});

test('T2 · free-board inter-table metric vectors are identical at 375/768/1400 px', () => {
  const room = roomBoxM(GOLDEN_FREE.floor);
  const positioned = GOLDEN_FREE.tables.filter((t) => t.x_pos != null);
  const vecAt = (canvasW: number) => {
    const a = editorWorldPose(positioned[0]!, GOLDEN_FREE.floor, canvasW);
    const b = editorWorldPose(positioned[1]!, GOLDEN_FREE.floor, canvasW);
    return { dx: b.x - a.x, dz: b.z - a.z };
  };
  const ref = vecAt(768);
  assert.ok(room.isDefault, 'free board reads the default 20×30');
  for (const w of [375, 1400, 1920]) {
    const v = vecAt(w);
    near(v.dx, ref.dx, 1e-6, `free dx @${w}`);
    near(v.dz, ref.dz, 1e-6, `free dz @${w}`);
  }
});

test('T2 · canvasPxToPctM is cell-invariant (property: 20 layouts × varied cells)', () => {
  const room = { w: 20, d: 30 };
  for (let i = 0; i < 20; i++) {
    const xPct = Math.random() * 160 - 30;
    const yPct = Math.random() * 160 - 30;
    let ref: { xPct: number; yPct: number } | null = null;
    for (const [cw, ch] of [[375, 600], [768, 900], [1400, 700], [1920, 800]] as const) {
      const fit = fitRoomToCell(room, cw, ch);
      const px = pctToCanvasPxM(xPct, yPct, fit);
      const back = canvasPxToPctM(px, fit);
      if (ref === null) ref = back;
      near(back.xPct, ref.xPct, 1e-9, `xPct @${cw}×${ch}`);
      near(back.yPct, ref.yPct, 1e-9, `yPct @${cw}×${ch}`);
      near(back.xPct, xPct, 1e-9, 'xPct round-trip');
      near(back.yPct, yPct, 1e-9, 'yPct round-trip');
    }
  }
});

// ===========================================================================
// T3 — ONE geometry family (frozen goldens · demands an explicit bump on drift)
// ===========================================================================
test('T3 · metricGeometry(serpentine) ≡ serpentineBand adapter ≡ mesh band params (< 1e-9)', () => {
  const g = metricGeometry('serpentine', 5);
  const band = serpentineBand(); // the 3D adapter — now DERIVED from metricGeometry
  // Band bbox agreement (the mesh extrudes serpentineBand().outline).
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (const p of g.outlineM) {
    mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mny = Math.min(mny, p.y); mxy = Math.max(mxy, p.y);
  }
  near(mxx - mnx, band.bboxW, 1e-9, 'band bbox W');
  near(mxy - mny, band.bboxD, 1e-9, 'band bbox D');
  // Tips agreement (metric family tip ≡ 3D band tip, x→x, y→z).
  near(g.tipsM!.plus.x, band.endPlus.x, 1e-9, 'tip+ x');
  near(g.tipsM!.plus.y, band.endPlus.z, 1e-9, 'tip+ z');
  near(g.tipsM!.minus.x, band.endMinus.x, 1e-9, 'tip− x');
  near(g.tipsM!.minus.y, band.endMinus.z, 1e-9, 'tip− z');
});

test('T3 · FROZEN literals — an innocent tableGeometry tweak fails loudly (bbox 1.864 · tip rm 0.986 · S-bend 1.618 · continue 1.314)', () => {
  const b = metricGeometry('serpentine', 5).bandM!;
  near(b.ri, 0.788382, 1e-5, 'FROZEN Ri≈0.789 m — bump the golden + decide data-compat if this moved');
  near(b.ro, 1.182574, 1e-5, 'FROZEN Ro≈1.183 m');
  near(b.rm, 0.985478, 1e-5, 'FROZEN tip rm≈0.986 m');
  const bbW = (() => {
    let mn = Infinity, mx = -Infinity;
    for (const p of metricGeometry('serpentine', 5).outlineM) { mn = Math.min(mn, p.x); mx = Math.max(mx, p.x); }
    return mx - mn;
  })();
  near(bbW, 1.863761, 1e-5, 'FROZEN band bbox≈1.864 m');
  // S-bend + continue-circle centre distances (the connected-chain geometry).
  const room = { w: 20, d: 30 };
  const A: PoseM = metricPoseM({ table_type: 'serpentine' as TableType, capacity: 5, rotation_deg: 0 }, 50, 50, room);
  const tip = serpTipsM(A)[0]!; // +tip
  const sbendDrag = { ...A, x: 2 * tip.x - A.x, y: 2 * tip.y - A.y, rot: 180 };
  const sbend = legalJoinPoseM(A, sbendDrag)!;
  near(Math.hypot(sbend.x - A.x, sbend.y - A.y), 1.6183, 1e-3, 'FROZEN S-bend centre≈1.618 m');
  // Continue-circle: rotate A about its arc centre by the sweep.
  const f = serpentineFrame();
  const s = metricScale('serpentine' as TableType, 5);
  const cw = { x: A.x + rotatePoint({ x: f.centre.x * s, y: f.centre.y * s }, A.rot).x, y: A.y + rotatePoint({ x: f.centre.x * s, y: f.centre.y * s }, A.rot).y };
  const cv = rotatePoint({ x: A.x - cw.x, y: A.y - cw.y }, 104);
  const contDrag = { ...A, x: cw.x + cv.x, y: cw.y + cv.y, rot: 104 };
  const cont = legalJoinPoseM(A, contDrag)!;
  near(Math.hypot(cont.x - A.x, cont.y - A.y), 1.3144, 1e-3, 'FROZEN continue-circle centre≈1.314 m');
});

// ===========================================================================
// T4 — Golden S-bend cross-view (the owner's screenshot as a test)
// ===========================================================================
test('T4 · anchor (40%,55%,20°) → B snapped via 2D path ≡ 3D path (< 1e-6); server accepts from either view', () => {
  for (const gr of GOLDEN_ROOMS) {
    const room = roomBoxM(gr.floor);
    const A = gr.tables.find((t) => t.table_id === gr.sBend.anchorId)!;
    const B = gr.tables.find((t) => t.table_id === gr.sBend.moverId)!;

    // A drag point near the S-bend target (offset a hair so the snap must WORK).
    const aPoseM = metricPoseM(A, A.x_pos!, A.y_pos!, room);
    const tip = serpTipsM(aPoseM)[0]!;
    const targetM = { x: 2 * tip.x - aPoseM.x + 0.03, y: 2 * tip.y - aPoseM.y - 0.02 };
    const targetPct = worldToPctM(targetM.x, targetM.y, room);

    // (ii) 3D path: world → legalJoinPoseM → pct.
    const dragM: PoseM = { ...aPoseM, x: targetM.x, y: targetM.y, rot: (A.rotation_deg + 180) % 360 };
    const snap3D = legalJoinPoseM(aPoseM, dragM)!;
    const pct3D = worldToPctM(snap3D.x, snap3D.y, room);

    // (i) 2D path: canvas px → oracle (legalJoinPose) → pct.
    const canvasW = 1200;
    const fit = fitFor(room, canvasW);
    const aPosePx = pose2Dpx(A, room, canvasW);
    const dragPx = pctToCanvasPxM(targetPct.xPct, targetPct.yPct, fit);
    const moverPx: PoseM = { ...aPosePx, x: dragPx.x, y: dragPx.y, rot: (A.rotation_deg + 180) % 360 };
    const snap2D = legalJoinPose(aPosePx, moverPx, Math.max(fit.pxPerMeter, 200))!;
    const pct2D = canvasPxToPctM({ x: snap2D.x, y: snap2D.y }, fit);

    near(pct2D.xPct, pct3D.xPct, 1e-6, `${gr.name} xPct 2D≡3D`);
    near(pct2D.yPct, pct3D.yPct, 1e-6, `${gr.name} yPct 2D≡3D`);
    near(((snap2D.rot % 360) + 360) % 360, ((snap3D.rot % 360) + 360) % 360, 1e-6, `${gr.name} rot 2D≡3D`);

    // Both land on B's stored pose (the fixture's literal legalJoinPose output).
    near(pct3D.xPct, B.x_pos!, 1e-6, `${gr.name} snap ≡ stored B.xPct`);
    near(pct3D.yPct, B.y_pos!, 1e-6, `${gr.name} snap ≡ stored B.yPct`);

    // The server accepts the link from EITHER view (the ~0.44 m rejection is dead).
    const bPoseM = metricPoseM(B, B.x_pos!, B.y_pos!, room);
    assert.ok(validateChainJointM(aPoseM, bPoseM), `${gr.name} validateChainJointM(A,B)`);
    assert.ok(isLegalJoint(aPosePx, pose2Dpx(B, room, canvasW), fit.pxPerMeter), `${gr.name} isLegalJoint px`);

    // Tips coincide < JOIN_TOL_M/10 = 5 mm in BOTH projections.
    assert.ok(minTipGap(aPoseM, bPoseM) < JOIN_TOL_M / 10, `${gr.name} 3D tips < 5 mm`);
    const gapPx = minTipGap(aPosePx, pose2Dpx(B, room, canvasW)) / fit.pxPerMeter;
    assert.ok(gapPx < JOIN_TOL_M / 10, `${gr.name} 2D tips < 5 mm (${gapPx} m)`);
  }
});

test('T4 · pct→metres→pct at 3 room sizes keeps the golden joint legal', () => {
  const B = GOLDEN_SIZED.tables.find((t) => t.table_id === GOLDEN_SIZED.sBend.moverId)!;
  const A = GOLDEN_SIZED.tables.find((t) => t.table_id === GOLDEN_SIZED.sBend.anchorId)!;
  for (const dims of [{ w: 12, d: 18 }, { w: 20, d: 30 }, { w: 8, d: 8 }]) {
    // Re-place A at a fixed pct in the resized room, re-snap B, verify legality.
    const room = dims;
    const aPoseM = metricPoseM(A, A.x_pos!, A.y_pos!, room);
    const tip = serpTipsM(aPoseM)[0]!;
    const drag = { ...aPoseM, x: 2 * tip.x - aPoseM.x, y: 2 * tip.y - aPoseM.y, rot: (A.rotation_deg + 180) % 360 };
    const snap = legalJoinPoseM(aPoseM, drag)!;
    const pct = worldToPctM(snap.x, snap.y, room);
    const bPoseM = metricPoseM(
      { table_type: B.table_type, capacity: B.capacity, rotation_deg: snap.rot },
      pct.xPct,
      pct.yPct,
      room,
    );
    assert.ok(validateChainJointM(aPoseM, bPoseM), `joint legal @${room.w}×${room.d}`);
  }
});

// ===========================================================================
// T5 — Seam-closure property (200 random anchors × both ends × both joints)
// ===========================================================================
test('T5 · 200 random anchors: oracle mover passes validation + tips coincide ≤ 5 mm + pct round-trip < 1e-9', () => {
  const room = { w: 16, d: 24 };
  for (let i = 0; i < 200; i++) {
    const A: PoseM = {
      shape: 'serpentine',
      capacity: 1 + Math.floor(Math.random() * 5),
      x: (Math.random() - 0.5) * room.w,
      y: (Math.random() - 0.5) * room.d,
      rot: Math.random() * 360,
      scale: metricScale('serpentine' as TableType, 5),
    };
    const tips = serpTipsM(A);
    const which = Math.random() < 0.5 ? 0 : 1;
    const sBend = Math.random() < 0.5;
    let drag: PoseM;
    if (sBend) {
      const m = tips[which]!;
      drag = { ...A, x: 2 * m.x - A.x, y: 2 * m.y - A.y, rot: (A.rot + 180) % 360 };
    } else {
      const f = serpentineFrame();
      const s = A.scale;
      const cw = { x: A.x + rotatePoint({ x: f.centre.x * s, y: f.centre.y * s }, A.rot).x, y: A.y + rotatePoint({ x: f.centre.x * s, y: f.centre.y * s }, A.rot).y };
      const sgn = which === 0 ? 1 : -1;
      const cv = rotatePoint({ x: A.x - cw.x, y: A.y - cw.y }, sgn * 104);
      drag = { ...A, x: cw.x + cv.x, y: cw.y + cv.y, rot: (A.rot + sgn * 104 + 360) % 360 };
    }
    const snap = legalJoinPoseM(A, drag);
    assert.ok(snap, `snap resolves (i=${i})`);
    const B: PoseM = { ...A, x: snap!.x, y: snap!.y, rot: snap!.rot };
    assert.ok(validateChainJointM(A, B), `mover passes validateChainJointM (i=${i})`);
    assert.ok(minTipGap(A, B) <= JOIN_TOL_M / 10, `tips ≤ 5 mm (i=${i}, gap=${minTipGap(A, B)})`);
    const pct = worldToPctM(B.x, B.y, room);
    const back = pctToWorldM(pct.xPct, pct.yPct, room);
    near(back.x, B.x, 1e-9, `pct round-trip x (i=${i})`);
    near(back.z, B.y, 1e-9, `pct round-trip y (i=${i})`);
  }
});

// ===========================================================================
// T6 — Null-row home parity (pins BOTH call sites to the ONE resolver)
// ===========================================================================
test('T6 · NULL-x/y rows → identical home pct via the ED-resolver path AND the LP path', () => {
  for (const gr of GOLDEN_ROOMS) {
    const room = roomBoxM(gr.floor);
    // ED path — the shared resolver over the fetch-ordered rows.
    const edHomes = resolveHomePcts(gr.tables, room);
    // LP path — the lab loader's per-row `defaultTablePosition(i, total, spread)`.
    gr.tables.forEach((t, i) => {
      if (t.x_pos != null && t.y_pos != null) return;
      const lp = defaultTablePosition(i, gr.tables.length, room.isDefault);
      const ed = edHomes.get(t.table_id)!;
      near(ed.x, lp.x, 1e-12, `${gr.name}/${t.table_id} home x`);
      near(ed.y, lp.y, 1e-12, `${gr.name}/${t.table_id} home y`);
    });
  }
});

// ===========================================================================
// T7 — Regression pins (captured from main BEFORE the refactor)
// ===========================================================================
test('T7-i · #3307 — the 2D oracle candidate poses for the golden anchor are byte-identical', () => {
  // Anchor at px (500,400), rot 20°, cap-5 serpentine at ppm 60. The 2D family
  // is CANONICAL — a refactor that moved these snap numbers is a #3307 regression.
  const ppm = 60;
  const scale = metricScale('serpentine' as TableType, 5) * ppm;
  const anchor = { x: 500, y: 400, rot: 20, scale };
  const f = serpentineFrame();
  const tipW = rotatePoint({ x: f.endPlus.x * scale, y: f.endPlus.y * scale }, anchor.rot);
  const tip = { x: anchor.x + tipW.x, y: anchor.y + tipW.y };
  const sbend = serpentineChainSnap({ x: 2 * tip.x - anchor.x, y: 2 * tip.y - anchor.y }, [anchor], 200)!;
  near(sbend.x, 578.24107515895, 1e-6, '#3307 S-bend x');
  near(sbend.y, 457.49809814152354, 1e-6, '#3307 S-bend y');
  near(sbend.rot, 200, 1e-9, '#3307 S-bend rot');
  const cLocal = rotatePoint({ x: f.centre.x * scale, y: f.centre.y * scale }, anchor.rot);
  const cw = { x: anchor.x + cLocal.x, y: anchor.y + cLocal.y };
  const cv = rotatePoint({ x: anchor.x - cw.x, y: anchor.y - cw.y }, 104);
  const cont = serpentineChainSnap({ x: cw.x + cv.x, y: cw.y + cv.y }, [anchor], 200)!;
  near(cont.x, 524.3696249098224, 1e-6, '#3307 continue x');
  near(cont.y, 475.0019933920962, 1e-6, '#3307 continue y');
  near(cont.rot, 124, 1e-9, '#3307 continue rot');
});

test('T7-iii · commitWeld atomicity — one batch carries BOTH poses, zero lone rotation write', () => {
  const room = { w: 20, d: 30 };
  const mover = { tableId: 'B', xPct: 42, yPct: 58, rotationDeg: 200 };
  const anchor = { tableId: 'A', xPct: 40, yPct: 55, rotationDeg: 20 };
  const batch = weldCommitBatch(mover, anchor);
  assert.equal(batch.length, 2, 'one round trip carries both poses');
  const ids = batch.map((p) => p.tableId).sort();
  assert.deepEqual(ids, ['A', 'B'], 'batch drops both ids into one write');
  // Every entry carries position AND rotation together — never a lone rotation.
  for (const p of batch) {
    assert.ok(typeof p.xPct === 'number' && typeof p.yPct === 'number' && typeof p.rotationDeg === 'number', 'pos + rot atomic');
  }
  // The mover's pose is preserved verbatim (the snapped x/y/rot).
  const b = batch.find((p) => p.tableId === 'B')!;
  assert.deepEqual(b, mover, 'mover pose carried verbatim');
});

// ===========================================================================
// T8 — Render-seam guard (the editor's real positioning seam ≡ the projection)
// ===========================================================================
test('T8 · editorWorldPose (the render/drag seam) ≡ pctToWorldM — blocks the inline-math tautology', () => {
  // If the editor ever re-forks anisotropic per-axis math, editorWorldPose (which
  // MODELS the letterbox render seam) would diverge from the canonical pctToWorldM.
  for (const gr of GOLDEN_ROOMS) {
    const room = roomBoxM(gr.floor);
    for (const t of gr.tables) {
      if (t.x_pos == null) continue;
      const seam = editorWorldPose(t, gr.floor, 900);
      const canonical = pctToWorldM(t.x_pos, t.y_pos!, room);
      near(seam.x, canonical.x, 1e-6, `${gr.name}/${t.table_id} seam x`);
      near(seam.z, canonical.z, 1e-6, `${gr.name}/${t.table_id} seam z`);
    }
  }
  // And the default board denominator is the fixed 20×30 (never content-derived).
  assert.deepEqual({ w: DEFAULT_ROOM_M.w, d: DEFAULT_ROOM_M.d }, { w: 20, d: 30 });
});
