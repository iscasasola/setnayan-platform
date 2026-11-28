/**
 * 👗 gown/parts/hand — place by hand (prototype v202 `brush`, `placeAt`, `eraseAt`, `buildManual`; v194's four tools:
 * beads, lace, scissors, eraser). What she places is her hand work (`GownHand`: `handBeads`, `handLace`, `handCuts`,
 * `handHoles`), kept beside the design (never inside it: a design is held to 8 KB) so it reaches the designer; these are the pure edits the tools make, and the beads she placed as sets to draw.
 *
 * Mirror draws both sides, and the eraser rubs out both sides. Each tool stops at its cap and says so in one line.
 * Coordinates are kept to four decimals, which is well under a millimetre on the gown.
 */
import { GOWN_HAND_MAX, type GownHand, type GownBeadColour, type GownBeadKind, type GownConfig, type GownHandBead, type GownHandCut, type GownHandHole, type GownHandLace, type GownLace } from '../../gown-config';
import { RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { lerpRow, type GownEnvelope } from '../dress/table';
import { GOWN_BEAD_CAP, gownLocate, gownThinBeads, type GownBeadSet } from './beads';
import type { GownLaceBeadPt } from './lace';

export type GownHandTool = 'beads' | 'lace' | 'cut' | 'eraser';
/** A spot on the gown under her finger (v202 `hitAt`): direction round her, height, distance from her centre line. */
export type GownHandHit = { ph: number; y: number; r: number };
/** What the tools read and write: the hand work (`GownHand`, beside the design) plus the design's picked bead and lace. */
export type GownHandDesign = Pick<GownConfig, 'bead' | 'beadCol' | 'beadHex' | 'beadMm' | 'lace' | 'laceCm'> & GownHand;
type HandDesign = GownHandDesign;

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const wrap = (d: number) => { const a = Math.abs(d) % TAU; return a > Math.PI ? TAU - a : a; };
/** The line she reads when a tool is full. */
export const GOWN_HAND_FULL: Record<'beads' | 'lace' | 'cuts' | 'holes', string> = {
  beads: `That is the most beads you can place by hand (${GOWN_HAND_MAX.beads.toLocaleString('en-US')}). Erase some to place more.`,
  lace: `That is the most lace pieces you can place by hand (${GOWN_HAND_MAX.lace}). Erase some to place more.`,
  cuts: `That is the most cuts the scissors can make (${GOWN_HAND_MAX.cuts}). Erase one to cut again.`,
  holes: 'The eraser has wiped as much as it can. Clear all hand work to start again.',
};

/** The bead she would place now: the picked kind (crystal when none), the picked colour (v202 `placeAt`). */
export function gownHandBeadNow(d: Pick<GownConfig, 'bead' | 'beadCol' | 'beadHex' | 'beadMm'>): { kind: GownBeadKind; col: string; mm: number } {
  return { kind: d.bead === 'none' ? 'crystal' : d.bead, col: d.beadCol === 'custom' ? (d.beadHex ?? '#FFFFFF') : (d.beadCol as Exclude<GownBeadColour, 'custom'>), mm: d.beadMm };
}

/**
 * Place one piece with the beads or lace tool (v202 `placeAt`): Mirror places its twin on the other side. `spin` is the
 * bead's turn; `rot` the lace motif's. Returns the design unchanged, with a note, when the tool is full.
 */
export function gownHandPlace<D extends HandDesign>(d: D, tool: 'beads' | 'lace', h: GownHandHit, o: { mirror: boolean; spin: number; rot: number }): { config: D; note: string } {
  const sides = o.mirror ? [1, -1] : [1];
  if (tool === 'beads') {
    if (d.handBeads.length + sides.length > GOWN_HAND_MAX.beads) return { config: d, note: GOWN_HAND_FULL.beads };
    const b = gownHandBeadNow(d), add: GownHandBead[] = sides.map((sg) => ({ ph: r4(h.ph * sg), y: r4(h.y), kind: b.kind, col: b.col, mm: b.mm, spin: r4(((o.spin % TAU) + TAU) % TAU) }));
    return { config: { ...d, handBeads: [...d.handBeads, ...add] }, note: '' };
  }
  // Lace is drawn on the mirrored map, so one motif covers both sides.
  if (d.handLace.length >= GOWN_HAND_MAX.lace) return { config: d, note: GOWN_HAND_FULL.lace };
  const id: Exclude<GownLace, 'none'> = d.lace === 'none' ? 'floral' : d.lace;
  const m: GownHandLace = { u: r4(Math.min(1, Math.abs(h.ph) / Math.PI)), y: r4(h.y), rot: r4(Math.max(-TAU, Math.min(TAU, o.rot))), id, cm: d.laceCm };
  return { config: { ...d, handLace: [...d.handLace, m] }, note: '' };
}

/**
 * A scissors tap: a round hole `cm` across (v202), on both sides with Mirror; a side the rule forbids is skipped with its
 * reason (the closure strip, the band under the bust). `forbidden` is `gownCutForbidden` bound to this gown.
 */
export function gownHandCutTap<D extends HandDesign>(d: D, h: GownHandHit, o: { mirror: boolean; cm: number; forbidden: (ph: number, y: number, rcm: number) => string }): { config: D; note: string } {
  const add: GownHandCut[] = [], why: string[] = [];
  for (const sg of o.mirror ? [1, -1] : [1]) {
    const w = o.forbidden(h.ph * sg, h.y, o.cm / 2);
    if (w) { why.push(w.replace('Not allowed: ', 'Not cut here: ')); continue; }
    add.push({ ph: r4(h.ph * sg), y: r4(h.y), r: r4(o.cm / 2) });
  }
  if (d.handCuts.length + add.length > GOWN_HAND_MAX.cuts) return { config: d, note: GOWN_HAND_FULL.cuts };
  return { config: add.length ? { ...d, handCuts: [...d.handCuts, ...add] } : d, note: why[0] ?? '' };
}

/** A scissors line that came back to where it started: the shape it encloses comes out (both sides with Mirror). */
export function gownHandCutShape<D extends HandDesign>(d: D, pts: readonly [number, number][], o: { mirror: boolean; forbidden: (ph: number, y: number, rcm: number) => string }): { config: D; note: string } {
  const P = pts.length > GOWN_HAND_MAX.cutPoints ? pts.filter((_, i) => i % Math.ceil(pts.length / GOWN_HAND_MAX.cutPoints) === 0) : pts;
  if (P.length < 4) return { config: d, note: 'Cut all the way around the part to take out, like scissors.' };
  const add: GownHandCut[] = [], why: string[] = [];
  for (const sg of o.mirror ? [1, -1] : [1]) {
    const w = P.map(([ph, y]) => o.forbidden(((ph * sg + Math.PI) % TAU + TAU) % TAU - Math.PI, y, 0.3)).find(Boolean);
    if (w) { why.push(w.replace('Not allowed: ', 'Not cut here: ')); continue; }
    add.push({ pts: P.map(([ph, y]) => [r4(ph * sg), r4(y)] as [number, number]) });
  }
  if (d.handCuts.length + add.length > GOWN_HAND_MAX.cuts) return { config: d, note: GOWN_HAND_FULL.cuts };
  return { config: add.length ? { ...d, handCuts: [...d.handCuts, ...add] } : d, note: why[0] ?? '' };
}

/**
 * Rub out (v202 `eraseAt`): wipes the ready-made placement here (a hole), and takes away what she placed by hand under
 * the brush, on both sides with Mirror. `what` picks beads, lace, cuts or everything; `cm` is the brush width.
 */
export function gownHandErase<D extends HandDesign>(d: D, h: GownHandHit, o: { mirror: boolean; what: GownHandHole['what']; cm: number; cmU: number }): { config: D; note: string } {
  const R = o.cm / 2, cmU = o.cmU, spots = o.mirror ? [h, { ...h, ph: -h.ph }] : [h];
  let holes = d.handHoles, beads = d.handBeads, lace = d.handLace, cuts = d.handCuts, note = '';
  for (const sg of o.mirror ? [1, -1] : [1]) {
    if (holes.length >= GOWN_HAND_MAX.holes) { note = GOWN_HAND_FULL.holes; break; }
    holes = [...holes, { ph: r4(h.ph * sg), y: r4(h.y), r: r4(R), what: o.what }];
  }
  for (const s of spots) {
    if (o.what === 'all' || o.what === 'cuts') cuts = cuts.filter((c) => {
      if ('pts' in c) {
        let cx = 0, cy = 0;
        for (const [a, b] of c.pts) { cx += a; cy += b; }
        cx /= c.pts.length; cy /= c.pts.length;
        cx = ((cx + Math.PI) % TAU + TAU) % TAU - Math.PI;
        return Math.hypot(wrap(cx - s.ph) * s.r * cmU, (cy - s.y) * cmU) > R + 3;
      }
      return Math.hypot(wrap(c.ph - s.ph) * s.r * cmU, (c.y - s.y) * cmU) > R;
    });
    if (o.what === 'cuts') continue;
    if (o.what !== 'lace') beads = beads.filter((b) => Math.hypot(wrap(b.ph - s.ph) * s.r * cmU, (b.y - s.y) * cmU) > R);
    if (o.what !== 'beads') lace = lace.filter((m) => Math.hypot((m.u - Math.abs(s.ph) / Math.PI) * Math.PI * s.r * cmU, (m.y - s.y) * cmU) > R + m.cm * 0.3);
  }
  return { config: { ...d, handHoles: holes, handBeads: beads, handLace: lace, handCuts: cuts }, note };
}

/** Clear all hand work (asked first, on the screen; Undo brings it back). */
export function gownHandClear<D extends HandDesign>(d: D): D {
  return { ...d, handBeads: [], handHoles: [], handLace: [], handCuts: [] };
}

/**
 * The beads placed by hand, and those sewn on the lace, as sets to draw (v202 `buildManual`): one set a kind, colour and
 * size; a phone draws at most 2500 a set and the quote counts every bead. Lace beads take the picked bead (crystal when
 * none) and colour. The two lines are the screen's ("Painted by hand: …", "Beads sewn on the lace: …").
 */
export function buildGownHandBeads(B: GownRig, D: GownDress, d: HandDesign, lacePts: readonly GownLaceBeadPt[], opts: { phone: boolean }): { sets: GownBeadSet[]; hand: number; onLace: number; line: string; laceLine: string } {
  const out = { sets: [] as GownBeadSet[], hand: 0, onLace: 0, line: '', laceLine: '' };
  if (!D.geo) return out;
  const groups = new Map<string, { kind: GownBeadKind; col: string; mm: number; lace: boolean; list: { ph: number; y: number; spin: number }[] }>();
  for (const b of d.handBeads) {
    const key = `${b.kind}|${b.col}|${b.mm}`;
    let gp = groups.get(key);
    if (!gp) { gp = { kind: b.kind, col: b.col, mm: b.mm, lace: false, list: [] }; groups.set(key, gp); }
    gp.list.push(b);
  }
  if (lacePts.length) {
    const now = gownHandBeadNow(d);
    groups.set(`${now.kind}|${now.col}|${lacePts[0]!.mm}|lace`, { kind: now.kind, col: now.col, mm: lacePts[0]!.mm, lace: true, list: lacePts.map((p, i) => ({ ph: p.ph, y: p.y, spin: (i * 2.399) % TAU })) });
  }
  const cmU = B.P.S * 100;
  for (const gp of groups.values()) {
    const tri: number[] = [], bc: number[] = [], spin: number[] = [];
    for (const b of gp.list) { const t = gownLocate(D, b.ph, b.y); if (!t) continue; tri.push(t[0], t[1], t[2]); bc.push(t[3], t[4]); spin.push(b.spin); }
    if (!spin.length) continue;
    const [tB, bB, sB] = gownThinBeads(tri, bc, spin, GOWN_BEAD_CAP, opts.phone);
    out.sets.push({ kind: gp.kind, tri: Uint32Array.from(tB), bc: Float32Array.from(bB), spin: Float32Array.from(sB), n: sB.length, count: spin.length, size: gp.mm / 10 / cmU, rows: D.rows, where: gp.lace ? 'lace' : 'hand', col: gp.col });
    if (gp.lace) out.onLace += spin.length; else out.hand += spin.length;
  }
  const lm = d.handLace.length * 2;
  out.line = out.hand || lm ? `Painted by hand: ${out.hand} beads${lm ? `, ${lm} lace motifs` : ''}. Added to the designer's count.` : '';
  out.laceLine = out.onLace ? `Beads sewn on the lace: about ${Math.round(out.onLace / 10) * 10}, ${lacePts[0]!.mm} mm. Added to the bead count and the quote.` : '';
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// A stroke: a finger down on the gown, moving, lifted (v202 pointer handlers)
// ─────────────────────────────────────────────────────────────────────────────

/** The brush settings (v202 `brush`): Line or Scatter, the gap (cm), brush width (cm), pieces per dab, Mirror, what the eraser takes. */
export type GownHandBrush = { tool: GownHandTool; stroke: 'line' | 'scatter'; gap: number; cm: number; qty: number; mirror: boolean; what: GownHandHole['what'] };
/** The brush she starts with (v202). */
export const GOWN_HAND_BRUSH: Omit<GownHandBrush, 'tool'> = { stroke: 'line', gap: 0.1, cm: 4, qty: 6, mirror: true, what: 'all' };
/** One stroke in progress: where it started, the last spot, the distance since the last piece, still a tap, the scissors' line. */
export type GownHandStroke = { start: GownHandHit; last: GownHandHit; acc: number; tap: boolean; path: [number, number][] | null };
type Ctx = { cmU: number; forbidden: (ph: number, y: number, rcm: number) => string; rnd: () => number };

export function gownHandStrokeStart(h: GownHandHit, tool: GownHandTool): GownHandStroke {
  return { start: h, last: h, acc: 0, tap: true, path: tool === 'cut' ? [[h.ph, h.y]] : null };
}

/**
 * The finger moved to `h` (`moved`: more than a tap's few pixels from where it went down). Line places a piece every
 * piece-width plus the gap, turned along the stroke; Scatter sprinkles a dab every third of the brush; the eraser rubs
 * as it goes; the scissors follow the finger, unwrapped round the back (v202).
 */
export function gownHandStrokeMove<D extends HandDesign>(d: D, st: GownHandStroke, h: GownHandHit, moved: boolean, b: GownHandBrush, c: Ctx): { config: D; stroke: GownHandStroke; note: string } {
  const tap = st.tap && !moved;
  if (tap) return { config: d, stroke: st, note: '' };
  const cmU = c.cmU, dx = (h.ph - st.last.ph) * h.r * cmU, dy = (h.y - st.last.y) * cmU;
  let acc = st.acc + Math.hypot(dx, dy), out = d, note = '';
  if (b.tool === 'cut') {
    const P = st.path ?? [[st.start.ph, st.start.y]], lp = P[P.length - 1]!;
    let ph = h.ph;
    while (ph - lp[0] > Math.PI) ph -= TAU;
    while (ph - lp[0] < -Math.PI) ph += TAU;
    const path = Math.hypot((ph - lp[0]) * h.r * cmU, (h.y - lp[1]) * cmU) >= 0.4 ? [...P, [ph, h.y] as [number, number]] : P;
    return { config: d, stroke: { ...st, last: h, acc, tap: false, path }, note: '' };
  }
  if (b.tool === 'eraser') {
    const e = gownHandErase(d, h, { mirror: b.mirror, what: b.what, cm: b.cm, cmU });
    return { config: e.config, stroke: { ...st, last: h, acc, tap: false }, note: e.note };
  }
  const tool = b.tool;
  if (b.stroke === 'line') {
    const gap = (tool === 'beads' ? d.beadMm / 10 : d.laceCm * 0.8) + b.gap;
    if (acc >= gap) { acc = 0; const r = gownHandPlace(out, tool, h, { mirror: b.mirror, spin: c.rnd() * TAU, rot: Math.atan2(-dy, dx) }); out = r.config; note = r.note; }
  } else if (acc >= b.cm * 0.35) {
    acc = 0;
    const k = tool === 'beads' ? b.qty : Math.max(1, Math.round(b.qty / 4));
    for (let i = 0; i < k; i++) {
      const o = (b.cm / 2) * Math.sqrt(c.rnd()), a = c.rnd() * TAU;
      const r = gownHandPlace(out, tool, { ph: h.ph + (o * Math.cos(a)) / (h.r * cmU), y: h.y + (o * Math.sin(a)) / cmU, r: h.r }, { mirror: b.mirror, spin: c.rnd() * TAU, rot: (c.rnd() - 0.5) * 2.4 });
      out = r.config; note = r.note || note;
    }
  }
  return { config: out, stroke: { ...st, last: h, acc, tap: false }, note };
}

/**
 * The finger lifted. A tap places one piece (or rubs once, or cuts a round hole); a scissors line is closed and checked
 * (`gownHandCutClose`) before the shape comes out (v202 `up`, `finishCut`).
 */
export function gownHandStrokeEnd<D extends HandDesign>(d: D, st: GownHandStroke, b: GownHandBrush, c: Ctx & { close: (P: [number, number][]) => { pts: [number, number][] | null; note: string } }): { config: D; note: string } {
  if (b.tool === 'cut') {
    if (st.tap) return gownHandCutTap(d, st.start, { mirror: b.mirror, cm: b.cm, forbidden: c.forbidden });
    const k = c.close(st.path ?? []);
    if (!k.pts) return { config: d, note: k.note };
    const r = gownHandCutShape(d, k.pts, { mirror: b.mirror, forbidden: c.forbidden });
    return { config: r.config, note: r.note || k.note };
  }
  if (!st.tap) return { config: d, note: '' };
  if (b.tool === 'eraser') return gownHandErase(d, st.start, { mirror: b.mirror, what: b.what, cm: b.cm, cmU: c.cmU });
  return gownHandPlace(d, b.tool, st.start, { mirror: b.mirror, spin: c.rnd() * TAU, rot: 0 });
}

/**
 * Close a scissors line (v202 `finishCut`): it must go all the way round and come back near where it started. A strip
 * of 6 cm or less left under it cannot hold itself up, so the cut opens through the hem; a wide hole in the skirt needs
 * illusion mesh to hold the cloth below. Returns the shape to take out, or none and the plain reason.
 */
export function gownHandCutClose(B: GownRig, T: GownEnvelope, P: readonly [number, number][], cutFill: GownConfig['cutFill']): { pts: [number, number][] | null; note: string } {
  const cmU = B.P.S * 100, N = RING_N, DTH = TAU / N;
  if (!P.length) return { pts: null, note: 'Cut all the way around the part to take out, like scissors.' };
  const rr = lerpRow(T, T.F, clamp(P[0]![1], T.yHem, T.y0 + (T.n - 2) * SLICE_DY), 0);
  let len = 0, area = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i]!, q = P[(i + 1) % P.length]!;
    if (i < P.length - 1) len += Math.hypot((q[0] - a[0]) * rr * cmU, (q[1] - a[1]) * cmU);
    area += ((a[0] * q[1] - q[0] * a[1]) * rr * cmU * cmU) / 2;
  }
  const gapCm = Math.hypot((P[P.length - 1]![0] - P[0]![0]) * rr * cmU, (P[P.length - 1]![1] - P[0]![1]) * cmU);
  if (P.length < 4 || Math.abs(area) < 2) return { pts: null, note: 'Cut all the way around the part to take out, like scissors.' };
  if (gapCm > Math.max(6, len * 0.3)) return { pts: null, note: 'The cut must come back to where it started: finish the line around the shape.' };
  let lo = 1e9, hi = -1e9, ymin = 1e9, ymax = -1e9;
  for (const [ph, y] of P) { lo = Math.min(lo, ph); hi = Math.max(hi, ph); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  const wCm = (hi - lo) * rr * cmU, mid = (lo + hi) / 2, hemY = T.hemQ[Math.min(N - 1, Math.round(Math.abs((((mid + Math.PI) % TAU) + TAU) % TAU - Math.PI) / DTH))] ?? T.yHem, below = (ymin - hemY) * cmU;
  if (below < 6 && below > -1) {
    // The strip under this cut would drop, so the cut opens through the hem.
    return { pts: P.map(([ph, y]) => [ph, y < ymin + (ymax - ymin) * 0.35 ? hemY - 0.08 : y]), note: 'The strip under this cut would drop, so the cut opens through the hem.' };
  }
  if (ymax < T.yS && wCm > 28 && cutFill !== 'illusion') return { pts: null, note: 'Too wide for the skirt: the cloth below would drop. Make it smaller, or pick Illusion mesh (Opening) to hold it.' };
  return { pts: [...P], note: '' };
}
