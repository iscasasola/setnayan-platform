// ============================================================================
// In-browser boomerang encoder (iteration 0046 — couple "living hero")
// ============================================================================
//
// Bakes a couple's chosen ≤5-second moment into a seamless forward→reverse
// boomerang MP4, entirely on the device — no server-side video pipeline (by
// design: even the homepage hero-video uploader processes video in the browser
// because Vercel can't run ffmpeg). Uses WebCodecs (VideoEncoder/VideoFrame) +
// a tiny MP4 muxer; no ffmpeg.wasm, no SharedArrayBuffer, no CSP changes.
//
// Output: a 10s clip = the trimmed window forward then the same frames reversed
// (the duplicate turnaround frames trimmed), so native <video loop> alone gives
// a continuous back-and-forth — the same model as the pre-baked sample clips.
//
// PHOTO-FIRST: every bake also returns the chosen freeze frame as a JPEG. When
// the device can't encode (no WebCodecs — older Safari, etc.), callers catch
// `EncoderUnsupportedError` and fall back to that still alone (the couple's hero
// is then a photo). The still is also the video poster, the PDF/print frame, and
// the slow-network fallback — one pick, every static use.
// ============================================================================

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export class EncoderUnsupportedError extends Error {
  constructor(message = 'This device can’t make a living hero — using a photo instead.') {
    super(message);
    this.name = 'EncoderUnsupportedError';
  }
}

export type BakeResult = {
  /** The forward→reverse boomerang, video/mp4. */
  boomerang: Blob;
  /** The chosen freeze frame, image/jpeg — poster + print + fallback. */
  still: Blob;
  width: number;
  height: number;
  /** Output clip duration in seconds (~2× the trimmed window). */
  durationSec: number;
};

export type BakeOptions = {
  file: File | Blob;
  /** Trim window start, in seconds into the source. */
  startSec: number;
  /** Window length, clamped to ≤ 5s (the locked clip cap). */
  durationSec: number;
  /** Absolute time in the source to grab the freeze still. */
  freezeSec: number;
  /** Output frames per second (default 24). */
  fps?: number;
  /** Longest output edge in px (default 1280 — h.264 level 4.0 safe). */
  maxEdge?: number;
  /** 0..1 progress callback. */
  onProgress?: (p: number) => void;
};

export const MAX_CLIP_SECONDS = 5;

/** True when this browser can bake a boomerang at all. */
export function boomerangSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder === 'function' &&
    typeof (window as unknown as { VideoFrame?: unknown }).VideoFrame === 'function' &&
    typeof document !== 'undefined'
  );
}

const CODEC = 'avc1.42E028'; // constrained baseline, level 4.0 — broad playback support

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('Could not read that video file.'));
  });
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    const dur = Number.isFinite(video.duration) ? video.duration : t + 1;
    video.currentTime = Math.max(0, Math.min(t, dur - 0.001));
  });
}

/**
 * Capture a single freeze frame from a video at `timeSec` as a JPEG — the
 * photo-only path (slow network / device can't encode). Uses only the native
 * <video>+canvas pipeline, so it works everywhere the file is readable.
 */
export async function captureFreezeFrame(
  file: File | Blob,
  timeSec: number,
  maxEdge = 1600,
): Promise<{ still: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  let video: HTMLVideoElement | null = null;
  try {
    video = await loadVideo(url);
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.min(1, maxEdge / Math.max(vw, vh));
    const w = Math.max(2, Math.round(vw * scale));
    const h = Math.max(2, Math.round(vh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not read that video file.');
    await seekTo(video, timeSec);
    ctx.drawImage(video, 0, 0, w, h);
    const still = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not capture the still.'))),
        'image/jpeg',
        0.86,
      ),
    );
    return { still, width: w, height: h };
  } finally {
    if (video) video.src = '';
    URL.revokeObjectURL(url);
  }
}

/**
 * Bake the boomerang + still. Throws {@link EncoderUnsupportedError} when the
 * device lacks WebCodecs (callers fall back to a photo-only hero) and a plain
 * Error for a genuinely unreadable/oversized file.
 */
export async function bakeBoomerang(opts: BakeOptions): Promise<BakeResult> {
  if (!boomerangSupported()) throw new EncoderUnsupportedError();

  const fps = opts.fps ?? 24;
  const maxEdge = opts.maxEdge ?? 1280;
  const windowSec = Math.min(Math.max(opts.durationSec, 0.5), MAX_CLIP_SECONDS);

  const url = URL.createObjectURL(opts.file);
  let video: HTMLVideoElement | null = null;
  const bitmaps: ImageBitmap[] = [];
  try {
    video = await loadVideo(url);

    // Even dimensions (h.264), capped to maxEdge.
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.min(1, maxEdge / Math.max(vw, vh));
    const w = Math.max(2, Math.round((vw * scale) / 2) * 2);
    const h = Math.max(2, Math.round((vh * scale) / 2) * 2);

    const cfg: VideoEncoderConfig = {
      codec: CODEC,
      width: w,
      height: h,
      // ~1.5 Mbps — a hero showpiece that stays light (≈2 MB for the 10s loop).
      bitrate: 1_500_000,
      framerate: fps,
      latencyMode: 'quality',
    };
    const support = await VideoEncoder.isConfigSupported(cfg);
    if (!support.supported) throw new EncoderUnsupportedError();

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new EncoderUnsupportedError();

    // 1 · Extract the forward frames once (reused for the reverse leg).
    const frameCount = Math.max(2, Math.round(windowSec * fps));
    for (let i = 0; i < frameCount; i++) {
      const t = opts.startSec + (i / (frameCount - 1)) * windowSec;
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, w, h);
      bitmaps.push(await createImageBitmap(canvas));
      opts.onProgress?.((i / frameCount) * 0.5);
    }

    // 2 · The freeze still (poster + print + fallback).
    await seekTo(video, opts.freezeSec);
    ctx.drawImage(video, 0, 0, w, h);
    const still = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not capture the still.'))),
        'image/jpeg',
        0.86,
      ),
    );

    // 3 · Encode forward then reverse (drop the duplicate turnaround frames so
    //     the loop reads as one continuous back-and-forth).
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: w, height: h },
      fastStart: 'in-memory',
    });
    let encodeError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        encodeError = e;
      },
    });
    encoder.configure(cfg);

    const usPerFrame = 1_000_000 / fps;
    let ts = 0;
    let encoded = 0;
    const totalEncodes = frameCount + Math.max(0, frameCount - 2);
    const encodeFrame = (bmp: ImageBitmap, keyFrame: boolean) => {
      ctx.drawImage(bmp, 0, 0, w, h);
      const frame = new VideoFrame(canvas, { timestamp: ts });
      encoder.encode(frame, { keyFrame });
      frame.close();
      ts += usPerFrame;
      encoded += 1;
      opts.onProgress?.(0.5 + (encoded / totalEncodes) * 0.45);
    };

    for (let i = 0; i < frameCount; i++) encodeFrame(bitmaps[i]!, i === 0);
    for (let i = frameCount - 2; i >= 1; i--) encodeFrame(bitmaps[i]!, false);

    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    encoder.close();

    const { buffer } = muxer.target as ArrayBufferTarget;
    opts.onProgress?.(1);
    return {
      boomerang: new Blob([buffer], { type: 'video/mp4' }),
      still,
      width: w,
      height: h,
      durationSec: (ts / 1_000_000),
    };
  } finally {
    bitmaps.forEach((b) => b.close());
    if (video) video.src = '';
    URL.revokeObjectURL(url);
  }
}
