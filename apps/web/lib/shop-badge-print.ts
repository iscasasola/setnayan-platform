import { loadOtFont, type OtFont } from '@/lib/glyph-path';
import type { OtFace } from '@/lib/logo-fonts';
import { SETNAYAN_MARK_PATH, SETNAYAN_MARK_TRANSFORM, SETNAYAN_MARK_VIEWBOX } from '@/lib/qr-style-svg';
import { flattenSvgMark, type FlatMark } from '@/lib/print-mark';
import { scalePath, type PrintOp } from '@/lib/print-layout';
import type { PrintBadgeArt } from '@/lib/print-badges-v84';
import { verifiedV84Ops } from '@/lib/verified-v84-art';

/**
 * 🖨 THE BADGES ON PAPER — ONLY THE APPROVED v84 ART (owner 15 Nov 2026, DECISION_LOG "THE BADGES IN THE APPROVED
 * PROTOTYPE ARE THE ONLY BADGES"). The retired long pill (milestone · ★ rating · years · monthly awards, owner
 * 2026-10-28 *"we can add this on their tarps?"*) is no longer drawn on any print: what a print wears is
 * `printBadgesV84` (`lib/print-badges-v84.ts`) and each badge is its own v84 picture —
 *
 *   Setnayan Verified   the v84 blue check, vector (`lib/verified-v84-art.ts`), the small look a print uses;
 *   a tier              the v84 tier picture (`public/badges/v84/<family>-<tier>.webp`), embedded as PNG;
 *   a seal              the v84 seal, every letter outlined (`lib/print-seal-art.ts`).
 *
 * The art arrives RESOLVED (`resolvePrintBadgeArt`, `lib/print-badge-art.ts`), so this file stays pure and
 * light: it only places it. 🔒 lib/shop-badge-print.test.ts · lib/prints-wear-only-v84-badges.test.ts
 */

const n = (v: number) => String(Math.round(v * 100) / 100);

let jost: OtFont | null = null;
/** The hub's Jost, loaded once — the door sticker outlines its words with the same face (`lib/door-sticker-print.ts`). */
export function jostFace(): OtFace {
  jost ??= loadOtFont('public/logo-fonts/jost.ttf');
  return jost as unknown as OtFace;
}

/* ── The Setnayan mark as print ops (the door sticker's head) ──────────────────────────────────────────────── */

let markFlat: FlatMark | null = null;
/**
 * The Setnayan mark as outlines, fitted into a `box`-wide square centred on (cx, cy) the way `setnayanMarkSvg` fits
 * it (the whole artwork's view box, so the two read the same). Flattened ONCE from the shipped artwork — never a redraw.
 */
export function setnayanMarkOps(cx: number, cy: number, box: number, fill: string): PrintOp[] {
  markFlat ??= flattenSvgMark(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SETNAYAN_MARK_VIEWBOX}"><path d="${SETNAYAN_MARK_PATH}" transform="${SETNAYAN_MARK_TRANSFORM}"/></svg>`,
  );
  if (!markFlat) throw new Error('[shop-badge-print] the Setnayan mark did not flatten');
  const vb = SETNAYAN_MARK_VIEWBOX.split(/\s+/).map(Number);
  const side = Math.max(vb[2] ?? 1, vb[3] ?? 1);
  const s = box / side;
  const ox = cx - box / 2 - (vb[0] ?? 0) * s;
  const oy = cy - box / 2 - (vb[1] ?? 0) * s;
  return markFlat.parts.map((p) => ({ t: 'path' as const, d: scalePath(p.d, s, ox, oy), fill, evenOdd: p.evenOdd || undefined, mark: true as const }));
}

/**
 * ONE badge `h` units tall, its top-left at (x, y): the resolved v84 art scaled into place. `data-print-badge` names
 * its kind (verified · tier · seal) so a guard can read what a print wears.
 */
export function printBadgeG(a: PrintBadgeArt, x: number, y: number, h: number): { svg: string; width: number } {
  const k = h / a.h;
  return {
    svg: `<g data-print-badge="${a.badge.kind}" data-badge="${a.badge.key}" transform="translate(${n(x)} ${n(y)}) scale(${k.toFixed(6)})">${a.svg}</g>`,
    width: a.w * k,
  };
}

/** The image ref a badge's picture is handed to the print backends under. */
export const printBadgeRef = (a: PrintBadgeArt) => `badge:${a.badge.key}`;

/**
 * ONE badge as print ops (the door sticker's PDF + SVG): Verified as the v84 vector in flat inks; a tier or a seal as
 * its picture (`printBadgeRef`, PNG bytes in `a.png`). `h` units tall, top-left at (x, y).
 */
export function printBadgeOps(a: PrintBadgeArt, x: number, y: number, h: number): { ops: PrintOp[]; width: number } {
  const w = (a.w / a.h) * h;
  if (a.badge.kind === 'verified') return { ops: verifiedV84Ops(x + w / 2, y + h / 2, h), width: w };
  return { ops: [{ t: 'image', ref: printBadgeRef(a), x, y, w, h }], width: w };
}

/**
 * The badges as one SVG document — in a row, each its v84 art `size` pt tall, a gap between. The printer scales the
 * file from a calling card to a tarp (the pictures are the approved art at their own resolution).
 */
export function badgePrintSvg(arts: readonly PrintBadgeArt[], opts: { size?: number } = {}): string {
  const H = opts.size ?? 144;
  const gap = 0.18 * H;
  let x = 0;
  const body = arts
    .map((a) => {
      const d = printBadgeG(a, x, 0, H);
      x += d.width + gap;
      return d.svg;
    })
    .join('');
  const W = Math.max(1, x - gap);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(W)}pt" height="${n(H)}pt" viewBox="0 0 ${n(W)} ${n(H)}">` +
    `<title>SETNAYAN badges</title>${body}</svg>`
  );
}
