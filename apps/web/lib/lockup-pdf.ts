/**
 * lib/lockup-pdf.ts — draw the couple's chosen monogram LOCKUP into a pdf-lib
 * page, so the seating-plan + concept-book PDFs carry the SAME mark the couple
 * sees on their site / QR codes / dashboard chip instead of plain initials.
 *
 * Scope (owner 2026-06-14 monogram-consistency pass): ONLY the four type-only
 * lockups — bar · duo · script · infinity — with BOTH initials and no bespoke /
 * cipher custom SVG. framed · single-initial · legacy/no-style events keep the
 * existing initials badge (the caller decides via `lockupForEvent` returning
 * null).
 *
 * GEOMETRY mirrors app/_components/monogram-mark.tsx (the canonical chrome
 * renderer) and lib/monogram.ts `lockupMarkSvg` (the QR-center string twin) —
 * same viewBox + coordinates, so all four surfaces agree pixel-for-pixel.
 *
 * RENDERING approach — why opentype.js + drawSvgPath, not @pdf-lib/fontkit:
 *   pdf-lib's drawSvgPath maps a path point (px,py) → page (x + px·scale,
 *   y − py·scale) — exactly the SVG-y-down → PDF-y-up flip we need. We turn each
 *   cap (+ the "&") into a baseline-anchored glyph PATH via opentype.js (already
 *   a dep — scripts/build-cipher-fonts.mts parses these same TTFs), then draw it
 *   with drawSvgPath. No fontkit (not installed), no doc.embedFont — the letters
 *   render as real vector outlines in the couple's chosen face, foil-free.
 *
 * Fonts (literal readFileSync paths so @vercel/nft traces them into the route's
 * serverless bundle — the proven lib/social/card.tsx pattern):
 *   bar / infinity → Cormorant (assets/cipher-fonts/cormorant.ttf), italic-sheared
 *   duo            → Bodoni Moda (assets/cipher-fonts/bodoni-moda.ttf), italic-sheared
 *                    (closest bundled high-contrast didone to the web Playfair face;
 *                     no Playfair TTF ships in-repo — see blocker note in the PR)
 *   script         → Great Vibes (lib/social/fonts/GreatVibes-Regular.ttf), upright
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import opentype, { type Font as OtFont, type Path as OtPath } from 'opentype.js';
import { LineCapStyle, rgb, type PDFPage, type RGB } from 'pdf-lib';
import { resolveMonogramDesign, splitInitials } from '@/lib/monogram';

export type LockupStyle = 'bar' | 'duo' | 'script' | 'infinity';

const INK_MULBERRY: RGB = rgb(0x5c / 255, 0x25 / 255, 0x42 / 255); // #5C2542
const GOLD: RGB = rgb(0xa8 / 255, 0x83 / 255, 0x40 / 255); // #A88340 (∞ stroke)

// opentype renders at this em; the glyph path coords then live in font-size px.
// We render directly at each lockup's font-size, so no extra scaling per glyph.
function loadFont(rel: string): OtFont {
  const abs = path.join(process.cwd(), rel);
  const buf = readFileSync(abs);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

// Module-load font cache (mirrors lib/social/card.tsx). The faces are tiny TTFs.
let _cormorant: OtFont | null = null;
let _bodoni: OtFont | null = null;
let _greatVibes: OtFont | null = null;
function cormorant(): OtFont {
  return (_cormorant ??= loadFont(path.join('assets', 'cipher-fonts', 'cormorant.ttf')));
}
function bodoni(): OtFont {
  return (_bodoni ??= loadFont(path.join('assets', 'cipher-fonts', 'bodoni-moda.ttf')));
}
function greatVibes(): OtFont {
  return (_greatVibes ??= loadFont(path.join('lib', 'social', 'fonts', 'GreatVibes-Regular.ttf')));
}

/** italic shear (~12°) applied to bar/duo/infinity caps to match the web faces,
 *  which render font-style:italic on upright-bundled TTFs (satori does the same).
 *  Shear in SVG y-down space: x' = x − y·tan(θ) leans the top to the right. */
const ITALIC_SHEAR = Math.tan((12 * Math.PI) / 180);

function shearPathData(p: OtPath, shear: number): string {
  if (!shear) return p.toPathData(2);
  for (const c of p.commands) {
    // Each on/off-curve point: x ← x − y·shear (y-down: above-baseline y<0 → +x).
    if (typeof c.x === 'number' && typeof c.y === 'number') c.x -= c.y * shear;
    if (typeof c.x1 === 'number' && typeof c.y1 === 'number') c.x1 -= c.y1 * shear;
    if (typeof c.x2 === 'number' && typeof c.y2 === 'number') c.x2 -= c.y2 * shear;
  }
  return p.toPathData(2);
}

/** A baseline-anchored, text-anchor=middle glyph path string in lockup-viewBox
 *  coordinates (SVG y-down, baseline at `y`). */
function glyphPath(
  font: OtFont,
  ch: string,
  cx: number,
  baselineY: number,
  fontSize: number,
  shear: number,
): string {
  const adv = font.getAdvanceWidth(ch, fontSize);
  const p = font.getPath(ch, cx - adv / 2, baselineY, fontSize);
  return shearPathData(p, shear);
}

export type EventLockupSource = {
  monogram_text?: string | null;
  display_name?: string | null;
  monogram_style?: string | null;
  monogram_font_key?: string | null;
  monogram_frame_key?: string | null;
  /** Bespoke / cipher custom mark — when present the couple's mark is a stored
   *  SVG, NOT a type-only lockup, so we keep the existing initials badge. */
  monogram_custom_svg?: string | null;
};

export type ResolvedLockup = {
  style: LockupStyle;
  a: string;
  b: string;
  ink: RGB;
};

function hexToRgb(h: string | null | undefined): RGB | null {
  if (!h) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Resolve an event to its type-only lockup, or null when it should keep the
 * legacy initials badge (framed · single-initial · legacy/no-style · bespoke).
 * `label` is the resolved monogram label ("A & B") the caller already computed.
 */
export function lockupForEvent(event: EventLockupSource, label: string): ResolvedLockup | null {
  if (event.monogram_custom_svg && event.monogram_custom_svg.trim()) return null;
  const design = resolveMonogramDesign(event);
  const style = design?.style ?? null;
  if (style !== 'bar' && style !== 'duo' && style !== 'script' && style !== 'infinity') return null;
  const [a, b] = splitInitials(label);
  if (!a || !b) return null;
  return { style, a, b, ink: hexToRgb(design?.color) ?? INK_MULBERRY };
}

type LockupSpec = {
  vb: { x: number; y: number; w: number; h: number };
  font: () => OtFont;
  shear: number;
};

const SPECS: Record<LockupStyle, LockupSpec> = {
  bar: { vb: { x: 6, y: 14, w: 120, h: 70 }, font: cormorant, shear: ITALIC_SHEAR },
  duo: { vb: { x: 18, y: 18, w: 66, h: 62 }, font: bodoni, shear: ITALIC_SHEAR },
  script: { vb: { x: 8, y: 6, w: 168, h: 90 }, font: greatVibes, shear: 0 },
  infinity: { vb: { x: 18, y: 8, w: 164, h: 76 }, font: cormorant, shear: ITALIC_SHEAR },
};

const INFINITY_PATH =
  'M100 46 C76 14 26 14 26 46 C26 78 76 78 100 46 C124 14 174 14 174 46 C174 78 124 78 100 46 Z';

/**
 * Draw the lockup centered in a square badge box of side `2·radius` at
 * (centerX, centerY) in PDF page space. The whole lockup viewBox is letterboxed
 * into that box (preserve aspect), matching the QR-center overlay's fit-box.
 */
export function drawLockupBadge(
  page: PDFPage,
  lockup: ResolvedLockup,
  opts: { centerX: number; centerY: number; radius: number },
): void {
  const { centerX, centerY, radius } = opts;
  const spec = SPECS[lockup.style];
  const { vb } = spec;
  const font = spec.font();

  // Square fit-box inside the badge circle (QR overlay uses circleR·1.5).
  const box = radius * 1.5;
  const scale = Math.min(box / vb.w, box / vb.h);
  // viewBox point (vx,vy) → page point. pdf-lib's drawSvgPath itself does
  // (x + vx·scale, y − vy·scale); we pick (x,y) so the viewBox lands centered.
  const drawnW = vb.w * scale;
  const drawnH = vb.h * scale;
  // Left of the drawn content sits at centerX − drawnW/2; that maps vb.x.
  const ox = centerX - drawnW / 2 - vb.x * scale;
  // Top of the drawn content (smallest viewBox y) sits at centerY + drawnH/2;
  // drawSvgPath maps a viewBox-y of vb.y to page-y = oy − vb.y·scale, so set
  // oy so vb.y → centerY + drawnH/2.
  const oy = centerY + drawnH / 2 + vb.y * scale;

  const pathOpts = { x: ox, y: oy, scale, color: lockup.ink };

  const cap = (ch: string, vx: number, baselineY: number, fontSize: number) =>
    page.drawSvgPath(glyphPath(font, ch, vx, baselineY, fontSize, spec.shear), pathOpts);

  // line in viewBox space → page space (apply the same transform).
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({
      start: { x: ox + x1 * scale, y: oy - y1 * scale },
      end: { x: ox + x2 * scale, y: oy - y2 * scale },
      thickness: 2.5 * scale,
      color: lockup.ink,
      lineCap: LineCapStyle.Round,
    });

  if (lockup.style === 'bar') {
    cap(lockup.a, 28, 72, 64);
    line(66, 16, 66, 42);
    line(66, 66, 66, 82);
    cap('&', 66, 60, 22);
    cap(lockup.b, 104, 72, 64);
  } else if (lockup.style === 'duo') {
    cap(lockup.a, 42, 72, 66);
    cap(lockup.b, 58, 72, 66);
  } else if (lockup.style === 'script') {
    cap(lockup.a, 42, 78, 74);
    cap('&', 92, 76, 46);
    cap(lockup.b, 142, 78, 74);
  } else {
    // infinity — gold ∞ stroke + caps (no fontkit; literal path via drawSvgPath).
    page.drawSvgPath(INFINITY_PATH, {
      x: ox,
      y: oy,
      scale,
      borderColor: GOLD,
      borderWidth: 6 * scale,
      borderLineCap: LineCapStyle.Round,
    });
    cap(lockup.a, 56, 56, 30);
    cap(lockup.b, 140, 56, 30);
  }
}
