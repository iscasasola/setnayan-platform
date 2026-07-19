import { euclideanDistance, FACE_AUTO_MAX_DISTANCE } from '@/lib/face-match-core';

/**
 * Multi-FRAME face embedding for Papic clips (WS5 · owner 2026-07-11 "we want
 * multi tagging").
 *
 * The photo path runs `embedFaces` on ONE image → detects every FACE in that
 * frame. A 5-second clip, though, is a moving scene: a guest can walk into shot
 * at second 3 and never appear in the poster frame. Tagging only the poster
 * therefore misses people who are genuinely IN the clip. This module samples a
 * handful of frames across the clip, embeds each, and UNIONS the results so
 * everyone who appears ANYWHERE in the clip is tagged exactly once.
 *
 * The two selection/union steps are PURE (unit-tested); only `embedClipFaces`
 * touches the DOM (video decode + seek), and it is best-effort — any failure
 * returns [] and the caller no-ops, so it can never break capture.
 */

/**
 * PURE. Choose evenly-distributed interior sample times (seconds) for a clip of
 * `durationSec`. ~`fps` samples/second (default 1 → one per second), capped at
 * `maxFrames` (default 6 — a 5s clip needs no more), inset from both edges so we
 * never sample a black first/last frame. Always returns ≥1 time in [0, duration].
 */
export function pickClipSampleTimes(
  durationSec: number,
  opts: { fps?: number; maxFrames?: number; edgeInsetSec?: number } = {},
): number[] {
  const fps = opts.fps ?? 1;
  const maxFrames = Math.max(1, Math.floor(opts.maxFrames ?? 6));
  const edge = Math.max(0, opts.edgeInsetSec ?? 0.15);
  const dur = Number(durationSec);
  if (!Number.isFinite(dur) || dur <= 0) return [0];

  const count = Math.min(maxFrames, Math.max(1, Math.ceil(dur * fps)));
  const usable = dur - 2 * edge;
  if (usable <= 0 || count === 1) {
    // Too short to inset, or a single sample → grab the middle frame.
    return [Number((dur / 2).toFixed(3))];
  }
  const step = usable / count;
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    // Center-of-bucket sampling → well-spread interior frames.
    const t = edge + step * (i + 0.5);
    times.push(Number(Math.min(dur, Math.max(0, t)).toFixed(3)));
  }
  return times;
}

/**
 * PURE. Union face descriptors detected across frames. Greedy single-link
 * clustering by Euclidean distance (the same metric + 0.50 same-person boundary
 * the matcher uses): a person seen in several frames collapses to ONE
 * representative (running mean), and every distinct person who appears in ANY
 * frame is included exactly once. Skips malformed descriptors. Empty → [].
 *
 * `perFrame` is an array (one entry per sampled frame) of that frame's
 * descriptors, i.e. `number[][][]`.
 */
export function unionClipFaceVectors(
  perFrame: number[][][],
  opts: { threshold?: number } = {},
): number[][] {
  const threshold = opts.threshold ?? FACE_AUTO_MAX_DISTANCE;
  type Cluster = { sum: number[]; n: number; centroid: number[] };
  const clusters: Cluster[] = [];

  for (const frame of perFrame) {
    if (!Array.isArray(frame)) continue;
    for (const desc of frame) {
      if (!Array.isArray(desc) || desc.length === 0) continue;
      let bestCluster: Cluster | null = null;
      let bestDist = Infinity;
      for (const cl of clusters) {
        const d = euclideanDistance(desc, cl.centroid);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = cl;
        }
      }
      if (bestCluster && bestDist <= threshold) {
        const cl = bestCluster;
        for (let k = 0; k < cl.sum.length; k++) {
          cl.sum[k] = (cl.sum[k] ?? 0) + (desc[k] ?? 0);
        }
        cl.n += 1;
        cl.centroid = cl.sum.map((s) => s / cl.n);
      } else {
        clusters.push({ sum: [...desc], n: 1, centroid: [...desc] });
      }
    }
  }
  return clusters.map((c) => c.centroid);
}

/**
 * BROWSER. Sample N frames across a recorded clip, embed faces in each, and union
 * them → the 128-d descriptors of everyone who appears anywhere in the clip.
 * Best-effort: dormant when no face model is hosted (embedFaces yields no vectors), and
 * ANY error (decode/seek/embed) returns [] so the caller no-ops. Never throws.
 */
export async function embedClipFaces(
  videoBlob: Blob,
  opts: { fps?: number; maxFrames?: number } = {},
): Promise<number[][]> {
  if (typeof document === 'undefined') return [];
  let url: string | null = null;
  const video = document.createElement('video');
  try {
    const { embedFaces } = await import('@/lib/face-embed');
    url = URL.createObjectURL(videoBlob);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('video decode'));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const times = pickClipSampleTimes(duration, opts);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const perFrame: number[][][] = [];
    for (const t of times) {
      try {
        await seekTo(video, t);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { vectors } = await embedFaces(canvas);
        if (vectors.length > 0) perFrame.push(vectors);
      } catch {
        // Skip this frame; a bad seek shouldn't lose the whole clip's tags.
      }
    }
    return unionClipFaceVectors(perFrame);
  } catch {
    return [];
  } finally {
    if (url) URL.revokeObjectURL(url);
    try {
      video.removeAttribute('src');
      video.load();
    } catch {
      // ignore teardown errors
    }
  }
}

/** Seek a video element to `t` seconds and resolve once the frame is ready. */
function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('seek'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onErr);
    try {
      video.currentTime = t;
    } catch {
      cleanup();
      reject(new Error('seek set'));
    }
  });
}
