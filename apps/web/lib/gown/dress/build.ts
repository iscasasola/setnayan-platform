/**
 * 👗 gown/dress/build — the gown from her posed body (prototype v189 `buildDress`, women): a bodice wrapped from the body
 * with an even ease, a skirt lofted from the fullest point (the hip ring, or the waist for a ball gown) so a full belly or
 * seat never makes a ridge, the chosen waistline, a hem that keeps its length where the body pushes it out, a train that
 * runs on along the floor, and slits that part. Owner rule: clothes follow the body; skirts hang from the fullest point.
 *
 * Writes the envelope's dress reach (`T.F`) and the dress grid (`D.r`, `D.y`, `D.t`, `D.cz`, `D.ang`) and lays it into
 * `D.geo` through `writeDress` (cloth.ts). Plain three.js maths: no DOM, no material.
 */
import * as THREE from 'three';
import { jointP, jointY } from '../body/bones';
import { BODY_K, RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import { apexOf } from '../body/tape';
import { GOWN_PETTI_HOLD } from '../fabric/types';
import { gownShapedVals } from '../body-rules';
import { GOWN_STRAPLESS } from '../../gown-config';
import { GOWN_BALL_HEM_CM, GOWN_EASE_MM, GOWN_SIL, GOWN_TRAIN_CM, gownFromWaist, hemPreset, gownIlluOuterTop, trainShare, waistY, type GownDressDesign, type GownNeckLandmarks } from './lines';
import { RING_COS, RING_SIN, envTabR, lerpRow, type GownEnvelope } from './table';

const N = RING_N, DY = SLICE_DY, DTH = TAU / N;

/** Where each slit opens (direction round her). */
export const GOWN_SLIT_ANGLE = { left: 0.55, right: -0.55, lside: 1.5, rside: -1.5, back: Math.PI } as const;

export type GownDress = {
  geo: THREE.BufferGeometry | null;
  rows: number;
  /** Bodice rows and skirt rows. */
  nb: number;
  ns: number;
  r: Float32Array; y: Float32Array; t: Float32Array; cz: Float32Array; ang: Float32Array;
  /** The hem lifted where the body pushes the cloth out (cloth keeps its length). */
  lift: Float32Array | null;
  fold: number;
  /** From the fabric (gownClothFeel): soft cloth falls in more folds; stiff cloth holds the skirt out. */
  foldK: number;
  hold: number;
  hemR: number;
  /** The train's length (model units) and which columns a slit opens. */
  Lt: number;
  slitQ: number[];
  L: GownNeckLandmarks | null;
  /** The fabric print's vertical range (the gmap's y), and whether the rest shape must be written again. */
  gmapY0: number;
  gmapY1: number;
  restDirty: boolean;
};

export function emptyDress(): GownDress {
  const z = new Float32Array(0);
  return { geo: null, rows: 0, nb: 48, ns: 0, r: z, y: z, t: z, cz: z, ang: z, lift: null, fold: 0.055, foldK: 1, hold: 1, hemR: 0, Lt: 0, slitQ: [], L: null, gmapY0: 0, gmapY1: 1, restDirty: true };
}

/** The lowest point of the posed body: the floor she stands on. */
export function floorOf(B: GownRig): number {
  let lo = 1e9;
  for (let i = 1; i < B.n * 3; i += 3) if (B.V[i]! < lo) lo = B.V[i]!;
  return lo;
}

/**
 * Build the dress on the posed body. `T` must hold the envelope of the same pose (buildEnvelope). `floorY` is where she
 * stands; `floorStand` is where she stood (the skirt is cut for her standing; seated, it keeps that length).
 */
export function buildDress(B: GownRig, T: GownEnvelope, D: GownDress, g: GownDressDesign, floorY: number, floorStand = floorY, view: { bustled?: boolean } = {}): GownDress {
  const P = B.P, V = B.V, k = BODY_K, off = GOWN_EASE_MM / 1000 / P.S, n = T.n, H = T.H, F = T.F, jF = Math.round((T.yF - T.y0) / DY);
  // v166: the smoothed bust point.
  let yA = 0, zA = -1e9;
  {
    const a = apexOf(B, 1), b = apexOf(B, -1);
    if (a && b) { yA = (a.y + b.y) / 2; zA = Math.max(a.z, b.z); }
    else for (const i of B.breastV) if (V[i * 3 + 2]! > zA) { zA = V[i * 3 + 2]!; yA = V[i * 3 + 1]!; }
  }
  // The underbust line (the fold under the breast), wherever the bust sits.
  let yUB = k.ubY;
  if (B.foldV.length) { yUB = 1e9; for (const i of B.foldV) yUB = Math.min(yUB, V[i * 3 + 1]!); }
  const front = Math.atan2(B.breastP.x * P.sUb, zA - B.zcAt(yA));
  const yN = jointY(B, 'neck01'), ySh = jointY(B, 'upperarm01.L');
  const L: GownNeckLandmarks = {
    yA, cup: Math.max(1, 1 + 0.8 * (P.b - 1)), front, yN, ySh, yW: k.yWaist, yUB,
    cm: 0.01 / P.S,
    fTop: g.neck === 'high' ? yN + 0.05 : yN - 0.012,
    // v166: the front goes down at most to the underbust line, following the bust point.
    fLow: Math.min(yUB, yA - 0.02),
    bTop: yN - 0.005,
    // The back goes down at most to her waist (and never below where the skirt starts).
    bLow: Math.max(k.yWaist, (gownFromWaist(g.sil) ? k.yWaist : T.yF) + 0.03),
  };
  // v199 `strapX` / `strapFrontAngle`: where a strap over the shoulder crosses it (the cape's strap line), and the direction
  // of its front end on the bodice at the top of the cups.
  {
    const xNk = envTabR(T, Math.PI / 2, yN), xUA = Math.abs(jointP(B, 'upperarm01.L', new THREE.Vector3()).x), xs = xNk + 0.45 * Math.max(0.02 / P.S, xUA - xNk), y = yA + 0.07 * L.cup;
    let a = 0.5;
    for (let it = 0; it < 3; it++) a = Math.asin(clamp(xs / Math.max(1e-4, envTabR(T, a, y)), 0.1, 0.99));
    L.strapA = clamp(a, 0.3, 1.0);
  }
  D.L = L;
  let topMax = 0;
  for (let q = 0; q < N; q++) {
    let ph = q * DTH;
    if (ph > Math.PI) ph = TAU - ph;
    // v198: the top edge as cut, which an illusion bodice or back reaches.
    T.top[q] = Math.min(gownIlluOuterTop(g, ph, L), T.y0 + (n - 3) * DY);
    if (T.top[q]! > topMax) topMax = T.top[q]!;
  }
  topTidy(T);
  const fl = floorY;
  const yHem0 = g.hemCm < 0 ? Math.max(fl + 0.012, fl + -g.hemCm / 100 / P.S) : hemPreset(B, fl, g.hem);
  // A train on a shorter skirt: high-low, the back falls to the floor.
  const hiLow = g.train !== 'none' && yHem0 > fl + 0.03, yHem = hiLow ? fl + 0.018 : yHem0;
  const jTop = Math.min(n - 1, Math.ceil((topMax - T.y0) / DY) + 2), jHem = Math.max(0, Math.floor((yHem - T.y0) / DY));
  T.jF = jF; T.jTop = jTop; T.jHem = jHem; T.yHem = yHem; T.on = true;
  // Bodice: the wrapped body plus an even offset, eased up and down so cloth bridges under the bust instead of tucking in.
  for (let j = jF; j <= jTop; j++) for (let q = 0; q < N; q++) F[j * N + q] = H[j * N + q]!;
  const col = new Float32Array(Math.max(n, N));
  const jSm = Math.min(jTop, Math.round((L.ySh + 0.01 - T.y0) / DY)); // bridge hollows up to the shoulder line
  for (let q = 0; q < N; q++) {
    for (let pass = 0; pass < 4; pass++) {
      for (let j = jF; j <= jTop; j++) col[j] = F[j * N + q]!;
      for (let j = jF + 1; j < jSm; j++) {
        const a = col[Math.max(jF, j - 2)]!, b = col[j - 1]!, c = col[j]!, d = col[j + 1]!, e = col[Math.min(jTop, j + 2)]!;
        F[j * N + q] = Math.max(H[j * N + q]!, (a + 4 * b + 6 * c + 4 * d + e) / 16);
      }
    }
  }
  const jW = Math.min(jTop, Math.round((k.yWaist - T.y0) / DY)); // below the waist cloth hangs: it never tucks back in under the tummy
  for (let j = jW - 1; j >= jF; j--) for (let q = 0; q < N; q++) F[j * N + q] = Math.max(F[j * N + q]!, F[(j + 1) * N + q]! - 0.0002);
  for (let j = jF; j <= jTop; j++) for (let q = 0; q < N; q++) F[j * N + q]! += off;
  for (const i of B.torsoV) {
    // The armhole rim: skin from triangles the wrap skipped (they touch the arm) stays inside too.
    const y = V[i * 3 + 1]!;
    if (y < L.ySh - 0.06 || B.aw[i]! < 0.08) continue;
    const fj = (y - T.y0) / DY, j0 = Math.floor(fj), cz = B.zcAt(Math.max(y, T.yF)), x = V[i * 3]!, z = V[i * 3 + 2]! - cz, r = Math.hypot(x, z) + off;
    let a = Math.atan2(x, z) / DTH;
    if (a < 0) a += N;
    for (let j = Math.max(jF, j0 - 1); j <= Math.min(jTop, j0 + 2); j++) for (let dq = -1; dq <= 2; dq++) { const o = j * N + ((Math.floor(a) + dq + N) % N); if (F[o]! < r) F[o] = r; }
  }
  // Skirt, lofted from the fullest point (the hip ring, or the waist for a ball gown). Each line sets how the ring grows on
  // the way down; where a knee or thigh reaches further, cloth rides over it and hangs.
  const sil = GOWN_SIL[g.sil] ?? GOWN_SIL.aline;
  const jS = gownFromWaist(g.sil) ? Math.max(jF + 1, Math.min(jW, jTop - 2)) : jF, yS = T.y0 + jS * DY, Lf = Math.max(0.2, yS - (floorStand + 0.018));
  const RB = F.slice(jS * N, jS * N + N), RH = F.slice(jF * N, jF * N + N);
  let hipR = 0, s0 = 0;
  for (let q = 0; q < N; q++) { hipR += RH[q]!; s0 += RB[q]!; }
  hipR /= N; s0 /= N;
  const soft = (u: number, c: number) => (u - c * (1 - Math.exp(-u / c))) / (1 - c * (1 - Math.exp(-1 / c)));
  // Accuracy review (v197): the mermaid releases at the knee, 55 % of the way from waist to floor (its cutting block's line).
  const yFl = g.sil === 'mermaid' ? Math.max(yHem + 0.12, k.yWaist - 0.55 * (k.yWaist - fl)) : -1;
  const E = new Float32Array(N), E2 = new Float32Array(N), A = new Float32Array(N), A0 = new Float32Array(N), BASE = new Float32Array(n * N), PUSH = new Float32Array(n * N), FP = new Float32Array(N);
  let gFl = 0;
  for (let q = 0; q < N; q++) { A[q] = RB[q]!; FP[q] = F[jS * N + q]!; }
  // The hem's size is asked in cm round (the cloth's folds add about half the fold depth).
  const cm1 = 0.01 / B.P.S, foldM = 1 + 0.5 * sil.fold * (D.foldK || 1), hipsCm = gownShapedVals(B.vals, g.shape).hips || B.vals.hips || 90;
  const aWS = !!sil.ease, TH = new Float32Array(N);
  let uH = 0, gA = 0, gBall = 0;
  if (aWS) {
    // At the hip: her hip tape plus the ease (cm round), all round; below it, on to about 3 × hips at the hem.
    uH = clamp((yS - T.yF) / Lf, 0.06, 0.6);
    let per = 0;
    for (let q = 0; q < N; q++) { const a = RH[q]! - off, b = RH[(q + 1) % N]! - off; per += Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(DTH)); }
    const kH = Math.max(1.02, ((hipsCm + sil.ease!) * cm1) / per);
    let m = 0;
    for (let q = 0; q < N; q++) { TH[q] = Math.max(RB[q]!, (RH[q]! - off) * kH); m += TH[q]!; }
    m /= N;
    gA = Math.max(0, (((sil.ratio ?? 3) * hipsCm) / TAU) * cm1 / foldM * 1.015 - m) * (D.hold || 1) * (GOWN_PETTI_HOLD[g.petti] || 1);
  }
  // A ball skirt's hem from its petticoat (the folds' peaks add about 3 % to a tape round the hem).
  if (g.sil === 'ball') gBall = (Math.max(GOWN_BALL_HEM_CM[g.petti] || 0, 2.5 * hipsCm) / TAU) * cm1 / foldM / 1.03 - s0;
  for (let j = jS - 1; j >= jHem; j--) {
    const y = T.y0 + j * DY, u = (yS - y) / Lf;
    if (sil.hang) {
      // Close lines: the cloth falls from the ring and may draw in only this fast.
      for (let q = 0; q < N; q++) A[q] = Math.max(H[j * N + q]! + off * 1.7, A[q]! - sil.hang * DY);
      E2.set(A);
      for (let pass = 0; pass < 3; pass++) { for (let q = 0; q < N; q++) col[q] = E2[q]!; for (let q = 0; q < N; q++) E2[q] = Math.max(A[q]!, (col[(q + N - 1) % N]! + 2 * col[q]! + col[(q + 1) % N]!) / 4); }
      A.set(E2);
      if (y < yFl) {
        if (!gFl) { A0.set(A); let m = 0; for (let q = 0; q < N; q++) m += A[q]!; gFl = Math.max(0.02, hipR * (sil.ratio ?? 2) - m / N); }
        const v = (yFl - y) / Math.max(0.1, yFl - (fl + 0.018)), gg = gFl * soft(Math.min(1, v), 0.12);
        for (let q = 0; q < N; q++) A[q] = Math.max(A[q]!, A0[q]! + gg);
      }
      if (g.sil === 'sheath') {
        // Accuracy review: a sheath never narrows below her hips less 6 cm, so she can walk.
        let m = 0;
        for (let q = 0; q < N; q++) m += A[q]!;
        m /= N;
        const need = (Math.max(0, hipsCm - 6) / TAU) * cm1;
        if (m < need) for (let q = 0; q < N; q++) A[q] = A[q]! + need - m;
      }
      for (let q = 0; q < N; q++) col[q] = A[q]!;
    } else if (aWS) {
      // A-line: straight off the waistline, past the hip with its ease, then on out to the hem.
      const uu = Math.min(1, u);
      if (uu <= uH) { const s1 = uu / uH; for (let q = 0; q < N; q++) col[q] = RB[q]! + (TH[q]! - RB[q]!) * s1; }
      else { const s1 = (uu - uH) / (1 - uH); for (let q = 0; q < N; q++) col[q] = TH[q]! + gA * s1; }
    } else {
      const gg = g.sil === 'ball' ? gBall * (1 - Math.pow(1 - Math.min(1, u), 1.7)) : (D.hold || 1) * (GOWN_PETTI_HOLD[g.petti] || 1) * (hipR * (sil.ratio ?? 2) - s0) * soft(Math.min(1, u), 0.06 / Lf);
      for (let q = 0; q < N; q++) col[q] = RB[q]! + gg;
    }
    // Below a bump (lap, knee, tummy) cloth hangs from its edge, nearly straight down; it flares only where the line is wider.
    for (let q = 0; q < N; q++) E[q] = Math.max(H[j * N + q]! + off * 1.7 - col[q]!, FP[q]! - 0.0015 - col[q]!, 0);
    E2.fill(0);
    const arc = DTH * Math.max(0.05, col[0]!); // each push becomes a soft round bulge, wider the further it pushes (no cone tips)
    for (let q0 = 0; q0 < N; q0++) {
      const e = E[q0]!;
      if (e <= 1e-5) continue;
      const W = clamp(3 + (1.2 * e) / arc, 3, 10) | 0;
      for (let d = -W; d <= W; d++) { const kk = 0.5 * (1 + Math.cos((Math.PI * d) / (W + 1))), o = (q0 + d + N) % N; if (e * kk > E2[o]!) E2[o] = e * kk; }
    }
    for (let q = 0; q < N; q++) { BASE[j * N + q] = col[q]!; PUSH[j * N + q] = E2[q]!; FP[q] = Math.max(col[q]! + E2[q]!, H[j * N + q]! + off * 1.7); }
  }
  for (let j = jHem + 1; j < jS; j++) for (let q = 0; q < N; q++) PUSH[j * N + q] = Math.max(PUSH[j * N + q]!, PUSH[(j - 1) * N + q]! * 0.88); // the cloth lifts a little above a knee, not at it
  for (let j = jHem; j < jS; j++) for (let q = 0; q < N; q++) F[j * N + q] = BASE[j * N + q]! + PUSH[j * N + q]!;
  if (g.waist !== 'natural') {
    // The skirt starts at the chosen waistline: fitted above it, its own flare below it.
    const old = Float32Array.from(F.subarray(0, n * N));
    const at = (y: number, q: number) => { const f = clamp((y - T.y0) / DY, jHem, jTop - 1.001), j = f | 0; return old[j * N + q]! + (old[(j + 1) * N + q]! - old[j * N + q]!) * (f - j); };
    // Accuracy review: an empire A-line falls nearly straight from under the bust (hem about 1.5 × hips), not a tent.
    let empG = 0;
    if (aWS && g.waist === 'empire') {
      const je = Math.min(jTop, Math.round((waistY(B, g.waist, 0) - T.y0) / DY));
      let m = 0;
      for (let q = 0; q < N; q++) m += F[je * N + q]!;
      empG = Math.max(0, ((1.5 * hipsCm) / TAU) * cm1 / foldM - m / N);
    }
    for (let q = 0; q < N; q++) {
      const wy = waistY(B, g.waist, q), st = gownFromWaist(g.sil) || g.waist === 'empire' ? wy : Math.min(wy, yS), d = yS - st;
      if (Math.abs(d) < 0.002) continue;
      for (let j = jHem; j <= jTop; j++) {
        const y = T.y0 + j * DY, o = j * N + q;
        if (y >= Math.max(st, yS)) continue; // above both: the bodice stays as it is
        if (d > 0 && y >= st) { F[o] = Math.max(H[o]! + off, Math.min(old[o]!, H[o]! + off * 2.2)); continue; } // fitted between
        if (d < 0 && g.sil !== 'ball') {
          // Empire on a column skirt: one smooth fall from under the bust to the hem.
          const rS = old[Math.min(jTop, Math.round((st - T.y0) / DY)) * N + q]!, u = clamp((st - y) / Math.max(0.05, st - (T.y0 + jHem * DY)), 0, 1);
          const rH = aWS ? rS + empG : old[jHem * N + q]!;
          F[o] = Math.max(H[o]! + off * 1.7, rS + (rH - rS) * (aWS ? u : u * (2 - u)));
          continue;
        }
        F[o] = Math.max(H[o]! + off, at(y + d, q));
      }
    }
  }
  {
    // Cloth rounds over a hip shelf or the bodice-skirt join instead of following a sharp step (never inside the body).
    const jW2 = Math.min(jTop - 1, Math.round((k.yWaist - T.y0) / DY)), jLo = Math.max(jHem + 1, jS - Math.round(0.22 / DY)), G3 = new Float32Array(n * N);
    if (!gownFromWaist(g.sil)) {
      for (let pass = 0; pass < 48; pass++) {
        G3.set(F.subarray(0, n * N));
        for (let j = jLo; j <= jW2; j++) for (let q = 0; q < N; q++) { const o = j * N + q; F[o] = Math.max(G3[o]!, H[o]! + off, (G3[o - N]! + 2 * G3[o]! + G3[o + N]!) / 4); }
      }
    }
  }
  // The columns each slit opens, and the slit's top.
  const hc = (q: number) => { if (!hiLow) return yHem; let ph = q * DTH; if (ph > Math.PI) ph = TAU - ph; return yHem0 + (yHem - yHem0) * smoothstep(ph, 0.45, 2.5); };
  const cutQ = new Set(g.slits.map((sn) => ((Math.floor(GOWN_SLIT_ANGLE[sn] / DTH) % N) + N) % N));
  {
    // Cloth keeps its length: where the body pushes a strip outward, that strip's hem rises by the extra length; strips
    // pull a little on their neighbours, but not across a slit.
    const lift = new Float32Array(N);
    for (let q = 0; q < N; q++) {
      let ex = 0;
      for (let j = jS - 1; j > jHem; j--) { const a = F[j * N + q]! - F[(j - 1) * N + q]!, b = BASE[j * N + q]! - BASE[(j - 1) * N + q]!; ex += Math.hypot(DY, a) - Math.hypot(DY, b); }
      lift[q] = clamp(ex, 0, 0.12);
    }
    for (let pass = 0; pass < 12; pass++) {
      const c2 = Float32Array.from(lift);
      for (let q = 0; q < N; q++) {
        const l = (q + N - 1) % N, r = (q + 1) % N, wl = cutQ.has(l) ? 0 : 1, wr = cutQ.has(q) ? 0 : 1;
        lift[q] = (2 * c2[q]! + wl * c2[l]! + wr * c2[r]!) / (2 + wl + wr);
      }
    }
    D.lift = lift;
  }
  {
    // Press the whole surface like finished fabric: each point eased towards its neighbours, never closer to the skin than the ease.
    const j0 = Math.max(1, jHem + 1), j1 = Math.min(jSm, n - 2), G = new Float32Array(F.subarray(0, n * N));
    for (let pass = 0; pass < 6; pass++) {
      G.set(F.subarray(0, n * N));
      for (let j = j0; j < j1; j++) for (let q = 0; q < N; q++) {
        const o = j * N + q, ql = j * N + ((q + N - 1) % N), qr = j * N + ((q + 1) % N);
        F[o] = Math.max(H[o]! + off, (4 * G[o]! + G[o - N]! + G[o + N]! + G[ql]! + G[qr]!) / 8);
      }
    }
  }
  if (g.boning !== 'soft') {
    // Boned bodice: bones hold the cloth in long straight lines over small rolls, while the waist's shape stays.
    const jU = Math.min(jTop - 1, Math.round((L.yA - 0.06 - T.y0) / DY)), jL = Math.max(jHem + 1, Math.round((T.yF - 0.02 - T.y0) / DY)), G2 = new Float32Array(N * n);
    for (let pass = 0; pass < 14; pass++) {
      G2.set(F.subarray(0, n * N));
      for (let j = jL; j <= jU; j++) for (let q = 0; q < N; q++) { const o = j * N + q; F[o] = Math.max(H[o]! + off, (2 * G2[o]! + G2[o - N]! + G2[o + N]!) / 4); }
    }
  }
  T.yS = yS;
  D.fold = sil.fold * (D.foldK || 1);
  // Mesh grid: one inner lip (a clean neckline edge), bodice rows from each column's own top, skirt rows to the hem.
  const nb = D.nb, ns = Math.max(4, Math.ceil((yS - yHem) / 0.02));
  // Bustled, the train is up off the floor: no train rows (v197).
  const Lt = g.train !== 'none' && !view.bustled ? GOWN_TRAIN_CM[g.train] / 100 / P.S : 0, nTr = Lt ? 16 : 0, rows = 1 + nb + 1 + ns + nTr;
  if (rows !== D.rows || !D.geo) {
    const geo = new THREE.BufferGeometry(), ix: number[] = [];
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows * N * 3), 3));
    for (let i = 0; i < rows - 1; i++) for (let q = 0; q < N; q++) { const a = i * N + q, b = i * N + ((q + 1) % N), c = a + N, d = b + N; ix.push(a, c, b, b, c, d); }
    // The cloth at rest: the fabric print is pinned to this, so it moves with the cloth.
    geo.setAttribute('rest', new THREE.BufferAttribute(new Float32Array(rows * N * 3), 3));
    geo.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(rows * N * 2), 2));
    geo.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(rows * N), 1));
    geo.setIndex(ix);
    D.r = new Float32Array(rows * N); D.y = new Float32Array(rows * N); D.t = new Float32Array(rows * N); D.cz = new Float32Array(rows * N); D.ang = new Float32Array(rows * N);
    D.geo?.dispose();
    D.geo = geo; D.rows = rows; D.ns = ns;
  }
  let hemR = 0;
  const TA = new Float32Array(rows * N);
  // Accuracy review (v197): bustled, the train's cloth goes somewhere. American: picked up to points under the waist seam
  // at the back, falling in a fan of folds; French: tucked under, a soft horizontal fold across the back of the skirt;
  // Ballroom: hooked up inside so the hem is even.
  const BU = ((): ((y: number, q: number, r: number) => number) | null => {
    const LtB = view.bustled && g.train !== 'none' ? GOWN_TRAIN_CM[g.train] : 0, kind = g.bustle;
    if (!LtB || (kind !== 'american' && kind !== 'french')) return null;
    const cm = 0.01 / P.S, amp = Math.min(13, 3 + 0.05 * LtB) * cm, yW = k.yWaist;
    if (kind === 'american') {
      const yP = yW - 7 * cm, picks = LtB > 100 ? [Math.PI - 0.42, Math.PI, Math.PI + 0.42] : LtB > 50 ? [Math.PI - 0.25, Math.PI + 0.25] : [Math.PI];
      return (y, q, r) => {
        if (y > yP + 1 * cm) return 0;
        let ph = q * DTH;
        if (ph < 0.5 * Math.PI) ph += TAU;
        const span = Math.max(20 * cm, (yP - yHem) * 0.55), sp = clamp((yP - y) / span, 0, 1), env = Math.sin(Math.PI * Math.pow(sp, 0.65)) * (1 - 0.35 * sp);
        let best = 1e9, fan = 0;
        for (const pk of picks) { const dx = (ph - pk) * Math.max(0.05, r), dd = Math.abs(dx); if (dd < best) { best = dd; fan = Math.atan2(dx, Math.max(0.3 * cm, yP - y)); } }
        const w = Math.exp(-((best / (14 * cm + (yP - y) * 0.45)) ** 2));
        return amp * env * w * (0.55 + 0.45 * Math.cos(fan * 9));
      };
    }
    // French: the tuck sits about halfway down the back of the skirt, a soft curve dipping at the centre.
    const yF = T.yF - 0.42 * (T.yF - yHem), wid = 6 * cm;
    return (y, q) => {
      let ph = q * DTH;
      if (ph > Math.PI) ph = TAU - ph;
      const bw = smoothstep(ph, 1.8, 2.6), yc = yF - 5 * cm * smoothstep(ph, 2.2, Math.PI), dd = (y - yc) / wid;
      return amp * 0.38 * bw * (Math.exp(-dd * dd) + 0.6 * Math.exp(-(((y - yc + 9 * cm) / wid) ** 2)) - 0.25 * Math.exp(-((dd + 0.9) ** 2)));
    };
  })();
  for (let q = 0; q < N; q++) T.hemQ[q] = hc(q); // each direction's hem, for lace and beads that follow it
  const onFloor = (q: number) => 1 - smoothstep(hc(q) - fl, 0.025, 0.08); // only where the hem reaches the floor does the train run on
  for (let i = 0; i < rows; i++) {
    for (let q = 0; q < N; q++) {
      const o = i * N + q;
      let y: number, t = 0, r: number;
      // v199: the inner lip stays under its neighbours' edge (no saw-tooth on a steep edge).
      if (i === 0) { y = Math.min(T.top[q]!, T.top[(q + 1) % N]!, T.top[(q + N - 1) % N]!) - 0.004; r = lerpRow(T, F, y, q) - 0.0045 / P.S; }
      else if (i <= nb + 1) { y = T.top[q]! + (yS - T.top[q]!) * ((i - 1) / nb); r = lerpRow(T, F, y, q); }
      else if (i > nb + 1 + ns) {
        // Train: the hem carried on along the floor, longest at centre back; eases onto the floor, a soft rise mid-train.
        const u = (i - nb - 1 - ns) / nTr;
        let ph = q * DTH;
        if (ph > Math.PI) ph = TAU - ph;
        const kf = onFloor(q), tw = trainShare(ph) * kf, ue = 1 - Math.pow(1 - u, 1.6), hy = hc(q) + (D.lift ? D.lift[q]! : 0);
        t = 1;
        y = hy + (fl + 0.003 - hy) * smoothstep(u, 0, 0.3) * kf + 0.012 * tw * Math.sin(Math.PI * u) * (1 - u);
        // Accuracy review (v197): the train runs straight back from the back hem, widening by about half its length at the
        // most, then tapers to a rounded end (not a round pool spreading to the sides).
        const r0 = lerpRow(T, F, hy, q) + Lt * tw * 0.14, sq = RING_SIN[q]!, cq = RING_COS[q]!, back = Lt * tw * 0.86 * ue, spread = 0.9 * back * Math.pow(Math.max(0, 1 - tw), 0.7) * Math.sign(sq);
        const px = r0 * sq + spread, pz = r0 * cq - back;
        r = Math.hypot(px, pz);
        let ta = Math.atan2(px, pz) - q * DTH;
        if (ta > Math.PI) ta -= TAU;
        if (ta < -Math.PI) ta += TAU;
        TA[o] = ta;
        y += (0.005 / P.S) * tw * Math.sin(Math.PI * u) * (0.5 + 0.5 * Math.cos(q * DTH * 11)); // a few soft folds along its length
        D.r[o] = r; D.y[o] = y; D.t[o] = t; D.cz[o] = B.zcAt(T.yF);
        continue;
      } else {
        t = (i - nb - 1) / ns;
        y = yS + (hc(q) - yS) * t + (D.lift ? D.lift[q]! : 0) * t * t;
        r = lerpRow(T, F, y, q);
        if (BU) r += BU(y, q, r);
        if (Lt) {
          // The back panels already lengthen on the way down, so the train is the skirt's own cloth.
          let ph = q * DTH;
          if (ph > Math.PI) ph = TAU - ph;
          const gg = smoothstep(t, 0.35, 1);
          r += Lt * trainShare(ph) * onFloor(q) * 0.14 * gg * gg;
        }
        if (yFl > 0) t = clamp((yFl - y) / (yFl - yHem), 0, 1);
        else if (sil.hang) t *= 0.35; // only free cloth swings
      }
      D.r[o] = r; D.y[o] = y; D.t[o] = t; D.cz[o] = B.zcAt(Math.max(y, T.yF));
      if (r > hemR) hemR = r;
    }
  }
  topRimTidy(B, T, D, g, nb, off);
  D.hemR = hemR;
  {
    // Slit: the seam between two columns opens from the slit top down to the hem; the cloth either side parts, wider
    // towards the hem (1 cm at the top to 5 cm each side lower down).
    const ang = D.ang, cut = new Map<number, number>();
    ang.set(TA); // the train's own turn away from straight out (it runs back, not round)
    for (const sn of g.slits) {
      const cs = ((Math.floor(GOWN_SLIT_ANGLE[sn] / DTH) % N) + N) % N, yTop = hc(cs) + g.slitCm / 100 / P.S;
      cut.set(cs, yTop);
      for (let o = (nb + 2) * N; o < rows * N; o++) {
        const depth = yTop - D.y[o]!;
        if (depth <= 0) continue;
        const q = o % N;
        let d = q - (cs + 0.5);
        if (d > N / 2) d -= N;
        if (d < -N / 2) d += N;
        const w = Math.max(0, 1 - (Math.abs(d) - 0.5) / 7), open = (1 + 4 * Math.min(1, (depth * P.S) / 0.4)) / 100 / P.S / Math.max(0.05, D.r[o]!);
        ang[o]! += Math.sign(d) * open * w;
      }
    }
    const ix: number[] = [];
    for (let i = 0; i < rows - 1; i++) {
      for (let q = 0; q < N; q++) {
        const ct = cut.get(q);
        if (ct !== undefined && i >= nb + 1 && D.y[(i + 1) * N + q]! < ct) continue;
        const a = i * N + q, b = i * N + ((q + 1) % N), c = a + N, d = b + N;
        ix.push(a, c, b, b, c, d);
      }
    }
    D.geo!.setIndex(ix);
    D.slitQ = [...cut.keys()];
  }
  D.Lt = Lt;
  D.gmapY0 = yHem - Lt - 0.05;
  D.gmapY1 = topMax + 0.03;
  D.restDirty = true;
  return D;
}

/**
 * Round the shoulders the top edge is eased column to column, so a V, high or bateau bodice has no pointed "ears" where
 * the armhole meets the shoulder (v199 `topTidy`). The V point, the sweetheart dip and a strap's peak (all nearer the
 * front) are left as cut.
 */
function topTidy(T: GownEnvelope): void {
  const w = new Float32Array(N), t = new Float32Array(N);
  for (let q = 0; q < N; q++) { let ph = q * DTH; if (ph > Math.PI) ph = TAU - ph; w[q] = smoothstep(ph, 0.85, 1.15) * (1 - smoothstep(ph, 2.25, 2.55)); }
  for (let pass = 0; pass < 4; pass++) {
    for (let q = 0; q < N; q++) t[q] = T.top[q]!;
    for (let q = 0; q < N; q++) { if (!w[q]) continue; const a = t[(q + N - 1) % N]!, c = t[(q + 1) % N]!; T.top[q] = t[q]! + w[q]! * ((a + 2 * t[q]! + c) / 4 - t[q]!); }
  }
}
/**
 * The top rows' radius eased round the shoulders (the armhole pass pushes single columns out), never closer to her than
 * the cloth's ease; a strapless cup is structured, so above the bust point its top edge stands up rather than falling
 * back onto the chest (no notch beside the cup on a full bust) (v199 `topRimTidy`).
 */
function topRimTidy(B: GownRig, T: GownEnvelope, D: GownDress, g: GownDressDesign, nb: number, off: number): void {
  const L = D.L;
  if (!L) return;
  const R = D.r, Y = D.y, yLo = L.ySh - 0.1 / B.P.S, rows = Math.min(nb + 1, 8), t = new Float32Array(N), w = new Float32Array(N);
  for (let q = 0; q < N; q++) { let ph = q * DTH; if (ph > Math.PI) ph = TAU - ph; w[q] = smoothstep(ph, 0.7, 1.0) * (1 - smoothstep(ph, 2.3, 2.6)); }
  for (let i = 0; i < rows; i++) for (let pass = 0; pass < 3; pass++) {
    const o0 = i * N;
    for (let q = 0; q < N; q++) t[q] = R[o0 + q]!;
    for (let q = 0; q < N; q++) {
      const o = o0 + q;
      if (!w[q] || Y[o]! < yLo) continue;
      const m = (t[(q + N - 1) % N]! + 2 * t[q]! + t[(q + 1) % N]!) / 4, floor = lerpRow(T, T.H, Y[o]!, q) + (i ? off * 0.7 : 0.0015 / B.P.S);
      R[o] = Math.max(floor, t[q]! + w[q]! * (m - t[q]!));
    }
  }
  if (GOWN_STRAPLESS.includes(g.neck) && g.neck !== 'off') {
    const yA = L.yA, lean = 0.3;
    for (let q = 0; q < N; q++) {
      let ph = q * DTH;
      if (ph > Math.PI) ph = TAU - ph;
      const wf = 1 - smoothstep(ph, 1.0, 1.4);
      if (!wf) continue;
      let rA = 0, yR = yA;
      for (let i = 1; i <= nb + 1; i++) { const o = i * N + q; if (Y[o]! <= yA + 0.005 && Y[o]! >= yA - 0.04 && R[o]! > rA) { rA = R[o]!; yR = Y[o]!; } }
      if (!rA) continue;
      for (let i = 0; i <= nb + 1; i++) { const o = i * N + q; if (Y[o]! <= yR) continue; const want = rA - lean * (Y[o]! - yR) - (i ? 0 : 0.0045 / B.P.S); if (R[o]! < want) R[o] = R[o]! + (want - R[o]!) * wf; }
    }
  }
}
