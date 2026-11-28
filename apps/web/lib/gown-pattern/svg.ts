/**
 * 👗 gown-pattern/svg — the blocks on the order view, one SVG sheet, 1 unit = 1 mm (plan steps B6 + B11; the approved
 * drawing is the prototype `gown_maker_v205.html` `blockSVG`, ported). Each piece is drawn by the same `gownPieceDraw`
 * the 1:1 pages use: the stitching line solid, the cut line dashed and mitred at her allowances, notches, PLACE ON
 * FOLD, the darts, the grain. Pure string; no DOM. On screen it is one ink (`currentColor`), so it follows the page's
 * light or dark ink. No prices on any sheet.
 * 🔒 lib/gown-pattern/pattern.test.ts
 */
import type { GownBlockPiece } from './skirt';
import { GOWN_SEAM_ALLOW_DEFAULT, gownPieceGeom, type GownSeamAllow } from './allowance';
import { GOWN_PAT_SCREEN, gownPageSvg, gownPieceDraw, type GownDraw } from './export';

export function gownBlocksSvg(pieces: readonly GownBlockPiece[], label: string, sa: GownSeamAllow = GOWN_SEAM_ALLOW_DEFAULT, net = false): string {
  const pad = 40, gap = 60, Gs = pieces.map((p) => gownPieceGeom(p, sa, net));
  const top = Math.min(0, ...Gs.map((G) => G.box[1])), padY = pad - top, ops: GownDraw[] = [];
  let x0 = pad, maxB = 0;
  pieces.forEach((p, i) => {
    const G = Gs[i]!;
    ops.push(...gownPieceDraw(p, G, x0 - G.box[0], padY, GOWN_PAT_SCREEN));
    maxB = Math.max(maxB, G.box[3]);
    x0 += G.box[2] - G.box[0] + gap;
  });
  return gownPageSvg(ops, x0 - gap + pad, maxB + padY + pad, label, { oneInk: true });
}
