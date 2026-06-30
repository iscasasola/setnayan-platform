/**
 * Client-side video compression for couple uploads (Save-the-Date film clip).
 *
 * Phone exports are often huge (cale-ice's was 45s / 135 MB / ~25 Mbps) — far too
 * heavy to stream, so the clip stalls and re-buffers on playback. There is NO
 * server-side video processing in the stack (Vercel can't run ffmpeg; everything
 * video is done in the browser — see reel-render / boomerang-encoder). So we
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

// QUALITY-FIRST (owner 2026-06-22 "keep full resolution, ~60–90 MB"): preserve the
// couple's ORIGINAL resolution up to 4K (no downscale for ≤4K, both orientations),
// H.264 high/yuv420p + AAC, faststart. CRF 21 is visually transparent (the encode
// is indistinguishable from the source on any screen); a MAXRATE cap keeps even a
// 4K clip from spiking past a streamable bitrate. This only trims the source's
// WASTEFUL over-bitrate (e.g. a 25 Mbps phone export → ~half) — it does NOT reduce
// resolution, so "high res" is preserved on large/4K screens. (The aggressive
// 1080p/CRF-27 variant the owner rejected lives in git history.)
const LONG_EDGE_CAP = 3840; // 4K long edge — keep original resolution up to here
const CRF = '21'; // visually transparent
const MAXRATE = '16M'; // cap spikes so even 4K stays streamable
const BUFSIZE = '32M';
const PRESET = 'veryfast'; // ffmpeg.wasm is single-thread; veryfast keeps it tolerable
const AUDIO_BITRATE = '192k'; // high-quality audio to match the quality-first target

// Don't re-encode clips already light + efficient enough to stream well — it only
// wastes the couple's time/battery and can't improve an already-good source.
const SKIP_BELOW_BYTES = 12 * 1024 * 1024; // 12 MB
const SKIP_BELOW_BITRATE = 8_000_000; // 8 Mbps — already a streamable, high-quality rate

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

    // Keep the ORIGINAL resolution up to a 4K long edge (only downscale a >4K
    // source; preserves ≤4K in BOTH orientations — min(cap,iw)+min(cap,ih)+decrease
    // caps the longer side), force even dimensions (H.264). Re-encode H.264/AAC at a
    // visually-transparent CRF with a maxrate cap, faststart for progressive play.
    const code = await ffmpeg.exec([
      '-i', inName,
      '-vf',
      `scale='min(${LONG_EDGE_CAP},iw)':'min(${LONG_EDGE_CAP},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-preset', PRESET,
      '-crf', CRF,
      '-maxrate', MAXRATE,
      '-bufsize', BUFSIZE,
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
