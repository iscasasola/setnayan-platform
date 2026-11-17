/**
 * gallery-zoom.ts — HOW MANY COLUMNS A MEMORIES GRID DRAWS (owner 2026-10-23, verbatim: *"gallery shouldn't be
 * inside a frame. maximize width. adapt to number of columns depending on zoom like apple photos"*; approved
 * prototypes `papic_controller_one_page_2026-10-23.html` (Gallery, revised) and
 * `event_bar_memories_tab_2026-10-23.html` frames 3–4).
 *
 *   phone   (< 1024)  1 · 3 · 5 · 7   — pinch: spread = fewer, larger tiles; squeeze = more
 *   desktop (≥ 1024)  6 · 8 · 12 · 16 — the − / + buttons, and a trackpad pinch (⌃ + wheel); 6 to start, and 8 to
 *                     start from 1600 (`wide` — the same steps and the same remembered key)
 *
 * 🖥 6 A ROW AT 1280, 8 AT 1600 (owner "Yes, all 8", 16 Nov 2026, event dashboard drawing v13 Q4: Memories takes the
 * full width from 1024 — "6 photos/row at 1280, 8 at 1600"). The 23 Oct desk steps were 6 · 9 · 12 · 16 with 9 to
 * start; 8 replaces 9 so the 1600 start is a step, and a remembered 9 falls back to the start for its width.
 *
 * Remembered on the device (localStorage, per viewer) under the prototype's own two keys — a per-viewer
 * convenience, never shared state. Pure: `gallery-zoom.test.ts`.
 */

export const PHONE_COLUMNS = [1, 3, 5, 7] as const;
export const DESK_COLUMNS = [6, 8, 12, 16] as const;
export const PHONE_DEFAULT = 3;
export const DESK_DEFAULT = 6;
export const WIDE_DEFAULT = 8;
/** The width the desktop steps start at — the house `lg`, where the rail paints. */
export const DESK_FROM_PX = 1024;
/** The width the wide desk starts at — 8 a row to start (owner 16 Nov 2026). */
export const WIDE_FROM_PX = 1600;
export const ZOOM_KEY_PHONE = 'sn-gallery-zoom';
export const ZOOM_KEY_DESK = 'sn-gallery-zoom-desk';

export type ZoomScale = 'phone' | 'desk' | 'wide';

export function stepsFor(scale: ZoomScale): readonly number[] {
  return scale === 'phone' ? PHONE_COLUMNS : DESK_COLUMNS;
}

export function defaultFor(scale: ZoomScale): number {
  return scale === 'wide' ? WIDE_DEFAULT : scale === 'desk' ? DESK_DEFAULT : PHONE_DEFAULT;
}

/** The scale for a viewport width — the phone below 1024, the desk from 1024, the wide desk from 1600. */
export function scaleFor(width: number): ZoomScale {
  return width >= WIDE_FROM_PX ? 'wide' : width >= DESK_FROM_PX ? 'desk' : 'phone';
}

/** A remembered value, or the default when it is missing or not one of the steps (an old or hand-typed value). */
export function readColumns(raw: string | null | undefined, scale: ZoomScale): number {
  const n = Number(raw);
  return stepsFor(scale).includes(n) ? n : defaultFor(scale);
}

/** One step along the scale — `+1` = more (smaller) tiles, `-1` = fewer (larger). Clamped at both ends. */
export function stepColumns(current: number, dir: 1 | -1, scale: ZoomScale): number {
  const steps = stepsFor(scale);
  const at = steps.indexOf(current);
  const i = at < 0 ? steps.indexOf(defaultFor(scale)) : at;
  return steps[Math.min(steps.length - 1, Math.max(0, i + dir))]!;
}

/**
 * ONE STEP PER GESTURE, LIKE APPLE PHOTOS (owner 2026-10-23, after trying the prototype: *"The pinch changes too
 * fast"*). While the fingers move the grid only SCALES (a transform — nothing re-lays out); on release it snaps one
 * step only past a clear threshold, otherwise it springs back:
 *   scale ≤ 0.8  → +1  more, smaller tiles (a squeeze)
 *   scale ≥ 1.25 → −1  fewer, larger tiles (a spread)
 * Never several steps, however far the fingers travel.
 */
export const PINCH_MORE_AT = 0.8;
export const PINCH_FEWER_AT = 1.25;
/** A trackpad pinch (⌃ + wheel) is one gesture while its events arrive less than this far apart. */
export const WHEEL_GESTURE_GAP_MS = 250;
/** The snap / spring-back — the house ease-out, skipped under prefers-reduced-motion. */
export const SNAP_MS = 200;

export function gestureStep(scale: number): 1 | -1 | null {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  if (scale <= PINCH_MORE_AT) return 1;
  if (scale >= PINCH_FEWER_AT) return -1;
  return null;
}

/** A two-finger gesture's scale: the distance between the fingers now over the distance at its start. */
export function pinchScale(startDistance: number, nowDistance: number): number {
  if (!(startDistance > 0) || !(nowDistance > 0)) return 1;
  return nowDistance / startDistance;
}

/** A ⌃ + wheel gesture's scale from its summed deltaY — the browsers' own page-zoom curve (exp(−Δ/100)). */
export function wheelScale(sumDeltaY: number): number {
  return Number.isFinite(sumDeltaY) ? Math.exp(-sumDeltaY / 100) : 1;
}

/** What the grid is drawn at mid-gesture — held to a sane band so a long drag never flings the photos away. */
export function liveScale(scale: number): number {
  return Math.min(2, Math.max(0.5, Number.isFinite(scale) ? scale : 1));
}

/** The credit and the marks shrink away on the dense steps (the prototype: 7 · 12 · 16 draw no names). */
export function isDense(columns: number): boolean {
  return columns >= 7;
}
