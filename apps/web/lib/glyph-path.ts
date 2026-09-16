// NOTE: deliberately NOT 'server-only'. `opentype.js` is a pure-JS parser and
// the TTFs are read with node:fs, so this runs anywhere Node runs — including
// `tsx --test`, which is what lets the QR-monogram guards rasterise a REAL
// badge and read the pixels instead of asserting that a flag was set.

/**
 * lib/glyph-path.ts — turn a string into SVG path data in a bundled face.
 *
 * ── WHY PATHS AND NOT `<text>` ────────────────────────────────────────────
 * This exists because of a finding this repo already paid for and wrote down in
 * `lib/watermark-server.ts` and `lib/social/card.tsx`: **librsvg's fontconfig
 * path is flaky on Vercel.** An SVG `<text font-family="…serif">` rasterised by
 * sharp can therefore draw NO GLYPHS on a lambda while drawing perfectly on a
 * developer's Mac — and the failure is silent in the worst possible way: the
 * composite succeeds, the bytes change, every "did anything get drawn" test
 * stays green, and the couple's saved invitation carries a blank cream disc.
 *
 * So no raster surface here asks the host for a font. Every glyph is an
 * outline parsed out of a TTF that ships in the repo and is traced into every
 * lambda by `outputFileTracingIncludes` in next.config.ts.
 *
 * ── ONE COPY OF THE SHEAR MATH ────────────────────────────────────────────
 * EXTRACTED from lib/lockup-pdf.ts (2026-06-14), unchanged, so the PDF lockup
 * badge and the QR-centre raster badge cannot drift into two answers about the
 * same question. lib/lockup-pdf.ts now imports these; its own output is
 * byte-identical to before the extraction (verified by diffing the emitted path
 * data for every lockup glyph).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
// ⚠ THE NAMED `parse`, NEVER A DEFAULT IMPORT. opentype.js@2's ESM build
// (dist/opentype.mjs, the one webpack picks via the `module` field) has NO
// default export — only named ones. `import opentype from 'opentype.js'`
// therefore yields UNDEFINED in a Next server bundle while working fine under
// `tsx`, which resolves the CJS `main` and synthesises a default.
// It typechecked because types/opentype.js.d.ts declared a default that does
// not exist; that declaration is now gone. Production said it out loud:
//   EventLandingQrPng.monogram — "Cannot read properties of undefined (reading 'parse')"
import { parse as parseFont, type Font as OtFont, type Path as OtPath } from 'opentype.js';

export type { OtFont };

/** italic shear (~12°) applied to caps drawn from an UPRIGHT bundled TTF, to
 *  match the web faces, which render `font-style: italic` on those same
 *  upright files (satori does the same). */
export const ITALIC_SHEAR = Math.tan((12 * Math.PI) / 180);

/** Read + parse a TTF relative to the app root. Fonts are traced into every
 *  serverless function (next.config.ts outputFileTracingIncludes '/**'). */
/** Read the file, or say WHICH path from WHERE. A bare ENOENT on a serverless
 *  runtime sends the next reader to the wrong question — the file IS in the
 *  repo and IS traced into the lambda, so the only thing worth knowing is what
 *  that runtime's cwd made of the relative path. */
function readFontOrExplain(abs: string, rel: string) {
  try {
    return readFileSync(abs);
  } catch (err) {
    throw new Error(
      `glyph-path: no font at ${abs} (cwd=${process.cwd()}, asked for ${rel})`,
      { cause: err },
    );
  }
}

export function loadOtFont(rel: string): OtFont {
  const abs = path.join(process.cwd(), rel);
  const buf = readFontOrExplain(abs, rel);
  return parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export function shearPathData(p: OtPath, shear: number, baselineY: number): string {
  if (!shear) return p.toPathData(2);
  // Pivot the shear at the BASELINE so the glyph only leans (like CSS italic) —
  // not also translates. x ← x − (y − baselineY)·shear: zero shift at the
  // baseline, top (y<baselineY) leans right. (A naive y·shear would slide the
  // whole glyph left by baselineY·shear and break alignment with the divider/∞.)
  for (const c of p.commands) {
    if (typeof c.x === 'number' && typeof c.y === 'number') c.x -= (c.y - baselineY) * shear;
    if (typeof c.x1 === 'number' && typeof c.y1 === 'number') c.x1 -= (c.y1 - baselineY) * shear;
    if (typeof c.x2 === 'number' && typeof c.y2 === 'number') c.x2 -= (c.y2 - baselineY) * shear;
  }
  return p.toPathData(2);
}

/**
 * SVG path data for `text`, horizontally centred on `cx` with its baseline at
 * `baselineY` — the vector equivalent of `text-anchor="middle"`.
 *
 * `letterSpacing` is in px and is added BETWEEN characters only (n−1 gaps), so
 * a single glyph is centred on its own advance exactly as lib/lockup-pdf.ts has
 * always centred it — a trailing gap would shift the mark off centre.
 */
export function centeredTextPathData(opts: {
  font: OtFont;
  text: string;
  cx: number;
  baselineY: number;
  fontSize: number;
  letterSpacing?: number;
  shear?: number;
}): string {
  const { font, text, cx, baselineY, fontSize } = opts;
  const ls = opts.letterSpacing ?? 0;
  const shear = opts.shear ?? 0;
  const chars = [...text];
  if (chars.length === 0) return '';
  const widths = chars.map((c) => font.getAdvanceWidth(c, fontSize));
  const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let x = cx - total / 2;
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const d = shearPathData(font.getPath(chars[i]!, x, baselineY, fontSize), shear, baselineY);
    if (d) parts.push(d);
    x += widths[i]! + ls;
  }
  return parts.join(' ');
}

/**
 * Cap height in px at `fontSize` — what `dominant-baseline="central"` needs:
 * the baseline sits HALF a cap below the requested centre. Falls back to a
 * 0.7em cap when the face carries no OS/2 sCapHeight (some display faces
 * don't), which is the conventional Latin proportion.
 */
export function capHeightPx(font: OtFont, fontSize: number): number {
  // `tables` is real at runtime but absent from opentype.js's shipped types, so
  // it is reached through a narrow cast rather than an `any`.
  const os2 = (font as unknown as { tables?: { os2?: { sCapHeight?: number } } }).tables?.os2;
  const cap = os2?.sCapHeight;
  const upm = font.unitsPerEm || 1000;
  if (typeof cap === 'number' && cap > 0) return (cap / upm) * fontSize;
  return 0.7 * fontSize;
}
