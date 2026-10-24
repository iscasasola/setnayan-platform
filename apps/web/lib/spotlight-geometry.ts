/**
 * 🔦 WHERE THE SPOTLIGHT'S RING AND CARD GO — the pure half of `app/_components/spotlight-tour.tsx`'s `place()`.
 * No DOM here: the engine reads the rectangles, these decide. Held by `lib/spotlight-geometry.test.ts` and, on the
 * real engine in a real browser, by `tests/e2e/the-spotlight-ring-wraps-its-target.spec.ts`.
 *
 * 🐛 Owner 2026-10-23, his own Maker on a ~1000 pt desktop window, About the Maker › "Apply when you like it": the
 * ring drew as a thin flat pill ~40 px BELOW Apply, cut at the right edge, Apply itself dimmed, and the card centred
 * at the top of the page. Three causes, one per rule below:
 *   ① `freeBand` counted the APP's sticky top bar as an obstacle — but the Maker is a full-screen sheet drawn OVER
 *     it, so that bar was nowhere on screen. The ring was clamped to start below it, and since Apply sits in the
 *     Maker's own top bar the clamp ate the ring's whole height (h went negative → a 0-high outline). A bar is an
 *     obstacle only when it is painted on top (`Bar.painted`) and the target is not drawn over it (`Bar.under`).
 *   ② The ring's padding was clamped on ONE side (x = max(8, left − 8), w cut at the right edge), so a button near
 *     the edge got 8 px on the left and none on the right, its outline off screen. Now one padding for every side,
 *     the largest that keeps the white outline on screen.
 *   ③ The card was always centred on the screen (`left:16px;right:16px;margin:auto`), which on a phone is beside
 *     everything and on a desktop is beside nothing. It now sits under (or over, or next to) its ring.
 */

export type Rect = { left: number; top: number; width: number; height: number };
export type Band = { top: number; bottom: number };
export type Box = { x: number; y: number; w: number; h: number; r: string };

/** A fixed or sticky bar (`header`, `nav`, the bottom dock, the app's top bar), as the engine measured it. */
export type Bar = {
  rect: Rect;
  /** It holds the target (a bottom tab, the Maker's Apply) — never an obstacle for that target. */
  holds: boolean;
  /** Something of it is the top-most thing on screen where it sits. False: a full-screen sheet (the Maker) covers it. */
  painted: boolean;
  /** The target overlaps it AND is the thing on top there — the bar is beneath the target, not over it. */
  under: boolean;
};

/** The ring's breathing room around its target. */
export const RING_PAD = 8;
/** The white outline sits `outline-offset: 4px` outside the ring and is 3 px thick: 7 px the ring's box never shows. */
export const RING_EDGE = 7;
/** Below this the "ring" is a line (the 2026-10-23 bug drew a 0-high one) — nothing is drawn and the step waits. */
export const RING_MIN = 12;
/** The card: never wider than this, 16 px from the screen's edges, `GAP` from its ring (past the pulse's 10 px). */
export const TIP_MAX_W = 420;
export const TIP_SIDE = 16;
export const TIP_GAP = 20;

const bottomOf = (r: Rect) => r.top + r.height;

/**
 * The band of the screen no bar covers, so a ring is never drawn under the top bar, the bottom bar or the home
 * indicator. `vh`: the screen's height; `insets`: the safe areas.
 */
export function freeBandFrom(bars: ReadonlyArray<Bar>, vw: number, vh: number, insets: Band): Band {
  let top = insets.top;
  let bottom = vh - insets.bottom;
  for (const b of bars) {
    if (b.holds || !b.painted || b.under) continue;
    const r = b.rect;
    if (r.height < 1 || r.height > vh / 2 || r.width < vw / 2) continue;
    if (r.top <= vh / 3 && bottomOf(r) > top) top = Math.min(bottomOf(r), vh / 3);
    else if (bottomOf(r) >= (vh * 2) / 3 && r.top < bottom) bottom = Math.max(r.top, (vh * 2) / 3);
  }
  return { top, bottom };
}

/**
 * The ring around a target: ONE padding on every side (the largest up to `RING_PAD` that keeps the outline on the
 * screen and out of the bars), so it is even. A side where the target itself runs past the screen or under a bar is
 * cut there (a tall card scrolled to its top). Null when what is left is a line — nothing to light, the step waits.
 */
export function ringFor(t: Rect, vw: number, band: Band): Box | null {
  const right = t.left + t.width;
  const bottom = bottomOf(t);
  const room: number[] = [RING_PAD];
  if (t.left >= 0) room.push(t.left - RING_EDGE);
  if (right <= vw) room.push(vw - RING_EDGE - right);
  if (t.top >= band.top) room.push(t.top - band.top - RING_EDGE);
  if (bottom <= band.bottom) room.push(band.bottom - RING_EDGE - bottom);
  const pad = Math.max(0, Math.floor(Math.min(...room)));
  const x0 = Math.max(0, t.left - pad);
  const x1 = Math.min(vw, right + pad);
  const y0 = Math.max(band.top, t.top - pad);
  const y1 = Math.min(band.bottom, bottom + pad);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < RING_MIN || h < RING_MIN) return null;
  return { x: x0, y: y0, w, h, r: h > 70 ? 'var(--m-r-lg,22px)' : 'var(--m-r-full,999px)' };
}

/**
 * The card beside its ring: under it when it fits, over it when that fits, else next to it (a desktop's tall
 * target), else — a phone with a tall target — as low as the screen allows. Horizontally it is centred on the ring
 * and kept on the screen: on a phone it is the full width either way; on a desktop it sits by its button.
 */
export function tipFor(ring: Box, tip: { h: number }, vw: number, vh: number, band: Band, insets: Band): { left: number; top: number; width: number } {
  const width = Math.max(0, Math.min(TIP_MAX_W, vw - TIP_SIDE * 2));
  const clampX = (x: number) => Math.min(Math.max(TIP_SIDE, x), Math.max(TIP_SIDE, vw - TIP_SIDE - width));
  const centred = clampX(ring.x + ring.w / 2 - width / 2);
  const below = ring.y + ring.h + TIP_GAP;
  if (below + tip.h <= band.bottom - 12) return { left: centred, top: below, width };
  const above = ring.y - TIP_GAP - tip.h;
  if (above >= band.top + 12) return { left: centred, top: above, width };
  const sideTop = Math.min(Math.max(band.top + 12, ring.y), Math.max(band.top + 12, band.bottom - 12 - tip.h));
  if (vw - (ring.x + ring.w) - TIP_GAP - TIP_SIDE >= width) return { left: ring.x + ring.w + TIP_GAP, top: sideTop, width };
  if (ring.x - TIP_GAP - TIP_SIDE >= width) return { left: ring.x - TIP_GAP - width, top: sideTop, width };
  return { left: centred, top: Math.max(insets.top + 12, Math.min(below, vh - insets.bottom - tip.h - 12)), width };
}
