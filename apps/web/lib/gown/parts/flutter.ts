/**
 * 👗 gown/parts/flutter — flutter cape sleeves (prototype v195 `flutterSleeve`, `writeFlutter`, `flutterMetres`): a half
 * circle of soft fabric from the shoulder seam to about the elbow, open under the arm. Sewn along the top of the armhole
 * only (front, over the shoulder, back); nothing under the arm. Each column of the cloth starts on that seam and falls
 * under its own weight: where the arm is under it, it lies along the arm; where it is not, it hangs straight down. It
 * never goes into the arm, the hand or her body, and stands a little further off toward its fluted hem. Built on the
 * sleeve's own mesh, so it hides with the gown and takes the sleeve fabric like any sleeve.
 */
import * as THREE from 'three';
import { BODY_K, SLICE_DY } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import type { GownCloth } from '../dress/cloth';
import { reach, type GownEnvelope } from '../dress/table';
import { SLEEVE_COLS, SLEEVE_ROWS } from './sleeves-grid';

const SNA = SLEEVE_COLS, SNR = SLEEVE_ROWS, TAU = Math.PI * 2;
/** How far round under the arm the seam runs at each end (radians), length on top of the arm (share of shoulder to elbow), flutes across the width. */
export const GOWN_FLUTTER = { edge: 0.38, reach: 1.0, flutes: 8 } as const;
/** Seated and kneeling: the arms come forward and the cloth would fold into the lap; hidden there, still in the design. */
export const GOWN_FLUTTER_HIDE: readonly string[] = ['kneel', 'sit', 'cross'];

/** What the sleeve builder hands the flutter (v195 passes the same locals). */
export type GownFlutterCtx = {
  B: GownRig; T: GownEnvelope;
  S: THREE.Vector3; E: THREE.Vector3; u: THREE.Vector3; f: THREE.Vector3; Lu: number; Lf: number;
  frame: (s: number) => { t: THREE.Vector3; r: THREE.Vector3; v: THREE.Vector3 };
  ctr: (s: number) => THREE.Vector3;
  Rs: (s: number, a: number) => number;
  strapless: boolean; yCut: number; off: number; cm: number;
  pos: Float32Array; uvA: Float32Array; R: Float32Array; ns: number; s0: number; SDS: number; SBA: number; laceCm: number;
};

/** Lay a flutter sleeve (v195 `flutterSleeve`). Returns each column's length. */
export function flutterSleeve(c: GownFlutterCtx): Float32Array {
  const { B, T, S, E, u, f, Lu, Lf, frame, ctr, Rs, strapless, yCut, off, cm, pos, uvA, R, ns, s0, SDS, SBA } = c;
  const A = SNA + 1, K = SNR - 1, Y = new THREE.Vector3(0, 1, 0), hand = B.handLen || 0.08, tableTop = T.y0 + (T.n - 2) * SLICE_DY, yPit = S.y - 0.05;
  const tCz = (y: number) => { const fy = clamp((y - T.y0) / SLICE_DY, 0, T.n - 1.001), j = fy | 0; return T.cz[j]! + (T.cz[j + 1]! - T.cz[j]!) * (fy - j); };
  // The arm's widest reach along its length.
  const Rmax = new Float32Array(ns);
  for (let k = 0; k < ns; k++) { let m = 0; for (let a = 0; a < SBA; a++) m = Math.max(m, R[k * SBA + a]!); Rmax[k] = m; }
  const rAt = (s: number) => { const fk = clamp((s - s0) / SDS, 0, ns - 1.001), k = fk | 0, w = fk - k; return Rmax[k]! * (1 - w) + Rmax[k + 1]! * w; };
  const d = new THREE.Vector3(), rad = new THREE.Vector3();
  // The nearest point on the arm's centre line (upper arm, forearm, hand), with the arm's own reach there.
  const near = (p: THREE.Vector3) => {
    d.copy(p).sub(S);
    const t1 = clamp(d.dot(u), s0, Lu), q1 = S.clone().addScaledVector(u, t1), d1 = p.distanceTo(q1);
    d.copy(p).sub(E);
    const t2 = clamp(d.dot(f), 0, Lf + hand), q2 = E.clone().addScaledVector(f, t2), d2 = p.distanceTo(q2);
    return d1 <= d2 ? { q: q1, dist: d1, r: rAt(t1) } : { q: q2, dist: d2, r: t2 > Lf ? Math.max(rAt(Lu + Lf), 4.2 * cm) : rAt(Lu + t2) };
  };
  // Push a point out of the arm (and below the armpit, out of her body and bodice).
  const clear = (p: THREE.Vector3, gap: number, body: boolean) => {
    for (let it = 0; it < 2; it++) {
      const n = near(p), need = n.r + gap;
      if (n.dist < need && n.dist > 1e-6) { rad.copy(p).sub(n.q).multiplyScalar(need / n.dist); p.copy(n.q).add(rad); }
    }
    if (body && p.y < yPit && p.y < tableTop && p.y > T.y0) {
      const e = reach(T, p.x, p.y, p.z), need = e.env + off + 0.3 * cm;
      if (e.r < need && e.r > 1e-5) { const cz = tCz(p.y), k = need / e.r; p.x *= k; p.z = cz + (p.z - cz) * k; }
    }
  };
  // The cloth at a distance s along the arm and a share w of its width (+1 its front edge, 0 the top of the arm, -1 its
  // back edge). Two ways it can hang, blended by how level the arm is: arm down, a bell round the arm that widens toward
  // the hem (the circle cut); arm out, the cloth lies over the top of the arm and, past the arm's widest point (front and
  // back), falls straight down in two curtains.
  const L0 = GOWN_FLUTTER.reach * Lu, P3 = new Float32Array(SNR * A * 3), lens = new Float32Array(A), Om = Math.PI + 2 * GOWN_FLUTTER.edge, flare = 0.85;
  const at = (s: number, w: number, sA: number, out: THREE.Vector3) => {
    const c0 = ctr(s), t = s <= Lu ? u : f, Ut = Y.clone().addScaledVector(t, -Y.dot(t)), h = Ut.length();
    if (h < 0.12) Ut.set(S.x > 0 ? 1 : -1, 0, 0).addScaledVector(t, -(S.x > 0 ? t.x : -t.x));
    Ut.normalize();
    const Sd = new THREE.Vector3().crossVectors(t, Ut).normalize();
    if (Sd.z < 0) Sd.negate();
    const ds = Math.max(0, s - sA), gp = off + (0.3 + 1.2 * Math.pow(clamp(ds / L0, 0, 1), 1.3)) * cm, rA = rAt(s) + gp, r0 = rAt(sA) + off, Wd = Om * r0 + 2 * flare * ds, arc = (w * Wd) / 2;
    const rb = Math.max(rA, Wd / Om), bb = arc / rb, WdD = Om * r0 + 2 * 0.45 * ds, arcD = (w * WdD) / 2;
    const bell = c0.clone().addScaledVector(Ut, rb * Math.cos(bb)).addScaledVector(Sd, rb * Math.sin(bb));
    const top = (rA * Math.PI) / 2, drape = c0.clone();
    if (Math.abs(arcD) <= top) { const b2 = arcD / rA; drape.addScaledVector(Ut, rA * Math.cos(b2)).addScaledVector(Sd, rA * Math.sin(b2)); }
    else { drape.addScaledVector(Sd, Math.sign(arcD) * rA); drape.y -= Math.abs(arcD) - top; } // over the arm, then straight down from its widest point
    return out.copy(bell).lerp(drape, smoothstep(h, 0.3, 0.72));
  };
  for (let a = 0; a < A; a++) {
    // a = 0: its front edge; middle: on top of the arm; a = SNA: its back edge.
    const w = 1 - (2 * a) / SNA, ang = GOWN_FLUTTER.edge - (Om * a) / SNA, e = Math.abs(w);
    let sA = -0.035;
    if (strapless) {
      sA = s0;
      for (let it = 0; it < 60; it++) {
        const fr = frame(sA), aa = (((ang / TAU) * SNA) % SNA + SNA) % SNA, r0 = Rs(sA, aa), p0 = ctr(sA).addScaledVector(fr.r, r0 * Math.cos(ang)).addScaledVector(fr.v, r0 * Math.sin(ang));
        if (p0.y <= yCut) break;
        sA += 0.004;
      }
    }
    // A half circle: a little shorter at its open edges.
    const Lc = Math.max(0.04, L0 - Math.max(0, sA) * 0.6) * (1 - 0.38 * e * e) * (1 + 0.025 * Math.sin(GOWN_FLUTTER.flutes * Math.PI * (1 - w) + 0.7));
    lens[a] = Lc;
    const p = new THREE.Vector3();
    for (let k = 0; k <= K; k++) {
      at(sA + (Lc * k) / K, w, sA, p);
      if (k) clear(p, off + 0.3 * cm, true);
      const o = (k * A + a) * 3;
      P3[o] = p.x; P3[o + 1] = p.y; P3[o + 2] = p.z;
    }
  }
  // The columns eased into one another: one soft sheet, not strips.
  const tmp = new Float32Array(A * 3), p = new THREE.Vector3();
  for (let k = 1; k <= K; k++) {
    const v = k / K;
    for (let a = 0; a < A; a++) {
      const l = Math.max(0, a - 1), r = Math.min(SNA, a + 1);
      for (let c3 = 0; c3 < 3; c3++) tmp[a * 3 + c3] = (P3[(k * A + l) * 3 + c3]! + 2 * P3[(k * A + a) * 3 + c3]! + P3[(k * A + r) * 3 + c3]!) / 4;
    }
    for (let a = 0; a < A; a++) { p.fromArray(tmp, a * 3); clear(p, off + (0.3 + 1.4 * Math.pow(v, 1.3)) * cm, true); p.toArray(P3, (k * A + a) * 3); }
  }
  // Flutes: soft folds across the width, deeper toward the hem, always outward.
  const nrm = new THREE.Vector3(), ta = new THREE.Vector3(), tv = new THREE.Vector3(), Q = Float32Array.from(P3);
  for (let k = 1; k <= K; k++) {
    const v = k / K, amp = 2.4 * cm * Math.pow(v, 1.4);
    for (let a = 0; a < A; a++) {
      const o = (k * A + a) * 3, al = (k * A + Math.max(0, a - 1)) * 3, ar = (k * A + Math.min(SNA, a + 1)) * 3, ou = ((k - 1) * A + a) * 3, od = (Math.min(K, k + 1) * A + a) * 3;
      ta.set(Q[ar]! - Q[al]!, Q[ar + 1]! - Q[al + 1]!, Q[ar + 2]! - Q[al + 2]!);
      tv.set(Q[od]! - Q[ou]!, Q[od + 1]! - Q[ou + 1]!, Q[od + 2]! - Q[ou + 2]!);
      nrm.crossVectors(ta, tv);
      const nl = nrm.length();
      if (nl < 1e-9) continue;
      nrm.divideScalar(nl);
      p.fromArray(Q, o);
      const n = near(p);
      if (nrm.dot(rad.copy(p).sub(n.q)) < 0) nrm.negate();
      const fl = amp * (0.5 + 0.5 * Math.sin((GOWN_FLUTTER.flutes * TAU * a) / SNA + 0.7));
      p.addScaledVector(nrm, fl);
      clear(p, off + 0.3 * cm, true);
      p.toArray(P3, o);
    }
  }
  {
    // Last: never inside her skin (nearest skin point, along its own normal).
    const V = B.V, NM = B.geo.attributes.normal ? (B.geo.attributes.normal.array as Float32Array) : null, h = 2.5 * cm, yLo = BODY_K.yWaist, grid = new Map<number, number[]>();
    const key = (x: number, y: number, z: number) => Math.floor(x / h) + 500 + 1000 * (Math.floor(y / h) + 500) + 1e6 * (Math.floor(z / h) + 500);
    if (NM) {
      for (let i = 0; i < B.n; i++) {
        if (V[i * 3 + 1]! < yLo) continue;
        const kk = key(V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!);
        let L = grid.get(kk);
        if (!L) grid.set(kk, (L = []));
        L.push(i);
      }
      const gmin = off * 0.8;
      for (let o = 0; o < P3.length; o += 3) for (let it = 0; it < 2; it++) {
        const x = P3[o]!, y = P3[o + 1]!, z = P3[o + 2]!;
        let bd = 1e9, bi = -1;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const L = grid.get(key(x + dx * h, y + dy * h, z + dz * h));
          if (!L) continue;
          for (const i of L) { const dd = (x - V[i * 3]!) ** 2 + (y - V[i * 3 + 1]!) ** 2 + (z - V[i * 3 + 2]!) ** 2; if (dd < bd) { bd = dd; bi = i; } }
        }
        if (bi < 0) break;
        const nx = NM[bi * 3]!, ny = NM[bi * 3 + 1]!, nz = NM[bi * 3 + 2]!, nl = Math.hypot(nx, ny, nz) || 1, sd = ((x - V[bi * 3]!) * nx + (y - V[bi * 3 + 1]!) * ny + (z - V[bi * 3 + 2]!) * nz) / nl;
        if (sd >= gmin || gmin - sd > 4 * cm) break;
        const k2 = (gmin - sd) / nl;
        P3[o] = x + nx * k2; P3[o + 1] = y + ny * k2; P3[o + 2] = z + nz * k2;
      }
    }
  }
  for (let k = 0; k <= K; k++) for (let a = 0; a < A; a++) {
    const o = (k * A + a) * 3;
    pos[o] = P3[o]!; pos[o + 1] = P3[o + 1]!; pos[o + 2] = P3[o + 2]!;
    uvA[(k * A + a) * 2] = (a / SNA) * 3;
    uvA[(k * A + a) * 2 + 1] = (lens[a]! * k) / K / (c.laceCm * cm);
  }
  return lens;
}

/**
 * The twirl (v195 `writeFlutter`): the sleeves' lower edge trails the turn a little and lifts out, like the cape. `base`
 * is the still shape the sleeve was built with; `geo` is drawn. The shape is rebuilt whenever she poses.
 */
export function writeFlutter(geo: THREE.BufferGeometry, base: Float32Array, C: GownCloth, B: GownRig, T: GownEnvelope): void {
  const P = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  if (P.length !== base.length) return;
  const sig = C.th[3]! * 3 + C.phi[3]!;
  if (Math.abs(sig) < 1e-5) P.set(base);
  else {
    const A = SNA + 1, lag = C.th[3]! * 0.55, fl = Math.max(0, C.phi[3]!) * 0.12;
    for (let i = 0; i < SNR; i++) {
      const w = Math.pow(i / (SNR - 1), 1.5);
      for (let a = 0; a < A; a++) {
        const o = (i * A + a) * 3, y = base[o + 1]!, cz = B.zcAt(Math.max(y, T.yF)), x = base[o]!, z = base[o + 2]! - cz, r = Math.hypot(x, z) * (1 + fl * w), an = Math.atan2(x, z) - lag * w;
        P[o] = r * Math.sin(an); P[o + 1] = y; P[o + 2] = cz + r * Math.cos(an);
      }
    }
  }
  (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * Both flutter sleeves laid flat (v195 `flutterMetres`, metres of 150 cm fabric): each a half circle, side by side across
 * the width; at least 0.5 m. `sleeves` are the two sleeves as built (null when not worn).
 */
export function flutterMetres(B: GownRig, sleeves: readonly (THREE.BufferGeometry | null)[]): number {
  const S = B.P.S, NA = SNA + 1;
  let L = 0, Ar = 0;
  for (const g of sleeves) {
    if (!g) continue;
    const P = (g.attributes.position as THREE.BufferAttribute).array as Float32Array, ix = g.index!.array;
    for (let a = 0; a < NA; a++) {
      let s = 0;
      for (let i = 1; i < SNR; i++) { const p0 = ((i - 1) * NA + a) * 3, p1 = (i * NA + a) * 3; s += Math.hypot(P[p1]! - P[p0]!, P[p1 + 1]! - P[p0 + 1]!, P[p1 + 2]! - P[p0 + 2]!); }
      L = Math.max(L, s);
    }
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t]! * 3, b = ix[t + 1]! * 3, c = ix[t + 2]! * 3;
      const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!, vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
      Ar += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
  }
  if (!L) L = 0.3 / S;
  return Math.round(Math.max(0.5, (L * S + 0.08) * (4 * L * S + 0.1 > 1.45 ? 2 : 1), ((Ar * S * S) / 1.4) * 1.5 + 0.1) * 10) / 10;
}
