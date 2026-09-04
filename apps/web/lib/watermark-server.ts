/**
 * THE SERVER-SIDE SETNAYAN WATERMARK (MB9) — `sharp`, not Canvas.
 *
 * ── WHY `lib/watermark.ts` COULD NOT DO THIS ──────────────────────────────
 * That module is the 2026-05-21 watermark, and its own header says what it is:
 * "client-side Canvas watermarking before upload… Upgrade to server-side
 * sharp.js compositing in V1.x if takedown evasion becomes a real problem."
 * It calls `document.createElement('canvas')`. A Mood Board render is produced
 * entirely server-side — the Gemini pipeline hands `render-actions.ts` raw
 * bytes that no browser ever touches — so there is no document to draw on and
 * no upload to intercept. Not a shortcoming of that module; a different place
 * in the pipeline.
 *
 * This is the sharp-based equivalent for bytes. It does not replace
 * `watermark.ts`, which still marks vendor marketplace uploads client-side, and
 * the two are deliberately not merged: one takes a `File` in a browser, the
 * other takes bytes in a lambda, and a single "universal" helper would have to
 * carry the browser half into every server bundle.
 *
 * ── WHAT IT IS FOR, AND WHAT IT IS NOT FOR ────────────────────────────────
 * 🔒 THE COUPLE'S OWN COPY IS NEVER MARKED. This runs on the GALLERY copy —
 * the derived image other couples browse — and never on `image_key`, the
 * photograph the couple paid for. `moodboard-gallery-copy.ts` is the only
 * caller and it names both keys, so the two cannot be confused at the call
 * site.
 *
 * The mark is a DETERRENT, not anti-tamper: anyone determined can crop it. The
 * owner directive it serves is about scraping and attribution, and a visible
 * mark is what that asks for.
 *
 * ── TWO SESSIONS BUILT THIS FILE ON THE SAME DAY (MB9 · MB11) ─────────────
 * MB11 needed the same thing for the VENDOR upload path — the supplier gallery
 * is the other publicly-readable pool — and wrote its own copy of this module
 * before MB9 merged. They are now ONE module: MB9's contract, geometry and
 * JPEG-only output are kept verbatim (its callers and tests are untouched),
 * with two things folded in from MB11 below — `imageRegionStats`, and the way
 * the glyphs are drawn.
 *
 * ── THE GLYPHS ARE VECTOR PATHS, NOT A FONT-FAMILY REQUEST ────────────────
 * ⚠ THIS IS A CORRECTION TO WHAT THIS FILE SAID ON 2026-09-04, AND IT IS
 * LOAD-BEARING. The original note here read: "No font FILE is referenced. sharp
 * renders SVG text through librsvg/fontconfig using whatever the host has… A
 * generic family is available everywhere the app runs." That is an assumption,
 * and if it is wrong the failure is silent and lands exactly where it must not:
 * the scrim composites, the pixels change, every pixel-reading test still
 * passes — and the mark is a blank grey pill on a public gallery photograph.
 *
 * The repo's own shipped evidence points the other way. `lib/social/card.tsx`
 * carries the finding in its docblock — "librsvg's fontconfig path is flaky on
 * Vercel" — which is why every social card, the lockup PDF and the Papic
 * display ref all render text through satori with an EXPLICIT font buffer. Grep
 * confirms it: before this change, this file was the ONLY place in the codebase
 * rasterizing SVG `<text>` through sharp.
 *
 * So the wordmark is rendered by satori into vector PATHS from the bundled
 * Poppins TTF and composited as an image. No host font is consulted, on any
 * runtime. The scrim stays a plain `<rect>` (no font needed) and the geometry
 * below is unchanged, so the mark looks the same and MB9's tests assert the
 * same pixels.
 *
 * 🔑 FLAGGED FOR THE OWNER rather than assumed: if the DejaVu/Helvetica
 * assumption was in fact verified against a Vercel lambda, say so and this can
 * go back — but it should not rest on a claim nobody measured.
 *
 * ── OUTPUT IS ALWAYS JPEG, ON PURPOSE ─────────────────────────────────────
 * One format out means one extension, one content type and one set of bytes to
 * assert on. A render is a photograph; JPEG loses nothing that matters here and
 * the gallery copy is a browse thumbnail, not an archival master (the master IS
 * `image_key`, untouched).
 */

import sharp from 'sharp';

/** Everything the mark's geometry is derived from, in one place. */
export const WATERMARK_TEXT = 'SETNAYAN';

/**
 * Longest edge of the gallery copy. A pool tile is browsed at ~200px; 1280 is
 * generous for a full-size preview and keeps the object small enough that a
 * page of six is cheap. The couple's own copy is not resized.
 */
export const GALLERY_MAX_EDGE = 1280;

export type ServerWatermarkResult = {
  bytes: Buffer;
  contentType: 'image/jpeg';
  width: number;
  height: number;
};

/**
 * Composite the SETNAYAN mark onto image bytes and return JPEG bytes.
 *
 * Throws on bytes sharp cannot decode — the caller treats that as "no gallery
 * copy", which is the honest outcome: a render whose bytes we could not read is
 * one we cannot prove we marked, and an unmarked image must never reach the
 * pool. There is no "return the original on failure" branch here, deliberately;
 * that branch is exactly how an unmarked image would get published.
 */
export async function watermarkImageBytes(
  input: Uint8Array | Buffer,
): Promise<ServerWatermarkResult> {
  const base = sharp(Buffer.from(input), { failOn: 'error' }).rotate();
  const resized = await base
    .resize({
      width: GALLERY_MAX_EDGE,
      height: GALLERY_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer({ resolveWithObject: true });

  const { width, height } = resized.info;
  const { scrim, wordmark } = await watermarkLayers(width, height);

  const bytes = await sharp(resized.data)
    .composite([
      { input: scrim, top: 0, left: 0 },
      { input: wordmark.buffer, top: wordmark.top, left: wordmark.left },
    ])
    .jpeg({ quality: 86 })
    .toBuffer();

  return { bytes, contentType: 'image/jpeg', width, height };
}

/**
 * The mark, in two layers.
 *
 * LAYER 1 — the scrim: a rounded `<rect>` the size of the image, drawn
 * bottom-right. Plain SVG geometry, no text, so librsvg needs no font for it.
 * It is why this is not just translucent white lettering: white-on-white is a
 * watermark that marks nothing, and it would still pass any test that only
 * asked "did we composite something".
 *
 * LAYER 2 — the wordmark: SETNAYAN, rendered by satori into vector PATHS from
 * the bundled Poppins TTF and rasterized as its own small PNG, then placed on
 * the scrim. No host font is consulted — see the header for why that matters
 * more than it looks like it does.
 *
 * Both are sized off the SHORT edge so a wide render and a tall one get a mark
 * of the same visual weight. The geometry is MB9's, unchanged.
 */
async function watermarkLayers(
  width: number,
  height: number,
): Promise<{
  scrim: Buffer;
  wordmark: { buffer: Buffer; top: number; left: number };
}> {
  const short = Math.min(width, height);
  const fontSize = Math.max(16, Math.round(short * 0.055));
  const pad = Math.max(10, Math.round(short * 0.03));
  const scrimH = Math.round(fontSize * 2.1);
  const scrimW = Math.round(fontSize * (WATERMARK_TEXT.length * 0.72 + 1.4));
  const scrimX = Math.max(0, width - scrimW - pad);
  const scrimY = Math.max(0, height - scrimH - pad);

  const scrim = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="${scrimX}" y="${scrimY}" width="${scrimW}" height="${scrimH}" rx="${Math.round(
      scrimH / 2,
    )}" fill="rgba(20,18,16,0.42)"/>
</svg>`,
  );

  const wordmarkPng = await renderWordmark(fontSize, scrimW, scrimH);
  const placed = await sharp(wordmarkPng).metadata();
  const wmW = placed.width ?? scrimW;
  const wmH = placed.height ?? scrimH;

  return {
    scrim,
    wordmark: {
      buffer: wordmarkPng,
      // Centred in the scrim, and clamped so a mark wider than its plate (only
      // reachable on a pathologically small image) still lands inside the
      // canvas rather than making sharp throw.
      left: Math.max(0, Math.min(width - wmW, scrimX + Math.round((scrimW - wmW) / 2))),
      top: Math.max(0, Math.min(height - wmH, scrimY + Math.round((scrimH - wmH) / 2))),
    },
  };
}

/**
 * SETNAYAN as vector paths on a transparent ground.
 *
 * satori is loaded dynamically and the TTF is read on demand so neither is
 * pulled in until a mark is actually drawn. Same font and same mechanism as
 * every social card in `lib/social`, for the same documented reason.
 */
async function renderWordmark(
  fontSizePx: number,
  maxWidth: number,
  maxHeight: number,
): Promise<Buffer> {
  const [{ default: satori }, fs, path] = await Promise.all([
    import('satori'),
    import('node:fs'),
    import('node:path'),
  ]);
  const fontData = fs.readFileSync(
    path.join(process.cwd(), 'lib', 'social', 'fonts', 'Poppins-Bold.ttf'),
  );

  const tree = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      },
      children: {
        type: 'span',
        props: {
          style: {
            fontFamily: 'Poppins',
            fontSize: fontSizePx,
            fontWeight: 700,
            letterSpacing: Math.round(fontSizePx * 0.12),
            color: 'rgba(255,255,255,0.92)',
          },
          children: WATERMARK_TEXT,
        },
      },
    },
  };

  // The object element form, cast at the boundary — the app's tsconfig is
  // `jsx: preserve` and satori wants React-element-SHAPED objects but not real
  // React. Same cast, for the same reason, as every card in lib/social.
  const svg = await satori(tree as unknown as React.ReactNode, {
    width: Math.max(1, Math.round(maxWidth)),
    height: Math.max(1, Math.round(maxHeight)),
    fonts: [
      { name: 'Poppins', data: fontData, weight: 700 as const, style: 'normal' as const },
    ],
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Read back the greyscale statistics of one quadrant of an ENCODED image.
 *
 * The instrument the watermark guards measure with: it looks at the pixels that
 * were actually produced, so a change that skips the mark shows up as a flat
 * corner and the test goes red. Nothing here reads a flag or a return value
 * claiming the mark was applied.
 *
 * 🪤 sharp's own `.stats()` READS THE INPUT IMAGE and silently DISCARDS the
 * pipeline queued in front of it — an `.extract()` before it is thrown away.
 * Measured 2026-09-04 on a flat 800×600 test image: all four quadrants of a
 * MARKED image came back identical (mean 139.584 · stdev 6.200), so a guard
 * built on `.stats()` could never have gone red no matter what it watched. The
 * region is read out with `.raw()` and the statistics computed by hand.
 */
export async function imageRegionStats(
  bytes: Uint8Array,
  region: 'bottom_right' | 'top_left',
): Promise<{ mean: number; stdev: number }> {
  const meta = await sharp(Buffer.from(bytes)).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 4 || height < 4) throw new Error('imageRegionStats: image too small');

  const w = Math.floor(width / 2);
  const h = Math.floor(height / 2);
  const left = region === 'bottom_right' ? width - w : 0;
  const top = region === 'bottom_right' ? height - h : 0;

  const raw = await sharp(Buffer.from(bytes))
    .extract({ left, top, width: w, height: h })
    .greyscale()
    .raw()
    .toBuffer();
  if (raw.length === 0) throw new Error('imageRegionStats: empty region');

  let sum = 0;
  for (const v of raw) sum += v;
  const mean = sum / raw.length;
  let variance = 0;
  for (const v of raw) variance += (v - mean) * (v - mean);
  return { mean, stdev: Math.sqrt(variance / raw.length) };
}
