/**
 * lib/clip-poster.ts — BROWSER-side poster-frame extraction for Papic clips.
 *
 * The always-on NSFW screen (lib/nsfw-screen.ts) classifies still images
 * only — nsfwjs has no video head, and the serverless lambda has no ffmpeg.
 * So the CLIENT extracts one poster JPEG from the clip it just recorded
 * (decode the blob in an off-DOM <video>, seek a beat in, draw to canvas)
 * and uploads it alongside the video; the server screens the poster as the
 * clip's proxy.
 *
 * Failure policy: NEVER throws, returns null on any trouble (no DOM, codec
 * the browser can't decode, zero-duration stream, canvas taint, timeout).
 * A missing poster never blocks the capture — the clip simply stays
 * 'unscreened', which every guest-facing surface already excludes for clips.
 */

/** Seek target — a beat past the first frame (encoders often start dark). */
const POSTER_SEEK_SECONDS = 0.5;
/** Hard cap on the whole extraction — a venue phone must never hang. */
const POSTER_TIMEOUT_MS = 5_000;
/** Longest output edge — the classifier only needs 224px; keep uploads tiny. */
const POSTER_MAX_EDGE_PX = 640;
const POSTER_JPEG_QUALITY = 0.85;

/**
 * Extract one JPEG poster frame from recorded clip bytes.
 * Browser-only (needs document/video/canvas) — returns null elsewhere.
 */
export async function extractClipPosterBytes(
  bytes: Uint8Array,
  mimeType: string,
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return null;

  // Fresh ArrayBuffer-backed copy so Blob accepts the view even when the
  // source rides a SharedArrayBuffer (same posture as the sink's PUT).
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType || 'video/webm' });
  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    const frame = await new Promise<Uint8Array | null>((resolve) => {
      let settled = false;
      const finish = (value: Uint8Array | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), POSTER_TIMEOUT_MS);

      const draw = () => {
        try {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (!w || !h) return finish(null);
          const scale = Math.min(1, POSTER_MAX_EDGE_PX / Math.max(w, h));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return finish(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (out) => {
              if (!out) return finish(null);
              out
                .arrayBuffer()
                .then((buf) => finish(new Uint8Array(buf)))
                .catch(() => finish(null));
            },
            'image/jpeg',
            POSTER_JPEG_QUALITY,
          );
        } catch {
          finish(null);
        } finally {
          clearTimeout(timer);
        }
      };

      video.addEventListener('error', () => finish(null), { once: true });
      video.addEventListener('seeked', draw, { once: true });
      video.addEventListener(
        'loadeddata',
        () => {
          // MediaRecorder webm often reports duration=Infinity — clamp the
          // seek; a failed/ignored seek still fires 'seeked' in practice,
          // and the timeout backstops the browsers where it doesn't.
          try {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const target = duration > POSTER_SEEK_SECONDS ? POSTER_SEEK_SECONDS : 0;
            if (target > 0 && video.currentTime !== target) {
              video.currentTime = target;
            } else {
              draw();
            }
          } catch {
            draw();
          }
        },
        { once: true },
      );

      video.src = objectUrl;
      video.load();
    });
    return frame;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      // releasing the decoder is best-effort
    }
  }
}
