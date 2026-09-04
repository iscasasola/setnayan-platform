// NOTE: deliberately NOT 'server-only'. `sharp` and `satori` are loaded via
// DYNAMIC imports inside the functions below (so nothing server-native leaks
// toward a client bundle), which also lets the Node test runner
// (`tsx --test`, `pnpm test:unit`) call the real watermarker on real bytes and
// then MEASURE THE PIXELS IT PRODUCED. That is the entire reason this module
// exists as its own file — see the guard note below. Mirrors the same choice,
// for the same reason, in lib/perceptual-hash.ts.

/**
 * lib/watermark-server.ts — the SETNAYAN watermark, applied on the SERVER.
 *
 * ── WHY A SERVER-SIDE TWIN OF lib/watermark.ts EXISTS ───────────────────────
 * The owner-locked rule (2026-05-21, written into lib/watermark.ts's own
 * docblock) is that "Vendor marketplace photos MUST have watermarks". The
 * vendor moodboard-library upload surface HAS honoured that since May — but
 * only in the browser: `stylist-library-editor.tsx` called `watermarkFile`
 * (Canvas) and the server action then stored whatever bytes arrived, without
 * ever asking whether they were marked.
 *
 * 🔑 A CLIENT-SIDE WATERMARK IS A REQUEST, NOT A RULE. The upload is a server
 * action; anything that can call it can hand it unmarked bytes, and the happy
 * path in the browser looks identical either way. MB11 opens this bucket to
 * every supplying trade and wires its photos into a PUBLICLY readable gallery
 * that couples browse — at which point "usually watermarked" is not a
 * property the platform has.
 *
 * So the mark is applied HERE, on the authoritative bytes, after they arrive
 * and before anything is stored. The client no longer marks this path at all
 * (a second pass would print SETNAYAN twice).
 *
 * ── WHY satori AND NOT AN SVG STRING WITH A FONT NAME ──────────────────────
 * ⚠ sharp rasterizes SVG through librsvg, whose fontconfig path is FLAKY ON
 * VERCEL — lib/social/card.tsx already carries that finding in its own
 * docblock, which is why every social card in this repo goes through satori
 * with an EXPLICIT font buffer. A `<text font-family="sans-serif">` overlay
 * would render locally, pass every test, and then composite NOTHING VISIBLE in
 * production: a watermark that silently disappears exactly where it matters.
 * satori converts the wordmark to VECTOR PATHS using the bundled Poppins TTF,
 * so the rasterized overlay carries no font dependency at all.
 *
 * ── THE GUARD MEASURES OUTPUT, NOT INTENT ──────────────────────────────────
 * `imageRegionStats` reads back the pixels of a produced image. The watermark
 * test builds a FLAT image (standard deviation ≈ 0 everywhere), marks it, and
 * asserts the corner the mark lands in is no longer flat while the opposite
 * corner still is. A boolean "watermarked: true" written next to the row would
 * survive deleting the watermark step; this cannot.
 */

/** The wordmark. Centralised so the guard and the renderer cannot disagree. */
export const WATERMARK_TEXT = 'SETNAYAN';

/** Longest edge we store. A gallery tile is never shown larger than this, and
 *  an uncapped 48-megapixel upload makes every downstream pass (pHash, QR
 *  decode, the model read) cost real money for no visible gain. */
export const MAX_STORED_EDGE = 2000;

const MARGIN_RATIO = 0.025;
const FONT_RATIO = 0.04;
const MIN_FONT_PX = 18;

export type WatermarkedImage = {
  bytes: Uint8Array;
  contentType: string;
  width: number;
  height: number;
};

/** JPEG for everything except PNG and WebP, which keep their own format. */
function outputFormatFor(contentType: string | null | undefined): 'jpeg' | 'png' | 'webp' {
  const t = (contentType ?? '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  return 'jpeg';
}

/** Content type of the format we chose. */
export function watermarkOutputContentType(inputContentType: string | null | undefined): string {
  const f = outputFormatFor(inputContentType);
  return f === 'jpeg' ? 'image/jpeg' : `image/${f}`;
}

/** File extension of the format we chose. */
export function watermarkOutputExtension(inputContentType: string | null | undefined): string {
  const f = outputFormatFor(inputContentType);
  return f === 'jpeg' ? 'jpg' : f;
}

/**
 * Render the wordmark to a transparent PNG overlay of the given pixel height,
 * with every glyph already a vector path. No system font is consulted.
 */
async function renderWordmarkOverlay(fontSizePx: number): Promise<Buffer> {
  const [{ default: satori }, { default: sharp }, fs, path] = await Promise.all([
    import('satori'),
    import('sharp'),
    import('node:fs'),
    import('node:path'),
  ]);

  const fontPath = path.join(process.cwd(), 'lib', 'social', 'fonts', 'Poppins-Medium.ttf');
  const fontData = fs.readFileSync(fontPath);

  const padding = Math.round(fontSizePx * 0.35);
  const tree = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${Math.round(padding * 0.5)}px ${padding}px`,
          // A dark plate behind the wordmark so it survives a white dress and
          // a black tuxedo alike — a translucent white text alone vanishes on
          // an overexposed sky, which is most reception ceilings.
          backgroundColor: 'rgba(0,0,0,0.32)',
          borderRadius: `${Math.round(fontSizePx * 0.25)}px`,
        },
        children: {
          type: 'span',
          props: {
            style: {
              fontFamily: 'Poppins',
              fontSize: fontSizePx,
              fontWeight: 500,
              letterSpacing: fontSizePx * 0.14,
              color: 'rgba(255,255,255,0.92)',
            },
            children: WATERMARK_TEXT,
          },
        },
      },
  };

  // The OBJECT element form, cast at the boundary — the app's tsconfig is
  // `jsx: preserve` and satori wants React-element-SHAPED objects but not real
  // React. Same cast, for the same reason, as every card in lib/social.
  const svg = await satori(tree as unknown as React.ReactNode, {
    width: Math.ceil(fontSizePx * (WATERMARK_TEXT.length + 2) * 0.8),
    height: Math.ceil(fontSizePx * 2),
    fonts: [{ name: 'Poppins', data: fontData, weight: 500 as const, style: 'normal' as const }],
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Apply the SETNAYAN watermark to encoded image bytes and return the encoded
 * result. EXIF orientation is baked first (`.rotate()`) so the mark lands in
 * the corner a human sees, not the corner the sensor recorded.
 *
 * Throws on undecodable input — the caller refuses the upload rather than
 * storing an unmarked file. That is deliberate and is the opposite posture
 * from the theft scan, which is best-effort: a missing hash costs a flag we
 * can recompute later, an unmarked public photo cannot be un-published.
 */
export async function watermarkImageBytes(
  bytes: Uint8Array,
  inputContentType?: string | null,
): Promise<WatermarkedImage> {
  const { default: sharp } = await import('sharp');

  const base = sharp(Buffer.from(bytes), { failOn: 'none' })
    .rotate()
    .resize({
      width: MAX_STORED_EDGE,
      height: MAX_STORED_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });

  const flattened = await base.toBuffer();
  const meta = await sharp(flattened).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new Error('watermark: image could not be decoded');
  }

  const fontSize = Math.max(MIN_FONT_PX, Math.round(Math.min(width, height) * FONT_RATIO));
  const overlay = await renderWordmarkOverlay(fontSize);
  const margin = Math.max(8, Math.round(Math.min(width, height) * MARGIN_RATIO));

  const format = outputFormatFor(inputContentType ?? meta.format ?? null);

  // `gravity` and explicit top/left offsets are mutually exclusive in sharp,
  // so the margin is produced by EXTENDING the overlay rather than by moving
  // it — an overlay carrying transparent padding on its right and bottom edges
  // sits `margin` px in from the corner under southeast gravity.
  const padded = await sharp(overlay)
    .extend({
      top: 0,
      left: 0,
      right: margin,
      bottom: margin,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const pipeline = sharp(flattened).composite([{ input: padded, gravity: 'southeast' }]);

  const out =
    format === 'png'
      ? await pipeline.png().toBuffer()
      : format === 'webp'
        ? await pipeline.webp({ quality: 88 }).toBuffer()
        : await pipeline.jpeg({ quality: 88 }).toBuffer();

  return {
    bytes: new Uint8Array(out),
    contentType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
    width,
    height,
  };
}

export type ImageRegion = 'bottom_right' | 'top_left';

/**
 * Read back the greyscale statistics of one quadrant of an ENCODED image.
 *
 * This is the guard's instrument: it looks at the pixels that were actually
 * produced, so a change that skips the watermark step shows up as a flat
 * bottom-right corner and the test goes red. Nothing here reads a flag, a
 * column, or a return value claiming the mark was applied.
 */
export async function imageRegionStats(
  bytes: Uint8Array,
  region: ImageRegion,
): Promise<{ mean: number; stdev: number }> {
  const { default: sharp } = await import('sharp');
  const img = sharp(Buffer.from(bytes));
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 4 || height < 4) throw new Error('imageRegionStats: image too small');

  const w = Math.floor(width / 2);
  const h = Math.floor(height / 2);
  const left = region === 'bottom_right' ? width - w : 0;
  const top = region === 'bottom_right' ? height - h : 0;

  // 🪤 sharp's own `.stats()` reads the INPUT image and IGNORES the pipeline
  // operations queued before it — an `.extract()` in front of it is silently
  // discarded, so every quadrant of a marked photo came back with identical
  // numbers and the watermark guard could never have failed. Measured here,
  // 2026-09-04, on a flat 800×600 test image: tl/tr/bl/br all returned
  // mean 139.584 · stdev 6.200. The pixels are read out by hand instead.
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
