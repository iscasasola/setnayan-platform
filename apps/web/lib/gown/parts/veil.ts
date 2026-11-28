/**
 * 👗 gown/parts/veil — sheer tulle from the crown, clearing her head, body, gown and any cape, on to the floor
 * (prototype v197 `buildVeil`, `veilEdge`, `veilCap`). Gathered at the crown, it wraps over the head and falls behind
 * to its length, measured from the crown; a classic veil's blusher is worn back unless she wants it over her face, when
 * it falls in front to below the bust. Styles: classic, mantilla (further back, framing the face, lace all round its
 * edge), drop, juliet cap (a lace cap edged with pearls, framing the face) and birdcage (a short net over the front).
 *
 * The veil is always drawn over what is under it: the stage gives its material a polygon offset and a later render
 * order (`GOWN_VEIL_DRAW`). Plain three.js maths on the posed body.
 */
import * as THREE from 'three';
import type { GownConfig } from '../../gown-config';
import { jointY } from '../body/bones';
import { BODY_K, RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { capeAt, type GownCapeMesh } from '../dress/cape';
import { GOWN_TRAIN_CM, GOWN_VEIL_CM, gownVeilFloor, gownVeilLong, trainShare } from '../dress/lines';
import type { GownOverlayMesh } from './overlay';
import { VEIL_COLS, VEIL_ROWS } from './veil-grid';
import { gownFlowerTopY, gownFlowerVeil, type GownFlowers } from './flowers';
import { reach, type GownEnvelope } from '../dress/table';

export { VEIL_COLS, VEIL_ROWS } from './veil-grid';
/** Rows of the mantilla's lace border, along the veil's edge. */
export const VEIL_EDGE_ROWS = 7;
/** Rows of the Juliet cap, from the crown to just above the ears. */
export const VEIL_CAP_ROWS = 10;
const VNA = VEIL_COLS, VNR = VEIL_ROWS, ER = VEIL_EDGE_ROWS, CR = VEIL_CAP_ROWS;
/** The mantilla's lace band at the end of every column (cm). */
export const GOWN_MANTILLA_BAND_CM = 9;
/** The Juliet cap's pearl band: its colour, and the tube's radius (cm). */
export const GOWN_JULIET_BAND = { colour: 0xf3ecdf, roughness: 0.25, sheen: 1, radiusCm: 0.4, renderOrder: 4 } as const;

/** How the stage draws the veil so it always lies over what is under it (v193 `veilMat`). */
export const GOWN_VEIL_DRAW = { colour: 0xffffff, renderOrder: 5, polygonOffset: -2, opacity: 0.3, roughness: 0.85, sheenRoughness: 0.4, edgeRenderOrder: 3 } as const;

export type GownVeilDesign = Pick<GownConfig, 'veil' | 'veilStyle' | 'blusher' | 'train'>;
export type GownVeilOut = { geo: THREE.BufferGeometry; edge: THREE.BufferGeometry; cap: THREE.BufferGeometry; band: THREE.Vector3[] };

export function emptyVeil(): GownVeilOut {
  const geo = new THREE.BufferGeometry(), ix: number[] = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VNR * VNA * 3), 3));
  for (let i = 0; i < VNR - 1; i++) for (let a = 0; a < VNA - 1; a++) { const p = i * VNA + a, q = p + VNA; ix.push(p, q, p + 1, p + 1, q, q + 1); }
  geo.setIndex(ix);
  const edge = new THREE.BufferGeometry(), ex: number[] = [], uv = new Float32Array(ER * VNA * 2);
  edge.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ER * VNA * 3), 3));
  for (let i = 0; i < ER; i++) for (let a = 0; a < VNA; a++) { uv[(i * VNA + a) * 2] = (a / (VNA - 1)) * 18; uv[(i * VNA + a) * 2 + 1] = i / (ER - 1); }
  for (let i = 0; i < ER - 1; i++) for (let a = 0; a < VNA - 1; a++) { const p = i * VNA + a, q = p + VNA; ex.push(p, q, p + 1, p + 1, q, q + 1); }
  edge.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  edge.setIndex(ex);
  const cap = new THREE.BufferGeometry(), cx: number[] = [], cuv = new Float32Array(CR * VNA * 2);
  cap.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CR * VNA * 3), 3));
  for (let i = 0; i < CR; i++) for (let a = 0; a < VNA; a++) { cuv[(i * VNA + a) * 2] = (a / (VNA - 1)) * 10; cuv[(i * VNA + a) * 2 + 1] = (i / (CR - 1)) * 1.5; }
  for (let i = 0; i < CR - 1; i++) for (let a = 0; a < VNA - 1; a++) { const p = i * VNA + a, q = p + VNA; cx.push(p, q, p + 1, p + 1, q, q + 1); }
  cap.setAttribute('uv', new THREE.BufferAttribute(cuv, 2));
  cap.setIndex(cx);
  return { geo, edge, cap, band: [] };
}

/**
 * Hang the veil (v197 `buildVeil`). `T` and `D` are the envelope and the dress of the same pose; `cape` the cape hung on
 * it, if any. Returns which pieces show: the veil, the mantilla's lace edge, and the Juliet cap (with its pearl band in
 * `out.band`, for the stage's tube).
 */
export function buildGownVeil(
  B: GownRig, T: GownEnvelope, D: GownDress, cape: GownCapeMesh | null, d: GownVeilDesign, out: GownVeilOut, floorY: number,
  overlayOut = 0, over: { overlay?: GownOverlayMesh | null; lite?: boolean; flowers?: GownFlowers | null } = {},
): { veil: boolean; edge: boolean; cap: boolean } {
  if (d.veil === 'none') return { veil: false, edge: false, cap: false };
  const V = B.V, P = B.P, hv = B.headV;
  let cx = 0, cy = 0, cz = 0, ymax = -1e9;
  for (const i of hv) { cx += V[i * 3]!; cy += V[i * 3 + 1]!; cz += V[i * 3 + 2]!; ymax = Math.max(ymax, V[i * 3 + 1]!); }
  cx /= hv.length; cy /= hv.length; cz /= hv.length;
  // Head outline: widest reach at each height around its own centre.
  const ring = new Float32Array(48), hy0 = cy - 0.24;
  for (const i of hv) { const j = Math.round((V[i * 3 + 1]! - hy0) / 0.01); if (j >= 0 && j < 48) ring[j] = Math.max(ring[j]!, Math.hypot(V[i * 3]! - cx, V[i * 3 + 2]! - cz)); }
  const headR = (y: number) => { const f = (y - hy0) / 0.01, j = Math.floor(f); return j < 0 || j >= 47 ? 0 : ring[j]! + (ring[j + 1]! - ring[j]!) * (f - j); };
  // Where it sits, how close it hugs, whether the face is framed or covered, how much it gathers.
  const VS = d.veilStyle, hug = VS === 'mantilla' || VS === 'juliet', bird = VS === 'birdcage';
  // A classic veil is worn back unless she asks for the blusher over her face (v197).
  const open = hug || (VS === 'classic' && d.blusher !== 'over');
  if (VS === 'mantilla') cz -= 0.02; // a mantilla sits further back on the head
  const trainCm = GOWN_TRAIN_CM[d.train];
  const top = ymax + (VS === 'mantilla' ? -0.012 : 0.004), off = 0.012, yA = D.L ? D.L.yA : BODY_K.yCh;
  const tanA = Math.tan(((hug ? 4 : VS === 'drop' ? 17 : 13) * Math.PI) / 180), foldA = VS === 'drop' ? 0.015 : VS === 'mantilla' ? 0.02 : 0.05;
  const yChin = cy - 0.115, yHair = cy + 0.05;
  const yBack = d.veil === 'fingertip' ? jointY(B, 'upperleg01.L') - 0.12 : d.veil === 'elbow' ? jointY(B, 'lowerarm01.L') - 0.02 : floorY + 0.008, yFront = yA - 0.09;
  // What is left of a long veil's length (from the crown) lies on the floor; it may lie over a longer train.
  const floorLen = gownVeilLong(d.veil) ? Math.max(0, GOWN_VEIL_CM[d.veil] / 100 / P.S - (top - yBack)) : 0;
  const pos = (out.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, R = new Float32Array(VNR), tableTop = T.y0 + (T.n - 2) * SLICE_DY;
  // v199: the veil keeps a few mm outside the gown as it is really drawn (skirt, overlay, train), all the way to the floor.
  const keep = veilGown(B, T, D, floorY, gownVeilFloor(d.veil), over.overlay ?? null, over.flowers ?? null);
  for (let a = 0; a < VNA; a++) {
    const ang = (TAU * a) / (VNA - 1), sx = Math.sin(ang), sz = Math.cos(ang), back = (1 - sz) / 2;
    let yEnd = yFront + (yBack - yFront) * smoothstep(back, 0.12, 0.8), Lfl = floorLen * smoothstep(back, 0.45, 1);
    if (open) yEnd = yEnd + (yHair - yEnd) * (1 - smoothstep(back, 0.18, 0.4)); // framing the face: open at the front, from the hairline back
    if (bird) { yEnd = top - 0.004 + (yChin - top) * (1 - smoothstep(back, 0.25, 0.42)); Lfl = 0; }
    // hang: the real length of cloth from the crown down to the floor, so what lies on the floor makes up the rest exactly.
    const Dv = Math.max(0.003, top - yEnd), Ltot = Dv + Lfl;
    let hang = 0, kF = -1;
    for (let i = 0; i < VNR; i++) {
      // Rows close together over the head.
      const u = i / (VNR - 1), sArc = Ltot * Math.pow(u, 1.7), o = (i * VNA + a) * 3, du = Ltot * (Math.pow(u, 1.7) - Math.pow(Math.max(0, u - 1 / (VNR - 1)), 1.7));
      if (sArc <= Dv) {
        const y = top - sArc;
        let r = 0.012 + sArc * tanA * (0.75 + 0.5 * back);
        r = Math.max(r, headR(y) + (hug && y > yChin - 0.02 ? 0.005 : bird ? 0.025 : 0.009));
        {
          // Over the body, the gown, the train's run-on and any cape.
          const phV = ang > Math.PI ? TAU - ang : ang, tS = clamp((T.yS - y) / Math.max(0.05, T.yS - T.yHem), 0, 1), gS = smoothstep(tS, 0.35, 1);
          const runOn = D.Lt && T.on ? D.Lt * trainShare(phV) * 0.14 * gS * gS * 1.1 : 0;
          for (let it = 0; it < 8 && y < tableTop; it++) {
            const px = cx + r * sx, pz = cz + r * sz, e = reach(T, px, y, pz), ce = capeAt(cape, px, y, pz), need = e.env + runOn + off + (y < T.yS ? overlayOut : 0), dc = ce ? ce.env + off - ce.r : 0;
            if (e.r >= need && dc <= 0) break;
            r += Math.min(0.06, Math.max(need - e.r, dc) + 0.001);
          }
        }
        // Tulle hangs: past the widest point of the head it falls straight, moving out only where it lands on the body;
        // it never tucks into the nape or under the chin.
        if (i) r = Math.max(r, R[i - 1]!);
        r = Math.min(r, 0.16 + sArc * 0.6);
        R[i] = r;
        const rr = r * (1 + foldA * smoothstep(u, 0.05, 0.6) * Math.sin(14 * ang + 1.3)); // soft folds, more towards the hem
        pos[o] = cx + rr * sx; pos[o + 1] = y; pos[o + 2] = cz + rr * sz;
        if (keep) keep(pos, o);
      } else {
        // On the floor it runs out behind.
        const q = o - VNA * 3;
        if (kF < 0) kF = Lfl > 1e-4 ? clamp((Ltot - hang) / Lfl, 0, 1.5) : 0;
        const dd = du * kF;
        pos[o] = pos[q]! + sx * dd * 0.15;
        pos[o + 1] = floorY + (trainCm > 0 ? 0.03 : 0.012);
        pos[o + 2] = pos[q + 2]! - dd * (0.55 + 0.45 * back);
        if (keep) keep(pos, o);
        R[i] = R[i - 1]!;
      }
      if (i && sArc <= Dv) { const q = o - VNA * 3; hang += Math.hypot(pos[o]! - pos[q]!, pos[o + 1]! - pos[q + 1]!, pos[o + 2]! - pos[q + 2]!); }
    }
  }
  // While she walks only the vertices are kept out; the finer pass waits until she stops.
  if (keep && !over.lite) keep.cloth(pos);
  (out.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  out.geo.computeVertexNormals();
  out.geo.computeBoundingSphere();
  // Mantilla: lace all round the edge, beside her face too: a band of about 9 cm at the end of every column (v197 `veilEdge`).
  const edge = VS === 'mantilla';
  if (edge) {
    const Q = (out.edge.attributes.position as THREE.BufferAttribute).array as Float32Array, Wb = GOWN_MANTILLA_BAND_CM / 100 / P.S, cum = new Float32Array(VNR);
    for (let a = 0; a < VNA; a++) {
      cum[0] = 0;
      for (let i = 1; i < VNR; i++) { const p = (i * VNA + a) * 3, q = p - VNA * 3; cum[i] = cum[i - 1]! + Math.hypot(pos[p]! - pos[q]!, pos[p + 1]! - pos[q + 1]!, pos[p + 2]! - pos[q + 2]!); }
      const S = cum[VNR - 1]!, w = Math.min(Wb, S * 0.6);
      let j = 0;
      for (let i = 0; i < ER; i++) {
        const sv = S - w + (w * i) / (ER - 1);
        while (j < VNR - 2 && cum[j + 1]! < sv) j++;
        const f = cum[j + 1]! > cum[j]! ? clamp((sv - cum[j]!) / (cum[j + 1]! - cum[j]!), 0, 1) : 0, p = (j * VNA + a) * 3, q = p + VNA * 3, t = (i * VNA + a) * 3;
        Q[t] = pos[p]! + (pos[q]! - pos[p]!) * f; Q[t + 1] = pos[p + 1]! + (pos[q + 1]! - pos[p + 1]!) * f + 0.0015; Q[t + 2] = pos[p + 2]! + (pos[q + 2]! - pos[p + 2]!) * f;
      }
    }
    (out.edge.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    out.edge.computeVertexNormals();
  }
  // Juliet cap: a close lace cap over the back of the head, from the crown down to just above the ears, edged with a
  // band of pearls; the veil falls from it (v197 `veilCap`).
  const capOn = VS === 'juliet';
  out.band = [];
  if (capOn) {
    const Q = (out.cap.attributes.position as THREE.BufferAttribute).array as Float32Array, yLo = cy - 0.035;
    for (let a = 0; a < VNA; a++) {
      let iEnd = 1;
      while (iEnd < VNR - 1 && pos[(iEnd * VNA + a) * 3 + 1]! > yLo) iEnd++;
      const back = (1 - Math.cos((TAU * a) / (VNA - 1))) / 2, k = smoothstep(back, 0.3, 0.55);
      for (let i = 0; i < CR; i++) {
        const f = (i / (CR - 1)) * iEnd * k, j = Math.min(VNR - 2, f | 0), w = f - j, p = (j * VNA + a) * 3, q = p + VNA * 3, t = (i * VNA + a) * 3;
        for (let c = 0; c < 3; c++) Q[t + c] = pos[p + c]! + (pos[q + c]! - pos[p + c]!) * w;
        Q[t + 1] = Q[t + 1]! + 0.001;
      }
      if (k > 0.5) { const t = ((CR - 1) * VNA + a) * 3; out.band.push(new THREE.Vector3(Q[t], Q[t + 1], Q[t + 2])); }
    }
    (out.cap.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    out.cap.computeVertexNormals();
  }
  return { veil: true, edge, cap: capOn };
}

type VeilKeep = ((P: Float32Array, o: number) => void) & { cloth: (P: Float32Array) => void };
/**
 * The gown as it is really drawn (skirt, overlay, train on the floor), read once per build: the veil keeps 4 mm outside
 * all of it, all the way to the floor (v199 `veilGown`). Null when there is no gown drawn. `low` says the veil reaches
 * the floor (it then also keeps up off a train lying there).
 */
export function veilGown(B: GownRig, T: GownEnvelope, D: GownDress, fl: number, low: boolean, ovl: GownOverlayMesh | null, flw: GownFlowers | null = null): VeilKeep | null {
  if (!(D.geo && T.on && D.rows > 2)) return null;
  const N = RING_N, DTH = TAU / N, czAt = (y: number) => { const f = clamp((y - T.y0) / SLICE_DY, 0, T.n - 1.001), j = f | 0; return T.cz[j]! + (T.cz[j + 1]! - T.cz[j]!) * (f - j); };
  const DP = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, rows = D.rows, r0 = Math.min(rows - 2, D.nb + 1), rS = Math.min(rows, 2 + D.nb + D.ns), WY = 0.01;
  // An overskirt lies over it.
  const OP = ovl ? ((ovl.geo.attributes.position as THREE.BufferAttribute).array as Float32Array) : null;
  let yHi = fl;
  for (let o = r0 * N * 3 + 1, e = rS * N * 3; o < e; o += 3) yHi = Math.max(yHi, DP[o]!);
  if (OP) for (let o = 1; o < OP.length; o += 3) yHi = Math.max(yHi, OP[o]!);
  // v200: 3D flowers on the bodice keep the veil off too.
  yHi = Math.max(yHi, gownFlowerTopY(flw));
  const nY = Math.ceil((yHi - fl) / WY) + 2, W = new Float32Array(nY * N);
  const put = (j: number, k0: number, k1: number, r: number) => { const o = j * N; if (r > W[o + k0]!) W[o + k0] = r; if (r > W[o + k1]!) W[o + k1] = r; };
  // One strip of cloth between two rows: its reach at every height it spans, into both neighbouring heights and
  // directions (a hem or a tier's edge is never missed between samples).
  const seg = (P: Float32Array, p1: number, p2: number) => {
    const x1 = P[p1]!, y1 = P[p1 + 1]!, x2 = P[p2]!, y2 = P[p2 + 1]!, c1 = czAt(y1), c2 = czAt(y2), z1 = P[p1 + 2]! - c1, z2 = P[p2 + 2]! - c2;
    let a = Math.atan2(x1 + x2, z1 + z2) / DTH;
    if (a < 0) a += N;
    const k0 = (a | 0) % N, k1 = (k0 + 1) % N, f1 = clamp((y1 - fl) / WY, 0, nY - 1), f2 = clamp((y2 - fl) / WY, 0, nY - 1), jA = Math.floor(Math.min(f1, f2)), jB = Math.ceil(Math.max(f1, f2));
    for (let j = jA; j <= jB; j++) { const u = f1 === f2 ? 0 : clamp((j - f1) / (f2 - f1), 0, 1), r = Math.hypot(x1 + (x2 - x1) * u, z1 + (z2 - z1) * u); put(j, k0, k1, r); }
  };
  // The skirt as drawn: folds, pleats, a petticoat's hold.
  for (let r = r0; r < rS - 1; r++) for (let q = 0; q < N; q++) seg(DP, (r * N + q) * 3, ((r + 1) * N + q) * 3);
  if (OP && ovl) { const NC = ovl.NC; for (let l = 0; l < ovl.nL; l++) for (let r = 0; r < ovl.NR - 1; r++) for (let c = 0; c < NC; c++) seg(OP, ((l * ovl.NR + r) * NC + c) * 3, ((l * ovl.NR + r + 1) * NC + c) * 3); }
  // v200: and outside every 3D flower.
  gownFlowerVeil(flw, T, put, fl, WY, nY);
  // Below the hem it is still under the skirt: the hem's own reach down to the floor.
  for (let q = 0; q < N; q++) { let j = 0; while (j < nY - 1 && !W[j * N + q]) j++; for (let k = 0; k < j; k++) W[k * N + q] = W[j * N + q]!; }
  let top: ((x: number, z: number) => number) | null = null;
  if (low && rows > rS) {
    // The train lying on the floor: its height over each spot.
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let o = (rS - 1) * N * 3, e = rows * N * 3; o < e; o += 3) { x0 = Math.min(x0, DP[o]!); x1 = Math.max(x1, DP[o]!); z0 = Math.min(z0, DP[o + 2]!); z1 = Math.max(z1, DP[o + 2]!); }
    const TC = 0.04, nx = Math.ceil((x1 - x0) / TC) + 2, nz = Math.ceil((z1 - z0) / TC) + 2, Hh = new Float32Array(nx * nz).fill(-1e9);
    const tri = (a: number, b: number, c: number) => {
      const ax = DP[a]!, az = DP[a + 2]!, bx = DP[b]!, bz = DP[b + 2]!, cx = DP[c]!, cz = DP[c + 2]!, d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / TC)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / TC)), k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / TC)), k1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz, cz) - z0) / TC));
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
        const px = x0 + i * TC, pz = z0 + k * TC;
        let y: number;
        if (Math.abs(d) > 1e-12) {
          let l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
          if (l1 < -0.25 || l2 < -0.25 || l3 < -0.25) continue; // a little past its edges too: no gap between cells
          l1 = Math.max(0, l1); l2 = Math.max(0, l2); l3 = Math.max(0, l3);
          y = (DP[a + 1]! * l1 + DP[b + 1]! * l2 + DP[c + 1]! * l3) / (l1 + l2 + l3);
        } else y = Math.max(DP[a + 1]!, DP[b + 1]!, DP[c + 1]!);
        const o = i * nz + k;
        if (y > Hh[o]!) Hh[o] = y;
      }
    };
    for (let r = rS - 1; r < rows - 1; r++) for (let q = 0; q < N; q++) { const a = (r * N + q) * 3, b = (r * N + ((q + 1) % N)) * 3, c = a + N * 3, d = b + N * 3; tri(a, c, b); tri(b, c, d); }
    top = (x, z) => {
      const fi = (x - x0) / TC, fk = (z - z0) / TC, i = Math.floor(fi), k = Math.floor(fk);
      let h = -1e9;
      for (let di = 0; di <= 1; di++) for (let dk = 0; dk <= 1; dk++) { const ii = i + di, kk = k + dk; if (ii >= 0 && ii < nx && kk >= 0 && kk < nz) h = Math.max(h, Hh[ii * nz + kk]!); }
      return h;
    };
  }
  const cl = 0.004 / B.P.S;
  // Per veil column: once it has lain on the skirt it falls straight from there, never back in under an edge (a tier, a hem).
  const carry = new Float32Array(VNA);
  // The widest at each height: most of the veil is quickly seen to be clear.
  const RM = new Float32Array(nY);
  for (let j = 0; j < nY; j++) { let m = 0; for (let q = 0; q < N; q++) m = Math.max(m, W[j * N + q]!); RM[j] = m; }
  // Vertices within a few cm of the skirt: only their triangles need a second look.
  const near = new Uint8Array(VNR * VNA);
  // Push one vertex out of the skirt (from her centre line), then up off the train.
  const keep = ((P: Float32Array, o: number) => {
    const y = P[o + 1]!, j = (y - fl) / WY;
    if (j < nY - 1) {
      const j0 = clamp(Math.floor(j), 0, nY - 1), j1 = Math.min(nY - 1, j0 + 1), cz = czAt(y), dx = P[o]!, dz = P[o + 2]! - cz, r = Math.hypot(dx, dz);
      let a = Math.atan2(dx, dz) / DTH;
      if (a < 0) a += N;
      const k0 = (a | 0) % N, k1 = (k0 + 1) % N, w = a - (a | 0), rd = (jj: number) => W[jj * N + k0]! * (1 - w) + W[jj * N + k1]! * w, c = (o / 3) % VNA;
      const need = Math.max(rd(j0), rd(j1), rd(Math.min(nY - 1, j1 + 1))) + cl;
      let nd = Math.max(need, carry[c]!);
      if (r < need + cl * 2.5) carry[c] = Math.max(carry[c]!, need); // lying on it (or within a centimetre of it): from here down it may not tuck back in
      // And the cloth between this row and the one above clears the skirt too (a long drop over a full skirt's curve).
      const q = o - VNA * 3, yP = q >= 0 ? P[q + 1]! : y;
      if (yP > y + WY) {
        const cP = czAt(yP), rP = Math.hypot(P[q]!, P[q + 2]! - cP);
        for (let jj = Math.max(0, Math.ceil(j)), jE = Math.min(nY - 1, Math.floor((yP - fl) / WY)); jj <= jE; jj++) { const t = (yP - fl - jj * WY) / (yP - y); if (t > 0.05) nd = Math.max(nd, Math.min(rP + (rd(jj) + cl - rP) / t, need + 0.5)); }
      }
      if (r < nd + 0.03) near[o / 3] = 1;
      if (r > 1e-6 && r < nd) { const k = nd / r; P[o] = dx * k; P[o + 2] = cz + dz * k; }
    }
    if (top) { const h = top(P[o]!, P[o + 2]!) + cl; if (P[o + 1]! < h) P[o + 1] = h; }
  }) as VeilKeep;
  const push = (P: Float32Array, v: number, d: number) => { const y = P[v + 1]!, cz = czAt(y), dx = P[v]!, dz = P[v + 2]! - cz, r = Math.hypot(dx, dz); if (r > 1e-6) { const k = (r + d) / r; P[v] = dx * k; P[v + 2] = cz + dz * k; } };
  // Then the cloth between the vertices: where a fold or a long drop (the side of a long veil, over a full skirt) still
  // cuts into it, ease that triangle out.
  keep.cloth = (P) => {
    const hc = cl * 0.6, Dm = new Float32Array(VNR * VNA), S4 = [0, 0, 0, 0];
    // A point on the cloth (the mean of n vertices): how far inside the skirt.
    const chk = (n: number) => {
      let x = 0, y = 0, z = 0;
      for (let t = 0; t < n; t++) { x += P[S4[t]!]!; y += P[S4[t]! + 1]!; z += P[S4[t]! + 2]!; }
      x /= n; y /= n; z /= n;
      const f = (y - fl) / WY;
      if (f >= nY - 1 || f < 0) return 0;
      const j0 = Math.floor(f), j1 = Math.min(nY - 1, j0 + 1), cz = czAt(y), dx = x, dz = z - cz, r = Math.hypot(dx, dz);
      if (r >= Math.max(RM[j0]!, RM[j1]!) + hc) return 0;
      let an = Math.atan2(dx, dz) / DTH;
      if (an < 0) an += N;
      const k0 = (an | 0) % N, k1 = (k0 + 1) % N, wt = an - (an | 0), d = Math.max(W[j0 * N + k0]!, W[j1 * N + k0]!) * (1 - wt) + Math.max(W[j0 * N + k1]!, W[j1 * N + k1]!) * wt + hc - r;
      if (d > 1e-5) { for (let t = 0; t < n; t++) Dm[S4[t]! / 3] = Math.max(Dm[S4[t]! / 3]!, d); return 1; }
      return 0;
    };
    for (let pass = 0; pass < 4; pass++) {
      let moved = 0;
      Dm.fill(0);
      for (let i = 0; i < VNR - 1; i++) for (let a = 0; a < VNA - 1; a++) {
        const p = (i * VNA + a) * 3, q = p + VNA * 3;
        if (!(near[p / 3]! | near[p / 3 + 1]! | near[q / 3]! | near[q / 3 + 1]!)) continue;
        // The middle of the cell, its diagonal and two of its sides (the other two are a neighbour's).
        S4[0] = p; S4[1] = p + 3; S4[2] = q; S4[3] = q + 3; moved += chk(4);
        S4[0] = p + 3; S4[1] = q; moved += chk(2); S4[1] = p; moved += chk(2); S4[0] = q; moved += chk(2);
      }
      if (!moved) break;
      // Each vertex moves once a pass, by the most any of its triangles needs.
      for (let v = 0; v < VNR * VNA; v++) if (Dm[v]) push(P, v * 3, Dm[v]!);
    }
  };
  return keep;
}
