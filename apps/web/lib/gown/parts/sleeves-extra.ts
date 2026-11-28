/**
 * 👗 gown/parts/sleeves-extra — v203's puff, bishop and Juliet sleeves, the off-shoulder ruffle band, cape sleeves'
 * band, and the over-robe's own sleeves (prototype v203 `slxSkin`, `slxClear`, `slxExtra`, `slxTube`, `slxCrease`,
 * `slxUnstick`, `slxArm`, `slxRobeSleeve`, `slxRuffleBack`, `slxMetres`). Women only.
 *
 * The full sleeves and bands are the sleeve's own tube (rows along the arm, columns round it), so they morph, hide with
 * the gown and take the sleeve fabric like any sleeve. Fullness is a soft profile along the arm (never a balloon: about
 * 12 cm at most), with gathers where they are sewn. Where the arm lies against her body or the skirt, the cloth is
 * pressed flat between them, never through. A set-in sleeve starts where it leaves her body (the armhole), never inside.
 * Plain three.js maths on the posed body.
 */
import * as THREE from 'three';
import type { GownConfig, GownSleeveExtra } from '../../gown-config';
import { jointP } from '../body/bones';
import { SLICE_DY, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import { GOWN_EASE_MM } from '../dress/lines';
import { czOf, envTopAt, reach, type GownEnvelope } from '../dress/table';
import { SLEEVE_COLS, SLEEVE_ROWS } from './sleeves-grid';

const SNA = SLEEVE_COLS, SNR = SLEEVE_ROWS, SDS = 0.02, SBA = 16;
type V3 = THREE.Vector3;
type Frame = { t: V3; r: V3; v: V3 };
/** The arm a sleeve is laid on (as `buildGownSleeve` measures it). */
export type GownSleeveArm = { S: V3; E: V3; W: V3; u: V3; f: V3; Lu: number; Lf: number; frame: (s: number) => Frame; ctr: (s: number) => V3; Rs: (s: number, a: number) => number; s0: number };

/** v203 `SLX_GATHER`: how much each new sleeve is gathered (for its fabric). */
export const GOWN_SLEEVE_GATHER: Record<GownSleeveExtra, number> = { puff: 1.8, bishop: 1.5, juliet: 1.4, ruffle: 2.5, capesl: 1.3 };

/**
 * Her posed skin in 2.5 cm cells inside a box: the signed distance of a point from the nearest skin vertex, along that
 * vertex's normal (v203 `slxSkin`). Deep inside her it looks further, shell by shell, so it never reads as outside.
 */
function skinSd(B: GownRig, lo: number[], hi: number[]): { sd: (x: number, y: number, z: number) => number; n: number[] } {
  const V = B.V, NM = B.geo.attributes.normal ? (B.geo.attributes.normal.array as Float32Array) : null, h = 0.025 / B.P.S, grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => Math.floor(x / h) + 500 + 1000 * (Math.floor(y / h) + 500) + 1e6 * (Math.floor(z / h) + 500);
  if (NM) for (let i = 0; i < B.n; i++) {
    const x = V[i * 3]!, y = V[i * 3 + 1]!, z = V[i * 3 + 2]!;
    if (x < lo[0]! || x > hi[0]! || y < lo[1]! || y > hi[1]! || z < lo[2]! || z > hi[2]!) continue;
    const k = key(x, y, z);
    let L = grid.get(k);
    if (!L) grid.set(k, (L = []));
    L.push(i);
  }
  const n = [0, 0, 0];
  const sd = (x: number, y: number, z: number) => {
    let bd = 1e9, bi = -1;
    for (let g = 0; g <= 4; g++) {
      for (let dx = -g; dx <= g; dx++) for (let dy = -g; dy <= g; dy++) for (let dz = -g; dz <= g; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < g) continue;
        const L = grid.get(key(x + dx * h, y + dy * h, z + dz * h));
        if (!L) continue;
        for (const i of L) { const d = (x - V[i * 3]!) ** 2 + (y - V[i * 3 + 1]!) ** 2 + (z - V[i * 3 + 2]!) ** 2; if (d < bd) { bd = d; bi = i; } }
      }
      if (bi >= 0 && bd <= (g * h) ** 2) break;
    }
    if (bi < 0 || !NM) return 1e9;
    const nx = NM[bi * 3]!, ny = NM[bi * 3 + 1]!, nz = NM[bi * 3 + 2]!, nl = Math.hypot(nx, ny, nz) || 1;
    n[0] = nx / nl; n[1] = ny / nl; n[2] = nz / nl;
    return ((x - V[bi * 3]!) * nx + (y - V[bi * 3 + 1]!) * ny + (z - V[bi * 3 + 2]!) * nz) / nl;
  };
  return { sd, n };
}

/** The test every point of a full sleeve must pass: outside her skin, and below the armpit outside her body and the gown (v203 `slxClear`). */
export type GownSleeveOk = ((p: V3) => boolean) & { out: (p: V3) => V3 };
export function gownSleeveClear(B: GownRig, T: GownEnvelope, S: V3, W: V3, off: number): GownSleeveOk {
  const pad = 0.3 / B.P.S, lo = [Math.min(S.x, W.x) - pad, Math.min(S.y, W.y) - pad, Math.min(S.z, W.z) - pad], hi = [Math.max(S.x, W.x) + pad, Math.max(S.y, W.y) + pad, Math.max(S.z, W.z) + pad];
  const k = skinSd(B, lo, hi), yPit = S.y - 0.05, tableTop = T.y0 + (T.n - 2) * SLICE_DY;
  const ok = ((p: V3) => {
    if (k.sd(p.x, p.y, p.z) < off) return false;
    if (p.y < yPit && p.y < tableTop && p.y > T.y0) { const e = reach(T, p.x, p.y, p.z); if (e.r < e.env + off) return false; }
    return true;
  }) as GownSleeveOk;
  // Out of the nearest skin along its own normal (the crease of a bent elbow).
  ok.out = (p: V3) => {
    for (let it = 0; it < 3; it++) {
      const d = k.sd(p.x, p.y, p.z);
      if (d >= off || d < -0.06 / B.P.S) break;
      const n = k.n, s = off - d + 0.0005 / B.P.S;
      p.x += n[0]! * s; p.y += n[1]! * s; p.z += n[2]! * s;
    }
    return p;
  };
  return ok;
}

type Fill = { e: number; fl: number; lift?: number; sag?: number; nf?: number };
/** Fullness along the arm in cm, for a column from s1 to s2 (s from the shoulder joint, model units) (v203 `slxExtra`). */
export function gownSleeveFill(kind: GownSleeveExtra, s: number, s1: number, s2: number, c: { Lu: number; Lf: number; cm: number; detach: boolean }): Fill {
  const { Lu, Lf, cm, detach } = c, x = (s - s1) / cm, L = Math.max(1e-3, (s2 - s1) / cm);
  const bell = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.9));
  // A detachable sleeve starts with its own gathered band (elastic inside).
  const band = detach ? 2.5 : 0;
  if (kind === 'puff') {
    const g0 = Math.max(1, band), bd = 2.5;
    if (x < g0 || x > L - bd) return { e: 0.3, fl: 0.35 };
    const t = (x - g0) / (L - bd - g0), e = 0.3 + 3.1 * bell(t);
    return { e, fl: 0.22 * e + 0.3 * (1 - smoothstep(t, 0, 0.18)) + 0.3 * smoothstep(t, 0.82, 1), lift: e };
  }
  if (kind === 'juliet') {
    const sJ = Math.max(s1 + 8 * cm, 0.5 * Lu), LJ = (sJ - s1) / cm, g0 = Math.max(1, band);
    if (x < g0) return { e: 0.3, fl: 0.35 };
    if (x < LJ) { const t = (x - g0) / (LJ - g0), e = 0.3 + 2.7 * bell(t); return { e, fl: 0.22 * e + 0.3 * (1 - smoothstep(t, 0, 0.18)) + 0.3 * smoothstep(t, 0.82, 1), lift: e }; }
    return { e: 0.25 + 0.3 * clamp((s - sJ) / Math.max(1e-3, s2 - sJ), 0, 1), fl: 0 };
  }
  if (kind === 'bishop') {
    const cuffTop = L - 4.5;
    if (x < band) return { e: 0.4, fl: 0.3 };
    if (x > cuffTop) return { e: 0.35, fl: 0.15 };
    const full = 0.6 + 0.9 * clamp(s / Lu, 0, 1) + 3.6 * smoothstep(s, 0.7 * Lu, Lu + 0.62 * Lf), dropT = smoothstep(x, cuffTop - 4, cuffTop + 0.3);
    const e = 0.35 + (full - 0.35) * (1 - Math.pow(dropT, 1.6)) * smoothstep(x, band, band + 3);
    return { e, fl: 0.2 * e + 0.35 * smoothstep(x, cuffTop - 3, cuffTop), sag: e };
  }
  if (kind === 'ruffle') {
    const t = clamp(x / L, 0, 1), e = 0.5 + 2.4 * Math.pow(Math.sin(Math.PI * t), 0.7) + 1.3 * smoothstep(x, L - 2.2, L);
    return { e, fl: 0.35 + 0.5 * Math.pow(Math.sin(Math.PI * t), 0.7) + 0.7 * smoothstep(x, L - 2.2, L), nf: 12 };
  }
  // Cape sleeves: the band round the upper arm.
  const t = clamp(x / L, 0, 1), e = 0.45 + 0.55 * Math.pow(Math.sin(Math.PI * t), 0.8);
  return { e, fl: 0.3, nf: 14 };
}

/** A bent elbow: no point of the sleeve inside the upper arm or the forearm (v203 `slxCrease`). */
function crease(pos: Float32Array, c: GownSleeveArm & { off: number }, ok: GownSleeveOk) {
  const { S, E, u, f, Lu, Lf, frame, Rs, off } = c, p = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Vector3(), A = SNA + 1;
  for (let o = 0; o < SNR * A * 3; o += 3) {
    p.set(pos[o]!, pos[o + 1]!, pos[o + 2]!);
    let moved = false;
    for (let it = 0; it < 3; it++) {
      d.copy(p).sub(S);
      const t1 = clamp(d.dot(u), 0, Lu), d1 = d.addScaledVector(u, -t1).length();
      d.copy(p).sub(E);
      const t2 = clamp(d.dot(f), 0, Lf), d2 = d.addScaledVector(f, -t2).length();
      const s = d1 <= d2 ? t1 : Lu + t2;
      q.copy(d1 <= d2 ? S : E).addScaledVector(d1 <= d2 ? u : f, d1 <= d2 ? t1 : t2);
      d.copy(p).sub(q);
      const dist = d.length();
      if (dist < 1e-6) break;
      const fr = frame(s);
      let a = (Math.atan2(d.dot(fr.v), d.dot(fr.r)) / TAU) * SNA;
      a = ((a % SNA) + SNA) % SNA;
      const need = Rs(s, a) + off;
      if (dist >= need) break;
      p.copy(q).addScaledVector(d, need / dist);
      moved = true;
    }
    if (moved) { ok.out(p); pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; }
  }
}

/** Where her arm sinks into her body, the cloth takes the straight way across from the nearest free cloth either side (v203 `slxUnstick`). */
function unstick(pos: Float32Array, stuck: Uint8Array, ok: GownSleeveOk, lite: boolean) {
  const A = SNA + 1, p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < SNR; i++) for (let a = 0; a < SNA; a++) {
    if (!stuck[i * A + a]) continue;
    let l = 1, r2 = 1;
    while (l < SNA && stuck[i * A + ((a - l + SNA) % SNA)]) l++;
    while (r2 < SNA && stuck[i * A + ((a + r2) % SNA)]) r2++;
    if (l + r2 >= SNA) continue;
    const oa = (i * A + ((a - l + SNA) % SNA)) * 3, ob = (i * A + ((a + r2) % SNA)) * 3, w = l / (l + r2), o = (i * A + a) * 3;
    q.set(pos[oa]! + (pos[ob]! - pos[oa]!) * w, pos[oa + 1]! + (pos[ob + 1]! - pos[oa + 1]!) * w, pos[oa + 2]! + (pos[ob + 2]! - pos[oa + 2]!) * w);
    p.set(pos[o]!, pos[o + 1]!, pos[o + 2]!);
    if (ok(q) || !ok(p)) { pos[o] = q.x; pos[o + 1] = q.y; pos[o + 2] = q.z; }
  }
  if (!lite) for (let i = 0; i < SNR; i++) for (let a = 0; a < SNA; a++) { const o = (i * A + a) * 3; p.set(pos[o]!, pos[o + 1]!, pos[o + 2]!); ok.out(p); pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; }
  // The seam column closes the ring.
  for (let i = 0; i < SNR; i++) { const o = i * A * 3, e = (i * A + SNA) * 3; pos[e] = pos[o]!; pos[e + 1] = pos[o + 1]!; pos[e + 2] = pos[o + 2]!; }
}

/**
 * One full sleeve (or a band) on the sleeve's own mesh (v203 `slxTube`): where each column starts (level with a strapless
 * bodice's edge, or where the arm leaves her body), where it ends (above the elbow, at the wrist), and its fullness.
 * Returns each column's length.
 */
export function gownSleeveTube(B: GownRig, T: GownEnvelope, kind: GownSleeveExtra, arm: GownSleeveArm, o: { strapless: boolean; yCut: number; off: number; cm: number; detach: boolean; laceCm: number; lite?: boolean }, pos: Float32Array, uvA: Float32Array): Float32Array {
  const { S, W, Lu, Lf, frame, ctr, Rs, s0 } = arm, { strapless, yCut, off, cm, detach } = o;
  const A = SNA + 1, K = SNR - 1, Y = new THREE.Vector3(0, 1, 0), sW = Lu + Lf - 0.025, ok = gownSleeveClear(B, T, S, W, off), st = new Float32Array(A), en = new Float32Array(A);
  // The arm's widest reach at each quarter bin (memo).
  const RmC = new Map<number, number>(), Rmax = (s: number) => { const q = Math.round((s / SDS) * 4); let m = RmC.get(q); if (m === undefined) { m = 0; for (let a = 0; a < SNA; a += 2) m = Math.max(m, Rs((q * SDS) / 4, a)); RmC.set(q, m); } return m; };
  const ring = (s: number, aa: number, r: number) => { const ang = (aa / SNA) * TAU, fr = frame(s); return ctr(s).addScaledVector(fr.r, r * Math.cos(ang)).addScaledVector(fr.v, r * Math.sin(ang)); };
  for (let a = 0; a < A; a++) {
    const aa = a % SNA;
    let sA = strapless ? s0 : -0.035;
    if (strapless) {
      // Level with the bodice edge, and never inside her at the armpit.
      for (let it = 0; it < 90; it++) { if (ring(sA, aa, Rs(sA, aa)).y <= yCut) break; sA += 0.004; }
      for (let it = 0; it < 45; it++) { if (ok(ring(sA, aa, Rs(sA, aa) + off * 1.5))) break; sA += 0.004; }
    } else for (let it = 0; it < 60; it++) { if (ok(ring(sA, aa, Rs(sA, aa) + off * 1.5))) break; sA += 0.004; } // a set-in sleeve: from where it leaves her body
    // A ruffle band is one piece round the arms and across the back: it sits at the bodice edge either way.
    if (detach && kind !== 'ruffle') sA += 3 * cm;
    st[a] = sA;
  }
  for (let a = 0; a < A; a++) { const s1 = st[a]!; en[a] = kind === 'puff' ? Math.max(s1 + 9 * cm, 0.62 * Lu) : kind === 'bishop' || kind === 'juliet' ? sW : s1 + (kind === 'ruffle' ? 8.5 : 5) * cm; }
  // The band above the elbow is one ring, square to the arm.
  if (kind === 'puff') { let m = 0; for (let a = 0; a < A; a++) m = Math.max(m, en[a]!); en.fill(m); }
  // A cuff never sinks into her where the hand rests on her hip.
  if (kind === 'bishop' || kind === 'juliet') for (let a = 0; a < A; a++) for (let it = 0; it < 25; it++) {
    if ([0, 1, 2, 3].every((k2) => { const s3 = en[a]! - k2 * 0.7 * cm; return ok(ring(s3, a % SNA, Rs(s3, a % SNA) + off)); })) break;
    en[a] = en[a]! - 0.004;
  }
  const p = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(), lens = new Float32Array(A), stuck = new Uint8Array(SNR * A), cc = { Lu, Lf, cm, detach };
  for (let a = 0; a < A; a++) {
    const aa = a % SNA, ang = (aa / SNA) * TAU, s1 = st[a]!, s2 = en[a]!;
    lens[a] = s2 - s1;
    for (let i = 0; i <= K; i++) {
      const w = i / K, s = s1 + (s2 - s1) * w, fr = frame(s), X = gownSleeveFill(kind, s, s1, s2, cc), c0 = ctr(s);
      d.copy(fr.r).multiplyScalar(Math.cos(ang)).addScaledVector(fr.v, Math.sin(ang));
      const rA = Rs(s, aa) + off, rR = Rmax(s) + off, k = clamp(X.e / 1.5, 0, 1) * 0.85, nf = X.nf || (kind === 'bishop' ? 9 : 10), fl = (X.fl || 0) * (0.5 + 0.5 * Math.cos(nf * ang + 0.7));
      const r = rA + (rR - rA) * k + (X.e + fl) * cm;
      up.copy(Y).addScaledVector(fr.t, -Y.dot(fr.t));
      const hz = up.length();
      if (hz > 1e-4) up.divideScalar(hz);
      // A puff stands up a little over the arm; the full part of a bishop sleeve droops when the arm is raised.
      const lift = X.lift ? 0.22 * X.lift * cm * Math.max(0, d.dot(up)) : 0, sag = X.sag ? 0.3 * X.sag * cm * hz : 0;
      p.copy(c0).addScaledVector(d, r).addScaledVector(up, lift - sag);
      if (!ok(p)) {
        // Pressed flat between the arm and her body, never through.
        const rMin = rA, stp = (o.lite ? 0.6 : 0.2) * cm;
        for (let r2 = r - stp; r2 >= rMin - 1e-6; r2 -= stp) { p.copy(c0).addScaledVector(d, r2).addScaledVector(up, ((lift - sag) * (r2 - rMin)) / Math.max(1e-6, r - rMin)); if (ok(p)) break; }
        if (!ok(p)) { p.copy(c0).addScaledVector(d, rMin); stuck[i * A + a] = 1; }
      }
      const q = (i * A + a) * 3;
      pos[q] = p.x; pos[q + 1] = p.y; pos[q + 2] = p.z;
      uvA[(i * A + a) * 2] = (aa / SNA) * 3;
      uvA[(i * A + a) * 2 + 1] = (s - s1) / (o.laceCm * cm);
    }
  }
  // While she walks: the cheap passes only (phones); all of them once she stops.
  unstick(pos, stuck, ok, !!o.lite);
  if (!o.lite) crease(pos, { ...arm, off }, ok);
  return lens;
}

/**
 * The arm's own reach round its centre line (as the sleeve builder bins it), plus any gown sleeve over it: what an
 * over-robe sleeve has to clear (v203 `slxArm`). `sleeve` is that side's sleeve positions when she wears one.
 */
export function gownSleeveArm(B: GownRig, sd: 'L' | 'R', sleeve: ArrayLike<number> | null): GownSleeveArm {
  const V = B.V, sg = sd === 'L' ? 1 : -1, S = jointP(B, `upperarm01.${sd}`, new THREE.Vector3()), E = jointP(B, `lowerarm01.${sd}`, new THREE.Vector3()), W = jointP(B, `wrist.${sd}`, new THREE.Vector3());
  const u = E.clone().sub(S), Lu = u.length();
  u.normalize();
  const f = W.clone().sub(E), Lf = f.length();
  f.normalize();
  const s0 = -0.08, ns = Math.ceil((Lu + Lf - s0) / SDS) + 1, R = new Float32Array(ns * SBA), Z = new THREE.Vector3(0, 0, 1);
  const tan = (s: number) => { const w = smoothstep(s, Lu - 0.04, Lu + 0.04); return u.clone().multiplyScalar(1 - w).addScaledVector(f, w).normalize(); };
  const ctr = (s: number) => (s <= Lu ? S.clone().addScaledVector(u, s) : E.clone().addScaledVector(f, s - Lu));
  const frame = (s: number) => { const t = tan(s), r = Z.clone().addScaledVector(t, -Z.dot(t)).normalize(), v = new THREE.Vector3().crossVectors(t, r).multiplyScalar(sg); return { t, r, v }; };
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  const bin = () => {
    d.copy(p).sub(S);
    const a1 = clamp(d.dot(u), s0, Lu), e1 = d.addScaledVector(u, -a1).length();
    d.copy(p).sub(E);
    const a2 = clamp(d.dot(f), 0, Lf), e2 = d.addScaledVector(f, -a2).length();
    const s = e2 < e1 ? Lu + a2 : a1, k = Math.round((s - s0) / SDS);
    if (k < 0 || k >= ns) return;
    const fr = frame(s);
    d.copy(p).sub(ctr(s));
    d.addScaledVector(fr.t, -d.dot(fr.t));
    const r = d.length();
    let a = Math.round((Math.atan2(d.dot(fr.v), d.dot(fr.r)) / TAU) * SBA);
    a = ((a % SBA) + SBA) % SBA;
    if (r > R[k * SBA + a]! && r < 0.25 / B.P.S) R[k * SBA + a] = r;
  };
  for (const i of B.armS[sd]) { p.set(V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!); bin(); }
  if (sleeve) for (let o = 0; o < sleeve.length; o += 3) { p.set(sleeve[o]!, sleeve[o + 1]!, sleeve[o + 2]!); bin(); }
  for (let k = 0; k < ns; k++) {
    const o = k * SBA;
    let any = 0;
    for (let a = 0; a < SBA; a++) any = Math.max(any, R[o + a]!);
    if (!any) continue;
    for (let a = 0; a < SBA; a++) if (!R[o + a]) {
      let l = 1, r2 = 1;
      while (!R[o + ((a - l + SBA) % SBA)]) l++;
      while (!R[o + ((a + r2) % SBA)]) r2++;
      R[o + a] = (R[o + ((a - l + SBA) % SBA)]! * r2 + R[o + ((a + r2) % SBA)]! * l) / (l + r2);
    }
  }
  for (let k = 1; k < ns; k++) for (let a = 0; a < SBA; a++) if (!R[k * SBA + a]) R[k * SBA + a] = R[(k - 1) * SBA + a]!;
  for (let k = ns - 2; k >= 0; k--) for (let a = 0; a < SBA; a++) if (!R[k * SBA + a]) R[k * SBA + a] = R[(k + 1) * SBA + a]!;
  const R0 = Float32Array.from(R);
  for (let pass = 0; pass < 4; pass++) {
    const c = Float32Array.from(R);
    for (let k = 0; k < ns; k++) for (let a = 0; a < SBA; a++) { const o = k * SBA; R[o + a] = (4 * c[o + a]! + c[o + ((a + 1) % SBA)]! + c[o + ((a + SBA - 1) % SBA)]! + c[Math.max(0, k - 1) * SBA + a]! + c[Math.min(ns - 1, k + 1) * SBA + a]!) / 8; }
  }
  // Never inside the arm or the gown sleeve.
  for (let o = 0; o < R.length; o++) R[o] = Math.max(R[o]!, R0[o]!);
  const Rs = (s: number, a: number) => {
    const fk = clamp((s - s0) / SDS, 0, ns - 1.001), k = fk | 0, w = fk - k, fa = (a / SNA) * SBA, a0 = fa | 0, a1 = (a0 + 1) % SBA, v = fa - a0;
    const rk = (kk: number) => R[kk * SBA + a0]! * (1 - v) + R[kk * SBA + a1]! * v;
    return rk(k) * (1 - w) + rk(k + 1) * w;
  };
  return { S, E, W, u, f, Lu, Lf, frame, ctr, Rs, s0 };
}

/**
 * The over-robe's own sleeve (v203 `slxRobeSleeve`): long and softly widening to the wrist, or a puff gathered at the
 * elbow, laid over the arm and any gown sleeve. Writes a sleeve-grid geometry (`emptySleeve`'s shape).
 */
export function buildGownRobeSleeve(B: GownRig, T: GownEnvelope, sd: 'L' | 'R', d: Pick<GownConfig, 'robeSl'>, sleeve: ArrayLike<number> | null, pos: Float32Array, uvA: Float32Array, lite = false): void {
  const C = gownSleeveArm(B, sd, sleeve), { S, W, Lu, Lf, frame, ctr, Rs } = C, cm = 0.01 / B.P.S, off = (GOWN_EASE_MM + 1) / 1000 / B.P.S, ok = gownSleeveClear(B, T, S, W, off), puff = d.robeSl === 'puff', sW = Lu + Lf - 0.02;
  const A = SNA + 1, K = SNR - 1, p = new THREE.Vector3(), dv = new THREE.Vector3(), stuck = new Uint8Array(SNR * A);
  for (let a = 0; a < A; a++) {
    const aa = a % SNA, ang = (aa / SNA) * TAU;
    let s1 = -0.045;
    // From where it leaves her body.
    for (let it = 0; it < 45; it++) { const fr = frame(s1), r = Rs(s1, aa) + off * 2; p.copy(ctr(s1)).addScaledVector(fr.r, r * Math.cos(ang)).addScaledVector(fr.v, r * Math.sin(ang)); if (ok(p)) break; s1 += 0.004; }
    const s2 = puff ? Math.max(s1 + 10 * cm, Lu - 1.5 * cm) : sW;
    for (let i = 0; i <= K; i++) {
      const w = i / K, s = s1 + (s2 - s1) * w, fr = frame(s), x = (s - s1) / cm, L = (s2 - s1) / cm;
      // Soft volume, never a balloon.
      const e = puff ? (x > L - 2.5 ? 0.6 : 0.6 + 4.2 * Math.pow(Math.sin(Math.PI * Math.pow(clamp(x / (L - 2.5), 0, 1), 0.85)), 0.9)) : 1.0 + 2.4 * smoothstep(s, 0.2 * Lu, sW) - 1.6 * smoothstep(x, L - 2, L);
      const fl = (puff ? 0.22 * e : 0.35 * smoothstep(s, Lu, sW)) * (0.5 + 0.5 * Math.cos((puff ? 10 : 8) * ang + 1.1));
      dv.copy(fr.r).multiplyScalar(Math.cos(ang)).addScaledVector(fr.v, Math.sin(ang));
      const rA = Rs(s, aa) + off, r = rA + (e + fl) * cm, c0 = ctr(s);
      p.copy(c0).addScaledVector(dv, r);
      if (!ok(p)) {
        for (let r2 = r - 0.2 * cm; r2 >= rA - 1e-6; r2 -= 0.2 * cm) { p.copy(c0).addScaledVector(dv, r2); if (ok(p)) break; }
        if (!ok(p)) { p.copy(c0).addScaledVector(dv, rA); stuck[i * A + a] = 1; }
      }
      const o = (i * A + a) * 3;
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      uvA[(i * A + a) * 2] = (aa / SNA) * 3;
      uvA[(i * A + a) * 2 + 1] = x / 12;
    }
  }
  unstick(pos, stuck, ok, lite);
  if (!lite) crease(pos, { ...C, off }, ok);
}

/** The ruffle band across the back: its grid (v203 `slxRuffleBack`: 72 round × 9 down). */
export const GOWN_RUFFLE_BACK = { cols: 72, rows: 9 } as const;
export function emptyRuffleBack(): THREE.BufferGeometry {
  const { cols: NA, rows: NR } = GOWN_RUFFLE_BACK, g = new THREE.BufferGeometry(), ix: number[] = [];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NA * NR * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(NA * NR * 2), 2));
  for (let i = 0; i < NR - 1; i++) for (let a = 0; a < NA - 1; a++) { const p = i * NA + a, q = p + NA; ix.push(p, q, p + 1, p + 1, q, q + 1); }
  g.setIndex(ix);
  return g;
}

/**
 * The ruffle band joined across the back (v203 `slxRuffleBack`): the same gathered ruffle laid along the back of the
 * bodice's top edge, from where it meets one arm band to the other. `sleeves` are the two ruffle bands' positions.
 */
export function buildGownRuffleBack(B: GownRig, T: GownEnvelope, sleeves: Record<'L' | 'R', ArrayLike<number>>, pos: Float32Array, uv: Float32Array): void {
  const { cols: NA, rows: NR } = GOWN_RUFFLE_BACK, cm = 0.01 / B.P.S, off = (GOWN_EASE_MM + 1) / 1000 / B.P.S, cz = czOf(T);
  const arm = (sd: 'L' | 'R') => { const S = jointP(B, `upperarm01.${sd}`, new THREE.Vector3()), E = jointP(B, `lowerarm01.${sd}`, new THREE.Vector3()); return { S, d: E.clone().sub(S).normalize(), L: S.distanceTo(E) }; };
  const AL = arm('L'), AR = arm('R');
  const dArm = (q: V3, ar: ReturnType<typeof arm>) => { const v = q.clone().sub(ar.S), t = clamp(v.dot(ar.d), -0.05, ar.L); return v.addScaledVector(ar.d, -t).length(); };
  const bandR = (sd: 'L' | 'R') => { const P = sleeves[sd], ar = sd === 'L' ? AL : AR; let r = 0, n = 0; for (let a = 0; a < SNA; a++) { const o = ((SNR >> 1) * (SNA + 1) + a) * 3; r += dArm(new THREE.Vector3(P[o]!, P[o + 1]!, P[o + 2]!), ar); n++; } return r / n; };
  const rbL = bandR('L'), rbR = bandR('R');
  const at = (a: number) => { const y = envTopAt(T, a) - 0.004 / B.P.S, c = cz(y), e = reach(T, Math.sin(a), y, c + Math.cos(a)), r = e.env + off + 0.15 * cm; return new THREE.Vector3(r * Math.sin(a), y, c + r * Math.cos(a)); };
  // From where it meets each arm band.
  let aL = Math.PI, aR = Math.PI;
  for (; aL > Math.PI / 2 + 0.05; aL -= 0.01) if (dArm(at(aL), AL) < rbL + 0.5 * cm) break;
  for (; aR < 1.5 * Math.PI - 0.05; aR += 0.01) if (dArm(at(aR), AR) < rbR + 0.5 * cm) break;
  const Wd = 7 * cm;
  for (let a = 0; a < NA; a++) {
    const an = aL + ((aR - aL) * a) / (NA - 1), q0 = at(an), c0 = cz(q0.y);
    for (let i = 0; i < NR; i++) {
      const t = i / (NR - 1), y = q0.y + 1.2 * cm - Wd * t, c2 = cz(y), e = reach(T, Math.sin(an), y, c2 + Math.cos(an));
      const puffv = 1.8 * Math.pow(Math.sin(Math.PI * t), 0.7) + 1.1 * smoothstep(t, 0.7, 1), fl = (0.35 + 0.5 * Math.pow(Math.sin(Math.PI * t), 0.7) + 0.6 * smoothstep(t, 0.7, 1)) * (0.5 + 0.5 * Math.cos(an * 34));
      const base = Math.max(Math.hypot(q0.x, q0.z - c0), e.env + off), r = base + (0.4 + puffv + fl) * cm, o = (i * NA + a) * 3;
      pos[o] = r * Math.sin(an); pos[o + 1] = y; pos[o + 2] = c2 + r * Math.cos(an);
      uv[(i * NA + a) * 2] = a / 6; uv[(i * NA + a) * 2 + 1] = t;
    }
  }
}

/**
 * Fabric for a pair (v203 `slxMetres`): the real panels' area laid on 140 cm fabric, times the gathering, or their
 * longest line, whichever is more, to the next 10 cm. `meshes` are the drawn pieces (index + positions); a sleeve-grid
 * piece also measures its longest column.
 */
export function gownSleeveMetres(B: GownRig, meshes: readonly ({ pos: ArrayLike<number>; index: ArrayLike<number> } | null)[], gather: number): number {
  const S = B.P.S;
  let A = 0, L = 0;
  for (const m of meshes) {
    if (!m) continue;
    const P = m.pos, ix = m.index;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t]! * 3, b = ix[t + 1]! * 3, c = ix[t + 2]! * 3, ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!, vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
      A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    if (P.length === SNR * (SNA + 1) * 3) for (let a = 0; a <= SNA; a += 4) {
      let s = 0;
      for (let i = 1; i < SNR; i++) { const p0 = ((i - 1) * (SNA + 1) + a) * 3, p1 = (i * (SNA + 1) + a) * 3; s += Math.hypot(P[p1]! - P[p0]!, P[p1 + 1]! - P[p0 + 1]!, P[p1 + 2]! - P[p0 + 2]!); }
      L = Math.max(L, s);
    }
  }
  if (!A) return 0;
  return Math.round(Math.max(L * S + 0.1, (A * S * S * gather) / 1.4 + 0.1) * 10) / 10;
}

/** The top of a cape sleeve's band (v203 `slxBandTop`): where the cape sleeve's panel hangs from. */
export function gownSleeveBandTop(B: GownRig, sd: 'L' | 'R', sleeve: ArrayLike<number> | null): number {
  if (!sleeve) return jointP(B, `upperarm01.${sd}`, new THREE.Vector3()).y - 0.06 / B.P.S;
  let y = -1e9;
  for (let a = 0; a < SNA; a++) y = Math.max(y, sleeve[a * 3 + 1]!);
  return y - 0.004 / B.P.S;
}
