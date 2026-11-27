/**
 * 👗 gown/parts/veil — sheer tulle from the crown, clearing her head, body, gown and any cape, on to the floor
 * (prototype v193 `buildVeil`, `veilEdge`). Gathered at the crown, it wraps over the head, falls in front as a blusher
 * to below the bust, and behind to its full length. Styles: classic, mantilla (further back, framing the face, with a
 * lace border), drop, juliet cap (framing the face) and birdcage (a short net over the front only).
 *
 * The veil is always drawn over what is under it: the stage gives its material a polygon offset and a later render
 * order (`GOWN_VEIL_DRAW`). Plain three.js maths on the posed body.
 */
import * as THREE from 'three';
import type { GownConfig } from '../../gown-config';
import { jointY } from '../body/bones';
import { BODY_K, SLICE_DY, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { capeAt, type GownCapeMesh } from '../dress/cape';
import { GOWN_TRAIN_CM, GOWN_VEIL_CM, trainShare } from '../dress/lines';
import { reach, type GownEnvelope } from '../dress/table';

/** All the way round (first and last column meet), crown to hem. */
export const VEIL_COLS = 65;
export const VEIL_ROWS = 80;
/** Rows of the mantilla's lace border, along the veil's edge. */
export const VEIL_EDGE_ROWS = 7;
const VNA = VEIL_COLS, VNR = VEIL_ROWS, ER = VEIL_EDGE_ROWS;

/** How the stage draws the veil so it always lies over what is under it (v193 `veilMat`). */
export const GOWN_VEIL_DRAW = { colour: 0xffffff, renderOrder: 5, polygonOffset: -2, opacity: 0.3, roughness: 0.85, sheenRoughness: 0.4, edgeRenderOrder: 3 } as const;

export type GownVeilDesign = Pick<GownConfig, 'veil' | 'veilStyle' | 'hem' | 'train'>;

export function emptyVeil(): { geo: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
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
  return { geo, edge };
}

/**
 * Hang the veil (v193 `buildVeil`). `T` and `D` are the envelope and the dress of the same pose; `cape` the cape hung on
 * it, if any. Returns which pieces show: the veil, and the mantilla's lace edge.
 */
export function buildGownVeil(
  B: GownRig, T: GownEnvelope, D: GownDress, cape: GownCapeMesh | null, d: GownVeilDesign, out: { geo: THREE.BufferGeometry; edge: THREE.BufferGeometry }, floorY: number,
  overlayOut = 0,
): { veil: boolean; edge: boolean } {
  if (d.veil === 'none') return { veil: false, edge: false };
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
  if (VS === 'mantilla') cz -= 0.02; // a mantilla sits further back on the head
  const trainCm = GOWN_TRAIN_CM[d.train];
  const top = ymax + (VS === 'mantilla' ? -0.012 : 0.004), off = 0.012, yA = D.L ? D.L.yA : BODY_K.yCh;
  const tanA = Math.tan(((hug ? 4 : VS === 'drop' ? 17 : 13) * Math.PI) / 180), foldA = VS === 'drop' ? 0.015 : VS === 'mantilla' ? 0.02 : 0.05;
  const yChin = cy - 0.115, yHair = cy + 0.05;
  const yBack = d.veil === 'fingertip' ? jointY(B, 'upperleg01.L') - 0.12 : floorY + 0.008, yFront = yA - 0.09;
  const floorLen = d.veil === 'fingertip' ? 0 : GOWN_VEIL_CM[d.veil] / 100 / P.S + (d.hem === 'floor' ? (trainCm / 100 / P.S) * 0.6 : 0);
  const pos = (out.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, R = new Float32Array(VNR), tableTop = T.y0 + (T.n - 2) * SLICE_DY;
  for (let a = 0; a < VNA; a++) {
    const ang = (TAU * a) / (VNA - 1), sx = Math.sin(ang), sz = Math.cos(ang), back = (1 - sz) / 2;
    let yEnd = yFront + (yBack - yFront) * smoothstep(back, 0.12, 0.8), Lfl = floorLen * smoothstep(back, 0.45, 1);
    if (hug) yEnd = yEnd + (yHair - yEnd) * (1 - smoothstep(back, 0.18, 0.4)); // framing the face: open at the front, from the hairline back
    if (bird) { yEnd = top - 0.004 + (yChin - top) * (1 - smoothstep(back, 0.25, 0.42)); Lfl = 0; }
    const Dv = Math.max(0.003, top - yEnd), Ltot = Dv + Lfl;
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
      } else {
        // On the floor it runs out behind.
        const q = o - VNA * 3;
        pos[o] = pos[q]! + sx * du * 0.15;
        pos[o + 1] = floorY + (trainCm > 0 ? 0.03 : 0.012);
        pos[o + 2] = pos[q + 2]! - du * (0.55 + 0.45 * back);
        R[i] = R[i - 1]!;
      }
    }
  }
  (out.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  out.geo.computeVertexNormals();
  out.geo.computeBoundingSphere();
  // Mantilla: a wide lace border along the veil's edge (the gown's lace, or Chantilly; the lace itself is A6b).
  const edge = VS === 'mantilla';
  if (edge) {
    const Q = (out.edge.attributes.position as THREE.BufferAttribute).array as Float32Array, i0 = VNR - ER;
    for (let i = 0; i < ER; i++) for (let a = 0; a < VNA; a++) { const s = ((i0 + i) * VNA + a) * 3, t = (i * VNA + a) * 3; Q[t] = pos[s]!; Q[t + 1] = pos[s + 1]! + 0.0015; Q[t + 2] = pos[s + 2]!; }
    (out.edge.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    out.edge.computeVertexNormals();
  }
  return { veil: true, edge };
}
