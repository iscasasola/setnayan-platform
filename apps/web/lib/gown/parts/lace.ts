/**
 * 👗 gown/parts/lace — lace appliqué (prototype v195 `LACE_LIB`, `rose`, `drawMotif`, `buildLace`): motifs placed at
 * their real size by zone on the gown's flat map (u = round the body, mirrored at centre front and back; v = height,
 * unrolled onto the train). Cascade, bodice, neckline edge, hem border, scattered or all over; a border lace follows the
 * real hem (climbing to a high-low's short front) or the real neckline. The stage paints the plan into a canvas the
 * cloth shader reads (`laceMap`); the count goes to the designer.
 *
 * Beaded lace and motifs placed by hand come with the beads (A7). The drawing takes any 2D context.
 */
import { formatCount } from '../../format-number';
import type { GownConfig, GownLace, GownLaceColour } from '../../gown-config';
import { gownInHole } from './beads';
import { RING_N, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { trainShare } from '../dress/lines';
import { lerpRow, type GownEnvelope } from '../dress/table';
import { SLICE_DY } from '../body/constants';

const N = RING_N, DTH = TAU / N;

/** The lace colours (v195 `LACE_COL`): product data, like the swatches. */
export const GOWN_LACE_COLOUR: Record<GownLaceColour, number> = { white: 0xffffff, ivory: 0xf6efe2, champagne: 0xe6d3ae, blush: 0xf0d3cd };
/** Stock laces that run as a border (placed on the hem when picked elsewhere). */
export const GOWN_BORDER_LACES: readonly GownLace[] = ['scallop'];
/** The lace map's size (px): round the body × height. */
export const GOWN_LACE_MAP = { w: 1024, h: 2048 } as const;

/** The 2D drawing calls the lace uses (a CanvasRenderingContext2D has them all). */
export type GownLaceCanvas = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle' | 'strokeStyle' | 'lineWidth' | 'lineJoin' | 'lineCap' | 'globalCompositeOperation' | 'shadowColor' | 'shadowBlur'
  | 'save' | 'restore' | 'rotate' | 'translate' | 'scale' | 'setTransform' | 'clearRect' | 'fillRect'
  | 'beginPath' | 'closePath' | 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'arc' | 'ellipse' | 'fill' | 'stroke'
>;

/** Petals, a second ring, centre, sprigs and picots (v195 `rose`). */
function rose(g: GownLaceCanvas, cord: number, net: number): void {
  g.lineWidth = cord;
  for (let k = 0; k < 7; k++) { g.save(); g.rotate((k / 7) * TAU); g.beginPath(); g.ellipse(0, -0.17, 0.085, 0.15, 0, 0, TAU); g.fillStyle = `rgba(255,255,255,${net})`; g.fill(); g.stroke(); g.restore(); }
  for (let k = 0; k < 7; k++) { g.save(); g.rotate(((k + 0.5) / 7) * TAU); g.beginPath(); g.ellipse(0, -0.3, 0.05, 0.1, 0, 0, TAU); g.stroke(); g.restore(); }
  g.beginPath(); g.arc(0, 0, 0.07, 0, TAU); g.fillStyle = '#fff'; g.fill();
  for (let k = 0; k < 3; k++) {
    g.save(); g.rotate((k / 3) * TAU + 0.5); g.beginPath(); g.moveTo(0, -0.33); g.quadraticCurveTo(0.08, -0.42, 0.02, -0.5); g.stroke();
    g.beginPath(); g.ellipse(0.06, -0.43, 0.035, 0.07, 0.6, 0, TAU); g.fillStyle = `rgba(255,255,255,${net})`; g.fill(); g.stroke(); g.restore();
  }
  g.fillStyle = '#fff';
  for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; g.beginPath(); g.arc(Math.cos(a) * 0.41, Math.sin(a) * 0.41, 0.012, 0, TAU); g.fill(); }
}

/** One stock motif, one unit wide, centred, white on clear (v195 `drawMotif`). */
export function drawGownMotif(g: GownLaceCanvas, id: Exclude<GownLace, 'none'>): void {
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.strokeStyle = '#fff'; g.lineWidth = 0.022; g.lineJoin = 'round'; g.lineCap = 'round';
  if (id === 'alencon') {
    // Heavy cord outline, the Alençon signature.
    rose(g, 0.05, 0.42); g.lineWidth = 0.014; g.strokeStyle = 'rgba(255,255,255,0.9)';
    for (let k = 0; k < 7; k++) { g.save(); g.rotate((k / 7) * TAU); g.beginPath(); g.ellipse(0, -0.17, 0.05, 0.1, 0, 0, TAU); g.stroke(); g.restore(); }
    return;
  }
  if (id === 'chantilly') {
    // Fine net, scrolls and small blooms.
    g.lineWidth = 0.01; g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(0, 0, 0.47, 0, TAU); g.fill();
    for (let k = 0; k < 5; k++) {
      g.save(); g.rotate((k / 5) * TAU); g.beginPath(); g.moveTo(0, -0.05); g.bezierCurveTo(0.2, -0.15, 0.05, -0.35, 0.2, -0.42); g.stroke();
      g.beginPath(); for (let a = 0; a < 2.6 * TAU; a += 0.2) { const r = 0.012 * a; g.lineTo(0.2 + r * Math.cos(a), -0.42 + r * Math.sin(a)); } g.stroke();
      for (let j = 0; j < 5; j++) { g.beginPath(); g.ellipse(0.06 + j * 0.03, -0.12 - j * 0.05, 0.018, 0.035, 0.8, 0, TAU); g.stroke(); }
      g.restore();
    }
    for (let k = 0; k < 5; k++) { g.save(); g.rotate((k / 5) * TAU); g.beginPath(); g.ellipse(0, -0.07, 0.03, 0.06, 0, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill(); g.stroke(); g.restore(); }
    return;
  }
  if (id === 'guipure') {
    // Bold, no net: solid petals joined by bars, open holes.
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let k = 0; k < 8; k++) { g.save(); g.rotate((k / 8) * TAU); g.beginPath(); g.ellipse(0, -0.24, 0.075, 0.17, 0, 0, TAU); g.fill(); g.restore(); }
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 8; k++) { g.save(); g.rotate((k / 8) * TAU); g.beginPath(); g.ellipse(0, -0.26, 0.03, 0.09, 0, 0, TAU); g.fill(); g.restore(); }
    g.globalCompositeOperation = 'source-over'; g.beginPath(); g.arc(0, 0, 0.09, 0, TAU); g.fill(); g.lineWidth = 0.03; g.beginPath(); g.arc(0, 0, 0.45, 0, TAU); g.stroke();
    return;
  }
  if (id === 'scallop') {
    // A strip: straight top, scalloped bottom with eyelets.
    g.lineWidth = 0.02; g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-0.5, -0.25);
    for (let k = 0; k < 3; k++) g.arc(-0.5 + (k + 0.5) / 3, 0.12, 1 / 6, Math.PI, 0, true);
    g.lineTo(0.5, -0.25); g.closePath(); g.fill(); g.stroke();
    for (let k = 0; k < 3; k++) { g.save(); g.translate(-0.5 + (k + 0.5) / 3, 0.02); g.scale(0.35, 0.35); rose(g, 0.05, 0.4); g.restore(); }
    return;
  }
  if (id === 'leaf') {
    g.beginPath(); g.moveTo(-0.02, 0.46); g.bezierCurveTo(0.1, 0.15, -0.1, -0.15, 0.04, -0.46); g.stroke();
    for (let i = 0; i < 7; i++) {
      const t = i / 6, y = 0.4 - t * 0.82, x = 0.04 * Math.sin(t * 6), sd = i % 2 ? 1 : -1, L = 0.26 - 0.12 * Math.abs(t - 0.4);
      g.save(); g.translate(x, y); g.rotate(sd * 0.9 - 0.15); g.beginPath(); g.ellipse(sd * L * 0.5, 0, L * 0.5, L * 0.2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(sd * L * 0.9, 0); g.lineWidth = 0.012; g.stroke(); g.lineWidth = 0.022; g.restore();
    }
    return;
  }
  rose(g, 0.022, 0.5);
}

/** One placed motif: where on the flat map (u 0 front … 1 back, y model height), its turn, scale and real width (cm). */
export type GownLaceSpot = { u: number; y: number; rot: number; sc: number; id: Exclude<GownLace, 'none'>; cm: number };
/** A bead sewn on the lace itself (v202 `lace.beadPts`): direction round her, height, size (mm). */
export type GownLaceBeadPt = { ph: number; y: number; mm: number };
/**
 * `count` is the ready-made motifs drawn (one side); `countN` every motif to make, mirrored, plus those placed by hand
 * (`hand`, each mirrored by the map); `beadPts` the beads sewn on the lace when beaded lace is picked (A7b).
 */
export type GownLacePlan = { spots: GownLaceSpot[]; count: number; countN: number; hand: number; beadPts: GownLaceBeadPt[]; y0: number; y1: number };

/**
 * Place the lace (v195 `buildLace`, its placement half). `D` is the dress as built (the flat map's range); `g`, when
 * given, is painted as it goes (cleared first). `inHole` keeps motifs out of cut-outs (A6c) and the brush's holes (A7).
 */
export function buildGownLace(
  B: GownRig, T: GownEnvelope, D: GownDress, d: Pick<GownConfig, 'lace' | 'laceAt' | 'laceCm'> & Partial<Pick<GownConfig, 'laceBeads' | 'beadMm' | 'handLace' | 'handHoles'>>,
  g: GownLaceCanvas | null = null, inHole: ((ph: number, y: number) => boolean) | null = null,
  /** The painted map's opacity at a pixel (0–255), for the beads sewn on the lace (v202 reads the canvas). */
  alphaAt: ((x: number, y: number) => number) | null = null,
): GownLacePlan | null {
  const manual = d.handLace ?? [], holes = d.handHoles ?? [];
  if ((d.lace === 'none' && !manual.length) || !T.on) return null;
  const item = d.lace !== 'none', id = d.lace === 'none' ? 'floral' : d.lace, W = GOWN_LACE_MAP.w, H = GOWN_LACE_MAP.h, cmU = B.P.S * 100, size = d.laceCm, y0 = D.gmapY0, y1 = D.gmapY1, sy = H / ((y1 - y0) * cmU), yS = T.yS, yHem = T.yHem, Lt = D.Lt || 0;
  if (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 2; }
  const meanR = (y: number) => { const yy = clamp(y, yHem, T.y0 + (T.n - 2) * SLICE_DY); let r = 0; for (let q = 0; q < N; q += 4) r += lerpRow(T, T.F, yy, q); return r / (N / 4); };
  const half = (y: number) => Math.PI * meanR(y) * cmU; // half the girth at this height, cm
  const topAt = (u: number) => { const f = (u * N) / 2, q = Math.min(N / 2 - 1, f | 0), w = f - q; return T.top[q]! * (1 - w) + T.top[q + 1]! * w; };
  let seed = 98765;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const spots: GownLaceSpot[] = [];
  let count = 0;
  // Anisotropic map scale, so the motif is true-shape on the cloth.
  // The eraser wipes ready-made motifs only; what she placed by hand stays (v202 `auto`).
  let auto = true;
  const stamp = (u: number, y: number, rot: number, sc = 1, mid: Exclude<GownLace, 'none'> = id, cm = size) => {
    spots.push({ u, y, rot, sc, id: mid, cm });
    if (auto && (inHole?.(u * Math.PI, y) || (holes.length && gownInHole(holes, u * Math.PI, y, cmU, meanR(y), 'lace')))) return;
    if (g) {
      const G = half(Math.max(y, yHem));
      g.setTransform(W / G, 0, 0, sy, u * W, (1 - (y - y0) / (y1 - y0)) * H);
      g.rotate(rot);
      g.scale(cm * sc, cm * sc);
      drawGownMotif(g, mid);
    }
    count++;
  };
  const at = item ? d.laceAt : null;
  if (at === 'neck') {
    // Walk along the real edge (round the body and up and down), a motif every 0.72 widths.
    let acc = size * 0.35, pu = 0, py = topAt(0);
    for (let u = 0.002; u <= 1; u += 0.002) {
      const y = topAt(u), dd = Math.hypot((u - pu) * half(y), (y - py) * cmU);
      acc += dd; pu = u; py = y;
      if (acc >= size * 0.72) { acc = 0; stamp(u, y - (size * 0.32) / cmU, 0, 0.9); }
    }
  } else if (at === 'hem') {
    // Along the real hem: on a high-low it climbs to the short front.
    const hq = (ph: number) => T.hemQ[Math.min(N - 1, Math.round(ph / DTH))] ?? yHem;
    let s = size * 0.4, u = 0;
    while (u <= 1.02) {
      u = s / half(hq(u * Math.PI));
      const ph = Math.min(1, u) * Math.PI, edge = hq(ph) - 0.86 * Lt * trainShare(ph);
      stamp(Math.min(1, u), edge + (size * 0.45) / cmU, 0);
      const dy = Math.abs(hq(Math.min(1, u + 0.02) * Math.PI) - hq(ph)) * cmU;
      s += (size * 0.7) / Math.sqrt(1 + (dy / (0.02 * half(hq(ph)))) ** 2);
    }
  } else if (at) {
    const step = size * 0.82;
    for (let y = topAt(0) - (size * 0.4) / cmU; y > yHem - Lt + (size * 0.3) / cmU; y -= (step * 0.9) / cmU) {
      const G = half(Math.max(y, yHem)), tSk = clamp((yS - y) / (yS - yHem), 0, 1);
      for (let s = rnd() * 0.5 * step; s < G; s += step) {
        const u = s / G, ph = u * Math.PI;
        if (y > topAt(u) - (size * 0.25) / cmU) continue; // stays inside the neckline
        if (y < yHem && y < yHem - 0.86 * Lt * trainShare(ph) + (size * 0.3) / cmU) continue; // and on the train only where there is train
        const pr = at === 'all' ? 0.95 : at === 'bodice' ? (y >= yS ? 0.95 : 0) : at === 'scatter' ? (y >= yS ? 0.06 : 0.16) : y >= yS ? 0.95 : 0.95 * Math.pow(1 - smoothstep(tSk, 0, 0.8), 1.4);
        if (rnd() < pr) stamp(u + ((rnd() - 0.5) * 0.25 * step) / G, y + ((rnd() - 0.5) * 0.25 * step) / cmU, (rnd() - 0.5) * 1.2, 0.85 + rnd() * 0.3);
      }
    }
  }
  // Motifs placed with the brush.
  auto = false;
  const autoN = count;
  for (const m of manual) stamp(m.u, m.y, m.rot, 1, m.id, m.cm);
  if (g) g.setTransform(1, 0, 0, 1, 0, 0);
  count = autoN;
  // Beaded lace: beads sewn onto the lace itself, only where the motif is drawn (v202).
  const beadPts: GownLaceBeadPt[] = [], lb = d.laceBeads ?? 'none';
  if (lb !== 'none' && alphaAt && spots.length) {
    const tries = lb === 'rich' ? 90 : 40, keep = lb === 'rich' ? 16 : 6, mmB = Math.min(d.beadMm ?? 3, 4);
    for (const sp of spots) {
      const G = half(Math.max(sp.y, yHem)), cm = sp.cm * sp.sc, got: [number, number][] = [];
      for (let t = 0; t < tries && got.length < keep; t++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * cm * 0.48, uu = sp.u + (r * Math.cos(a)) / G, yy = sp.y + (r * Math.sin(a)) / cmU;
        if (uu < 0 || uu > 1) continue;
        const X = Math.round(uu * W), Y = Math.round((1 - (yy - y0) / (y1 - y0)) * H);
        if (X < 0 || X >= W || Y < 0 || Y >= H || alphaAt(X, Y) < 170) continue;
        if (got.some(([gu, gy]) => Math.hypot((gu - uu) * G, (gy - yy) * cmU) < (mmB / 10) * 2.2)) continue;
        got.push([uu, yy]);
      }
      for (const [uu, yy] of got) for (const sg of [1, -1]) beadPts.push({ ph: sg * uu * Math.PI, y: yy, mm: mmB });
    }
  }
  // Mirrored left and right: every motif but the one on the centre line of an edge counts twice.
  const countN = (item ? count * 2 - (at === 'neck' || at === 'hem' ? 1 : 0) : 0) + manual.length * 2;
  return { spots, count, countN, hand: manual.length * 2, beadPts, y0, y1 };
}

/** The line under the lace step (v195), for the designer's count. */
export const gownLaceCountLine = (name: string, plan: GownLacePlan, cm: number) => `About ${formatCount(plan.countN - plan.hand)} ${name} motifs, ${cm} cm wide, mirrored left and right. This count goes to the designer.`;

/** The sheer lace tile's size (px). */
export const GOWN_LACE_TILE_PX = 256;
/**
 * Sheer lace on fine tulle, one seamless tile (v197 `laceSleeveMat`): the gown's lace, or Chantilly when it has none.
 * The mantilla's edge and the Juliet cap wear it; the stage tints it with the lace colour.
 */
export function drawGownLaceTile(g: GownLaceCanvas, lace: GownLace): void {
  const W = GOWN_LACE_TILE_PX, id = lace === 'none' ? 'chantilly' : lace;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, W);
  g.fillStyle = 'rgba(255,255,255,0.07)'; // the tulle
  g.fillRect(0, 0, W, W);
  for (const [x, y] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]] as const) { g.setTransform(240, 0, 0, 240, x * W, y * W); drawGownMotif(g, id); }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
/** How the stage draws sheer lace (v197). */
export const GOWN_LACE_TILE_DRAW = { roughness: 0.75 } as const;

/** A cape border's canvas size (px): lace is a band, appliqué a square tile. */
export const GOWN_CAPE_EDGE_PX = { lace: { w: 256, h: 128 }, applique: { w: 256, h: 256 } } as const;
/**
 * A cape's border (v196 `capeEdgeMat`): lace is a continuous band with a scalloped outer edge (the canvas bottom);
 * appliqué is separate motifs, dense along the outer edge and thinning into the cloth. The gown's lace, or Chantilly
 * (lace) or Floral (appliqué) when it has none. The stage tints it with the lace colour.
 */
export function drawGownCapeEdge(g: GownLaceCanvas, kind: 'lace' | 'applique', lace: GownLace): void {
  const id = lace === 'none' ? (kind === 'applique' ? 'floral' : 'chantilly') : lace, { w: W, h: H } = GOWN_CAPE_EDGE_PX[kind];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  if (kind === 'lace') {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H - 22);
    for (let k = 3; k >= 0; k--) g.arc(((k + 0.5) * W) / 4, H - 22, W / 8, 0, Math.PI, false);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
    g.beginPath(); for (let k = 0; k < 4; k++) g.arc(((k + 0.5) * W) / 4, H - 22, W / 8, Math.PI, 0, true); g.stroke();
    g.beginPath(); g.moveTo(0, 3); g.lineTo(W, 3); g.stroke();
    for (const [x, sz] of [[0.25, 92], [0.75, 92], [0, 44], [0.5, 44], [1, 44]] as const) { g.setTransform(sz, 0, 0, sz, x * W, x % 0.5 ? H * 0.5 : H * 0.28); drawGownMotif(g, id); }
  } else {
    for (const [x, y, sz] of [[0.125, 0.84, 0.3], [0.375, 0.86, 0.3], [0.625, 0.84, 0.3], [0.875, 0.86, 0.3], [0, 0.68, 0.22], [0.25, 0.66, 0.24], [0.5, 0.69, 0.22], [0.75, 0.66, 0.24], [0.14, 0.47, 0.17], [0.6, 0.44, 0.18], [0.38, 0.27, 0.12], [0.86, 0.24, 0.11]] as const) {
      for (const dx of [-1, 0, 1]) for (let rep = 0; rep < 2; rep++) { g.setTransform(sz * W, 0, 0, sz * W, (x + dx) * W, y * H); g.rotate(((x * 13 + y * 7) % 1.2) - 0.6); drawGownMotif(g, id); }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, H - 6); g.lineTo(W, H - 6); g.stroke();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
