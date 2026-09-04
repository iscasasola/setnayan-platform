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
  const overlay = Buffer.from(watermarkSvg(width, height));

  const bytes = await sharp(resized.data)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 86 })
    .toBuffer();

  return { bytes, contentType: 'image/jpeg', width, height };
}

/**
 * The mark itself — an SVG the exact size of the image, composited at 0,0.
 *
 * Sized off the SHORT edge so a wide render and a tall one get a mark of the
 * same visual weight, and drawn bottom-right over a soft dark scrim so it stays
 * legible on both a white ceiling drape and a night reception. The scrim is why
 * this is not just `text` with an opacity: white-on-white is a watermark that
 * marks nothing, and it would still pass any test that only asked "did we
 * composite something".
 *
 * No font FILE is referenced. sharp renders SVG text through librsvg/fontconfig
 * using whatever the host has; a missing custom font on a Vercel lambda would
 * silently drop the glyphs. A generic family is available everywhere the app
 * runs, and legibility here beats typography.
 */
function watermarkSvg(width: number, height: number): string {
  const short = Math.min(width, height);
  const fontSize = Math.max(16, Math.round(short * 0.055));
  const pad = Math.max(10, Math.round(short * 0.03));
  const scrimH = Math.round(fontSize * 2.1);
  const scrimW = Math.round(fontSize * (WATERMARK_TEXT.length * 0.72 + 1.4));
  const scrimX = Math.max(0, width - scrimW - pad);
  const scrimY = Math.max(0, height - scrimH - pad);
  const textX = scrimX + Math.round(scrimW / 2);
  const textY = scrimY + Math.round(scrimH / 2 + fontSize * 0.36);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="${scrimX}" y="${scrimY}" width="${scrimW}" height="${scrimH}" rx="${Math.round(
    scrimH / 2,
  )}" fill="rgba(20,18,16,0.42)"/>
  <text x="${textX}" y="${textY}" text-anchor="middle"
        font-family="DejaVu Sans, Helvetica, Arial, sans-serif"
        font-size="${fontSize}" font-weight="700" letter-spacing="${Math.round(fontSize * 0.12)}"
        fill="rgba(255,255,255,0.92)">${WATERMARK_TEXT}</text>
</svg>`;
}
