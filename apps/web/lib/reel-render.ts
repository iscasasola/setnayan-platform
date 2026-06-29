// Shared client-side reel render engine.
//
// (Formerly lib/patiktok-render.ts. Patiktok was retired 2026-06-29; this
// generic 9:16 reel encoder is kept because Guest Stories — the free,
// photo-driven personal-reel tier — renders through it. No remaining Patiktok
// caller; renamed to drop the retired product's name.)
//
// Render host (owner-locked 2026-06-18): CLIENT-SIDE, ₱0 server compute. The
// couple browser stitches the captured clips/photos into a 9:16 MP4 and uploads
// the finished file to R2. There is NO server ffmpeg/Remotion.
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
import type { BeatGrid } from './stories-templates';
import {
  cameraAt,
  beatPunchAtDownbeats,
  resolveFocus,
  type CameraMove,
  type Transform,
  type Focus,
} from './stories-camera-move';

/**
 * One render source. Historically every source was a booth CLIP (a short
 * <video>); Guest Stories (the free, photo-driven tier) adds still PHOTOS,
 * which paint a frozen <img> for the slot's whole span instead of seeking a
 * video. `kind` defaults to `'clip'` so every existing caller (the Patiktok
 * booth) keeps working untouched.
 */
export type RenderClip = {
  clipId: string;
  url: string;
  durationSec: number | null;
  /** 'clip' = moving <video> (default), 'photo' = still <img>. */
  kind?: 'clip' | 'photo';
  /**
   * Optional virtual camera move for a PHOTO (§16.9) — a deterministic
   * push-in / pan / roll / orbit-feel applied across the slot so the still
   * reads as filmed. Ignored for clips (they already move). ₱0 per render.
   */
  cameraMove?: CameraMove;
  /**
   * Tier 2 — normalized subject center (0–1) from a detector at ingest, if
   * available. When `cameraMove.auto_reframe` is on, the zoom converges here so
   * the subject stays framed. Null/absent → a portrait-biased default.
   */
  subjectCenter?: Focus | null;
  /**
   * Tier 3 — URL of a grayscale DEPTH MAP for this photo (white = near, black =
   * far), produced once at ingest. When present, the render does a 2-layer
   * 2.5D parallax (near layer moves more than far) for the "orbit" depth. Absent
   * → a flat rigid move. Generating the map is the owner-infra model step.
   */
  depthUrl?: string | null;
};

export type RenderTemplate = {
  slug: string;
  name: string;
  palette: readonly [string, string, string, string];
  /**
   * Footer wordmark baked into the bottom scrim. Defaults to the plain
   * 'Setnayan' mark; Guest Stories passes its own ('Stories · Setnayan').
   */
  footerLabel?: string;
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
  /**
   * The chosen music track's beat grid (the `beat_grid` JSONB on
   * `reel_music_tracks`). When present, cut points snap to the music's
   * beats so the montage hits the rhythm; when NULL/absent the renderer falls
   * back to the legacy EVEN split — behavior never regresses for a track that
   * hasn't been analyzed yet.
   */
  beatGrid?: BeatGrid | null;
  /**
   * Beats between cuts — 1 = cut on every beat (frenetic), 2 = every other,
   * 4 = roughly once per bar (calm). Mirrors a Stories template's
   * `beatsPerCut`. Only consulted when `beatGrid` is present. Defaults to 1.
   */
  beatsPerCut?: number;
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
export async function renderReel(
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

/** Load a still photo for a Guest Stories slot (cross-origin, CORS-safe). */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Could not load a tagged photo (check R2 CORS).'));
    img.src = url;
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
export function splitFrames(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const rem = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Hard cap on any single CLIP slot, in seconds (CLAUDE.md hard constraint). */
const CLIP_SLOT_MAX_SEC = 5;

/**
 * Per-source duration schedule (SECONDS), beat-aware.
 *
 * Walks the track's beat onsets with a `beatsPerCut` stride and assigns one
 * source per cut, so each source's on-screen span is a run of beats — cuts land
 * on the rhythm. A clip source is hard-capped at {@link CLIP_SLOT_MAX_SEC}; a
 * photo can hold a longer beat gap (a still doesn't run out of footage). The
 * returned spans always sum to `totalSec` (the last span absorbs any remainder)
 * so the reel is exactly the requested length.
 *
 * Falls back to an EVEN split (every source gets `totalSec / n`, clips still
 * capped) when there's no usable beat grid — so a NULL `beat_grid` reproduces
 * the legacy behavior exactly.
 *
 * Pure + exported so the scheduler is unit-testable in Node (no DOM/canvas).
 *
 * @param totalSec  Target reel length, seconds.
 * @param kinds     Per-source media kind, in order ('clip' | 'photo').
 * @param opts      `beatGrid` (nullable) + `beatsPerCut` (default 1).
 */
export function buildBeatSchedule(
  totalSec: number,
  kinds: ReadonlyArray<'clip' | 'photo'>,
  opts: { beatGrid?: BeatGrid | null; beatsPerCut?: number } = {},
): number[] {
  const n = kinds.length;
  if (n === 0 || totalSec <= 0) return [];

  const cap = (kind: 'clip' | 'photo', span: number) =>
    kind === 'clip' ? Math.min(span, CLIP_SLOT_MAX_SEC) : span;

  const evenFallback = (): number[] => {
    const each = totalSec / n;
    const out = kinds.map((k) => cap(k, each));
    // Make the spans cover exactly [0, totalSec]: stretch the LAST span to
    // absorb the rounding/cap remainder (a photo can grow; a capped clip can't,
    // so a residual tail just means the previous frame holds — acceptable).
    return normalizeToTotal(out, totalSec, kinds);
  };

  const grid = opts.beatGrid;
  const beats = grid?.beats;
  if (!beats || beats.length < 2) return evenFallback();

  const stride = Math.max(1, Math.round(opts.beatsPerCut ?? 1));
  const sorted = [...beats].filter((b) => Number.isFinite(b) && b >= 0).sort((a, b) => a - b);
  if (sorted.length < 2) return evenFallback();

  // Re-base so the first usable beat is t=0 of the reel, then keep beats inside
  // the reel window.
  const t0 = sorted[0]!;
  const rel = sorted.map((b) => b - t0).filter((b) => b <= totalSec + 1e-6);
  if (rel.length < 2) return evenFallback();

  const spans: number[] = [];
  let cursor = 0;
  let beatIdx = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    if (isLast) {
      // Last source fills to the end so the reel is exactly totalSec.
      spans.push(cap(kinds[i]!, totalSec - cursor));
      break;
    }
    // Next cut = `stride` beats ahead of the current beat onset.
    const nextIdx = Math.min(beatIdx + stride, rel.length - 1);
    let cutAt = rel[nextIdx]!;
    // Guard against a stalled cursor (duplicate/degenerate beats): always move
    // forward by at least one beat's worth, else evenly.
    if (cutAt <= cursor + 1e-3) cutAt = cursor + totalSec / n;
    cutAt = Math.min(cutAt, totalSec);
    spans.push(cap(kinds[i]!, cutAt - cursor));
    cursor = cutAt;
    beatIdx = nextIdx;
    if (cursor >= totalSec - 1e-3) {
      // Beats ran out before all sources placed — even-split the rest.
      const remaining = n - spans.length;
      if (remaining > 0) {
        const tail = Math.max(0, totalSec - cursor);
        const each = remaining > 0 ? tail / remaining : 0;
        for (let j = i + 1; j < n; j++) spans.push(cap(kinds[j]!, each));
      }
      break;
    }
  }
  return normalizeToTotal(spans, totalSec, kinds);
}

/**
 * Stretch/scale a span list so it sums to `totalSec`, WITHOUT ever pushing a
 * clip span past the {@link CLIP_SLOT_MAX_SEC} hard cap.
 *
 * Positive residual is poured first onto PHOTO spans (uncapped — a still holds
 * for any length), then onto clip spans only up to their 5s cap. If no
 * uncapped headroom remains, the residual is intentionally left UNFILLED: the
 * 5-second clip cap is a hard product constraint that outranks hitting the
 * exact target duration, so an all-clips reel with too little footage just ends
 * a touch short rather than violating the cap. Negative residual (cap math
 * overshot) trims the longest span. Keeps every span ≥ 0.
 */
function normalizeToTotal(
  spans: number[],
  totalSec: number,
  kinds: ReadonlyArray<'clip' | 'photo'>,
): number[] {
  const out = spans.map((s) => Math.max(0, s));
  const sum = out.reduce((a, b) => a + b, 0);
  let residual = totalSec - sum;
  if (Math.abs(residual) < 1e-3) return out;

  if (residual > 0) {
    // Pass 1 — photo spans absorb residual freely (uncapped).
    for (let i = 0; i < out.length && residual > 1e-6; i++) {
      if (kinds[i] === 'photo') {
        out[i] = (out[i] ?? 0) + residual;
        residual = 0;
        break;
      }
    }
    // Pass 2 — clip spans take residual only up to the 5s cap.
    for (let i = 0; i < out.length && residual > 1e-6; i++) {
      if (kinds[i] === 'clip') {
        const headroom = Math.max(0, CLIP_SLOT_MAX_SEC - (out[i] ?? 0));
        const give = Math.min(headroom, residual);
        out[i] = (out[i] ?? 0) + give;
        residual -= give;
      }
    }
    // Any remaining residual is dropped — the 5s cap wins over exact duration.
  } else {
    // Over-allocated (cap math overshot) — trim the longest span down.
    let longest = 0;
    for (let i = 1; i < out.length; i++) if ((out[i] ?? 0) > (out[longest] ?? 0)) longest = i;
    out[longest] = Math.max(0, (out[longest] ?? 0) + residual);
  }
  return out;
}

/**
 * Convert a per-source SECONDS schedule into a per-source UNIT count (frames or
 * milliseconds), preserving the exact `totalUnits` (remainder rides the largest
 * spans). Used by both render paths so the beat schedule maps cleanly onto the
 * frame loop (WebCodecs) or the wall-clock loop (MediaRecorder).
 */
export function spansToUnits(spans: number[], totalUnits: number): number[] {
  const total = spans.reduce((a, b) => a + b, 0);
  if (total <= 0 || spans.length === 0) return splitFrames(totalUnits, Math.max(1, spans.length));
  const raw = spans.map((s) => (s / total) * totalUnits);
  const floored = raw.map((r) => Math.floor(r));
  let used = floored.reduce((a, b) => a + b, 0);
  let leftover = totalUnits - used;
  // Hand the leftover units to the sources with the largest fractional parts.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (leftover <= 0) break;
    floored[i] = (floored[i] ?? 0) + 1;
    leftover--;
  }
  return floored;
}

// The camera-move engine's translate units are tuned against a 360×640 frame
// (the §16.9 preview viewBox); scale them to the real output dimensions.
const MOVE_TX_BASE = 360;
const MOVE_TY_BASE = 640;

/**
 * Auto-reframe focal, CLAMPED to the band the overscan can actually cover for
 * THIS move (audit #3 — "off-center focal breaks no-edge-reveal").
 *
 * Geometry: `withCamera` scales the cover image by `move.scale` about the focal,
 * then pans by `move.tx/ty`. The overscan headroom on a side is (distance of the
 * focal from that edge) × (scale − 1). A pan of `tN = tx/MOVE_TX_BASE` (fraction
 * of width) is covered only if the focal sits ≥ `tN/(scale−1)` in from each edge.
 * At the centered focal the headroom exactly equals the max pan (why the audit
 * measured ~87px reveal at the extreme); an off-center `subjectCenter` near an
 * edge pulls the image edge inside the frame → dark backdrop strip.
 *
 * We sample this move's own envelope (so push/pull — no pan — keep FULL reframe,
 * and pans tighten exactly as much as their amplitude needs) and clamp the focal
 * into `[m, 1−m]` per axis. Conservative: ignores the beat-punch zoom (only adds
 * headroom) — but does NOT account for the Tier-3 near-layer 1.6× pan
 * amplification (depth is dormant; revisit when parallax ships).
 *
 * Tradeoff for Vids AI: stronger reframe on big pans needs more `BASE_OVERSCAN`,
 * not a looser clamp — that's an aesthetic call. This only prevents the bug.
 */
function safeFocal(move: CameraMove | undefined, subjectCenter?: Focus | null): Focus {
  const focal = resolveFocus(move, subjectCenter);
  if (!move) return focal;
  let maxTxN = 0;
  let maxTyN = 0;
  let minScale = Infinity;
  for (let p = 0; p <= 1.0001; p += 0.1) {
    const t = cameraAt(move, p);
    maxTxN = Math.max(maxTxN, Math.abs(t.tx) / MOVE_TX_BASE);
    maxTyN = Math.max(maxTyN, Math.abs(t.ty) / MOVE_TY_BASE);
    minScale = Math.min(minScale, t.scale);
  }
  const z = Math.max(1e-3, minScale - 1);
  const mx = Math.min(0.5, maxTxN / z);
  const my = Math.min(0.5, maxTyN / z);
  return {
    x: Math.min(1 - mx, Math.max(mx, focal.x)),
    y: Math.min(1 - my, Math.max(my, focal.y)),
  };
}

/** Apply a camera transform about a focal point, then run `paint`. */
function withCamera(
  ctx: CanvasRenderingContext2D,
  move: Transform | undefined,
  focal: Focus,
  paint: () => void,
) {
  if (!move) {
    paint();
    return;
  }
  const fx = focal.x * OUT_W;
  const fy = focal.y * OUT_H;
  const txPx = (move.tx / MOVE_TX_BASE) * OUT_W;
  const tyPx = (move.ty / MOVE_TY_BASE) * OUT_H;
  ctx.save();
  ctx.translate(fx + txPx, fy + tyPx);
  ctx.rotate((move.rot * Math.PI) / 180);
  ctx.scale(move.scale, move.scale);
  ctx.translate(-fx, -fy);
  paint();
  ctx.restore();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement,
  template: RenderTemplate,
  move?: Transform,
  focal: Focus = { x: 0.5, y: 0.5 },
  nearLayer?: HTMLCanvasElement | null,
) {
  const [, , , dark] = template.palette;
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, OUT_W, OUT_H);
  const vw =
    source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const vh =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!vw || !vh) return;
  const scale = Math.max(OUT_W / vw, OUT_H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  // FAR layer: the full photo. The engine's overscan (scale ≥ 1.16) plus the
  // focal-point convergence keep pan/roll/zoom inside the frame.
  withCamera(ctx, move, focal, () => {
    ctx.drawImage(source, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
  });
  // NEAR layer (Tier 3): the depth-masked foreground, moved MORE than the far
  // layer so foreground separates from background → 2.5D "orbit" depth.
  if (nearLayer && move) {
    const amp: Transform = {
      scale: 1 + (move.scale - 1) * 1.6,
      tx: move.tx * 1.6,
      ty: move.ty * 1.6,
      rot: move.rot,
    };
    withCamera(ctx, amp, focal, () => {
      ctx.drawImage(nearLayer, 0, 0);
    });
  }
}

/**
 * Tier 3 — build the depth-masked NEAR layer once per photo: the cover-fit photo
 * with per-pixel alpha taken from the depth map's luminance (white = near =
 * opaque, black = far = transparent). Returns an OUT-sized canvas the render
 * draws (shifted more than the far layer) for parallax. One O(pixels) pass at
 * photo load — never per frame.
 */
function buildNearLayer(
  image: HTMLImageElement,
  depth: HTMLImageElement,
): HTMLCanvasElement | null {
  const vw = image.naturalWidth;
  const vh = image.naturalHeight;
  if (!vw || !vh) return null;
  const cnv = document.createElement('canvas');
  cnv.width = OUT_W;
  cnv.height = OUT_H;
  const c = cnv.getContext('2d');
  if (!c) return null;
  const scale = Math.max(OUT_W / vw, OUT_H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  c.drawImage(image, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
  // Depth, cover-fit to the same frame.
  const dcnv = document.createElement('canvas');
  dcnv.width = OUT_W;
  dcnv.height = OUT_H;
  const dc = dcnv.getContext('2d');
  if (!dc) return null;
  const dscale = Math.max(OUT_W / depth.naturalWidth, OUT_H / depth.naturalHeight);
  const ddw = depth.naturalWidth * dscale;
  const ddh = depth.naturalHeight * dscale;
  dc.drawImage(depth, (OUT_W - ddw) / 2, (OUT_H - ddh) / 2, ddw, ddh);
  const img = c.getImageData(0, 0, OUT_W, OUT_H);
  const dep = dc.getImageData(0, 0, OUT_W, OUT_H).data;
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    // Rec.601 luminance of the depth map → alpha of the photo pixel.
    const lum = 0.299 * dep[i]! + 0.587 * dep[i + 1]! + 0.114 * dep[i + 2]!;
    px[i + 3] = lum;
  }
  c.putImageData(img, 0, 0);
  return cnv;
}

/**
 * Load + build the depth near-layer for a photo when it has a `depthUrl` and
 * parallax is requested. Returns null (flat move) when there's no depth map or
 * the depth image can't be read (e.g. CORS-tainted) — never throws.
 */
async function maybeBuildNearLayer(
  image: HTMLImageElement,
  source: RenderClip,
): Promise<HTMLCanvasElement | null> {
  const parallax = source.cameraMove?.parallax;
  if (!source.depthUrl || !parallax || parallax === 'none') return null;
  try {
    const depth = await loadImage(source.depthUrl);
    const layer = buildNearLayer(image, depth);
    depth.removeAttribute('src');
    return layer;
  } catch {
    return null;
  }
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
  ctx.fillText(template.footerLabel ?? 'Setnayan', OUT_W / 2, OUT_H - 56, OUT_W - 120);
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
// substantial encoder/muxer change. Until then, `renderReel` steers any
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
  const kinds = clips.map((c) => c.kind ?? 'clip');
  // Beat-aware frame budget when a grid is present; even split otherwise.
  const spans = buildBeatSchedule(durationSec, kinds, {
    beatGrid: opts.beatGrid,
    beatsPerCut: opts.beatsPerCut,
  });
  const perClip = spansToUnits(spans, totalFrames);
  const frameDurUs = Math.round(1_000_000 / FPS);
  const downbeats = opts.beatGrid?.downbeats ?? [];
  let frameIdx = 0;

  try {
    for (let ci = 0; ci < clips.length; ci++) {
      if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      const n = perClip[ci] ?? 0;
      if (n === 0) continue;
      const source = clips[ci]!;
      if ((source.kind ?? 'clip') === 'photo') {
        // PHOTO slot — paint the still once per frame across its span (no seek).
        const img = await loadImage(source.url);
        const nearLayer = await maybeBuildNearLayer(img, source);
        const focal = safeFocal(source.cameraMove, source.subjectCenter);
        try {
          for (let f = 0; f < n; f++) {
            if (encoderError) throw encoderError;
            if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
            const p = n <= 1 ? 0 : f / (n - 1);
            const move = source.cameraMove ? cameraAt(source.cameraMove, p) : undefined;
            if (move) move.scale *= beatPunchAtDownbeats(frameIdx / FPS, downbeats);
            drawCover(ctx, img, template, move, focal, nearLayer);
            drawOverlay(ctx, template);
            const frame = new VideoFrame(canvas, {
              timestamp: frameIdx * frameDurUs,
              duration: frameDurUs,
            });
            encoder.encode(frame, { keyFrame: frameIdx % (FPS * 2) === 0 });
            frame.close();
            frameIdx++;
            if (frameIdx % 4 === 0) onProgress?.(Math.min(0.97, frameIdx / totalFrames));
            if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
          }
        } finally {
          img.removeAttribute('src');
        }
        continue;
      }
      const video = await loadVideo(source.url);
      try {
        const span = effectiveDuration(video, source.durationSec);
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
  const kinds = clips.map((c) => c.kind ?? 'clip');
  // Beat-aware wall-clock budget when a grid is present; even split otherwise.
  const spans = buildBeatSchedule(durationSec, kinds, {
    beatGrid: opts.beatGrid,
    beatsPerCut: opts.beatsPerCut,
  });
  const perClipMs = spansToUnits(spans, Math.round(totalMs));
  const downbeats = opts.beatGrid?.downbeats ?? [];
  const startedAt = performance.now();

  try {
    for (let ci = 0; ci < clips.length; ci++) {
      if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      const ms = perClipMs[ci] ?? 0;
      if (ms === 0) continue;
      const source = clips[ci]!;
      if ((source.kind ?? 'clip') === 'photo') {
        // PHOTO slot — hold the still on the canvas for the slot's span.
        const img = await loadImage(source.url);
        const nearLayer = await maybeBuildNearLayer(img, source);
        const focal = safeFocal(source.cameraMove, source.subjectCenter);
        try {
          await new Promise<void>((resolve) => {
            const slotStart = performance.now();
            const tick = () => {
              const elapsed = performance.now() - slotStart;
              const p = ms <= 0 ? 0 : Math.min(1, elapsed / ms);
              const move = source.cameraMove ? cameraAt(source.cameraMove, p) : undefined;
              if (move) {
                move.scale *= beatPunchAtDownbeats(
                  (performance.now() - startedAt) / 1000,
                  downbeats,
                );
              }
              drawCover(ctx, img, template, move, focal, nearLayer);
              drawOverlay(ctx, template);
              if (elapsed % 200 < 20) {
                onProgress?.(Math.min(0.97, (performance.now() - startedAt) / totalMs));
              }
              if (elapsed >= ms || signal?.aborted) {
                resolve();
                return;
              }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        } finally {
          img.removeAttribute('src');
        }
        continue;
      }
      const video = await loadVideo(source.url);
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
