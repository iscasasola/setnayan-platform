/**
 * 👗 gown/dress/table — the body's envelope (prototype v189 `T`, `buildTable`, `lerpRow`, `reach`): for every height and
 * every direction round her, how far out the posed body reaches, wrapped the way cloth under light tension does
 * (straight across every hollow). The dress, the lace and the beads all read it.
 */
import { RING_N, SLICE_DY, TAU } from '../body/constants';
import { jointY } from '../body/bones';
import { BODY_K } from '../body/constants';
import type { GownRig } from '../body/rig';

const N = RING_N, DY = SLICE_DY, DTH = TAU / N;
export const RING_SIN = Float32Array.from({ length: N }, (_, k) => Math.sin(k * DTH));
export const RING_COS = Float32Array.from({ length: N }, (_, k) => Math.cos(k * DTH));

export type GownEnvelope = {
  y0: number;
  n: number;
  /** The raw slice reach, then reused as scratch. */
  R: Float32Array;
  /** The body's wrapped reach (n × N). */
  H: Float32Array;
  /** The dress's reach (n × N), written by the dress build. */
  F: Float32Array;
  /** The torso's centre line per slice. */
  cz: Float32Array;
  /** The bodice's top edge per direction. */
  top: Float32Array;
  /** Each direction's own hem height (a high-low hem differs round her). */
  hemQ: Float32Array;
  jF: number; jHem: number; jTop: number;
  yF: number; yHem: number; yS: number;
  /** True once a dress is on it (`reach` then reads the cloth too). */
  on: boolean;
};

export function emptyEnvelope(): GownEnvelope {
  return { y0: 0, n: 0, R: new Float32Array(0), H: new Float32Array(0), F: new Float32Array(0), cz: new Float32Array(0), top: new Float32Array(N), hemQ: new Float32Array(N), jF: 0, jHem: 0, jTop: 0, yF: 0, yHem: 0, yS: 0, on: false };
}

/** v189 `buildTable`: measure the posed body (`B.V`) into the envelope. */
export function buildEnvelope(B: GownRig, T: GownEnvelope): void {
  const V = B.V, tt = B.tt, k = BODY_K;
  let lo = 1e9;
  for (const i of B.torsoV) if (V[i * 3 + 1]! < lo) lo = V[i * 3 + 1]!;
  const y0 = lo + 0.004, n = Math.ceil((Math.max(k.yTop, jointY(B, 'neck01') + 0.09) - y0) / DY) + 1; // up to the neck, so a high neckline has body to follow
  if (T.R.length < n * N) { T.R = new Float32Array(n * N); T.H = new Float32Array(n * N); T.F = new Float32Array(n * N); T.cz = new Float32Array(n); }
  T.y0 = y0; T.n = n; T.yF = k.yHip - 0.01; T.R.fill(0); T.F.fill(0); T.on = false;
  for (let j = 0; j < n; j++) T.cz[j] = B.zcAt(Math.max(y0 + j * DY, T.yF));
  const R = T.R, seg = new Float64Array(6), yKnee = B.neutral.knee; // below the knee only: feet and toes
  for (let t = 0; t < tt.length; t += 3) {
    const a = tt[t]! * 3, b = tt[t + 1]! * 3, c = tt[t + 2]! * 3, ya = V[a + 1]!, yb = V[b + 1]!, yc = V[c + 1]!;
    const mn = Math.min(ya, yb, yc), mx = Math.max(ya, yb, yc), j0 = Math.max(0, Math.ceil((mn - y0) / DY)), j1 = Math.min(n - 1, Math.floor((mx - y0) / DY));
    for (let j = j0; j <= j1; j++) {
      const y = y0 + j * DY, cz = T.cz[j]!;
      let m = 0;
      if (ya <= y !== yb <= y) { const u = (y - ya) / (yb - ya); seg[m++] = V[a]! + (V[b]! - V[a]!) * u; seg[m++] = V[a + 2]! + (V[b + 2]! - V[a + 2]!) * u - cz; }
      if (yb <= y !== yc <= y) { const u = (y - yb) / (yc - yb); seg[m++] = V[b]! + (V[c]! - V[b]!) * u; seg[m++] = V[b + 2]! + (V[c + 2]! - V[b + 2]!) * u - cz; }
      if (yc <= y !== ya <= y) { const u = (y - yc) / (ya - yc); seg[m++] = V[c]! + (V[a]! - V[c]!) * u; seg[m++] = V[c + 2]! + (V[a + 2]! - V[c + 2]!) * u - cz; }
      if (m < 4) continue;
      const x1 = seg[0]!, z1 = seg[1]!, x2 = seg[2]!, z2 = seg[3]!, a1 = Math.atan2(x1, z1);
      let d = Math.atan2(x2, z2) - a1;
      if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      const s = Math.min(a1, a1 + d), e = Math.max(a1, a1 + d), dx = x2 - x1, dz = z2 - z1, num = x1 * dz - z1 * dx;
      if (y < yKnee && Math.ceil(s / DTH) > Math.floor(e / DTH)) {
        // A sliver between two rays (a toe tip) still counts.
        const kk = ((Math.round((s + e) / 2 / DTH) % N) + N) % N, r = Math.max(Math.hypot(x1, z1), Math.hypot(x2, z2)), o = j * N + kk;
        if (r > R[o]!) R[o] = r;
      }
      for (let q = Math.ceil(s / DTH); q <= Math.floor(e / DTH); q++) {
        const kk = ((q % N) + N) % N, den = RING_SIN[kk]! * dz - RING_COS[kk]! * dx;
        if (Math.abs(den) < 1e-9) continue;
        // A ray nearly parallel to a toe edge can give a wild value: no body part reaches 0.7 out.
        const r = num / den, o = j * N + kk;
        if (r > R[o]! && r < (y < yKnee ? 0.4 : 0.7)) R[o] = r;
      }
    }
  }
  // Wrap each slice the way cloth under light tension does: straight across every hollow.
  const H = T.H, hx = new Float32Array(N), hz = new Float32Array(N), st = new Int32Array(N + 2);
  for (let j = 0; j < n; j++) {
    const o = j * N;
    let kmax = -1, rmax = 0, cnt = 0;
    for (let q = 0; q < N; q++) { const r = R[o + q]!; hx[q] = r * RING_SIN[q]!; hz[q] = r * RING_COS[q]!; H[o + q] = r; if (r > 0) cnt++; if (r > rmax) { rmax = r; kmax = q; } }
    if (cnt < 3) continue;
    let sp = 0;
    st[sp++] = kmax;
    for (let q = 1; q <= N; q++) {
      const kk = (kmax + q) % N;
      if (!(R[o + kk]! > 0) && q < N) continue;
      while (sp >= 2) { const p1 = st[sp - 2]!, p2 = st[sp - 1]!; if ((hx[p2]! - hx[p1]!) * (hz[kk]! - hz[p1]!) - (hz[p2]! - hz[p1]!) * (hx[kk]! - hx[p1]!) >= 0) sp--; else break; }
      st[sp++] = kk;
    }
    for (let q = 0; q < sp - 1; q++) {
      const p1 = st[q]!, p2 = st[q + 1]!, dx = hx[p2]! - hx[p1]!, dz = hz[p2]! - hz[p1]!, num = hx[p1]! * dz - hz[p1]! * dx;
      for (let kk = (p1 + 1) % N; kk !== p2; kk = (kk + 1) % N) {
        const den = RING_SIN[kk]! * dz - RING_COS[kk]! * dx;
        if (Math.abs(den) > 1e-9) { const r = num / den; if (r > 0 && r <= Math.max(R[o + p1]!, R[o + p2]!) + 1e-4) H[o + kk] = Math.max(H[o + kk]!, r); }
      }
    }
  }
  // The widest of each slice and its two neighbours, so a shelf (under a full bust, a kneecap) is never cut between slices.
  const R2 = T.R;
  R2.set(H.subarray(0, n * N));
  for (let j = 0; j < n; j++) {
    const a = Math.max(0, j - 1) * N, b = j * N, c = Math.min(n - 1, j + 1) * N;
    for (let q = 0; q < N; q++) H[b + q] = Math.max(R2[a + q]!, R2[b + q]!, R2[c + q]!);
  }
}

/** A row of the table at any height (v189 `lerpRow`). */
export function lerpRow(T: GownEnvelope, A: Float32Array, y: number, kk: number): number {
  const f = Math.min(T.n - 1.001, Math.max(0, (y - T.y0) / DY)), j = f | 0;
  return A[j * N + kk]! + (A[(j + 1) * N + kk]! - A[j * N + kk]!) * (f - j);
}

/** How far out the body (or the dress, where there is one) reaches at a point's own height and direction (v189 `reach`). */
export function reach(T: GownEnvelope, x: number, y: number, z: number): { r: number; env: number } {
  const f = Math.min(T.n - 1.001, Math.max(0, (y - T.y0) / DY)), j = f | 0, u = f - j, cz = T.cz[j]! + (T.cz[j + 1]! - T.cz[j]!) * u;
  let a = Math.atan2(x, z - cz) / DTH;
  if (a < 0) a += N;
  const k0 = (a | 0) % N, k1 = (k0 + 1) % N, w = a - (a | 0);
  const rd = (A: Float32Array, jj: number) => A[jj * N + k0]! * (1 - w) + A[jj * N + k1]! * w;
  const body = rd(T.H, j) * (1 - u) + rd(T.H, j + 1) * u;
  let cloth = 0;
  if (T.on && j >= T.jHem && j < T.jTop) cloth = (rd(T.F, j) * (1 - u) + rd(T.F, j + 1) * u) * (y < T.yF ? 1.07 : 1);
  return { r: Math.hypot(x, z - cz), env: Math.max(body, cloth) };
}
