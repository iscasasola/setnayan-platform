// NOTE: deliberately NOT 'server-only'. Nothing here is reachable from a client
// bundle — lib/qr.ts loads this module with a dynamic import and only from a
// server renderer — and leaving the marker off is what lets `tsx --test`
// rasterise a REAL badge and read the PIXELS, which is the only assertion worth
// making about this file. Mirrors lib/qr-decode.ts, not server-only for exactly
// that reason.
//
// ⚠ `sharp` is imported STATICALLY here, and that is a correction, not a style
// choice. The first cut used `(await import('sharp')).default` (copied from
// lib/qr-decode.ts) and the mark did not reach production: every request
// returned 200 with the bare code. A dynamic import of a native package inside
// an already-dynamically-imported webpack chunk is one interop hop nobody had
// verified, while `import sharp from 'sharp'` is the form lib/watermark-server.ts
// and lib/social/card.tsx have been rendering with in production for months.
// The module is only ever loaded behind lib/qr.ts's own dynamic import, so the
// static import costs no other route anything.

/**
 * lib/qr-monogram-raster.ts — put the couple's monogram into the SAVED QR image.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * Until now the on-screen QR carried the couple's mark and the DOWNLOADED PNG
 * did not. Three route docblocks recorded the same reason — "compositeMonogram
 * operates on raw SVG strings" — and called the bare PNG "the bulletproof
 * shareable version". That is a true statement about a function signature and a
 * false conclusion about the product: on this platform the saved image IS the
 * invitation. Measured in production 2026-09-16: of 77 guests on one live
 * wedding, 75 have neither an email address nor a mobile number, so for those 75
 * people there is no digital route at all — somebody prints or hands over the
 * picture. A mark that only exists on a screen the guest never sees is not a
 * mark.
 *
 * ── WHY NOT JUST RASTERISE THE COMPOSITED SVG ─────────────────────────────
 * Because the badge contains type, and this repo has already paid for the
 * lesson: **librsvg's fontconfig path is flaky on Vercel** (recorded in
 * lib/social/card.tsx and lib/watermark-server.ts, which is why every social
 * card and the wordmark watermark render through satori with an explicit font
 * buffer). Hand sharp an SVG whose badge is a `<text>` element and the glyphs
 * can silently fail to draw on a lambda while rendering perfectly on a Mac. The
 * composite still succeeds, the file still changes, and the couple saves a blank
 * cream disc in the middle of their invitation.
 *
 * So the letters here are never a font REQUEST. `monogramTextToPathRenderer`
 * turns each run into opentype.js outlines from a TTF that ships in the repo and
 * is traced into every lambda (next.config.ts outputFileTracingIncludes '/**').
 * The rasterised SVG contains only `<rect>`, `<circle>`, `<line>` and `<path>` —
 * no host font is consulted on any runtime.
 *
 * ── THE GEOMETRY IS NOT COPIED ────────────────────────────────────────────
 * The badge comes from `monogramOverlaySvg` in lib/monogram.ts — the SAME
 * function the on-screen SVG uses, so the saved picture is the picture the
 * couple was shown, lockup or initials, and there is no third rendering of one
 * couple's mark to drift.
 *
 * ── AND IT STILL HAS TO SCAN ──────────────────────────────────────────────
 * A beautiful unscannable QR is worse than a plain one — those 75 guests have no
 * link to fall back to. The badge covers ~7×7 modules of a level-H code (~30%
 * redundancy); lib/the-saved-code-carries-the-mark.test.ts DECODES the composited
 * PNG with the repo's own detector and asserts the payload is byte-identical to
 * the plain code's.
 */
import path from 'node:path';
import sharp from 'sharp';
import {
  monogramOverlaySvg,
  type MonogramConfig,
  type MonogramTextRenderer,
} from '@/lib/monogram';
import {
  ITALIC_SHEAR,
  capHeightPx,
  centeredTextPathData,
  loadOtFont,
  type OtFont,
} from '@/lib/glyph-path';

/**
 * CSS font stack → a TTF that ships in this repo.
 *
 * The stacks in lib/monogram.ts all lead with a next/font CSS variable
 * (`var(--font-tangerine), 'Tangerine', …`), which is the only stable token in
 * them — the quoted family name is a fallback and the generic tail is shared by
 * half the registry. So the variable is what we match on.
 *
 * `--font-playfair` maps to Bodoni Moda, the closest bundled high-contrast
 * didone: no Playfair TTF ships in-repo. That substitution is not new here —
 * lib/lockup-pdf.ts has made exactly the same one for the PDF lockup badge
 * since 2026-06-14, and making a different choice would be the drift.
 */
const FONT_BY_VAR: Record<string, string> = {
  '--font-display': path.join('assets', 'cipher-fonts', 'cormorant.ttf'),
  '--font-playfair': path.join('assets', 'cipher-fonts', 'bodoni-moda.ttf'),
  '--font-cinzel': path.join('assets', 'cipher-fonts', 'cinzel.ttf'),
  '--font-script': path.join('lib', 'social', 'fonts', 'GreatVibes-Regular.ttf'),
  '--font-libre-caslon': path.join('assets', 'cipher-fonts', 'libre-caslon-display.ttf'),
  '--font-tangerine': path.join('assets', 'cipher-fonts', 'tangerine.ttf'),
  '--font-luxurious': path.join('assets', 'cipher-fonts', 'luxurious-script.ttf'),
  '--font-vidaloka': path.join('assets', 'cipher-fonts', 'vidaloka.ttf'),
};

/** A legacy event (no design columns) asks for "ui-serif, Georgia, serif" —
 *  Cormorant is this brand's serif and what every other lettered surface falls
 *  back to. */
const FALLBACK_FONT = path.join('assets', 'cipher-fonts', 'cormorant.ttf');

const cache = new Map<string, OtFont>();
function font(rel: string): OtFont {
  let f = cache.get(rel);
  if (!f) {
    f = loadOtFont(rel);
    cache.set(rel, f);
  }
  return f;
}

/** Which bundled TTF a CSS stack resolves to. Exported for the guard, which
 *  asserts every registered face has a real file behind it — a missing TTF
 *  would be an ENOENT at render time, i.e. on a guest's download. */
export function fontFileForStack(stack: string | undefined): string {
  if (stack) {
    for (const [token, file] of Object.entries(FONT_BY_VAR)) {
      if (stack.includes(`var(${token})`)) return file;
    }
  }
  return FALLBACK_FONT;
}

/** CSS length → px at this font size. Only the units the monogram registry
 *  actually uses ('0', '0.01em', '0.04em'); anything else contributes nothing
 *  rather than a wrong number. */
function letterSpacingPx(value: string, fontSize: number): number {
  const v = value.trim();
  if (!v || v === '0') return 0;
  const em = /^(-?[\d.]+)em$/.exec(v);
  if (em) return parseFloat(em[1]!) * fontSize;
  const px = /^(-?[\d.]+)px$/.exec(v);
  if (px) return parseFloat(px[1]!);
  return 0;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

/**
 * The raster glyph renderer: every run becomes vector outlines, no font-family
 * request survives into the markup sharp sees.
 */
export const monogramTextToPathRenderer: MonogramTextRenderer = (run) => {
  const f = font(fontFileForStack(run.fontFamily));
  // `dominant-baseline="central"` centres the CAP on y, so the baseline sits
  // half a cap below it. 'alphabetic' runs already give us the baseline.
  const baselineY =
    run.baseline === 'central' ? run.y + capHeightPx(f, run.fontSize) / 2 : run.y;
  const d = centeredTextPathData({
    font: f,
    text: run.text,
    cx: run.x,
    baselineY,
    fontSize: run.fontSize,
    letterSpacing: letterSpacingPx(run.letterSpacing, run.fontSize),
    // The bundled faces are upright files; the web renders them font-style:
    // italic. Shear to match — the same 12° lib/lockup-pdf.ts uses.
    shear: run.fontStyle === 'italic' ? ITALIC_SHEAR : 0,
  });
  return d ? `<path d="${escapeAttr(d)}" fill="${escapeAttr(run.fill)}"/>` : '';
};

/**
 * The monogram badge as a standalone, transparent-background SVG document sized
 * to `size` pixels square. The badge's own proportions are fractions of `size`,
 * exactly as they are fractions of the QR's module-unit viewBox on screen, so
 * the saved picture and the on-screen one are the same mark at the same
 * relative size.
 */
export function monogramBadgeSvgDocument(size: number, monogram: MonogramConfig): string {
  const inner = monogramOverlaySvg({
    viewBoxSize: size,
    monogram,
    renderText: monogramTextToPathRenderer,
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${size} ${size}">${inner}</svg>`
  );
}

/**
 * Composite the couple's monogram into the centre of an already-rendered QR PNG.
 *
 * Returns the ORIGINAL bytes if anything goes wrong. That is deliberate and it
 * is the one place a silent fallback is right: the guest's scannable code is the
 * thing that must never fail, and a missing badge is a smaller loss than a 500
 * on the download. It is not silent to US — the throw is re-raised to the
 * caller's logger via `onError` so a broken font path cannot hide.
 */
export async function compositeMonogramOntoQrPng(
  qrPng: Buffer,
  monogram: MonogramConfig,
  onError?: (err: unknown) => void,
): Promise<Buffer> {
  try {
    const meta = await sharp(qrPng).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height || width !== height) {
      // NOT a quiet `return qrPng`. Every QR this repo renders is square, so
      // reaching here means something upstream changed — and the first version
      // of this line returned the bare code with no error anywhere, which is
      // indistinguishable from the composite having worked.
      throw new Error(`qr-monogram: expected a square QR, got ${width}x${height}`);
    }
    const badge = Buffer.from(monogramBadgeSvgDocument(width, monogram));
    const overlay = await sharp(badge).png().toBuffer();
    return await sharp(qrPng)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch (err) {
    onError?.(err);
    return qrPng;
  }
}
