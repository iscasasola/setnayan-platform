/**
 * Client-side video compression for couple uploads (Save-the-Date film clip).
 *
 * Phone exports are often huge (cale-ice's was 45s / 135 MB / ~25 Mbps) — far too
 * heavy to stream, so the clip stalls and re-buffers on playback. There is NO
 * server-side video processing in the stack (Vercel can't run ffmpeg; everything
 * video is done in the browser — see patiktok-render / boomerang-encoder). So we
 * compress in the browser, at upload time, with ffmpeg.wasm (single-thread build —
 * no SharedArrayBuffer, so no cross-origin-isolation / CSP changes).
 *
 * The ffmpeg core (~32 MB wasm) is LAZY-loaded from a CDN only the first time a
 * couple actually compresses a video — it never touches the main bundle. Owner
 * chose this "robust" path (2026-06-22) over the lighter WebCodecs route because
 * WebCodecs AAC audio re-encode is unreliable on iOS Safari (where couples upload).
 *
 * CONTRACT: this NEVER throws and ALWAYS returns a usable File. On anything that
 * goes wrong — unsupported browser, core load failure, decode error, OOM, or a
 * result that isn't actually smaller — it returns the ORIGINAL file unchanged, so
 * the upload proceeds exactly as it does today. Compression is a best-effort
 * optimisation, never a gate.
 */

// Target: fit within 1080p, H.264 high/yuv420p + AAC, faststart for progressive
// playback. CRF 27 @ veryfast ≈ 2–4 Mbps for typical content → a ~25 Mbps/135 MB
// clip drops to ~15–30 MB with no visible quality loss at phone/laptop sizes.
const TARGET_LONG_EDGE = 1080;
const CRF = '27';
const PRESET = 'veryfast';
const AUDIO_BITRATE = '128k';

// Don't bother compressing clips that are already light enough to stream well —
// re-encoding only wastes the couple's time + battery and can soften quality.
const SKIP_BELOW_BYTES = 15 * 1024 * 1024; // 15 MB
const SKIP_BELOW_BITRATE = 6_000_000; // 6 Mbps

// Pinned core version (matches @ffmpeg/ffmpeg 0.12.x). UMD single-thread build.
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

export type CompressProgress = {
  /** 'probing' | 'loading' (fetching the ~32MB core) | 'optimizing' | 'done'. */
  phase: 'probing' | 'loading' | 'optimizing';
  /** 0..1 within the current phase (optimizing reports real ffmpeg progress). */
  ratio: number;
};

/** True when the browser can run ffmpeg.wasm at all (WASM + dynamic import). */
export function canCompressVideo(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly === 'object';
}

/** Read a local video's duration (seconds) cheaply via a metadata-only <video>. */
function probeDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      const done = (d: number | null) => {
        URL.revokeObjectURL(url);
        v.removeAttribute('src');
        resolve(d);
      };
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
      v.onerror = () => done(null);
      v.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Compress a video File for web playback. Returns a smaller MP4 File on success,
 * or the ORIGINAL file unchanged on skip/failure (never throws).
 */
export async function compressVideoForWeb(
  file: File,
  opts: { onProgress?: (p: CompressProgress) => void; signal?: AbortSignal } = {},
): Promise<File> {
  const { onProgress, signal } = opts;
  if (!canCompressVideo()) return file;

  // ── Skip clips that are already light enough to stream smoothly.
  onProgress?.({ phase: 'probing', ratio: 0 });
  const duration = await probeDurationSeconds(file);
  const bitrate = duration && duration > 0 ? (file.size * 8) / duration : null;
  if (file.size < SKIP_BELOW_BYTES || (bitrate !== null && bitrate < SKIP_BELOW_BITRATE)) {
    return file;
  }

  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    onProgress?.({ phase: 'loading', ratio: 0 });
    // Load the single-thread core from CDN as blob URLs (same-origin worker load,
    // no CSP/SAB changes). Browser-cached after the first time on the device.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    if (signal?.aborted) {
      ffmpeg.terminate();
      return file;
    }

    ffmpeg.on('progress', ({ progress }) => {
      // ffmpeg reports 0..1 (occasionally >1 near the end) — clamp it.
      onProgress?.({ phase: 'optimizing', ratio: Math.max(0, Math.min(1, progress)) });
    });

    const inName = 'in.mp4';
    const outName = 'out.mp4';
    await ffmpeg.writeFile(inName, await fetchFile(file));

    // Downscale to fit within 1080p (keep aspect), force even dimensions (H.264),
    // re-encode H.264/AAC, faststart so it plays progressively.
    const code = await ffmpeg.exec([
      '-i', inName,
      '-vf',
      `scale='min(${TARGET_LONG_EDGE * 2},iw)':'min(${TARGET_LONG_EDGE},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-preset', PRESET,
      '-crf', CRF,
      '-c:a', 'aac',
      '-b:a', AUDIO_BITRATE,
      '-movflags', '+faststart',
      outName,
    ]);
    if (code !== 0 || signal?.aborted) {
      ffmpeg.terminate();
      return file;
    }

    const out = await ffmpeg.readFile(outName);
    ffmpeg.terminate();
    // out is a Uint8Array (binary read). Guard the type + that it actually shrank.
    if (typeof out === 'string') return file;
    const bytes = out as Uint8Array;
    if (bytes.byteLength === 0 || bytes.byteLength >= file.size) return file;

    // Copy into a fresh ArrayBuffer for the File part — the ffmpeg buffer view is
    // typed over ArrayBufferLike (TS won't accept it as a BlobPart directly).
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';
    return new File([ab], `${baseName}.mp4`, { type: 'video/mp4' });
  } catch {
    // Unsupported / core load failed / decode error / OOM — upload the original.
    return file;
  }
}
