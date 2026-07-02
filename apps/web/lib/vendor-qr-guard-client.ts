/**
 * QR-in-media guard — CLIENT-side file validators (browser-only; import
 * lazily from client components, e.g. via <FileUpload qrGuard>).
 *
 * Decodes QR codes from a picked image (single pass) or video (sampled
 * frames) with jsQR on an offscreen canvas, then asks
 * POST /api/vendor/qr-guard for the verdict (the server resolves shortener
 * redirects, which the browser can't do cross-origin). The obvious direct
 * case short-circuits locally via payloadHitsGuardedPath.
 *
 * FAIL-OPEN everywhere: a decode/probe/network hiccup returns null (valid) —
 * this layer is fast feedback; the authoritative gate for images is the
 * save-time server scan. For VIDEO this is the only pre-save check (no
 * server-side frame extraction exists), so it samples generously but still
 * fails open — the retro-scan + report path backstop it.
 */

import {
  payloadHitsGuardedPath,
  VENDOR_QR_MEDIA_ERROR,
} from '@/lib/vendor-qr-guard-shared';

const IMAGE_MAX_EDGE = 1600;
const VIDEO_MAX_EDGE = 960;
const VIDEO_SAMPLE_FRAMES = 8;
const VIDEO_OVERALL_TIMEOUT_MS = 15_000;

type JsQrFn = typeof import('jsqr').default;

async function loadJsQr(): Promise<JsQrFn> {
  return (await import('jsqr')).default;
}

function decodeCanvas(
  jsQR: JsQrFn,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): string | null {
  const image = ctx.getImageData(0, 0, width, height);
  const code = jsQR(image.data, image.width, image.height, {
    inversionAttempts: 'attemptBoth',
  });
  return code?.data?.trim() || null;
}

/** Decode QR payloads from a picked image File. [] when none / undecodable. */
export async function findQrPayloadsInImageFile(file: File): Promise<string[]> {
  try {
    const jsQR = await loadJsQr();
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(
        1,
        IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
      );
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return [];
      ctx.drawImage(bitmap, 0, 0, w, h);
      const payload = decodeCanvas(jsQR, ctx, w, h);
      return payload ? [payload] : [];
    } finally {
      bitmap.close();
    }
  } catch {
    return [];
  }
}

/**
 * Decode QR payloads from a picked video File by sampling evenly-spaced
 * frames (same hidden-<video> pattern as the showcase duration probe).
 * Distinct payloads only; [] on any probe failure.
 */
export async function findQrPayloadsInVideoFile(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  const cleanup = () => {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  };

  try {
    const jsQR = await loadJsQr();
    const payloads = new Set<string>();

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('video probe timeout')),
        VIDEO_OVERALL_TIMEOUT_MS,
      );
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('video load error'));
      };
      video.src = url;
    });

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return [];

    const w0 = video.videoWidth || 640;
    const h0 = video.videoHeight || 480;
    const scale = Math.min(1, VIDEO_MAX_EDGE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    const frames = Math.min(VIDEO_SAMPLE_FRAMES, Math.max(2, Math.ceil(duration)));
    const started = Date.now();
    for (let i = 0; i < frames; i++) {
      if (Date.now() - started > VIDEO_OVERALL_TIMEOUT_MS) break;
      // Nudge inside the clip bounds — t=0 / t=duration often render black.
      const t = Math.min(
        Math.max(0.1, ((i + 0.5) / frames) * duration),
        Math.max(0.1, duration - 0.1),
      );
      const seeked = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 3000);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve(true);
        };
        video.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
        try {
          video.currentTime = t;
        } catch {
          clearTimeout(timer);
          resolve(false);
        }
      });
      if (!seeked) continue;
      try {
        ctx.drawImage(video, 0, 0, w, h);
        const payload = decodeCanvas(jsQR, ctx, w, h);
        if (payload) payloads.add(payload);
      } catch {
        // an undrawable frame skips cleanly
      }
    }
    return Array.from(payloads);
  } catch {
    return [];
  } finally {
    cleanup();
  }
}

/**
 * <FileUpload>-compatible validator: null = fine, string = rejection message.
 * Routes by MIME; asks the server verdict endpoint so shortener QRs are
 * caught too. FAIL-OPEN on every error path.
 */
export async function validateNoVendorQrInFile(
  file: File,
): Promise<string | null> {
  try {
    const type = (file.type || '').toLowerCase();
    const payloads = type.startsWith('video/')
      ? await findQrPayloadsInVideoFile(file)
      : type.startsWith('image/')
        ? await findQrPayloadsInImageFile(file)
        : [];
    if (payloads.length === 0) return null;

    // Obvious direct hit — no round-trip needed.
    if (payloads.some(payloadHitsGuardedPath)) return VENDOR_QR_MEDIA_ERROR;

    const res = await fetch('/api/vendor/qr-guard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payloads }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { invalid?: unknown };
    return Array.isArray(json.invalid) && json.invalid.length > 0
      ? VENDOR_QR_MEDIA_ERROR
      : null;
  } catch {
    return null;
  }
}
