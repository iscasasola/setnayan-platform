/**
 * 👗 gown/parts/hand — place by hand (prototype v202 `brush`, `placeAt`, `eraseAt`, `buildManual`; v194's four tools:
 * beads, lace, scissors, eraser). What she places lives on the design (`handBeads`, `handLace`, `handCuts`, `handHoles`)
 * so it reaches the designer; these are the pure edits the tools make, and the beads she placed as sets to draw.
 *
 * Mirror draws both sides, and the eraser rubs out both sides. Each tool stops at its cap and says so in one line.
 * Coordinates are kept to four decimals, which is well under a millimetre on the gown.
 */
import { GOWN_HAND_MAX, type GownBeadColour, type GownBeadKind, type GownConfig, type GownHandBead, type GownHandCut, type GownHandHole, type GownHandLace, type GownLace } from '../../gown-config';
import { TAU } from '../body/constants';
import type { GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { GOWN_BEAD_CAP, gownLocate, gownThinBeads, type GownBeadSet } from './beads';
import type { GownLaceBeadPt } from './lace';

export type GownHandTool = 'beads' | 'lace' | 'cut' | 'eraser';
/** A spot on the gown under her finger (v202 `hitAt`): direction round her, height, distance from her centre line. */
export type GownHandHit = { ph: number; y: number; r: number };
type HandDesign = Pick<GownConfig, 'handBeads' | 'handHoles' | 'handLace' | 'handCuts' | 'bead' | 'beadCol' | 'beadHex' | 'beadMm' | 'lace' | 'laceCm'>;

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
