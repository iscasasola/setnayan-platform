/**
 * The pure half of `<ScratchCard>` (app/_components/scratch-card.tsx) — everything that decides WHEN a
 * scratch-off is done, kept out of the component so node:test can hold it without a DOM or a canvas.
 *
 *   • how much of the cover is gone (from a canvas's RGBA bytes, sampled, not every pixel),
 *   • the same answer estimated from the strokes alone, for a cover the browser will not let us read back
 *     (a cross-origin cover image taints the canvas, and `getImageData` then THROWS — a silent 0% would
 *     leave the card un-revealable),
 *   • whether that is past the threshold (default 55%), with a bad threshold clamped rather than trusted,
 *   • the brush size for a given card, so a 1:1 phone card and a wide desktop card feel the same,
 *   • points along a stroke, so the gold dust follows a fast swipe instead of clumping at its two ends.
 */

export const DEFAULT_REVEAL_THRESHOLD = 0.55;

/** A pixel counts as scratched once at least half of its alpha is gone. */
const CLEARED_ALPHA = 128;

export type Point = { x: number; y: number };

/** Clamp a threshold into (0, 1]; anything non-finite falls back to the default. */
export function normaliseThreshold(threshold: number | undefined): number {
  if (threshold === undefined || !Number.isFinite(threshold)) return DEFAULT_REVEAL_THRESHOLD;
  if (threshold <= 0) return 0.01;
  if (threshold > 1) return 1;
  return threshold;
}

/**
 * Fraction (0–1) of pixels whose alpha is under half, read from RGBA bytes. `step` samples every
 * step-th pixel (1 = all of them); a 1024×1024 retina card is 1M pixels, so the component samples.
 * An empty buffer reports 0 — never NaN, which would compare false against every threshold.
 */
export function clearedFraction(rgba: ArrayLike<number>, step = 1): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  const s = Math.max(1, Math.floor(step));
  let seen = 0;
  let cleared = 0;
  for (let p = 0; p < pixels; p += s) {
    seen += 1;
    if ((rgba[p * 4 + 3] ?? 255) < CLEARED_ALPHA) cleared += 1;
  }
  return seen === 0 ? 0 : cleared / seen;
}

/**
 * Fallback when the canvas cannot be read back: the area the strokes swept (length × brush width, plus a
 * cap per stroke), over the card's area, discounted for overlap. Deliberately conservative — it should
 * cross the threshold a little LATER than the real count would, never earlier.
 */
export function estimatedFraction(
  strokeLength: number,
  strokes: number,
  brushRadius: number,
  width: number,
  height: number,
): number {
  const area = width * height;
  if (!(area > 0) || !(brushRadius > 0)) return 0;
  const swept = Math.max(0, strokeLength) * brushRadius * 2 + Math.max(0, strokes) * Math.PI * brushRadius * brushRadius;
  const OVERLAP = 0.6; // strokes cross each other; assume ~40% of what was swept was already clear
  return Math.min(1, (swept * OVERLAP) / area);
}

/** True once the cleared fraction has reached the (normalised) threshold. */
export function isRevealed(fraction: number, threshold?: number): boolean {
  if (!Number.isFinite(fraction)) return false;
  return fraction >= normaliseThreshold(threshold);
}

/** Brush radius in CSS px: 8% of the card's shorter side, never under 16 or over 48. */
export function brushRadiusFor(width: number, height: number): number {
  const short = Math.min(width, height);
  if (!(short > 0)) return 16;
  return Math.max(16, Math.min(48, short * 0.08));
}

/** Points from `a` to `b` (both included) no further apart than `spacing`. */
export function pointsAlong(a: Point, b: Point, spacing: number): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const gap = spacing > 0 ? spacing : 1;
  const n = Math.max(1, Math.ceil(dist / gap));
  const out: Point[] = [];
  for (let i = 0; i <= n; i += 1) out.push({ x: a.x + (dx * i) / n, y: a.y + (dy * i) / n });
  return out;
}

/** How many pixels to skip when sampling a canvas of this many pixels: aim for ~40k samples. */
export function sampleStepFor(pixelCount: number): number {
  if (!(pixelCount > 0)) return 1;
  return Math.max(1, Math.floor(pixelCount / 40_000));
}
