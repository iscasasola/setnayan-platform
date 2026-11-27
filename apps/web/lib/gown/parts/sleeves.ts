/**
 * 👗 gown/parts/sleeves — cap, long and butterfly (terno) sleeves, and the band an off-shoulder neckline drapes over
 * the upper arm (prototype v193 `buildSleeves`, `sleeveMesh`). Women only: the men's set-in sleeve and cuff are not
 * ported. Each sleeve follows her own arm: every arm vertex is binned by where it lies along the arm and which way round
 * it, smoothed like cloth but never more than 3 mm inside the skin, then the sleeve is laid on it with the gown's ease.
 *
 * Plain three.js maths on the posed body; the stage owns the material (the gown's, the accent's or sheer lace, A6b).
 */
import * as THREE from 'three';
import { GOWN_STRAPLESS, type GownConfig } from '../../gown-config';
import { jointP } from '../body/bones';
import { RING_N, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import { GOWN_EASE_MM } from '../dress/lines';
import type { GownEnvelope } from '../dress/table';

const N = RING_N;
/** Mesh round the arm and along it; bins along the arm (model units) and round it. */
export const SLEEVE_COLS = 40;
export const SLEEVE_ROWS = 44;
const SNA = SLEEVE_COLS, SNR = SLEEVE_ROWS, SDS = 0.02, SBA = 16;

export type GownSleeveSide = 'L' | 'R';
export type GownSleeveDesign = Pick<GownConfig, 'sleeve' | 'neck' | 'laceCm'>;
/** What a sleeve is: a real sleeve, or the band an off-shoulder neckline lays over the upper arm. */
export type GownSleeveKind = 'band' | 'cap' | 'long' | 'butterfly';

/** Whether she wears anything on the arm: a sleeve, or the off-shoulder band. */
export const gownSleeveKind = (d: Pick<GownConfig, 'sleeve' | 'neck'>): GownSleeveKind | null =>
  d.sleeve !== 'none' ? d.sleeve : d.neck === 'off' ? 'band' : null;

/** One sleeve's geometry (v193 `sleeveMesh`): SLEEVE_ROWS rings of SLEEVE_COLS + 1 points (the seam is doubled for the lace uv). */
export function emptySleeve(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), ix: number[] = [], n = SNR * (SNA + 1);
  const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  g.setAttribute('position', pos);
  g.setAttribute('rest', pos);
  // No lace, cut-outs or techniques on a sleeve.
  g.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
  g.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(n).fill(-100), 1));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (let i = 0; i < SNR - 1; i++) for (let a = 0; a < SNA; a++) { const p = i * (SNA + 1) + a, q = p + SNA + 1; ix.push(p, q, p + 1, p + 1, q, q + 1); }
  g.setIndex(ix);
  return g;
}

/**
 * Lay one sleeve on her posed arm (v193 `buildSleeves`, women). `T` is the envelope with the dress on it (the bodice's
 * top edge cuts a strapless sleeve level with it). Returns false when she wears nothing on the arm.
 */
export function buildGownSleeve(B: GownRig, T: GownEnvelope, sd: GownSleeveSide, d: GownSleeveDesign, geo: THREE.BufferGeometry): boolean {
  const kind = gownSleeveKind(d);
  if (!kind) return false;
  const P = B.P, V = B.V, sg = sd === 'L' ? 1 : -1;
  const S = jointP(B, `upperarm01.${sd}`, new THREE.Vector3()), E = jointP(B, `lowerarm01.${sd}`, new THREE.Vector3()), W = jointP(B, `wrist.${sd}`, new THREE.Vector3());
  const u = E.clone().sub(S), Lu = u.length();
  u.normalize();
  const f = W.clone().sub(E), Lf = f.length();
  f.normalize();
  const s0 = -0.08, ns = Math.ceil((Lu + Lf - s0) / SDS) + 1, R = new Float32Array(ns * SBA), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
  const tan = (s: number) => { const w = smoothstep(s, Lu - 0.04, Lu + 0.04); return u.clone().multiplyScalar(1 - w).addScaledVector(f, w).normalize(); };
  const ctr = (s: number) => (s <= Lu ? S.clone().addScaledVector(u, s) : E.clone().addScaledVector(f, s - Lu));
  const frame = (s: number) => { const t = tan(s), r = Z.clone().addScaledVector(t, -Z.dot(t)).normalize(), v = new THREE.Vector3().crossVectors(t, r).multiplyScalar(sg); return { t, r, v }; };
  const p = new THREE.Vector3(), dv = new THREE.Vector3();
  // Each arm vertex: which bin along the arm, which direction around it, how far out.
  for (const i of B.armS[sd]) {
    p.set(V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!);
    dv.copy(p).sub(S);
    const a1 = clamp(dv.dot(u), s0, Lu), e1 = dv.addScaledVector(u, -a1).length();
    dv.copy(p).sub(E);
    const a2 = clamp(dv.dot(f), 0, Lf), e2 = dv.addScaledVector(f, -a2).length();
    const s = e2 < e1 ? Lu + a2 : a1, k = Math.round((s - s0) / SDS);
    if (k < 0 || k >= ns) continue;
    const fr = frame(s);
    dv.copy(p).sub(ctr(s));
    dv.addScaledVector(fr.t, -dv.dot(fr.t));
    const r = dv.length();
    let a = Math.round((Math.atan2(dv.dot(fr.v), dv.dot(fr.r)) / TAU) * SBA);
    a = ((a % SBA) + SBA) % SBA;
    if (r > R[k * SBA + a]!) R[k * SBA + a] = r;
  }
  // Empty directions: from their nearest filled neighbours; empty bins along the arm from the next one.
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
  // Smooth like cloth, but never more than 3 mm inside the skin.
  const R0 = Float32Array.from(R);
  for (let pass = 0; pass < 4; pass++) {
    const c = Float32Array.from(R);
    for (let k = 0; k < ns; k++) for (let a = 0; a < SBA; a++) {
      const o = k * SBA;
      R[o + a] = (4 * c[o + a]! + c[o + ((a + 1) % SBA)]! + c[o + ((a + SBA - 1) % SBA)]! + c[Math.max(0, k - 1) * SBA + a]! + c[Math.min(ns - 1, k + 1) * SBA + a]!) / 8;
    }
  }
  for (let o = 0; o < R.length; o++) R[o] = Math.max(R[o]!, R0[o]! - 0.003);
  const Rs = (s: number, a: number) => {
    const fk = clamp((s - s0) / SDS, 0, ns - 1.001), k = fk | 0, w = fk - k, fa = (a / SNA) * SBA, a0 = fa | 0, a1 = (a0 + 1) % SBA, v = fa - a0;
    const rk = (kk: number) => R[kk * SBA + a0]! * (1 - v) + R[kk * SBA + a1]! * v;
    return rk(k) * (1 - w) + rk(k + 1) * w;
  };
  // Where the sleeve starts: on a strapless or off-shoulder top it is cut level with the bodice edge; otherwise at the shoulder point.
  const strapless = GOWN_STRAPLESS.includes(d.neck), yCut = T.top[N / 4]! - 0.004, off = (GOWN_EASE_MM + 1) / 1000 / P.S, cm = 0.01 / P.S;
  const len = { band: 5.5 * cm, cap: 9 * cm, long: Lu + Lf - 0.012, butterfly: 0.5 * Lu }[kind];
  const pos = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array, uvA = (geo.attributes.uv as THREE.BufferAttribute).array as Float32Array, up = new THREE.Vector3();
  for (let a = 0; a <= SNA; a++) {
    const aa = a % SNA, ang = (aa / SNA) * TAU, c = Math.cos(ang), sn = Math.sin(ang);
    let sA = kind === 'butterfly' ? -0.06 : strapless ? s0 : -0.035;
    if (strapless) for (let it = 0; it < 60; it++) {
      const fr = frame(sA), q = ctr(sA).addScaledVector(fr.r, Rs(sA, aa) * c).addScaledVector(fr.v, Rs(sA, aa) * sn);
      if (q.y <= yCut) break;
      sA += 0.004;
    }
    const sB = (strapless ? Math.max(sA, 0) : 0) + len;
    for (let i = 0; i < SNR; i++) {
      const w = i / (SNR - 1), s = sA + (sB - sA) * w, fr = frame(s);
      let r = Rs(s, aa) + off;
      if (kind === 'cap') r += 1.2 * cm * w; // a cap stands a little off the arm at its edge
      if (kind === 'long') r += 0.4 * cm * smoothstep(w, 0.8, 1);
      let lift = 0;
      if (kind === 'butterfly') {
        // Terno: a stiff pleated wing standing up over the shoulder, flat front to back.
        up.copy(Y).addScaledVector(fr.t, -Y.dot(fr.t)).normalize();
        const dir = fr.r.clone().multiplyScalar(c).addScaledVector(fr.v, sn), lobe = Math.pow(Math.max(0, dir.dot(up)), 0.7);
        const env = Math.pow(Math.sin(Math.PI * Math.pow(w, 0.75)), 0.8);
        lift = 11 * cm * env * lobe * (1 + 0.06 * Math.cos(10 * TAU * w));
        r += 1.5 * cm * env;
      }
      const o = (i * (SNA + 1) + a) * 3, q = ctr(s).addScaledVector(fr.r, r * c).addScaledVector(fr.v, r * sn).addScaledVector(up, lift);
      pos[o] = q.x; pos[o + 1] = q.y; pos[o + 2] = q.z;
      // Lace repeats: 3 round the arm, one per lace width along it.
      uvA[(o / 3) * 2] = (aa / SNA) * 3;
      uvA[(o / 3) * 2 + 1] = (s - sA) / (d.laceCm * cm);
    }
  }
  (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  (geo.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return true;
}
