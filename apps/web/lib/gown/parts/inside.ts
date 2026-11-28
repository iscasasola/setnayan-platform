/**
 * 👗 gown/parts/inside — what is inside the gown (prototype v191–v195 `buildInside`, `applyPeel`, `layerHex`): the
 * layers under the skirt (each its own material, fullness and colour, layer 1 next to her), the lining, her body
 * shaping, the hoop's rings, the boning and the waist stay. Each layer is a copy of the gown pulled in towards her
 * centre, and never inside her body. The Inside stage dresses her in order, layer by layer (v192); "See inside" ticks
 * each piece on or off.
 *
 * Plain three.js maths: the stage gives each piece its material (`GOWN_INSIDE_LOOK`). Also measures each layer's hem and
 * length, so organza and chiffon layers get their real metres (`gownLayerMetres`).
 */
import * as THREE from 'three';
import { GOWN_LAYER_COLOURS, GOWN_LAYER_TYPES, gownLayerCount, gownSyncLayers, type GownConfig, type GownLayerColour, type GownLayerType } from '../../gown-config';
import { BODY_K, RING_N, TAU } from '../body/constants';
import type { GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { gownLayerMetres } from '../dress/layers';
import { bodyReach, type GownEnvelope } from '../dress/table';
import { gownBoneSet } from './illusion';

const N = RING_N;

/** How each kind of inside piece is drawn (v191 `insideMats`). Colours here are product data, like the swatches. */
export const GOWN_INSIDE_LOOK = {
  lining: { opacity: 0.7, roughness: 0.5 },
  layer: { opacity: 0.55, roughness: 0.9, sheerRoughness: 0.6 },
  bone: { colour: 0x8a6a4a, roughness: 0.5 },
  shape: { colour: 0xd4a892, corset: 0xe7c9b8, roughness: 0.55 },
  stay: { colour: 0x9d3f1e, roughness: 0.6 },
  hoop: { colour: 0x6e6a62, roughness: 0.4, metalness: 0.3 },
  /** A lining that matches: cotton's own cream, or the satin and silk champagne. */
  liningOwn: { cotton: 0xeadfc8, other: 0xe0c49a },
  /** While the inside shows, the gown itself is see-through. */
  gownOpacity: 0.18,
} as const;

export type GownInsideKey = 'gown' | `tulle${number}` | 'lining' | 'shape' | 'hoop' | 'bone';
export type GownInsidePiece = {
  key: GownInsideKey;
  /** What "See inside" calls it. */
  name: string;
  /** Its dot colour, and the colour it is drawn in (layers and lining). */
  colour: number;
  kind: 'layer' | 'lining' | 'shape' | 'hoop' | 'bone';
  /** Draw a layer as a crisp sheer (organza, chiffon). */
  crisp?: boolean;
  geos: THREE.BufferGeometry[];
  /** For a layer: its material, hem round her and length from the waist (metres), for the quantities. */
  layer?: { type: GownLayerType; hemM: number; lengthM: number };
};

const LAYER_NAME: Record<GownLayerType, string> = { soft: 'soft tulle', full: 'full tulle', organza: 'organza', chiffon: 'chiffon', hoop: 'tulle over the hoop', glitter: 'glitter tulle' };
const FILL = Object.fromEntries(GOWN_LAYER_TYPES.map((t) => [t.id, t.fill])) as Record<GownLayerType, number>;

/** A layer's or the lining's colour (v193 `layerHex`): a stock shade, or the gown's own. */
export function gownLayerColour(c: GownLayerColour, gownColour: number): number {
  const hex = GOWN_LAYER_COLOURS.find((x) => x.id === c)?.hex;
  return hex ? parseInt(hex.slice(1), 16) : gownColour;
}

/**
 * Build what is inside this gown on the dress as written (v195 `buildInside`). `gownColour` is the cloth's colour (a
 * layer or lining that matches takes it). The pieces come in the prototype's order: the gown's layers from the outside
 * in, the lining, body shaping, the hoop, then the boning and waist stay.
 */
export function buildGownInside(
  B: GownRig, T: GownEnvelope, D: GownDress,
  d: Pick<GownConfig, 'petti' | 'skirtLayers' | 'layerTypes' | 'layerCols' | 'lining' | 'liningCol' | 'shape' | 'boning' | 'waistStay' | 'fabric'>,
  gownColour: number, gownName: string,
): GownInsidePiece[] {
  if (!D.geo || !D.rows) return [];
  const p = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, R = D.rows, cm = 0.01 / B.P.S, yW = BODY_K.yWaist, yA = D.L ? D.L.yA : yW + 0.15, S = B.P.S;
  const C: [number, number, number][] = [];
  for (let j = 0; j < R; j++) {
    let x = 0, y = 0, z = 0;
    for (let q = 0; q < N; q++) { const i = (j * N + q) * 3; x += p[i]!; y += p[i + 1]!; z += p[i + 2]!; }
    C.push([x / N, y / N, z / N]);
  }
  const out: GownInsidePiece[] = [{ key: 'gown', name: `Gown (${gownName})`, colour: gownColour, kind: 'layer', geos: [] }];
  // A copy of the gown pulled in towards her centre; never inside her body (v191: a sheath's lining went into her legs).
  const shell = (inward: number, rowOk: (y: number) => boolean, scale: ((y: number) => number) | null, gap: number | null) => {
    const P = new Float32Array(R * N * 3), ix: number[] = [];
    for (let j = 0; j < R; j++) for (let q = 0; q < N; q++) {
      const i = (j * N + q) * 3, dx = p[i]! - C[j]![0], dz = p[i + 2]! - C[j]![2], r = Math.hypot(dx, dz) || 1, k = Math.max(0.2, (scale ? scale(p[i + 1]!) : 1) - inward / r);
      P[i] = C[j]![0] + dx * k; P[i + 1] = p[i + 1]!; P[i + 2] = C[j]![2] + dz * k;
      if (gap != null && T.n) {
        const e = bodyReach(T, P[i]!, P[i + 1]!, P[i + 2]!), need = e.env + gap;
        if (e.r > 1e-4 && e.r < need) { const m = need / e.r; P[i] = P[i]! * m; P[i + 2] = e.cz + (P[i + 2]! - e.cz) * m; }
      }
    }
    let jTop = -1, jBot = -1;
    for (let j = 0; j < R - 1; j++) {
      if (!rowOk(C[j]![1]) || !rowOk(C[j + 1]![1])) continue;
      if (jTop < 0) jTop = j;
      jBot = j + 1;
      for (let q = 0; q < N; q++) { const a = j * N + q, b = j * N + ((q + 1) % N), c = a + N, dd = b + N; ix.push(a, b, c, b, dd, c); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setIndex(ix);
    geo.computeVertexNormals();
    // Its hem round her and its length from the top row, in metres (for the quantities).
    let hemM = 0, lengthM = 0;
    if (jTop >= 0) {
      for (let q = 0; q < N; q++) { const a = (jBot * N + q) * 3, b = (jBot * N + ((q + 1) % N)) * 3; hemM += Math.hypot(P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!); }
      for (let q = 0; q < N; q++) {
        let s = 0;
        for (let j = jTop; j < jBot; j++) { const a = (j * N + q) * 3, b = ((j + 1) * N + q) * 3; s += Math.hypot(P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!); }
        lengthM = Math.max(lengthM, s);
      }
    }
    return { geo, hemM: hemM * S, lengthM: lengthM * S };
  };
  const tube = (pts: THREE.Vector3[], rad: number, closed: boolean) => (pts.length < 2 ? null : new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(8, pts.length * 2), rad, 6, closed));
  // Outside in: the gown · the layers (sewn between gown and lining) · the lining, next to her. Each layer its own
  // fullness (v192); l counts in from the gown, layer numbers count out from her.
  const nL = gownLayerCount(d), LT = gownSyncLayers(d.petti, nL, d.layerTypes);
  const fOf = (l: number) => FILL[LT[nL - l] ?? 'soft'] ?? 0.11;
  const Fsum = (l: number) => { let a = 0; for (let k = 1; k <= l; k++) a += k <= nL ? fOf(k) : 0.11; return a; };
  const under = (l: number) => (y: number) => 1 - Fsum(l) * Math.min(1, (yW - y) / 0.6);
  for (let l = 1; l <= nL; l++) {
    const li = nL - l + 1, type = LT[li - 1] ?? 'soft', s = shell(1.2 * cm * l, (y) => y < yW - 0.01, under(l), (0.5 + 0.45 * li) * cm);
    out.push({ key: `tulle${li}`, name: `Layer ${li}: ${LAYER_NAME[type]}`, colour: gownLayerColour(d.layerCols[li - 1] ?? 'match', gownColour), kind: 'layer', crisp: type === 'chiffon' || type === 'organza', geos: [s.geo], layer: { type, hemM: s.hemM, lengthM: s.lengthM } });
  }
  if (d.lining !== 'none') {
    const sk = under(nL + 1), s = shell(0.5 * cm + 1.2 * cm * nL, () => true, (y) => (y < yW ? sk(y) : 1), 0.3 * cm);
    const own = d.lining === 'cotton' ? GOWN_INSIDE_LOOK.liningOwn.cotton : GOWN_INSIDE_LOOK.liningOwn.other;
    out.push({ key: 'lining', name: `Lining (${d.lining})`, colour: d.liningCol !== 'match' ? gownLayerColour(d.liningCol, own) : own, kind: 'lining', geos: [s.geo] });
  }
  if (d.shape !== 'none') {
    // Body shaping is worn on her: light or firm shapewear, or a corset, drawn on her own body.
    const V = B.V, yHip = BODY_K.yHip, top = d.shape === 'corset' ? yA + 0.02 : yW + 0.1, bot = d.shape === 'firm' ? yHip - 0.17 : d.shape === 'corset' ? yHip - 0.02 : yHip - 0.06;
    const keep = shapeKeep(B), ok = (i: number) => keep[i] === 1 && V[i * 3 + 1]! > bot && V[i * 3 + 1]! < top, ix: number[] = [];
    for (let t = 0; t < B.idx.length; t += 3) { const a = B.idx[t]!, b = B.idx[t + 1]!, c = B.idx[t + 2]!; if (ok(a) && ok(b) && ok(c)) ix.push(a, b, c); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V), 3));
    geo.setIndex(ix);
    geo.computeVertexNormals();
    const P = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array, Nn = (geo.attributes.normal as THREE.BufferAttribute).array as Float32Array, e = 0.25 * cm;
    for (let i = 0; i < P.length; i++) P[i] = P[i]! + Nn[i]! * e;
    geo.computeVertexNormals();
    const word = { light: 'light shapewear', firm: 'firm shapewear', corset: 'corset' }[d.shape];
    out.push({ key: 'shape', name: `Body shaping (${word})`, colour: d.shape === 'corset' ? GOWN_INSIDE_LOOK.shape.corset : GOWN_INSIDE_LOOK.shape.colour, kind: 'shape', geos: [geo] });
  }
  const nearestRow = (yy: number) => { let best = 0, bd = 1e9; for (let j = 0; j < R; j++) { const dd = Math.abs(C[j]![1] - yy); if (dd < bd) { bd = dd; best = j; } } return best; };
  if (d.petti === 'hoop') {
    const rings: THREE.BufferGeometry[] = [];
    for (const f of [0.25, 0.55, 0.85]) {
      const best = nearestRow(yW - f * (yW - (T.yHem || 0))), ring: THREE.Vector3[] = [];
      for (let q = 0; q < N; q += 2) { const i = (best * N + q) * 3; ring.push(new THREE.Vector3(C[best]![0] + (p[i]! - C[best]![0]) * 0.86, p[i + 1]!, C[best]![2] + (p[i + 2]! - C[best]![2]) * 0.86)); }
      const g = tube(ring, 0.35 * cm, true);
      if (g) rings.push(g);
    }
    if (rings.length) out.push({ key: 'hoop', name: 'Hoop (crinoline)', colour: GOWN_INSIDE_LOOK.hoop.colour, kind: 'hoop', geos: rings });
  }
  const bones: THREE.BufferGeometry[] = [];
  if (d.boning !== 'soft') {
    // The bones: straight lines from the waist up the bodice (v198: one list with the visible channels and the quote).
    for (const ang of gownBoneSet(B, D.L, d.boning).angs) {
      const q = ((Math.round(ang / (TAU / N)) % N) + N) % N, pts: THREE.Vector3[] = [];
      for (let j = 0; j < R; j++) {
        const y = C[j]![1];
        if (y < yW - 0.04 || y > yA + 0.01) continue;
        const i = (j * N + q) * 3, dx = p[i]! - C[j]![0], dz = p[i + 2]! - C[j]![2], r = Math.hypot(dx, dz) || 1, k = 1 - (0.35 * cm) / r;
        pts.push(new THREE.Vector3(C[j]![0] + dx * k, y, C[j]![2] + dz * k));
      }
      pts.sort((a, c) => a.y - c.y);
      const g = tube(pts, 0.25 * cm, false);
      if (g) bones.push(g);
    }
  }
  const stays: THREE.BufferGeometry[] = [];
  if (d.waistStay) {
    const best = nearestRow(yW), ring: THREE.Vector3[] = [];
    for (let q = 0; q < N; q += 2) { const i = (best * N + q) * 3, dx = p[i]! - C[best]![0], dz = p[i + 2]! - C[best]![2], r = Math.hypot(dx, dz) || 1, k = 1 - (0.4 * cm) / r; ring.push(new THREE.Vector3(C[best]![0] + dx * k, p[i + 1]!, C[best]![2] + dz * k)); }
    const g = tube(ring, 0.6 * cm, true);
    if (g) stays.push(g);
  }
  if (bones.length || stays.length) {
    out.push({ key: 'bone', name: d.boning !== 'soft' ? `Boning${d.waistStay ? ' and waist stay' : ''}` : 'Waist stay', colour: GOWN_INSIDE_LOOK.bone.colour, kind: 'bone', geos: [...bones, ...stays] });
  }
  return out;
}

const keepCache = new WeakMap<GownRig, Uint8Array>();
/** Which skin vertices shapewear can cover (not the arms, hands, neck or head), measured once per body. */
function shapeKeep(B: GownRig): Uint8Array {
  let k = keepCache.get(B);
  if (k) return k;
  k = new Uint8Array(B.n);
  for (let i = 0; i < B.n; i++) {
    let bw = 0, bi = 0;
    for (let c = 0; c < 4; c++) if (B.SW[i * 4 + c]! > bw) { bw = B.SW[i * 4 + c]!; bi = B.SI[i * 4 + c]!; }
    k[i] = /^(upperarm|lowerarm|wrist|finger|metacarpal|hand|thumb|neck|head)/i.test(B.name[bi] || '') ? 0 : 1;
  }
  keepCache.set(B, k);
  return k;
}

/** The Inside stage's steps (v192), in order. "Bustle" only shows with a train; the layer steps follow the count. */
export type GownInsideStage = 'Body shaping' | 'Lining' | 'Layers under the skirt' | `Layer ${number}` | 'Boning' | 'Bustle' | 'See inside';

/**
 * Which pieces show (v192 `applyPeel`): a stage dresses her in order, layer by layer; "See inside" (or no stage) shows
 * every piece she has not unticked.
 */
export function gownInsideShown(key: GownInsideKey, stage: GownInsideStage | null, off: ReadonlySet<string>): boolean {
  const m = stage ? /^Layer (\d)/.exec(stage) : null;
  if (stage === 'Body shaping') return key === 'shape';
  if (stage === 'Lining') return key === 'shape' || key === 'lining';
  if (stage === 'Layers under the skirt') return key !== 'gown' && key !== 'bone';
  if (m) return key === 'shape' || key === 'lining' || key === 'hoop' || (/^tulle\d/.test(key) && Number(key.slice(5)) <= Number(m[1]));
  if (stage === 'Boning') return key !== 'gown';
  return !off.has(key);
}

/** "See inside" lists the pieces outside in: the gown, the layers, the hoop, the lining, the boning, the shaping. */
export const gownInsideOrder = (pieces: readonly GownInsidePiece[]) => {
  const rank = (k: string) => (k === 'gown' ? 0 : k.startsWith('tulle') ? 1 : k === 'hoop' ? 2 : k === 'lining' ? 3 : k === 'bone' ? 4 : 5);
  return pieces.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p.key) - rank(b.p.key) || a.i - b.i).map((x) => x.p);
};

/** The organza and chiffon layers' metres, from their real hem and length (coordinator 27 Nov; tulle stays as v193). */
export function gownInsideLayerMetres(pieces: readonly GownInsidePiece[], opt: { organzaGather?: number; chiffonGather?: number; widthCm?: number } = {}): { organzaM: number; chiffonM: number } {
  let organzaM = 0, chiffonM = 0;
  for (const p of pieces) {
    const L = p.layer;
    if (!L) continue;
    if (L.type === 'organza') organzaM += gownLayerMetres('organza', L.hemM, L.lengthM, { gather: opt.organzaGather, widthCm: opt.widthCm });
    if (L.type === 'chiffon') chiffonM += gownLayerMetres('chiffon', L.hemM, L.lengthM, { gather: opt.chiffonGather, widthCm: opt.widthCm });
  }
  return { organzaM: Math.round(organzaM * 10) / 10, chiffonM: Math.round(chiffonM * 10) / 10 };
}
