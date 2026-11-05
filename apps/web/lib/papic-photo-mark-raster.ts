// NOTE: deliberately NOT 'server-only' (as lib/qr-monogram-raster.ts): nothing
// here is reachable from a client bundle — lib/papic-derivatives.ts is a server
// module — and leaving the marker off lets `tsx --test` rasterise a REAL copy
// and read its PIXELS.

/**
 * lib/papic-photo-mark-raster.ts — 🏷 THE SAME MARK, BURNED IN BY THE SERVER.
 *
 * Owner, 24 Oct 2026 (controller review of #6865): the copies the SERVER makes —
 * when a phone could not make its own (no decode, no resize, an older camera) —
 * must carry the same mark as the phone's (Setnayan on a free event, the couple's
 * monogram on a Pro one), "so a Free event's photos are never unmarked by
 * accident".
 *
 * ONE PLACEMENT: `markBox` from `lib/papic-photo-mark.ts`, the very function the
 * phone's painter uses — bottom-right, ~4.5 % of the long edge, a light chip.
 *
 * NO FONT REQUEST: librsvg's fontconfig path is flaky on Vercel (recorded in
 * lib/qr-monogram-raster.ts), so a lettered monogram is drawn as opentype.js
 * OUTLINES from the TTF that ships in the repo and is traced into every lambda.
 * The overlay contains only `<rect>`, `<path>` and nested `<svg>` — the
 * Setnayan mark and a couple's safe SVG mark are vector already.
 *
 * 🔒 Only the COPIES go through here (display · tile · thumb · a clip's
 * display still). The original is never touched.
 */
import path from 'node:path';
import { centeredTextPathData, capHeightPx, loadOtFont, type OtFont } from '@/lib/glyph-path';
import { markBox, SETNAYAN_MARK_SVG, type PapicMark } from '@/lib/papic-photo-mark';

const MARK_FONT = path.join('assets', 'cipher-fonts', 'cormorant.ttf');
let font: OtFont | null = null;
function markFont(): OtFont {
  font ??= loadOtFont(MARK_FONT);
  return font;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** An SVG document's viewBox aspect (w/h), or 1. */
function svgAspect(svg: string): number {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) return vb[2]! / vb[3]!;
  const w = Number(/\bwidth\s*=\s*"([\d.]+)/i.exec(svg)?.[1]);
  const h = Number(/\bheight\s*=\s*"([\d.]+)/i.exec(svg)?.[1]);
  return w > 0 && h > 0 ? w / h : 1;
}

/** Place a whole SVG document at (x, y, w, h) — its own viewBox kept, its own size dropped. */
function placeSvg(svg: string, x: number, y: number, w: number, h: number): string {
  const open = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!open) return '';
  const attrs = open
    .replace(/^<svg\b/i, '')
    .replace(/>$/, '')
    .replace(/\s(?:width|height|x|y)\s*=\s*"[^"]*"/gi, '');
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}"${attrs}>${svg.slice(svg.indexOf(open) + open.length)}`;
}

/**
 * A transparent W × H SVG with the mark's chip in the bottom-right — composited
 * over a copy after it is resized. `null` when there is nothing it can draw.
 */
export function markOverlaySvg(w: number, h: number, mark: PapicMark): string | null {
  if (!(w > 0 && h > 0)) return null;
  const svg = mark.kind === 'monogram' && mark.svg ? mark.svg : mark.kind === 'monogram' && mark.text ? null : SETNAYAN_MARK_SVG;
  const text = !svg && mark.kind === 'monogram' ? mark.text : null;

  let aspect = svg ? svgAspect(svg) : 1;
  let textPath = '';
  if (text) {
    const f = markFont();
    const probe = markBox(w, h, 1);
    const px = probe.h - probe.pad * 2;
    const advance = [...text].reduce((n, c) => n + f.getAdvanceWidth(c, px), 0);
    aspect = Math.max(1, (advance + px * 0.3) / Math.max(1, px));
  }
  const box = markBox(w, h, aspect);
  const ax = box.x + box.pad;
  const ay = box.y + box.pad;
  const aw = box.w - box.pad * 2;
  const ah = box.h - box.pad * 2;
  if (text) {
    const f = markFont();
    const fontSize = ah * 0.95;
    const d = centeredTextPathData({ font: f, text, cx: ax + aw / 2, baselineY: ay + ah / 2 + capHeightPx(f, fontSize) / 2, fontSize, shear: Math.tan((12 * Math.PI) / 180) });
    if (!d) return null;
    const ink = mark.kind === 'monogram' && mark.ink && /^#[0-9a-f]{3,8}$/i.test(mark.ink) ? mark.ink : '#3a2f2a';
    textPath = `<path d="${esc(d)}" fill="${ink}"/>`;
  }
  const art = svg ? placeSvg(svg, ax, ay, aw, ah) : textPath;
  if (!art) return null;
  const r = Math.round(box.h * 0.3);
  const blur = Math.max(1, Math.round(box.h * 0.12));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><filter id="papic-mark-shadow" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feDropShadow dx="0" dy="0" stdDeviation="${blur}" flood-color="#000" flood-opacity="0.28"/></filter></defs>` +
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${r}" ry="${r}" fill="#fff" fill-opacity="0.82" filter="url(#papic-mark-shadow)"/>` +
    art +
    `</svg>`
  );
}
