/**
 * lib/qr-scan.ts — a single QR detector that reads a frame from a live <video>.
 *
 * Prefers the native BarcodeDetector (hardware-accelerated, no main-thread
 * canvas churn) and falls back to jsQR (already a dependency, used by the
 * day-of check-in desk) on browsers without it — notably desktop Firefox and
 * older iOS Safari. Browser-only: import lazily from a client component.
 *
 * `makeQrDetector()` returns a `detect(video)` you can call on each animation
 * frame; it returns the decoded string (whatever the QR encodes — a URL, a
 * token) or null when no code is in view.
 */

type DetectFn = (video: HTMLVideoElement) => Promise<string | null>;

// Minimal shape of the Barcode Detection API (not in lib.dom yet).
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

function getNativeCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/** Resolve a detector, preferring native BarcodeDetector over jsQR. */
export async function makeQrDetector(): Promise<DetectFn> {
  const ctor = getNativeCtor();
  if (ctor) {
    try {
      // Confirm the QR format is actually supported before committing to native
      // (some engines expose the ctor but not qr_code).
      const formats = (await ctor.getSupportedFormats?.()) ?? ['qr_code'];
      if (formats.includes('qr_code')) {
        const detector = new ctor({ formats: ['qr_code'] });
        return async (video) => {
          if (video.readyState < 2) return null;
          try {
            const codes = await detector.detect(video);
            return codes[0]?.rawValue?.trim() || null;
          } catch {
            return null;
          }
        };
      }
    } catch {
      // fall through to jsQR
    }
  }

  // jsQR fallback — draw the frame to an offscreen canvas, decode the pixels.
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!ctx || video.readyState < 2) return null;
    const scale = Math.min(1, 640 / (video.videoWidth || 640));
    canvas.width = Math.round((video.videoWidth || 640) * scale);
    canvas.height = Math.round((video.videoHeight || 480) * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(image.data, image.width, image.height, {
      inversionAttempts: 'dontInvert',
    });
    return code?.data?.trim() || null;
  };
}
