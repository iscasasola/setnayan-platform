/**
 * 👗 gown/parts/trims — trims built along the garment's own edges, moving with the cloth (prototype v197 `buildTrims`,
 * `placeTrims`, `trimLengths`, `buildBand`, `buildWaistSeam`, `buildSmallBow`): piping on the neckline or the hem; a
 * neckline ruffle that turns down over the bodice; a hem ruffle sewn on as the skirt's last tier, about 13 cm up; fringe
 * and feathers sewn on above the hem and hanging down to it; a two-piece's waistband (and its top's hem over it); the
 * waistline seam where bodice meets skirt; a small bow in the gown fabric (the owner allows no statement bows, and no
 * sash). Every trim keeps outside the gown's own surface; what reaches the floor lies down flat on it, spreading outward.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GownConfig, GownTrim } from '../../gown-config';
import { BODY_K, RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { waistY } from '../dress/lines';
import { RING_COS, RING_SIN, lerpRow, type GownEnvelope } from '../dress/table';

const N = RING_N, DTH = TAU / N;
export type GownTrimEdge = 'neck' | 'hem';
export type GownTrimPiece =
  | { kind: 'pipe'; edge: GownTrimEdge; geo: THREE.BufferGeometry; rad: number }
  | { kind: 'ruffle'; edge: GownTrimEdge; geo: THREE.BufferGeometry; R: number; SUB: number; AA: number; w: number; cm: number }
  | { kind: 'fringe'; edge: 'hem'; feather: boolean; geo: THREE.BufferGeometry; per: number; len: number }
  | { kind: 'band' | 'seam' | 'bow'; geo: THREE.BufferGeometry };

/** The edge row of the dress grid: the neckline edge, or the hem edge (the train's end, or the hem where there is none). */
const edgeRow = (D: GownDress, which: GownTrimEdge, q: number) => (which === 'neck' ? 1 * N + q : (D.rows - 1) * N + q);
/** How the band and the seam shade the gown's own colour (v195). */
export const GOWN_TRIM_SHADE = { band: 0.94, seam: 0.86 } as const;

const geoOf = (nv: number, ix: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3)); g.setIndex(ix); return g; };
const strip = (rowsN: number, cols: number) => { const ix: number[] = []; for (let r = 0; r < rowsN - 1; r++) for (let k = 0; k < cols - 1; k++) { const a = r * cols + k, b = a + 1, c2 = a + cols, d = c2 + 1; ix.push(a, c2, b, b, c2, d); } return ix; };

/** Which trims this design wears, plus a two-piece's band and a shaped waistline's seam. */
export function buildGownTrims(B: GownRig, T: GownEnvelope, d: Pick<GownConfig, 'trims' | 'pieces' | 'waist' | 'bow'>): GownTrimPiece[] {
  const out: GownTrimPiece[] = [], cm = 0.01 / B.P.S;
  for (const t of d.trims as readonly GownTrim[]) {
    if (t === 'pipeNeck' || t === 'pipeHem') {
      const ix: number[] = [];
      for (let q = 0; q < N; q++) for (let k = 0; k < 6; k++) { const a = q * 6 + k, b = q * 6 + ((k + 1) % 6), c2 = a + 6, dd = b + 6; ix.push(a, c2, b, b, c2, dd); }
      out.push({ kind: 'pipe', edge: t === 'pipeNeck' ? 'neck' : 'hem', geo: geoOf((N + 1) * 6, ix), rad: 0.35 * cm });
    }
    if (t === 'ruffleHem' || t === 'ruffleNeck') {
      // Fine columns so the flutes are round.
      const R = 9, SUB = 8, AA = N * SUB + 1;
      out.push({ kind: 'ruffle', edge: t === 'ruffleNeck' ? 'neck' : 'hem', geo: geoOf(AA * R, strip(R, AA)), R, SUB, AA, w: (t === 'ruffleNeck' ? 7 : 13) * cm, cm });
    }
    if (t === 'fringe' || t === 'feather') {
      const per = t === 'feather' ? 6 : 3, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * per * 2 * 3), 3));
      out.push({ kind: 'fringe', edge: 'hem', feather: t === 'feather', geo: g, per, len: (t === 'feather' ? 7 : 10) * cm });
    }
  }
  const bandIx = () => { const ix: number[] = []; for (let q = 0; q < N; q++) { const a = q * 2, b = a + 2; ix.push(a, a + 1, b, b, a + 1, b + 1); } return ix; };
  const ring = (yc: (q: number) => number, wcm: number, off: number) => {
    const g = geoOf((N + 1) * 2, bandIx()), pa = (g.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let q = 0; q <= N; q++) {
      const qq = q % N, y0 = yc(qq);
      for (let k = 0; k < 2; k++) { const y = y0 + (k ? 0.5 : -0.5) * wcm, r = lerpRow(T, T.F, y, qq) + off, cz = B.zcAt(Math.max(y, T.yF)), o = (q * 2 + k) * 3; pa[o] = r * RING_SIN[qq]!; pa[o + 1] = y; pa[o + 2] = cz + r * RING_COS[qq]!; }
    }
    g.computeVertexNormals();
    return g;
  };
  if (d.pieces !== 'one') {
    // Two-piece: a 3 cm waistband on the skirt; for a separate top, its hem sits just over it, a little proud.
    if (d.pieces === 'crop') out.push({ kind: 'band', geo: ring(() => BODY_K.yWaist + 0.75 * cm, 3 * cm, 0.0035 / B.P.S) });
    else {
      out.push({ kind: 'band', geo: ring((q) => waistY(B, d.waist, q), 3 * cm, 0.0035 / B.P.S) });
      out.push({ kind: 'band', geo: ring((q) => waistY(B, d.waist, q) + 2.2 * cm, 1.2 * cm, 0.0055 / B.P.S) });
    }
  } else if (d.waist !== 'natural') {
    // The waistline seam: a fine line where bodice meets skirt, following the chosen line round her.
    out.push({ kind: 'seam', geo: ring((q) => waistY(B, d.waist, q), 0.45 * cm, 0.0018 / B.P.S) });
  }
  if (d.bow !== 'none') out.push({ kind: 'bow', geo: smallBow(B, T, d.bow, d.waist, cm) });
  return out;
}

/**
 * A small bow in the gown fabric (v197 `buildSmallBow`): two loops, a knot and two short tails, about 8 cm wide at the
 * back of the waist, or 7 cm on her left shoulder (or sleeve band). Built once on the envelope; it does not ride the cloth.
 */
function smallBow(B: GownRig, T: GownEnvelope, at: 'back' | 'shoulder', waist: GownConfig['waist'], cm: number): THREE.BufferGeometry {
  const back = at === 'back', q = back ? N / 2 : Math.round(1.35 / DTH), ph = q * DTH, y = back ? waistY(B, waist, N / 2) : T.top[q]! - 1.2 * cm, sc = back ? 1 : 0.85;
  const r0 = lerpRow(T, T.F, clamp(y, T.yHem, T.y0 + (T.n - 2) * SLICE_DY), q) + 0.004 / B.P.S, cz = B.zcAt(Math.max(y, T.yF));
  const c = new THREE.Vector3(r0 * Math.sin(ph), y, cz + r0 * Math.cos(ph)), out = new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph)), side = new THREE.Vector3(Math.cos(ph), 0, -Math.sin(ph)), upV = new THREE.Vector3(0, 1, 0);
  const parts: THREE.BufferGeometry[] = [];
  const ribbon = (pts: THREE.Vector3[], wid: (t: number) => number, wdir: THREE.Vector3, closed: boolean) => {
    const n = pts.length, ix: number[] = [];
    for (let i = 0; i < n - (closed ? 0 : 1); i++) { const a = i * 2, b = ((i + 1) % n) * 2; ix.push(a, a + 1, b, b, a + 1, b + 1); }
    const g2 = geoOf(n * 2, ix), pa2 = (g2.attributes.position as THREE.BufferAttribute).array as Float32Array;
    pts.forEach((p, i) => { const w = wid(i / (n - 1)); for (let k = 0; k < 2; k++) { const v = p.clone().addScaledVector(wdir, (k ? 0.5 : -0.5) * w); pa2.set([v.x, v.y, v.z], (i * 2 + k) * 3); } });
    parts.push(g2);
  };
  // The loops.
  for (const s2 of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU; pts.push(c.clone().addScaledVector(side, s2 * sc * (2 * cm - 2 * cm * Math.cos(a))).addScaledVector(out, sc * (0.5 * cm + 1.2 * cm * Math.sin(a))).addScaledVector(upV, sc * 0.6 * cm * Math.sin(a))); }
    ribbon(pts, (t) => sc * 2.2 * cm * (0.35 + 0.65 * Math.sin(Math.PI * t) ** 0.6), upV, true);
  }
  // The tails.
  for (const s2 of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(c.clone().addScaledVector(out, sc * (0.6 * cm + 0.5 * cm * t)).addScaledVector(side, s2 * sc * (0.5 + 1.8 * t) * cm).addScaledVector(upV, -sc * 6.5 * cm * t)); }
    ribbon(pts, () => sc * 1.8 * cm, side, false);
  }
  // The knot.
  const knot = new THREE.SphereGeometry(0.75 * cm * sc, 10, 8);
  knot.scale(1, 1.3, 0.7);
  knot.translate(c.x + out.x * 0.6 * cm, c.y, c.z + out.z * 0.6 * cm);
  parts.push(knot);
  const geos = parts.map((g) => { const g2 = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g2.attributes)) if (k !== 'position') g2.deleteAttribute(k); return g2; });
  const g = mergeGeometries(geos)!;
  g.computeVertexNormals();
  // The same cloth as the gown: no lace, cut-outs or techniques on it.
  const n = g.attributes.position!.count;
  g.setAttribute('rest', g.attributes.position!);
  g.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
  g.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(n).fill(-100), 1));
  return g;
}

/** The point on the skirt `dy` above its hem in this direction (the train left out), with its outward direction (v197 `hemAbove`). */
function hemAbove(D: GownDress, P: Float32Array, q: number, dy: number) {
  const r0 = D.nb + 2, rH = D.nb + 1 + D.ns, yH = P[(rH * N + q) * 3 + 1]!, yT = yH + dy;
  let i = rH;
  while (i > r0 && P[(i * N + q) * 3 + 1]! < yT) i--;
  const a = (i * N + q) * 3, b = ((i + 1) * N + q) * 3, ya = P[a + 1]!, yb = P[b + 1]!, w = ya !== yb ? clamp((yT - ya) / (yb - ya), 0, 1) : 0;
  const p = new THREE.Vector3(P[a]! + (P[b]! - P[a]!) * w, ya + (yb - ya) * w, P[a + 2]! + (P[b + 2]! - P[a + 2]!) * w), cz = D.cz[i * N + q]!;
  return { p, cz, out: new THREE.Vector3(p.x, 0, p.z - cz).normalize() };
}
/** Keep a trim on the outside of the gown's own surface at its height (v197 `clearCloth`). */
function clearCloth(T: GownEnvelope, D: GownDress, v: THREE.Vector3, cz: number, gap: number): THREE.Vector3 {
  if (!T.on) return v;
  const dx = v.x, dz = v.z - cz, r = Math.hypot(dx, dz);
  if (r < 1e-6) return v;
  let q = Math.round(Math.atan2(dx, dz) / DTH);
  q = ((q % N) + N) % N;
  const need = lerpRow(T, T.F, clamp(v.y, T.yHem, T.y0 + (T.n - 2) * SLICE_DY), q) * (1 + (D.fold || 0)) + gap;
  if (r < need) { v.x = (dx / r) * need; v.z = cz + (dz / r) * need; }
  return v;
}

/** Lay the trims on the cloth as it is now (v197 `placeTrims`): call after every `writeDress`. `t` (seconds) sways the fringe. */
export function placeGownTrims(pieces: readonly GownTrimPiece[], B: GownRig, T: GownEnvelope, D: GownDress, floorY: number, t = 0): void {
  if (!D.geo) return;
  const P = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, up = new THREE.Vector3(0, 1, 0), fl = floorY + 0.002 / B.P.S, oh = new THREE.Vector3();
  const frame = (i: number) => { const cz = D.cz[i]!, p = new THREE.Vector3(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!); return { p, out: new THREE.Vector3(p.x, 0, p.z - cz).normalize() }; };
  // What reaches the floor lies down flat on it, spreading outward.
  const lay = (v: THREE.Vector3, out: THREE.Vector3) => { if (v.y >= fl) return v; const ex = fl - v.y; v.y = fl; oh.set(out.x, 0, out.z); if (oh.lengthSq() < 1e-8) oh.set(0, 0, 1); v.addScaledVector(oh.normalize(), ex); return v; };
  for (const pt of pieces) {
    if (pt.kind === 'band' || pt.kind === 'seam' || pt.kind === 'bow') continue;
    const pa = (pt.geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
    if (pt.kind === 'ruffle') {
      // Gathered cloth: round flutes that open wider toward the free edge, hanging down. A hem ruffle is the skirt's last
      // tier, sewn on about 13 cm above the hem.
      const neck = pt.edge === 'neck', E: THREE.Vector3[] = [], O: THREE.Vector3[] = [], CZ: number[] = [];
      for (let q = 0; q <= N; q++) {
        if (neck) { const i = edgeRow(D, 'neck', q % N), f = frame(i); E.push(f.p); O.push(f.out); CZ.push(D.cz[i]!); }
        else { const a = hemAbove(D, P, q % N, pt.w); E.push(a.p); O.push(a.out); CZ.push(a.cz); }
      }
      let girth = 0;
      for (let q = 0; q < N; q++) girth += E[q]!.distanceTo(E[q + 1]!);
      const waves = Math.max(12, Math.round(girth / (pt.cm * 4.2))); // a flute about every 4 cm
      const p = new THREE.Vector3(), o = new THREE.Vector3(), tg = new THREE.Vector3(), ra = new THREE.Vector3();
      for (let m = 0; m < pt.AA; m++) {
        const fq = m / pt.SUB, q0 = Math.min(N - 1, Math.floor(fq)), w = fq - q0;
        p.copy(E[q0]!).lerp(E[q0 + 1]!, w); o.copy(O[q0]!).lerp(O[q0 + 1]!, w).normalize(); tg.copy(E[q0 + 1]!).sub(E[q0]!).normalize();
        const ph = (m / (pt.AA - 1)) * waves * TAU, jitter = 0.15 * Math.sin(ph * 0.37 + 1.3);
        for (let r = 0; r < pt.R; r++) {
          // Flute depth grows from the gathered edge to the free edge. Both hang down (the neckline ruffle turns down over
          // the bodice): never standing out like a collar, or lying on the floor.
          const s2 = r / (pt.R - 1), amp = pt.w * (0.05 + (neck ? 0.3 : 0.22) * Math.pow(s2, 0.8)) * (1 + jitter), down = neck ? -0.85 : -0.97, outK = neck ? 0.3 : 0.12;
          ra.copy(p).addScaledVector(o, pt.w * s2 * outK + amp * Math.max(0, Math.cos(ph)) * s2 + amp * 0.3 * Math.cos(ph)).addScaledVector(up, down * pt.w * s2 * (1 - 0.06 * Math.sin(ph))).addScaledVector(tg, amp * 0.35 * Math.sin(ph) * s2);
          clearCloth(T, D, ra, CZ[q0]!, 0.003 / B.P.S);
          lay(ra, o);
          const oo = (r * pt.AA + m) * 3;
          pa[oo] = ra.x; pa[oo + 1] = ra.y; pa[oo + 2] = ra.z;
        }
      }
      pt.geo.attributes.position!.needsUpdate = true; pt.geo.computeVertexNormals(); pt.geo.computeBoundingSphere();
      continue;
    }
    const edge: GownTrimEdge = 'edge' in pt ? pt.edge : 'hem';
    for (let q = 0; q <= N; q++) {
      const qq = q % N, i = edgeRow(D, edge, qq), { p, out } = frame(i);
      if (pt.kind === 'pipe') {
        const nxt = frame(edgeRow(D, edge, (qq + 1) % N)).p, prv = frame(edgeRow(D, edge, (qq + N - 1) % N)).p, tg = nxt.sub(prv).normalize(), n2 = new THREE.Vector3().crossVectors(tg, out).normalize();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU, v = p.clone().addScaledVector(out, pt.rad * (1 + Math.cos(a))).addScaledVector(n2, pt.rad * Math.sin(a)), oo = (q * 6 + k) * 3; pa[oo] = v.x; pa[oo + 1] = v.y; pa[oo + 2] = v.z; }
      } else if (pt.kind === 'fringe' && q < N) {
        // Fringe and feathers are sewn on above the hem and hang down to it.
        const h0 = hemAbove(D, P, qq, pt.len), h1 = hemAbove(D, P, (qq + 1) % N, pt.len);
        for (let k = 0; k < pt.per; k++) {
          const f = k / pt.per, a = h0.p.clone().lerp(h1.p, f);
          const sway = 0.15 * Math.sin(t * 2 + qq * 0.7 + k), len = pt.len * (pt.feather ? 0.6 + 0.4 * Math.abs(Math.sin(qq * 3.7 + k * 1.3)) : 1);
          const e = a.clone().addScaledVector(up, -len).addScaledVector(h0.out, len * (pt.feather ? 0.35 : 0.08) + len * sway * 0.2);
          clearCloth(T, D, e, h0.cz, 0.002 / B.P.S);
          lay(e, out);
          const oo = (qq * pt.per + k) * 2 * 3;
          pa[oo] = a.x; pa[oo + 1] = a.y; pa[oo + 2] = a.z; pa[oo + 3] = e.x; pa[oo + 4] = e.y; pa[oo + 5] = e.z;
        }
      }
    }
    pt.geo.attributes.position!.needsUpdate = true;
    if (pt.kind !== 'fringe') pt.geo.computeVertexNormals();
    pt.geo.computeBoundingSphere();
  }
}

/** Metres of each edge trim, from the garment's real edge length (v195 `trimLengths`); a ruffle takes 2.5× the edge in cloth. */
export function gownTrimMetres(B: GownRig, D: GownDress, trims: readonly GownTrim[]): { trim: GownTrim; edgeM: number; metres: number }[] {
  if (!D.geo) return [];
  const P = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  return trims.map((t) => {
    const which: GownTrimEdge = t === 'pipeNeck' || t === 'ruffleNeck' ? 'neck' : 'hem';
    let L = 0;
    for (let q = 0; q < N; q++) { const a = edgeRow(D, which, q) * 3, b = edgeRow(D, which, (q + 1) % N) * 3; L += Math.hypot(P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!); }
    const edgeM = L * B.P.S;
    return { trim: t, edgeM, metres: edgeM * (t.startsWith('ruffle') ? 2.5 : 1) };
  });
}
