/**
 * 👗 gown/parts/technique — every fabric technique as real folds (prototype v195 `buildTechShell`, `placeTechShell`,
 * `techFold`, `applyTech`): pintucks, ruching and smocking over the chosen zone, the drapes (Grecian bodice, cowl neck,
 * side swag) and the ridges of darts and seams. A finer layer of the same cloth rides on the gown and is folded outward;
 * the print rides on the folds and is drawn into the gathers. The designer reads one line that names them all.
 */
import * as THREE from 'three';
import type { GownConfig } from '../../gown-config';
import { BODY_K, RING_N, TAU } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import type { GownEnvelope } from '../dress/table';

const N = RING_N;
const fr1 = (x: number) => x - Math.floor(x);
const th2j = (x: number, y: number) => fr1(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const tnj = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = th2j(ix, iy), b = th2j(ix + 1, iy), c = th2j(ix, iy + 1), d = th2j(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
};

/** Fold height 0..1 at a point on the cloth (cm): ruching's uneven gathers, or smocking's pillows between the tacks. */
function techFold(kind: 'ruche' | 'smock', dir: GownConfig['texDir'], px: number, py: number, sp: number): number {
  if (kind === 'ruche') {
    let c = dir === 'd' || dir === 'vv' ? px * 0.6 + py : dir === 'h' ? py : px;
    const a = dir === 'd' || dir === 'vv' ? px * 0.8 - py * 0.6 : dir === 'h' ? px : py;
    c += sp * 0.9 * (tnj(a / (sp * 2.6), c / (sp * 3.2)) - 0.5);
    return Math.pow(Math.abs(Math.sin((Math.PI * c) / sp)), 0.55) * (0.45 + 0.55 * tnj(a / (sp * 1.7) + 7.3, c / (sp * 1.1) + 1.9));
  }
  const qx = px / sp, qy = py / sp;
  let best = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const r = Math.floor(qy) + j, off = 0.5 * (((r % 2) + 2) % 2), tx = Math.floor(qx - off) + i + off; best = Math.min(best, Math.hypot(qx - tx, (qy - r) * 1.25)); }
  const t = clamp(best / 0.62, 0, 1);
  return t * t * (3 - 2 * t) * (0.9 + 0.1 * Math.sin(qx * 25.13));
}

export type GownTechShell = { geo: THREE.BufferGeometry; src: Uint32Array; wt: Float32Array; disp: Float32Array; list: Uint32Array; cz: Float32Array };

/** Build the technique layer on the dress as written (v195 `buildTechShell`). Null when the design has no technique. */
export function buildGownTechShell(B: GownRig, T: GownEnvelope, D: GownDress, d: Pick<GownConfig, 'tex' | 'texAt' | 'texDir' | 'texSp' | 'drape' | 'darts'>): GownTechShell | null {
  const kind = d.tex, drape = d.drape, dart = d.darts, L = D.L;
  if ((kind === 'none' && drape === 'none' && dart === 'none') || !D.geo || !L) return null;
  const big = kind !== 'none' && (d.texAt === 'all' || d.texAt === 'skirt'), SC = big ? 3 : 4, SR = 3, rows = D.rows;
  const R = (D.geo.attributes.rest as THREE.BufferAttribute).array as Float32Array, GM = (D.geo.attributes.gmap as THREE.BufferAttribute).array as Float32Array, GC = (D.geo.attributes.gcz as THREE.BufferAttribute).array as Float32Array;
  const cmU = B.P.S * 100, sp = d.texSp, yS = T.yS, yW = BODY_K.yWaist, yA = L.yA, ap = L.front;
  const ss = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const zone = (w: GownConfig['texAt'], ph: number, y: number) => (w === 'bodice' ? (y > yS ? 1 : 0) : w === 'waist' ? (Math.abs(y - yW) * cmU < 5 ? 1 : 0) : w === 'back' ? (Math.abs(ph) > 2.35 && y > yS ? 1 : 0) : w === 'skirt' ? (y < yS ? 1 : 0) : 1);
  const dZone = (ph: number, y: number) => (drape === 'grecian' ? (y > yS ? 1 : 0) : drape === 'cowl' ? (1 - ss(0.55, 0.95, Math.abs(ph))) * ss(yA - 0.05, yA, y) : drape === 'swag' ? 1 - ss(0.55, 1, Math.hypot((ph - 0.55) / 0.95, (y - (yS - 0.2)) / 0.26)) : 0);
  // Distance (cm) to the sewn line of a dart or seam.
  const seamCm = (ph: number, y: number, rr: number) => {
    const aph = Math.abs(ph);
    if (dart === 'bust') { const ax = Math.PI / 2, ay = yA - 0.02, bx = ap * 0.8, by = yA - 0.005, ux = bx - ax, uy = by - ay, k = clamp(((aph - ax) * ux + (y - ay) * uy) / (ux * ux + uy * uy), 0, 1); return Math.hypot((aph - ax - ux * k) * rr, y - ay - uy * k) * cmU; }
    if (dart === 'waist') { if (y < yA - 0.05 && y > yW - 0.1) { const w = 0.012 * (1 - Math.abs(y - yW) / 0.12); return Math.abs(Math.abs(aph - ap) * rr - Math.max(0, w) * 0.5) * cmU; } return 99; }
    if (dart === 'princess') { if (y < yS) return 99; const f = aph < Math.PI / 2 ? ap * (1 + 0.5 * Math.max(0, yA - y)) : Math.PI - ap * (1 + 0.5 * Math.max(0, yA - y)); return Math.abs(aph - f) * rr * cmU; }
    if (dart === 'corset') { if (y < yS) return 99; const k2 = aph / 0.7854; return Math.abs(k2 - Math.round(k2)) * 0.7854 * rr * cmU; }
    return 99;
  };
  const texSkirt = kind !== 'none' && (d.texAt === 'skirt' || d.texAt === 'all'), lastRow = texSkirt || drape === 'swag' ? Math.min(rows - 1, D.nb + 1 + D.ns) : D.nb + 1;
  const NR = (lastRow - 1) * SR + 1, NC = N * SC + 1, nv = NR * NC, src = new Uint32Array(nv * 4), wt = new Float32Array(nv * 4), disp = new Float32Array(nv), keep = new Uint8Array(nv);
  const rest = new Float32Array(nv * 3), gmap = new Float32Array(nv * 2), gcz = new Float32Array(nv), cowlY = T.top[0]!;
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const v = r * NC + c, fi = 1 + r / SR, i0 = Math.min(lastRow - 1, Math.floor(fi)), b = fi - i0, fq = c / SC, q0 = Math.floor(fq) % N, q1 = (q0 + 1) % N, a = fq - Math.floor(fq);
    const ids = [i0 * N + q0, i0 * N + q1, (i0 + 1) * N + q0, (i0 + 1) * N + q1], ws = [(1 - a) * (1 - b), a * (1 - b), (1 - a) * b, a * b];
    for (let k = 0; k < 4; k++) {
      src[v * 4 + k] = ids[k]!; wt[v * 4 + k] = ws[k]!;
      for (let dd = 0; dd < 3; dd++) rest[v * 3 + dd] = rest[v * 3 + dd]! + R[ids[k]! * 3 + dd]! * ws[k]!;
      gmap[v * 2] = gmap[v * 2]! + GM[ids[k]! * 2]! * ws[k]!; gmap[v * 2 + 1] = gmap[v * 2 + 1]! + GM[ids[k]! * 2 + 1]! * ws[k]!; gcz[v] = gcz[v]! + GC[ids[k]!]! * ws[k]!;
    }
    const cz = D.cz[ids[0]!]!, x = rest[v * 3]!, y = rest[v * 3 + 1]!, z = rest[v * 3 + 2]! - cz, ph = Math.atan2(x, z), rr = Math.hypot(x, z), px = ph * rr * cmU, py = y * cmU;
    let h = 0, any = 0, gather = 0;
    if (kind !== 'none' && zone(d.texAt, ph, y)) {
      any = 1;
      const pxx = d.texAt === 'back' ? (Math.PI - Math.abs(ph)) * rr * cmU : px;
      if (kind === 'pintuck') {
        // A stitched tuck: a narrow fold standing about 1 mm.
        const cc = d.texDir === 'v' ? pxx : d.texDir === 'h' ? py : d.texDir === 'd' ? (pxx + py) * 0.7071 : Math.abs(pxx) * 0.8 + py * 0.6, dd = (fr1(cc / sp + 0.5) - 0.5) * sp;
        h += 0.12 * Math.exp((-dd * dd) / 0.03);
      } else {
        const hf = techFold(kind, d.texDir, pxx, py, sp);
        h += (kind === 'ruche' ? 0.3 : 0.26) * sp * hf;
        gather += (kind === 'ruche' ? 0.35 : 0.25) * sp * Math.sin(Math.PI * hf);
      }
    }
    const dz = dZone(ph, y);
    if (dz > 0) {
      // A drape: deep soft folds.
      any = 1;
      const ds = drape === 'cowl' ? 4.5 : 6;
      const w = drape === 'grecian' ? 0.5 + 0.5 * Math.sin((TAU * (px * 0.8 - py)) / ds) : drape === 'cowl' ? 0.5 + 0.5 * Math.sin((TAU * Math.hypot(px * 0.7, py - cowlY * cmU)) / ds) : 0.5 + 0.5 * Math.sin((TAU * (px * 0.5 + py)) / ds);
      h += dz * 0.28 * ds * Math.pow(w, 1.3);
      gather += dz * 0.3 * ds * Math.sin(Math.PI * w);
    }
    if (dart !== 'none') { const ln = seamCm(ph, y, rr); if (ln < 1.2) { any = 1; h += 0.16 * Math.exp(-((ln / 0.22) ** 2)); } } // a sewn seam stands up a little along its line
    if (any) {
      // The print rides on the folds and is drawn into the gathers.
      keep[v] = 1;
      disp[v] = 0.0007 / B.P.S + h / cmU;
      const k = h / cmU, g = (gather / cmU) * 0.3;
      rest[v * 3] = rest[v * 3]! + (x / (rr || 1)) * k + Math.cos(ph) * g;
      rest[v * 3 + 1] = rest[v * 3 + 1]! + g;
      rest[v * 3 + 2] = rest[v * 3 + 2]! + (z / (rr || 1)) * k;
    }
  }
  const ix: number[] = [];
  for (let r = 0; r < NR - 1; r++) for (let c = 0; c < NC - 1; c++) { const a = r * NC + c, b = a + 1, c2 = a + NC, dd = c2 + 1; if (keep[a] && keep[b] && keep[c2] && keep[dd]) ix.push(a, c2, b, b, c2, dd); }
  if (!ix.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute('rest', new THREE.BufferAttribute(rest, 3));
  g.setAttribute('gmap', new THREE.BufferAttribute(gmap, 2));
  g.setAttribute('gcz', new THREE.BufferAttribute(gcz, 1));
  g.setIndex(ix);
  const used = new Uint8Array(nv);
  for (const k of ix) used[k] = 1;
  const list: number[] = [];
  for (let v = 0; v < nv; v++) if (used[v]) list.push(v);
  const S: GownTechShell = { geo: g, src, wt, disp, list: Uint32Array.from(list), cz: D.cz };
  placeGownTechShell(S, D);
  return S;
}

/** Ride the gown as it moves (v195 `placeTechShell`): call after every `writeDress`. */
export function placeGownTechShell(S: GownTechShell, D: GownDress): void {
  if (!D.geo) return;
  const P = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, pa = (S.geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  for (const v of S.list) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) { const id = S.src[v * 4 + k]! * 3, w = S.wt[v * 4 + k]!; x += P[id]! * w; y += P[id + 1]! * w; z += P[id + 2]! * w; }
    const cz = S.cz[S.src[v * 4]!]!, dz = z - cz, l = Math.hypot(x, dz) || 1, dd = S.disp[v]!;
    pa[v * 3] = x + (x / l) * dd; pa[v * 3 + 1] = y; pa[v * 3 + 2] = z + (dz / l) * dd;
  }
  (S.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  S.geo.computeVertexNormals();
  S.geo.computeBoundingSphere();
}

/** The line for the designer (v195 `applyTech`): pleats with their fabric factor, texture, darts and drape. */
export function gownTechniqueLine(d: Pick<GownConfig, 'pleat' | 'pleatN' | 'pleatCm' | 'tex' | 'texAt' | 'texDir' | 'texSp' | 'darts' | 'drape'>, hemCircCm: number): string {
  const parts: string[] = [];
  if (d.pleat !== 'none') parts.push(`${d.pleatN} ${d.pleat} pleats, ${d.pleatCm} cm deep (the skirt takes about ${(1 + (2 * d.pleatCm * d.pleatN) / hemCircCm).toFixed(1)}× its width in fabric)`);
  if (d.tex !== 'none') {
    const at = { bodice: 'bodice', waist: 'waist band', back: 'back panel', skirt: 'skirt', all: 'whole gown' }[d.texAt], dir = { v: 'vertical', h: 'horizontal', d: 'diagonal', vv: 'V-shaped' }[d.texDir];
    parts.push(`${{ pintuck: 'pintucks', ruche: 'ruching', smock: 'smocking' }[d.tex]} on the ${at}, ${dir}, ${d.texSp} cm apart`);
  }
  if (d.darts !== 'none') parts.push({ bust: 'bust darts', waist: 'waist darts', princess: 'princess seams', corset: 'corset panels (8)' }[d.darts]);
  if (d.drape !== 'none') parts.push(`drape idea: ${{ grecian: 'Grecian bodice', cowl: 'cowl neck', swag: 'side swag' }[d.drape]} (sample)`);
  return parts.length ? `For the designer: ${parts.join(' · ')}.` : '';
}
