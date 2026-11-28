/**
 * 👗 gown-pattern/cutting-list — what to cut, and how much cloth it takes (plan step B11). Pure; cm out (owner D30).
 *
 * One row per block piece: how many, on the fold or as a pair, which fabric, and its size WITH the allowance (the cut
 * line's own box, or the sewing line on a net pattern). The skirt and bodice are cut again in lining when the gown is
 * lined; sleeves are not.
 *
 * The metres follow the prototype's own rule (`fabricMetres`, v203), so the list and the bride's quote can be laid side
 * by side: every piece is laid on 150 cm fabric folded double (75 cm across) — a fold piece against the fold, a pair
 * cut through both layers at once — and takes its own length plus 10 cm, times the widths it needs (at most two);
 * then 15 % for matching and waste, rounded up to a tenth of a metre. The list never shows a price.
 * 🔒 lib/gown-pattern/cutting-list.test.ts
 */
import type { GownBlockPiece } from './skirt';
import { gownCutLine, type GownSeamAllowance } from './allowance';

export const GOWN_FABRIC_WIDTH_CM = 150;
export type GownCutFabric = 'outer' | 'lining';
export type GownCutRow = {
  piece: string;
  /** How many to cut (from the block's own cut note). */
  count: number;
  /** Cut against the fold (one piece opens out to the whole). */
  fold: boolean;
  /** Cut as mirrored pairs, through both layers. */
  pair: boolean;
  fabric: GownCutFabric;
  /** The piece's size with its allowance, cm (along the grain × across). */
  lengthCm: number;
  widthCm: number;
};
export type GownCuttingList = { rows: GownCutRow[]; metres: Record<GownCutFabric, number> };

/** "Cut 1 on the fold" · "Cut 2" · "Cut 2 (a pair)" · "Cut 4 (or 2 half circles on the fold)". */
export function gownCutCount(cut: string): { count: number; fold: boolean } {
  const n = Number(/cut\s+(\d+)/i.exec(cut)?.[1] ?? 1);
  return { count: Math.max(1, n), fold: /\bon the fold\b/i.test(cut) && !/half circles on the fold/i.test(cut) };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

function rowOf(p: GownBlockPiece, sa: GownSeamAllowance, fabric: GownCutFabric): GownCutRow {
  const line = gownCutLine(p, sa) ?? p.outline;
  const xs = line.map((q) => q[0]), ys = line.map((q) => q[1]);
  const { count, fold } = gownCutCount(p.cut);
  return { piece: p.name, count, fold, pair: !fold && count % 2 === 0, fabric, lengthCm: round1((Math.max(...ys) - Math.min(...ys)) / 10), widthCm: round1((Math.max(...xs) - Math.min(...xs)) / 10) };
}

/** Metres of one fabric for these rows, on folded 150 cm cloth (the prototype's `fabricMetres` rule). */
export function gownCutMetres(rows: readonly GownCutRow[], widthCm = GOWN_FABRIC_WIDTH_CM): number {
  const across = widthCm / 2;
  let m = 0;
  for (const r of rows) {
    const lays = r.fold ? r.count : Math.ceil(r.count / 2);
    m += (lays * (r.lengthCm + 10) * Math.min(2, Math.ceil((r.widthCm + 3) / across))) / 100;
  }
  return rows.length ? Math.ceil(m * 1.15 * 10) / 10 : 0;
}

export function gownCuttingList(
  blocks: { skirt?: readonly GownBlockPiece[]; bodice?: readonly GownBlockPiece[]; sleeve?: readonly GownBlockPiece[] },
  sa: GownSeamAllowance,
  opts: { lined: boolean },
): GownCuttingList {
  const outer = [...(blocks.bodice ?? []), ...(blocks.skirt ?? []), ...(blocks.sleeve ?? [])].map((p) => rowOf(p, sa, 'outer'));
  const lining = opts.lined ? [...(blocks.bodice ?? []), ...(blocks.skirt ?? [])].map((p) => rowOf(p, sa, 'lining')) : [];
  return { rows: [...outer, ...lining], metres: { outer: gownCutMetres(outer), lining: gownCutMetres(lining) } };
}

/** The blocks' metres against the quote's (the bride's design): within 10 % agrees, otherwise the sheet says so. */
export function gownMetresAgree(blocksM: number, quoteM: number): boolean {
  if (!(quoteM > 0) || !(blocksM > 0)) return false;
  return Math.abs(blocksM - quoteM) <= quoteM * 0.1;
}
