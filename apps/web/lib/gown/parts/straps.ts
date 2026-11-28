/**
 * 👗 gown/parts/straps — shoulder straps (prototype v199 `strapSkin`, `strapResample`, `strapTaut`, `strapPolar`,
 * `strapLine`, `buildStraps`, `strapSummary`, `strapQuote`, and the `strapClip` test hook).
 *
 * Straps are one small mesh (both straps and any beads), laid on her own posed skin: the line over the shoulder is the
 * cape's strap line (so a cape hangs from the same strap); halter, cross-back and off-shoulder straps start from the body
 * table and the upper arm. Every line is pulled taut like a real strap, then pushed out to sit 3 mm off the skin, so it
 * never floats and never sinks in. The ends tuck 1.2 cm under the bodice's top edge, where they are sewn. Re-laid for
 * every pose. Women only. The rules (which straps go with which neckline) are in `gown-config` (`gownStrapOk`).
 *
 * State is passed in: the posed body, its envelope and the dress as built. Plain three.js maths: no DOM, no material.
 */
import * as THREE from 'three';
import { GOWN_STRAP_DEF, gownStrapKind, gownScallopOn, gownPlungeMeshOn, type GownConfig, type GownStraps } from '../../gown-config';
import { jointP, jointY } from '../body/bones';
import { BODY_K, TAU } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { capeStrap } from '../dress/cape';
import { gownStrapFrontAngle } from '../dress/lines';
import { czOf, envTabR, envTopAt, type GownEnvelope } from '../dress/table';

type P3 = [number, number, number];
type Side = 'L' | 'R';

/** Vertices the strap mesh holds (both straps and every bead) (v199 `STRAP_NV`). */
export const GOWN_STRAP_VERTS = 3200;

export type GownStrapMesh = {
  /** Groups: 0 the straps (the gown's cloth, or the accent), 1 the beads and the halter's covered button. */
  geo: THREE.BufferGeometry;
  kind: GownStraps;
  /** Each strap's centre line (its inner face), front end to back end. */
  paths: P3[][];
  /** Both straps' length (metres), the beads on them, the vertices in use. */
  len: number;
  beads: number;
  nUsed: number;
};

/** The design keys the straps read. */
export type GownStrapDesign = Pick<GownConfig, 'straps' | 'strapEdge' | 'neck' | 'illu' | 'sleeve'>;

export function emptyStraps(): GownStrapMesh {
  const g = new THREE.BufferGeometry(), n = GOWN_STRAP_VERTS;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('rest', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  // No lace, cut-outs or zones on the straps.
  g.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
  g.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(n).fill(-100), 1));
  return { geo: g, kind: 'none', paths: [], len: 0, beads: 0, nUsed: 0 };
}

/** Her upper body as points in a grid, for nearest-skin checks (v199 `strapSkin`). */
export type GownStrapSkin = {
  near: (x: number, y: number, z: number) => number;
  /** Signed distance off the skin along the nearest skin vertex's normal. */
  sd: (p: P3) => { d: number; n: P3 };
  /** Push a point out to `clr` off the skin (in place). */
  push: (p: P3, clr: number) => P3;
  /** The nearest skin point, `clr` out along its normal. */
  snap: (p: P3, clr: number) => P3;
};
export function gownStrapSkin(B: GownRig): GownStrapSkin {
  const V = B.V, NM = B.geo.attributes.normal!.array as Float32Array, cell = 0.03 / B.P.S, grid = new Map<string, number[]>(), yLo = BODY_K.yWaist - 0.04 / B.P.S;
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < B.n; i++) {
    if (V[i * 3 + 1]! < yLo) continue;
    const k = key(V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!);
    let L = grid.get(k);
    if (!L) grid.set(k, (L = []));
    L.push(i);
  }
  const near = (x: number, y: number, z: number) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell);
    let bd = 1e9, bi = -1;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const L = grid.get(`${gx + dx},${gy + dy},${gz + dz}`);
      if (L) for (const i of L) { const d = (x - V[i * 3]!) ** 2 + (y - V[i * 3 + 1]!) ** 2 + (z - V[i * 3 + 2]!) ** 2; if (d < bd) { bd = d; bi = i; } }
    }
    return bi;
  };
  const nrm = (i: number): P3 => { const l = Math.hypot(NM[i * 3]!, NM[i * 3 + 1]!, NM[i * 3 + 2]!) || 1; return [NM[i * 3]! / l, NM[i * 3 + 1]! / l, NM[i * 3 + 2]! / l]; };
  const sd = (p: P3) => {
    const i = near(p[0], p[1], p[2]);
    if (i < 0) return { d: 1, n: [0, 1, 0] as P3 };
    const n = nrm(i);
    return { d: (p[0] - V[i * 3]!) * n[0] + (p[1] - V[i * 3 + 1]!) * n[1] + (p[2] - V[i * 3 + 2]!) * n[2], n };
  };
  const push = (p: P3, clr: number) => {
    for (let k = 0; k < 3; k++) { const s = sd(p); if (s.d >= clr) return p; const m = clr - s.d; p[0] += s.n[0] * m; p[1] += s.n[1] * m; p[2] += s.n[2] * m; }
    return p;
  };
  const snap = (p: P3, clr: number): P3 => { const i = near(p[0], p[1], p[2]); if (i < 0) return p; const n = nrm(i); return [V[i * 3]! + n[0] * clr, V[i * 3 + 1]! + n[1] * clr, V[i * 3 + 2]! + n[2] * clr]; };
  return { near, sd, push, snap };
}

const dist = (a: P3, b: P3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
/** Even spacing along the line (v199 `strapResample`). */
function resample(P: P3[], step: number): P3[] {
  const out: P3[] = [[...P[0]!]];
  let acc = 0;
  for (let k = 1; k < P.length; k++) {
    const a = P[k - 1]!, b = P[k]!, l = dist(a, b);
    let t0 = 0;
    while (acc + l * (1 - t0) >= step) { const t = t0 + (step - acc) / l; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); t0 = t; acc = 0; }
    acc += l * (1 - t0);
  }
  const e = P[P.length - 1]!;
  if (dist(out[out.length - 1]!, e) > step * 0.3) out.push([...e]);
  else out[out.length - 1] = [...e];
  return out;
}
/**
 * Pull the line taut (ends held), then push it back out of her skin: it lies over the body like a strap under tension
 * (v199 `strapTaut`). A long line straightens first on a coarse copy (ten pieces). Changes `P` in place.
 */
function taut(P: P3[], K: GownStrapSkin, clr: number, its = 8): P3[] {
  if (P.length > 12) {
    let L0 = 0;
    for (let k = 1; k < P.length; k++) L0 += dist(P[k - 1]!, P[k]!);
    const Q = resample(P, L0 / 10);
    for (let it = 0; it < its; it++) {
      const Z = Q.map((p) => [...p] as P3);
      for (let k = 1; k < Q.length - 1; k++) for (let c = 0; c < 3; c++) Q[k]![c] = Z[k]![c]! * 0.5 + (Z[k - 1]![c]! + Z[k + 1]![c]!) * 0.25;
      for (let k = 1; k < Q.length - 1; k++) K.push(Q[k]!, clr);
    }
    const R = resample(Q, L0 / Math.max(2, P.length - 1));
    for (const p of R) K.push(p, clr);
    P.length = 0;
    for (const p of R) P.push(p);
    its = Math.min(its, 4);
  }
  for (let it = 0; it < its; it++) {
    const Q = P.map((p) => [...p] as P3);
    for (let k = 1; k < P.length - 1; k++) for (let c = 0; c < 3; c++) P[k]![c] = Q[k]![c]! * 0.5 + (Q[k - 1]![c]! + Q[k + 1]![c]!) * 0.25;
    for (let k = 1; k < P.length - 1; k++) K.push(P[k]!, clr);
  }
  return P;
}

/** The centre line of one strap's inner face, front end to back end (v199 `strapLine`). `G.knot`: where a halter's straps meet. */
function strapLine(B: GownRig, T: GownEnvelope, D: GownDress, d: GownStrapDesign, sd: Side, path: 'over' | 'arm' | 'halter' | 'cross', K: GownStrapSkin, G: { knot?: P3 }): P3[] {
  const M = 1 / B.P.S, cm = 0.01 * M, clr = 0.3 * cm, s = sd === 'L' ? 1 : -1, tuck = 1.2 * cm, mir = (a: number) => (s > 0 ? a : TAU - a), yN = jointY(B, 'neck01'), L = D.L!;
  const czAt = czOf(T), topAt = (a: number) => envTopAt(T, a);
  // A point on her body table (torso and neck) (v199 `strapPolar`).
  const polar = (a: number, y: number): P3 => { const r = envTabR(T, a, y) + clr, cz = czAt(y); return [r * Math.sin(a), y, cz + r * Math.cos(a)]; };
  const over = (): P3[] => capeStrap(B, T, sd).drawn.map((p) => [p.x, p.y, p.z]);
  const guide = (pts: P3[], n: number) => {
    const out: P3[] = [];
    for (let k = 0; k < pts.length - 1; k++) for (let i = 0; i < n; i++) { const t = i / n, a = pts[k]!, b = pts[k + 1]!; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    out.push(pts[pts.length - 1]!);
    return out;
  };
  let P: P3[];
  if (path === 'over') {
    P = resample(over(), 0.8 * cm);
    for (const p of P) K.push(p, clr);
    taut(P, K, clr, 6);
  } else if (path === 'cross') {
    // Over the shoulder, then across the upper back to the far side.
    const F = over();
    let j = F.length - 1;
    for (let k = F.length >> 1; k < F.length; k++) { const p = F[k]!; if (p[2] - czAt(p[1]) < -0.01 * M) { j = k; break; } }
    const J = F[j]!, aJ = Math.atan2(J[0], J[2] - czAt(J[1])), aO = Math.PI + s * 0.85, yO = topAt(aO) - tuck, n = 24, Dd: P3[] = [];
    const a1 = aO, a0 = aJ < 0 ? aJ + TAU : aJ;
    for (let i = 1; i <= n; i++) { const t = i / n; Dd.push(K.snap(polar(a0 + (a1 - a0) * t, J[1] + (yO - J[1]) * t), clr)); }
    P = resample(F.slice(0, j + 1).concat(Dd), 0.8 * cm);
    for (const p of P) K.push(p, clr);
    taut(P, K, clr, 16);
    // Her right strap crosses over the left one.
    if (s < 0) for (const p of P) {
      const cz = czAt(p[1]), a = Math.atan2(p[0], p[2] - cz);
      if (p[2] - cz < 0 && Math.abs(Math.abs(a) - Math.PI) < 0.5) { const r = Math.hypot(p[0], p[2] - cz), r2 = r + 0.3 * cm; p[0] *= r2 / r; p[2] = cz + ((p[2] - cz) * r2) / r; }
    }
  } else if (path === 'halter') {
    const aH = gownStrapFrontAngle(d, L), yF = topAt(mir(aH)) - tuck;
    const C = ([[aH, yF], [1.45, yN - 0.012 * M], [2.25, yN - 0.002 * M], [Math.PI - 0.07, yN + 0.002 * M]] as const).map(([a, y]) => polar(mir(a), y));
    P = resample(guide(C, 6).map((p) => K.snap(p, clr)), 0.8 * cm);
    for (const p of P) K.push(p, clr);
    taut(P, K, clr, 8);
    G.knot = P[P.length - 1];
  } else {
    // Off-shoulder: round the outside of the upper arm, a third of the way down.
    const S0 = jointP(B, `upperarm01.${sd}`, new THREE.Vector3()), E0 = jointP(B, `lowerarm01.${sd}`, new THREE.Vector3()), u = E0.clone().sub(S0), ul = u.length();
    u.divideScalar(ul || 1);
    const A = S0.clone().addScaledVector(u, 0.3 * ul), f = new THREE.Vector3(0, 0, 1).addScaledVector(u, -u.z).normalize(), o = f.clone().cross(u).normalize();
    if (o.x * s < 0) o.negate();
    const ds: number[] = [];
    for (const i of B.armS[sd]) {
      const vx = B.V[i * 3]! - A.x, vy = B.V[i * 3 + 1]! - A.y, vz = B.V[i * 3 + 2]! - A.z, t = vx * u.x + vy * u.y + vz * u.z;
      if (Math.abs(t) > 0.015 * M) continue;
      ds.push(Math.hypot(vx - t * u.x, vy - t * u.y, vz - t * u.z));
    }
    ds.sort((a, b) => a - b);
    const rho = ds.length ? ds[(ds.length * 0.8) | 0]! : 0.045 * M, aF = clamp(L.front + 0.6, 0.9, 1.25), aB = Math.PI - 1.15;
    const pF = polar(mir(aF), topAt(mir(aF)) - tuck), pB = polar(mir(aB), topAt(mir(aB)) - tuck), ring: P3[] = [];
    for (let k = 0; k <= 6; k++) { const th = (0.1 + (0.8 * k) / 6) * Math.PI, c = Math.cos(th), sn = Math.sin(th); ring.push([A.x + (f.x * c + o.x * sn) * rho, A.y + (f.y * c + o.y * sn) * rho, A.z + (f.z * c + o.z * sn) * rho]); }
    P = resample(guide([pF, ...ring, pB], 4).map((p, k, arr) => (k === 0 || k === arr.length - 1 ? p : K.snap(p, clr))), 0.8 * cm);
    for (const p of P) K.push(p, clr);
    taut(P, K, clr, 3);
    // It rests on the arm and the side of the bust: no bridge wider than a few mm across the armpit crease.
    for (let it = 0; it < 3; it++) for (let k = 1; k < P.length - 1; k++) {
      const q = K.sd(P[k]!), ex = q.d - 0.7 * cm;
      if (ex > 0) { for (let c = 0; c < 3; c++) P[k]![c] = P[k]![c]! - q.n[c]! * ex * 0.7; K.push(P[k]!, clr); }
    }
  }
  return P;
}

/**
 * Lay the straps on her, after the gown (and any cape) (v199 `buildStraps`). Returns whether they are drawn: never
 * without a gown on her, or when her design rules them out (`gownStrapKind`).
 */
export function buildGownStraps(B: GownRig, T: GownEnvelope, D: GownDress, d: GownStrapDesign, S: GownStrapMesh): boolean {
  const kind = gownStrapKind(d);
  S.kind = kind;
  if (kind === 'none' || !T.on || !D.geo || !D.L) { S.paths = []; S.len = 0; S.beads = 0; S.nUsed = 0; return false; }
  const def = GOWN_STRAP_DEF[kind], M = 1 / B.P.S, cm = 0.01 * M, K = gownStrapSkin(B), G: { knot?: P3 } = {}, w = def.w * cm, th = (kind === 'spaghetti' ? 0.22 : 0.25) * cm;
  const czAt = czOf(T), g = S.geo, Pa = (g.attributes.position as THREE.BufferAttribute).array as Float32Array, U = (g.attributes.uv as THREE.BufferAttribute).array as Float32Array, body: number[] = [], jw: number[] = [];
  let nv = 0, len = 0, nb = 0;
  const vtx = (p: P3, u: number, v: number) => { if (nv >= GOWN_STRAP_VERTS) return -1; Pa[nv * 3] = p[0]; Pa[nv * 3 + 1] = p[1]; Pa[nv * 3 + 2] = p[2]; U[nv * 2] = u; U[nv * 2 + 1] = v; return nv++; };
  // A small faceted crystal (an octahedron, a little taller than wide).
  const jewel = (p: P3, sz: number) => {
    if (nv + 6 > GOWN_STRAP_VERTS) return;
    const b0 = nv;
    for (const e of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) vtx([p[0] + e[0] * sz, p[1] + e[1] * sz * 1.2, p[2] + e[2] * sz], 0, 0);
    for (const [a, b2, c] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]] as const) jw.push(b0 + a, b0 + b2, b0 + c);
    nb++;
  };
  S.paths = [];
  for (const sd of def.sides) {
    const P = strapLine(B, T, D, d, sd, def.path, K, G);
    if (P.length < 3) continue;
    S.paths.push(P);
    const n = P.length, NR = P.map((p) => K.sd(p).n), b0 = nv, beads: P3[] = [];
    let s = 0;
    for (let k = 0; k < n; k++) {
      const a = P[Math.max(0, k - 1)]!, c = P[Math.min(n - 1, k + 1)]!, t: P3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], tl = Math.hypot(...t) || 1;
      t[0] /= tl; t[1] /= tl; t[2] /= tl;
      let nn: P3 = [0, 0, 0];
      for (let j = Math.max(0, k - 3); j <= Math.min(n - 1, k + 3); j++) for (let c2 = 0; c2 < 3; c2++) nn[c2] = nn[c2]! + NR[j]![c2]!;
      const dt = nn[0] * t[0] + nn[1] * t[1] + nn[2] * t[2];
      nn = [nn[0] - dt * t[0], nn[1] - dt * t[1], nn[2] - dt * t[2]];
      const nl = Math.hypot(...nn) || 1;
      nn = [nn[0] / nl, nn[1] / nl, nn[2] / nl];
      const bn: P3 = [t[1] * nn[2] - t[2] * nn[1], t[2] * nn[0] - t[0] * nn[2], t[0] * nn[1] - t[1] * nn[0]], p = P[k]!;
      if (k) s += dist(P[k - 1]!, p);
      // The end sewn under the bodice's edge lies flat inside the cloth.
      const az = Math.atan2(p[0], p[2] - czAt(p[1])), under = p[1] < envTopAt(T, az < 0 ? az + TAU : az) - 0.15 * cm;
      for (const [sw, sn] of [[0.5, 1], [-0.5, 1], [-0.5, 0], [0.5, 0]] as const) {
        const q: P3 = [p[0] + bn[0] * w * sw, p[1] + bn[1] * w * sw, p[2] + bn[2] * w * sw];
        K.push(q, 0.15 * cm);
        if (under) { const z = K.sd(q); if (z.d > 0.25 * cm) for (let c2 = 0; c2 < 3; c2++) q[c2] = q[c2]! - z.n[c2]! * (z.d - 0.25 * cm); }
        vtx([q[0] + nn[0] * th * sn, q[1] + nn[1] * th * sn, q[2] + nn[2] * th * sn], s / (8 * cm), sw + 0.5);
      }
      if (d.strapEdge === 'beaded' && k % 2 === 1) beads.push([p[0] + nn[0] * (th + 0.12 * cm), p[1] + nn[1] * (th + 0.12 * cm), p[2] + nn[2] * (th + 0.12 * cm)]);
    }
    for (let k = 0; k < n - 1; k++) for (let f = 0; f < 4; f++) { const a = b0 + k * 4 + f, b2 = b0 + k * 4 + ((f + 1) % 4), c = a + 4, e = b2 + 4; body.push(a, c, b2, b2, c, e); }
    // Closed ends.
    for (const k of [0, n - 1]) { const o = b0 + k * 4; if (k) body.push(o, o + 1, o + 2, o, o + 2, o + 3); else body.push(o, o + 2, o + 1, o, o + 3, o + 2); }
    // The beads, every other step along the strap. v199 writes each between the strap's own rows, which its faces then
    // run into; here they follow the strap's vertices (the same beads, in the same places).
    for (const b of beads) jewel(b, (kind === 'spaghetti' ? 0.16 : 0.2) * cm);
    len += s;
  }
  // Where the two halter straps meet at the nape: a covered button.
  if (kind === 'halter' && G.knot) jewel([G.knot[0], G.knot[1], G.knot[2] - 0.25 * cm], 0.5 * cm);
  S.len = len / M; S.beads = nb; S.nUsed = nv;
  g.setIndex([...body, ...jw]);
  g.clearGroups();
  g.addGroup(0, body.length, 0);
  if (jw.length) g.addGroup(body.length, jw.length, 1);
  ((g.attributes.rest as THREE.BufferAttribute).array as Float32Array).set(Pa);
  for (const k of ['position', 'rest', 'uv'] as const) (g.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  g.setDrawRange(0, Infinity);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return true;
}

/**
 * The straps against her skin (v199 `strapClip`): every vertex in use more than 2 mm inside her is `bad`; how far each
 * strap's centre line floats off the skin where it is not tucked under the bodice (`maxGapMm`).
 */
export function gownStrapClip(B: GownRig, T: GownEnvelope, S: GownStrapMesh): { n: number; bad: number; worstMm: number; maxGapMm: number } {
  const K = gownStrapSkin(B), C = (S.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, mm = B.P.S * 1000, czAt = czOf(T), used = new Uint8Array(S.nUsed);
  for (const v of S.geo.index?.array ?? []) used[v] = 1;
  let n = 0, bad = 0, worst = 0, maxGap = 0;
  for (let v = 0; v < S.nUsed; v++) {
    if (!used[v]) continue;
    const s = K.sd([C[v * 3]!, C[v * 3 + 1]!, C[v * 3 + 2]!]);
    n++;
    if (s.d * mm < -2) { bad++; worst = Math.min(worst, s.d * mm); }
  }
  for (const P of S.paths) for (const p of P) {
    const a = Math.atan2(p[0], p[2] - czAt(p[1]));
    if (p[1] < envTopAt(T, a < 0 ? a + TAU : a) + 0.002 / B.P.S) continue;
    maxGap = Math.max(maxGap, K.sd(p).d * mm);
  }
  return { n, bad, worstMm: worst, maxGapMm: maxGap };
}

/** The straps, the scalloped edge and the plunge in words, for the designer (v199 `strapSummary`). */
export function gownStrapSummary(d: GownStrapDesign & Pick<GownConfig, 'strapCol' | 'topEdge' | 'plungeFill'>, accented: boolean): string[] {
  const out: string[] = [], k = gownStrapKind(d);
  if (k !== 'none') {
    const def = GOWN_STRAP_DEF[k], where = k === 'one' ? ' on her left shoulder' : k === 'halter' ? ', meeting at the back of the neck with a covered button' : k === 'cross' ? ', crossing on the back' : k === 'offsh' ? ', resting on the upper arms' : '';
    out.push(`${def.name}${where}, ${def.w < 1 ? `${Math.round(def.w * 10)} mm` : `${def.w} cm`} wide, in ${d.strapCol === 'accent' && accented ? 'the accent colour' : 'the gown fabric'}${d.strapEdge === 'beaded' ? ', beaded' : ''}`);
  }
  if (gownScallopOn(d)) out.push('Scalloped top edge');
  if (d.neck === 'plungewaist') out.push(gownPlungeMeshOn(d) ? 'Plunge to the waist, filled with sheer modesty mesh' : 'Open plunge to the waist');
  return out;
}

/**
 * What the straps take (v199 `strapQuote`; unpriced until the designer prices them): a pair, or the one strap; their
 * length plus 15 % and 10 cm a strap, rounded up to 10 cm, as a rouleau or ribbon (1 cm wide or less) or in the gown's
 * fabric (or the accent's); the crystals on a beaded edge.
 */
export function gownStrapQuantities(d: GownStrapDesign, S: GownStrapMesh): { kind: GownStraps; metres: number; ribbon: boolean; beads: number } {
  const k = gownStrapKind(d);
  if (k === 'none') return { kind: k, metres: 0, ribbon: false, beads: 0 };
  const def = GOWN_STRAP_DEF[k];
  return { kind: k, metres: Math.ceil((S.len * 1.15 + 0.1 * def.sides.length) * 10) / 10, ribbon: def.w <= 1, beads: d.strapEdge === 'beaded' ? S.beads : 0 };
}
