// lib/papic-upload/prepare.ts — make a shot's small pieces ON THE PHONE.
//
// Owner relay 2026-10-23 ("as realtime as possible"): the thumbnail and the
// display copy are made here, from the photo the shutter already saved, so the
// first thing that crosses the network is ~30 KB instead of the whole frame.
// The sizes are the platform's own (lib/papic-derivatives.ts): thumb 320 ·
// tile 640 · display 1280 long edge — the server writes the phone's copies into
// the same thumb/tile/display columns, so no reader changes.
//
// WebP where the browser can encode it (Chrome, Safari 16+…), JPEG otherwise —
// `canvas.toBlob('image/webp')` silently returns a PNG on a browser that cannot,
// so the returned type is checked rather than trusted.
//
// Runs in the replayer's background step, never on the shutter.

export const THUMB_EDGE = 320;
export const TILE_EDGE = 640;
export const DISPLAY_EDGE = 1280;

const QUALITY = { thumb: 0.7, tile: 0.75, display: 0.8, poster: 0.8 } as const;

type Drawable = ImageBitmap | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

function sizeOf(src: Drawable): { w: number; h: number } {
  if ('videoWidth' in src) return { w: src.videoWidth, h: src.videoHeight };
  if ('naturalWidth' in src) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

/** Fit (w, h) inside a long edge, never enlarging. */
export function fitLongEdge(w: number, h: number, edge: number): { w: number; h: number } {
  const long = Math.max(w, h);
  if (long <= edge || long === 0) return { w, h };
  const k = edge / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Encode WebP, or JPEG where the browser cannot encode WebP. */
export async function encodeStill(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp' && webp.size > 0) return webp;
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
  return jpeg && jpeg.size > 0 ? jpeg : null;
}

export async function resizeTo(src: Drawable, edge: number, quality: number): Promise<Blob | null> {
  const { w, h } = sizeOf(src);
  if (!w || !h) return null;
  const fit = fitLongEdge(w, h, edge);
  const canvas = document.createElement('canvas');
  canvas.width = fit.w;
  canvas.height = fit.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, fit.w, fit.h);
  const out = await encodeStill(canvas, quality);
  // Free the backing store now — iOS caps total canvas memory per page.
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

async function decode(blob: Blob): Promise<Drawable | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // fall through to <img>
    }
  }
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export interface PhotoPieces {
  thumb: Blob;
  tile: Blob;
  display: Blob;
}

/**
 * Thumbnail, tile and display copy from a saved photo. Null when the browser
 * cannot decode or resize it — the shot then records with its original and the
 * server makes the copies, as it always did (phaseOf, hasThumb === false).
 */
export async function makePhotoPieces(original: Blob): Promise<PhotoPieces | null> {
  const img = await decode(original);
  if (!img) return null;
  try {
    const thumb = await resizeTo(img, THUMB_EDGE, QUALITY.thumb);
    const tile = await resizeTo(img, TILE_EDGE, QUALITY.tile);
    const display = await resizeTo(img, DISPLAY_EDGE, QUALITY.display);
    if (!thumb || !tile || !display) return null;
    return { thumb, tile, display };
  } finally {
    if ('close' in img && typeof img.close === 'function') img.close();
  }
}

/** A clip's poster at display size (the NSFW proxy and the still others see first). */
export async function makePoster(poster: Blob): Promise<Blob | null> {
  const img = await decode(poster);
  if (!img) return null;
  try {
    return await resizeTo(img, DISPLAY_EDGE, QUALITY.poster);
  } finally {
    if ('close' in img && typeof img.close === 'function') img.close();
  }
}

/** How long the phone may spend making a clip's web copy before it sends the clip as it is. */
export const CLIP_WEB_BUDGET_MS = 90_000;

/**
 * The ~0.5 MB web copy of a clip (the existing ffmpeg.wasm path,
 * lib/video-compress.ts `web720`). Null when this browser cannot make one, it
 * fails, it is not smaller, or it takes longer than the budget — the raw clip is
 * then the playable piece and goes with the record.
 */
export async function makeClipWebCopy(clip: Blob): Promise<Blob | null> {
  try {
    const { canCompressVideo, compressVideoForWeb, WEB_COPY_MIN_BYTES } = await import('@/lib/video-compress');
    if (!canCompressVideo()) return null;
    const src = new File([clip], 'papic-clip.mp4', { type: clip.type || 'video/mp4' });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CLIP_WEB_BUDGET_MS);
    try {
      const web = await compressVideoForWeb(src, { profile: 'web720', signal: ctl.signal });
      if (web === src || web.size <= WEB_COPY_MIN_BYTES || web.size >= clip.size) return null;
      return new Blob([web], { type: 'video/mp4' });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/** Run the on-device face pass on the CLEAN frame (mode_a events only). */
export async function faceVectorsFrom(clean: Blob): Promise<{ vectors: number[][]; subjectCenter: { x: number; y: number } | null }> {
  const empty = { vectors: [] as number[][], subjectCenter: null };
  const img = await decode(clean);
  if (!img) return empty;
  try {
    const { w, h } = sizeOf(img);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    const { embedFaces } = await import('@/lib/face-embed');
    const fe = await embedFaces(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return { vectors: fe.vectors, subjectCenter: fe.subjectCenter };
  } catch {
    return empty;
  } finally {
    if ('close' in img && typeof img.close === 'function') img.close();
  }
}
