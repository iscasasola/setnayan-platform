// Iteration 0017 PR3 — Patiktok client-side reel render engine.
//
// Render host (owner-locked 2026-06-18): CLIENT-SIDE, ₱0 server compute. The
// booth tablet / couple browser stitches the captured clips into a 9:16 MP4
// and uploads the finished file to R2. There is NO server ffmpeg/Remotion.
//
// Two paths:
//   • PRIMARY — WebCodecs `VideoEncoder` feeding `mp4-muxer` (clean H.264 MP4,
//     deterministic, faster-than-realtime). Used when WebCodecs is available
//     AND a hardware/software AVC config is supported.
//   • FALLBACK — `MediaRecorder` over `canvas.captureStream()` (real-time;
//     webm on most browsers). Used when WebCodecs/AVC isn't available.
//
// Both composite each source clip cover-fit onto a 1080×1920 canvas with a
// light template overlay. Music is an optional seam: when a `musicUrl` is
// present (the couple's Pakanta song, selected in #2057) the renderer mixes it
// into the output so the reel plays audio. Audio mixing only works on the
// MediaRecorder path (it muxes an audio MediaStreamTrack alongside the canvas
// video track into one webm/opus blob), so the entry point PREFERS that path
// whenever a track URL is present. The WebCodecs path stays video-only for now
// (adding an AudioEncoder + audio track to mp4-muxer is a follow-up — see the
// note on renderWithWebCodecs). When `musicUrl` is null, both paths behave
// exactly as before and the reel renders silent.
//
// CORS: the music is a presigned R2 URL fetched cross-origin. It's loaded with
// `crossOrigin='anonymous'` (and the AudioContext decode goes through a CORS
// fetch) so the captured MediaStream stays untainted. If the music fails to
// fetch/decode (CORS or load error), we FALL BACK to a silent render — a reel
// is never failed over its backing track.
//
// IMPORTANT: decoding the clip <video> onto the canvas requires R2 to send
// CORS headers (the clips are fetched cross-origin via presigned URLs). Without
// CORS the canvas taints and VideoFrame()/encode throws SecurityError. R2 CORS
// is the owner action gating this end to end — same gate as PR2's upload.

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export type RenderClip = {
  clipId: string;
  url: string;
  durationSec: number | null;
};

export type RenderTemplate = {
  slug: string;
  name: string;
  palette: readonly [string, string, string, string];
};

export type RenderResult = {
  blob: Blob;
  mimeType: 'video/mp4' | 'video/webm';
  width: number;
  height: number;
  durationSec: number;
  renderMode: 'client_webcodecs' | 'client_mediarecorder';
};

export type RenderOptions = {
  clips: RenderClip[];
  template: RenderTemplate;
  durationSec: number;
  musicUrl?: string | null;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

const OUT_W = 1080;
const OUT_H = 1920;
const FPS = 30;
const BITRATE = 6_000_000;

export function supportsWebCodecs(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder !==
      'undefined' &&
    typeof (window as unknown as { VideoFrame?: unknown }).VideoFrame !==
      'undefined'
  );
}

/**
 * Should the renderer take the MediaRecorder path for these options?
 *
 * Audio mixing only works on the MediaRecorder path today, so a reel that has a
 * backing track (`musicUrl`) is steered there even when WebCodecs is available
 * — getting audio out matters more than the cleaner MP4. With no music, we keep
 * preferring the WebCodecs MP4 path. Pure + exported so it's unit-testable.
 */
export function shouldUseMediaRecorder(opts: {
  musicUrl?: string | null;
  webCodecsAvailable: boolean;
}): boolean {
  if (!opts.webCodecsAvailable) return true;
  // WebCodecs is available but it can't mux audio yet — fall back to
  // MediaRecorder so a reel with a song actually plays sound.
  return Boolean(opts.musicUrl);
}

/** Entry point. Picks the WebCodecs path when possible, else MediaRecorder. */
export async function renderPatiktokReel(
  opts: RenderOptions,
): Promise<RenderResult> {
  if (!opts.clips.length) {
    throw new Error('No clips to render.');
  }
  const webCodecsAvailable = supportsWebCodecs();
  if (
    webCodecsAvailable &&
    !shouldUseMediaRecorder({ musicUrl: opts.musicUrl, webCodecsAvailable })
  ) {
    const config = await pickAvcConfig();
    if (config) return renderWithWebCodecs(opts, config);
  }
  return renderWithMediaRecorder(opts);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  return { canvas, ctx };
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const onReady = () => {
      cleanup();
      resolve(video);
    };
    const onError = () =>
      reject(new Error('Could not load a booth clip (check R2 CORS).'));
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = url;
  });
}

function destroyVideo(video: HTMLVideoElement) {
  try {
    video.pause();
    video.removeAttribute('src');
    video.load();
  } catch {
    /* best-effort */
  }
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const target = Math.max(0, t);
    if (Math.abs(video.currentTime - target) < 1e-3) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done, { once: true });
    // Safety net: some codecs don't fire 'seeked' on tiny deltas.
    setTimeout(done, 400);
    video.currentTime = target;
  });
}

function effectiveDuration(video: HTMLVideoElement, fallbackSec: number | null): number {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  if (fallbackSec && fallbackSec > 0) return fallbackSec;
  return 2;
}

/** Even frame split across clips; remainder goes to the earlier clips. */
function splitFrames(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rem = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  template: RenderTemplate,
) {
  const [, , , dark] = template.palette;
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, OUT_W, OUT_H);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(OUT_W / vw, OUT_H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
}

function drawOverlay(ctx: CanvasRenderingContext2D, template: RenderTemplate) {
  const [bg, a1, a2] = template.palette;
  // Top accent bar
  ctx.fillStyle = a1;
  ctx.fillRect(0, 0, OUT_W, 20);
  // Bottom scrim for legibility
  const grad = ctx.createLinearGradient(0, OUT_H - 280, 0, OUT_H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, OUT_H - 280, OUT_W, 280);
  // Template name
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 58px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText(template.name, OUT_W / 2, OUT_H - 132, OUT_W - 120);
  // Accent rule
  ctx.fillStyle = a2;
  ctx.fillRect(OUT_W / 2 - 84, OUT_H - 104, 168, 4);
  // Footer wordmark
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '500 30px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('Patiktok · Setnayan', OUT_W / 2, OUT_H - 56, OUT_W - 120);
  // Bottom palette ticks
  const tickW = OUT_W / 4;
  [bg, a1, a2].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * tickW, OUT_H - 8, tickW, 8);
  });
}

// ---------------------------------------------------------------------------
// WebCodecs path
// ---------------------------------------------------------------------------

type AvcConfig = { codec: string };

async function pickAvcConfig(): Promise<AvcConfig | null> {
  // High/Main/Baseline @ level 4.0–4.2 — all cover 1080×1920@30. Probe in
  // descending quality; the first the platform accepts wins.
  const codecs = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f'];
  for (const codec of codecs) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width: OUT_W,
        height: OUT_H,
        bitrate: BITRATE,
        framerate: FPS,
      });
      if (support.supported) return { codec };
    } catch {
      /* try next */
    }
  }
  return null;
}

// NOTE (audio follow-up): this path is VIDEO-ONLY. Mixing the backing track
// here would mean standing up a WebCodecs `AudioEncoder` (AAC/opus), decoding
// `musicUrl` to PCM, encoding it, and feeding `mp4-muxer`'s audio track — a
// substantial encoder/muxer change. Until then, `renderPatiktokReel` steers any
// reel that has a `musicUrl` to the MediaRecorder path (see
// `shouldUseMediaRecorder`), which DOES mux audio. So a reel with a song never
// silently loses it just because WebCodecs was available.
async function renderWithWebCodecs(
  opts: RenderOptions,
  avc: AvcConfig,
): Promise<RenderResult> {
  const { clips, template, durationSec, onProgress, signal } = opts;
  const { canvas, ctx } = makeCanvas();

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: OUT_W, height: OUT_H },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({
    codec: avc.codec,
    width: OUT_W,
    height: OUT_H,
    bitrate: BITRATE,
    framerate: FPS,
  });

  const totalFrames = Math.max(1, Math.round(durationSec * FPS));
  const perClip = splitFrames(totalFrames, clips.length);
  const frameDurUs = Math.round(1_000_000 / FPS);
  let frameIdx = 0;

  try {
    for (let ci = 0; ci < clips.length; ci++) {
      if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      const n = perClip[ci] ?? 0;
      if (n === 0) continue;
      const video = await loadVideo(clips[ci]!.url);
      try {
        const span = effectiveDuration(video, clips[ci]!.durationSec);
        for (let f = 0; f < n; f++) {
          if (encoderError) throw encoderError;
          if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
          const localT = n <= 1 ? 0 : (f / n) * Math.max(0.05, span - 0.001);
          await seekTo(video, localT);
          drawCover(ctx, video, template);
          drawOverlay(ctx, template);
          const frame = new VideoFrame(canvas, {
            timestamp: frameIdx * frameDurUs,
            duration: frameDurUs,
          });
          encoder.encode(frame, { keyFrame: frameIdx % (FPS * 2) === 0 });
          frame.close();
          frameIdx++;
          if (frameIdx % 4 === 0) {
            onProgress?.(Math.min(0.97, frameIdx / totalFrames));
          }
          // Backpressure so the encode queue doesn't balloon memory.
          if (encoder.encodeQueueSize > 8) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      } finally {
        destroyVideo(video);
      }
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();
    onProgress?.(1);
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    return {
      blob,
      mimeType: 'video/mp4',
      width: OUT_W,
      height: OUT_H,
      durationSec,
      renderMode: 'client_webcodecs',
    };
  } finally {
    try {
      if (encoder.state !== 'closed') encoder.close();
    } catch {
      /* already closed */
    }
  }
}

// ---------------------------------------------------------------------------
// MediaRecorder fallback (real-time)
// ---------------------------------------------------------------------------

// Codec preference lists for the MediaRecorder container. With audio we MUST
// pick a mime that carries an audio codec (opus), otherwise the muxed audio
// track is silently dropped; without audio we keep the original video-only
// ladder (mp4 first, where supported).
const RECORDER_MIME_WITH_AUDIO = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=opus',
  'video/webm',
] as const;
const RECORDER_MIME_VIDEO_ONLY = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

/**
 * Choose a MediaRecorder mimeType. Pure (takes the support predicate) so it's
 * unit-testable in Node where `MediaRecorder` doesn't exist. Returns the first
 * supported candidate, preferring audio-capable containers when `hasAudio`.
 */
export function selectRecorderMime(
  hasAudio: boolean,
  isTypeSupported: (mime: string) => boolean,
): string | undefined {
  const candidates = hasAudio
    ? RECORDER_MIME_WITH_AUDIO
    : RECORDER_MIME_VIDEO_ONLY;
  for (const c of candidates) {
    if (isTypeSupported(c)) return c;
  }
  return undefined;
}

function pickRecorderMime(hasAudio: boolean): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return selectRecorderMime(hasAudio, (m) => MediaRecorder.isTypeSupported(m));
}

// ---------------------------------------------------------------------------
// Audio mixing for the MediaRecorder path
// ---------------------------------------------------------------------------

type MixedAudio = {
  /** The audio MediaStreamTrack to add to the recorded stream. */
  track: MediaStreamTrack;
  /** Begin playback from the start. Called the moment recording starts. */
  start: () => void;
  /** Tear everything down (stop the track, close the context). */
  stop: () => void;
};

/**
 * Load `musicUrl` (a presigned R2 URL), decode it through an AudioContext, and
 * route it into a `MediaStreamAudioDestinationNode` so we get a real audio
 * MediaStreamTrack to mux alongside the canvas video.
 *
 * CORS-safe: the fetch is cross-origin and the decoded buffer never taints the
 * recorded stream. Returns `null` (NOT throwing) on any failure — a fetch/CORS
 * error, an unsupported AudioContext, or a decode error — so the caller renders
 * silent rather than failing the reel.
 */
async function prepareMusicTrack(
  musicUrl: string,
  signal?: AbortSignal,
): Promise<MixedAudio | null> {
  try {
    const Ctx =
      typeof window !== 'undefined'
        ? (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext)
        : undefined;
    if (!Ctx) return null;

    // `crossOrigin: 'anonymous'`-equivalent for fetch: a CORS request with no
    // credentials. Presigned R2 URLs must send Access-Control-Allow-Origin.
    const res = await fetch(musicUrl, { mode: 'cors', credentials: 'omit', signal });
    if (!res.ok) return null;
    const encoded = await res.arrayBuffer();

    const ctx = new Ctx();
    // Some browsers start the context suspended (autoplay policy); resume so
    // the destination node actually produces samples once playback starts.
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    const buffer = await ctx.decodeAudioData(encoded);
    const dest = ctx.createMediaStreamDestination();

    let source: AudioBufferSourceNode | null = null;
    let started = false;

    const start = () => {
      if (started) return;
      started = true;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      // Don't loop: the song may be longer than the reel; we just play from the
      // start and let `stop()` (bound to the render duration) cut it off.
      source.loop = false;
      source.connect(dest);
      try {
        source.start();
      } catch {
        /* already started / context closed */
      }
    };

    const track = dest.stream.getAudioTracks()[0] ?? null;
    if (!track) {
      await ctx.close().catch(() => {});
      return null;
    }

    const stop = () => {
      try {
        source?.stop();
      } catch {
        /* not started or already stopped */
      }
      try {
        track.stop();
      } catch {
        /* best-effort */
      }
      void ctx.close().catch(() => {});
    };

    return { track, start, stop };
  } catch {
    // CORS, load error, decode failure, or no AudioContext — render silent.
    return null;
  }
}

function normalizeOutMime(t: string): 'video/mp4' | 'video/webm' {
  return t.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
}

async function renderWithMediaRecorder(opts: RenderOptions): Promise<RenderResult> {
  const { clips, template, durationSec, onProgress, signal, musicUrl } = opts;
  const { canvas, ctx } = makeCanvas();

  // Prime the canvas so the first captured frame isn't transparent.
  ctx.fillStyle = template.palette[3];
  ctx.fillRect(0, 0, OUT_W, OUT_H);

  // Prepare the backing track (best-effort). On any failure this is null and we
  // render silent — a reel is never failed over its music.
  const audio = musicUrl ? await prepareMusicTrack(musicUrl, signal) : null;

  const stream = canvas.captureStream(FPS);
  if (audio) stream.addTrack(audio.track);

  // Only request an audio-capable container when we actually have an audio track
  // to mux — otherwise keep the original video-only mime ladder.
  const mime = pickRecorderMime(Boolean(audio));
  const recorder = mime
    ? new MediaRecorder(stream, { mimeType: mime })
    : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();
  // Start the song the instant recording begins so audio and video share a t0.
  audio?.start();
  const totalMs = Math.max(500, durationSec * 1000);
  const perClipMs = splitFrames(Math.round(totalMs), clips.length);
  const startedAt = performance.now();

  try {
    for (let ci = 0; ci < clips.length; ci++) {
      if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      const ms = perClipMs[ci] ?? 0;
      if (ms === 0) continue;
      const video = await loadVideo(clips[ci]!.url);
      video.muted = true;
      try {
        await video.play().catch(() => {});
        await new Promise<void>((resolve) => {
          const clipStart = performance.now();
          const tick = () => {
            drawCover(ctx, video, template);
            drawOverlay(ctx, template);
            const clipElapsed = performance.now() - clipStart;
            if (clipElapsed % 200 < 20) {
              onProgress?.(Math.min(0.97, (performance.now() - startedAt) / totalMs));
            }
            if (clipElapsed >= ms || signal?.aborted) {
              resolve();
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      } finally {
        destroyVideo(video);
      }
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    // Bound the song to the render: stop it when the reel ends (we never loop).
    audio?.stop();
    stream.getTracks().forEach((t) => t.stop());
  }

  onProgress?.(1);
  const type = recorder.mimeType || mime || 'video/webm';
  const outMime = normalizeOutMime(type);
  const blob = new Blob(chunks, { type: outMime });
  return {
    blob,
    mimeType: outMime,
    width: OUT_W,
    height: OUT_H,
    durationSec,
    renderMode: 'client_mediarecorder',
  };
}
