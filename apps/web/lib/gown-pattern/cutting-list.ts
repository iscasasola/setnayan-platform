/**
 * 👗 gown-pattern/cutting-list — what to cut, in which fabric, and how much cloth it takes (plan step B11; the approved
 * drawing is the prototype `gown_maker_v205.html`: `cutInfo` · `grainSay` · `patFabrics` · `layMetres` · `patCutList`,
 * ported). Pure; cm and metres. No money on it.
 *
 * Grouped by fabric — the outer, the lining, each tulle layer — one row per block piece: the piece, how many, on the
 * fold or not, its grain, its fabric, and its size WITH the allowance (the cut line's box; the stitching line's on a
 * net pattern). Metres per fabric are laid out as the quote does (150 cm cloth folded in half, two layers cut at once,
 * +15 %) and checked against the quote's own metres, with the reason when they differ by more than 10 %. What has no
 * block yet (accent fabric, lace, a cape, an overlay, flutter sleeves) is named as "not in this list yet".
 * 🔒 lib/gown-pattern/cutting-list.test.ts (held to the prototype's own patCutList, prototype-v205.golden.json)
 */
import { gownCapeInGownFabric, gownLayerCount, type GownConfig, type GownQuantities } from '../gown-config';
import type { GownBlockPiece } from './skirt';
import { gownPieceGeom, type GownSeamAllow } from './allowance';

/** v205 `o.cut`: which fabrics the blocks are cut in, what has no block, and the quote's metres for each. */
export type GownCutContext = {
  outerName: string | null;
  lining: string | null;
  layers: string[];
  accent: string | null;
  lace: string | null;
  incl: string[];
  metres: { outer: number | null; lining: number; tulle: number } | null;
  /** The design has a train (the quote's outer metres include it; there is no train block yet). */
  train: boolean;
};
export type GownCutPart = 'bodice' | 'skirt';
export type GownCutFabricKey = 'outer' | 'lining' | 'tulle';
export type GownCutRow = { fabric: string; k: GownCutFabricKey; piece: string; qty: number; fold: boolean; grain: string; w: number; h: number; note: string };
export type GownCutCheck = { k: GownCutFabricKey; m: number; q: number | null; ok: boolean | null; diff?: number; why: string };
export type GownCutList = {
  rows: GownCutRow[];
  tot: Partial<Record<GownCutFabricKey, { m: number; names: string[]; pieced: boolean }>>;
  checks: GownCutCheck[];
  unblocked: string[];
  net: boolean;
};

/** The context from a stored design: its config, the quantities the bride's quote used, and the outer fabric's name. */
export function gownCutContext(config: GownConfig, quantities: GownQuantities | null, outerName: string | null): GownCutContext {
  const nL = gownLayerCount(config);
  const accentOn = !!(config.accentFabric || config.accentHex);
  const m = quantities?.materials ?? null;
  return {
    outerName,
    lining: config.lining,
    layers: Array.from({ length: nL }, (_, i) => (config.layerTypes ?? [])[i] ?? 'tulle').filter((t) => t !== 'hoop'),
    accent: accentOn && config.sleeve !== 'none' && config.sleeveFab !== 'lace' ? 'sleeves' : null,
    lace: config.sleeveFab === 'lace' && config.sleeve !== 'none' ? 'sleeves' : null,
    incl: [
      gownCapeInGownFabric(config) ? 'the cape' : '',
      config.ovFab === 'gown' && config.overlay !== 'none' ? 'the overlay' : '',
      config.sleeve === 'flutter' && config.sleeveFab === 'fabric' && !accentOn ? 'the flutter sleeves' : '',
    ].filter(Boolean),
    metres: m ? { outer: m.outerM > 0 ? m.outerM : null, lining: m.liningM, tulle: m.netM } : null,
    train: config.train !== 'none',
  };
}

/** v205 `cutInfo`. */
export function gownCutInfo(p: Pick<GownBlockPiece, 'cut'>): { qty: number; fold: boolean } {
  const m = /Cut (\d+)/.exec(p.cut || '');
  return { qty: m ? Number(m[1]) : 1, fold: /on the fold/.test(p.cut || '') };
}

/** v205 `grainSay`. */
export function gownGrainSay(p: Pick<GownBlockPiece, 'cut' | 'grain'>): string {
  const [[a, b], [c2, d]] = p.grain;
  const ang = Math.abs((Math.atan2(c2 - a, d - b) * 180) / Math.PI) % 180, fold = gownCutInfo(p).fold;
  return ang < 8 || ang > 172
    ? fold ? 'Straight grain, along the fold' : 'Straight grain, along the centre'
    : Math.abs(ang - 45) < 8 || Math.abs(ang - 135) < 8 ? 'Straight grain as marked: 45° to the straight edges' : 'As marked';
}

const TULLE_NAME: Record<string, string> = { soft: 'soft tulle', full: 'full tulle', glitter: 'glitter tulle' };

/** v205 `patFabrics`: the fabrics this order's blocks are cut in, and what has no block yet. */
export function gownCutFabrics(c: GownCutContext): { F: { k: GownCutFabricKey; name: string; parts: GownCutPart[] }[]; unblocked: string[] } {
  const F: { k: GownCutFabricKey; name: string; parts: GownCutPart[] }[] = [{ k: 'outer', name: 'Outer' + (c.outerName ? ` (${c.outerName.toLowerCase()})` : ''), parts: ['bodice', 'skirt'] }];
  if (c.lining && c.lining !== 'none') F.push({ k: 'lining', name: `Lining (${c.lining})`, parts: ['bodice', 'skirt'] });
  c.layers.forEach((t, i) => F.push({ k: 'tulle', name: `Tulle layer ${i + 1}${t && t !== 'tulle' ? ` (${TULLE_NAME[t] ?? t})` : ''}`, parts: ['skirt'] }));
  return {
    F,
    unblocked: [c.accent ? `accent fabric for the ${c.accent}` : '', c.lace ? `lace for the ${c.lace}` : '', ...c.incl.map((x) => x + ' (in the outer fabric)')].filter(Boolean),
  };
}

/** v205 `layMetres`: cm in, metres out (+15 % like the quote); shelves across 150 cm cloth folded in half. */
export function gownLayMetres(items: readonly { w: number; h: number; qty: number; fold: boolean }[], width = 150): { m: number; pieced: boolean } {
  const half = width / 2, slots: { w: number; h: number }[] = [];
  let open = 0, pieced = false;
  for (const it of items) {
    const n = it.fold ? it.qty : Math.ceil(it.qty / 2); // a fold piece takes one slot each; pairs come two to a slot
    if (it.w <= half) { for (let i = 0; i < n; i++) slots.push(it); continue; }
    const across = it.fold ? 2 * it.w : it.w, k = Math.ceil(across / width);
    if (k > 1) pieced = true;
    open += it.h * k * it.qty; // too wide to cut folded: cut open, one at a time (pieced if wider than the fabric)
  }
  slots.sort((a, b) => b.h - a.h);
  const shelves: { w: number; h: number }[] = [];
  for (const s of slots) { const sh = shelves.find((x) => x.w + s.w <= half); if (sh) sh.w += s.w; else shelves.push({ w: s.w, h: s.h }); }
  const len = shelves.reduce((a, s) => a + s.h, 0) + open;
  return { m: Math.ceil((len * 1.15) / 10) / 10, pieced };
}

/** v205 `patCutList`. */
export function gownCutList(list: readonly { p: GownBlockPiece; part: GownCutPart }[], ctx: GownCutContext | null, sa: GownSeamAllow, net: boolean): GownCutList {
  const { F, unblocked } = gownCutFabrics(ctx ?? { outerName: null, lining: null, layers: [], accent: null, lace: null, incl: [], metres: null, train: false });
  const rows: GownCutRow[] = [], tot: GownCutList['tot'] = {};
  for (const f of F) {
    const items: { w: number; h: number; qty: number; fold: boolean }[] = [];
    for (const { p, part } of list) {
      if (!f.parts.includes(part)) continue;
      const G = gownPieceGeom(p, sa, net), ci = gownCutInfo(p), w = (G.box[2] - G.box[0]) / 10, h = (G.box[3] - G.box[1]) / 10;
      rows.push({ fabric: f.name, k: f.k, piece: p.name, qty: ci.qty, fold: ci.fold, grain: gownGrainSay(p), w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, note: p.zipNote && !net ? p.zipNote : '' });
      items.push({ w, h, qty: ci.qty, fold: ci.fold });
    }
    const L = gownLayMetres(items), t = (tot[f.k] ??= { m: 0, names: [], pieced: false });
    t.m = Math.round((t.m + L.m) * 10) / 10;
    t.names.push(f.name);
    t.pieced = t.pieced || L.pieced;
  }
  const q = ctx?.metres ?? null, checks: GownCutCheck[] = [];
  for (const [k, t] of Object.entries(tot) as [GownCutFabricKey, { m: number; names: string[]; pieced: boolean }][]) {
    const qm = q ? Number(q[k]) : Number.NaN;
    if (!(qm > 0)) {
      checks.push({ k, m: t.m, q: null, ok: null, why: q ? 'The quote has no separate line for this fabric.' : 'This order was sent before the quote saved its metres, so there is nothing to check against.' });
      continue;
    }
    const diff = (t.m - qm) / qm, ok = Math.abs(diff) <= 0.1, why: string[] = [];
    if (!ok) {
      if (k === 'outer') {
        if (diff < 0) {
          if (ctx?.train) why.push('the quote includes the train, and there is no train block yet');
          for (const x of ctx?.incl ?? []) why.push(`the quote includes ${x}, which has no block here`);
          why.push('the quote unrolls the 3D gown, which is cut fuller than these starting blocks');
        } else why.push('these blocks need more than the 3D estimate: the allowances, and pieces that do not fit side by side on the fabric');
        if (t.pieced) why.push('some pieces are wider than the fabric and must be pieced');
      }
      if (k === 'lining') why.push('the quote takes the lining as 85% of the outer fabric', ...(diff < 0 && ctx?.train ? ['and that outer figure includes the train'] : []));
      if (k === 'tulle') why.push(diff < 0 ? 'the quote buys petticoat tulle to be gathered, 2–3 × fuller than these flat layers' : 'these flat layers need more than the quote allows for the petticoat');
    }
    checks.push({ k, m: t.m, q: qm, ok, diff, why: why.join('; ') });
  }
  return { rows, tot, checks, unblocked, net };
}

/** The words a person reads for one check (v205 `patCutListHTML`'s `.cut-tot` line), without the markup. */
export const GOWN_CUT_FABRIC_WORD: Record<GownCutFabricKey, string> = { outer: 'Outer', lining: 'Lining', tulle: 'Tulle layers' };
export function gownCutCheckSentence(c: GownCutCheck): { lead: string; why: string | null } {
  const lead = `${GOWN_CUT_FABRIC_WORD[c.k]}: about ${c.m} m of 150 cm fabric${c.q ? ` · the quote says ${c.q} m${c.ok ? ' ✓' : ` (${(c.diff ?? 0) > 0 ? '+' : ''}${Math.round((c.diff ?? 0) * 100)}%)`}` : ''}.`;
  return { lead, why: c.ok === false ? `Why: ${c.why}.` : c.ok === null ? c.why : null };
}
export const GOWN_CUT_LIST_HINT = 'Laid on 150 cm fabric folded in half, two layers cut at once, +15% for matching and waste (the same as the quote).';
