/**
 * Client-side image compression utility.
 *
 * Web-optimizes an image the couple picks BEFORE it goes to R2 — a canvas
 * downscale + re-encode that mirrors the existing client-side transforms in
 * this codebase (`lib/watermark.ts` reads the file into a canvas the same way;
 * `lib/video-compress.ts` does the video-side equivalent with ffmpeg.wasm).
 *
 * Why client-side (not sharp): the app uploads direct-to-R2 via a presigned
 * PUT (see `app/api/upload/route.ts`) — the bytes never round-trip through the
 * Next.js server, so there's no server hook to run `sharp` on. Compressing in
 * the browser keeps the signed `content-length` matched to the actual PUT body
 * and means only the compressed object ever lands on R2 (no 3-month Papic
 * originals cycle — these couple uploads are stored compressed, permanently).
 *
 * Contract: BEST-EFFORT, NEVER THROWS. On any failure (no canvas, unreadable
 * image, tiny/animated GIF, encode error) it returns the ORIGINAL file so the
 * upload always proceeds — same fail-open posture as `watermarkFile` /
 * `compressVideoForWeb`.
 */

export type ImageCompressOptions = {
  /**
   * Longest-edge ceiling in CSS pixels. An image larger than this on either
   * axis is scaled down (preserving aspect ratio); a smaller image is left at
   * its native size. Default 2000 — a full-bleed editorial hero / gallery photo
   * reads crisply at this width on any screen while staying light.
   */
  maxEdge?: number;
  /** JPEG/WebP quality, 0–1. Default 0.82 — visually lossless for photos. */
  quality?: number;
};

const DEFAULTS: Required<ImageCompressOptions> = {
  maxEdge: 2000,
  quality: 0.82,
};

/**
 * Compress + web-optimize an image file. Returns a NEW File (JPEG for opaque
 * source formats, WebP preserved) capped at `maxEdge` on its longest side, or
 * the original file untouched when compression isn't worthwhile or fails.
 */
export async function compressImageForWeb(
  file: File,
  opts: ImageCompressOptions = {},
): Promise<File> {
  const options = { ...DEFAULTS, ...opts };

  // Only raster images we can canvas-decode + re-encode. GIF is skipped (a
  // canvas re-encode would flatten an animation to a single frame) and SVG has
  // no raster to compress — both pass through untouched.
  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/') || type === 'image/gif' || type === 'image/svg+xml') {
    return file;
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return file; // couldn't measure → don't risk a bad encode

    const scale = Math.min(1, options.maxEdge / Math.max(nw, nh));
    const outW = Math.max(1, Math.round(nw * scale));
    const outH = Math.max(1, Math.round(nh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, outW, outH);

    // Preserve WebP (already-efficient + may carry alpha); everything else
    // re-encodes to JPEG (best photo compression). PNG screenshots the couple
    // uploads become JPEGs — fine for editorial imagery, and far lighter.
    const outMime = type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outMime, options.quality);
    if (!blob) return file;

    // Never hand back a LARGER file — if the re-encode didn't help (e.g. an
    // already-tiny, already-optimized image), keep the original.
    if (blob.size >= file.size && scale === 1) return file;

    const filename = renameForMime(file.name, outMime);
    return new File([blob], filename, { type: outMime, lastModified: Date.now() });
  } catch {
    return file; // fail-open
  }
}

// ---- helpers (mirror lib/watermark.ts) ----

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load image'));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function renameForMime(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  const ext = mime === 'image/webp' ? 'webp' : 'jpg';
  return `${base}.${ext}`;
}
