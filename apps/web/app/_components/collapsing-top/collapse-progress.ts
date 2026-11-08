/**
 * collapse-progress.ts — THE MATH OF THE ONE COLLAPSING TOP (THE ONE BUILD F2, v108/v110, 8 Nov 2026). Pure, so it is
 * tested without a browser (🔒 the-top-scrolls-up-and-locks.test.ts).
 *
 * The rule (v108, owner: *"the TOP ITSELF scrolls up and locks … native sticky"*): a top block of height H is
 * `position: sticky` with a NEGATIVE top, T + R − H — T the tops stacked above it (the shell bar, then earlier blocks'
 * rows), R the pinned row it leaves on screen (44 px). Its in-flow height never changes, so nothing under it ever moves;
 * once stuck only its bottom R px stay on screen. The big content fades out and the row fades in ONLY in the last 48 px
 * before it locks (v110 "only the last 48 px crossfade") — the progress `q`, 0 at rest, 1 locked.
 */

/** The pinned row a top leaves on screen — `--sn-pin-h` in globals.css. */
export const COLLAPSE_ROW_H = 44;
/** The cross-fade runs over the last 48 px before the top locks — never sooner. */
export const COLLAPSE_FADE_PX = 48;
/** Over this, the row is the top (it takes the taps; the attribute `data-pinned`). */
export const COLLAPSE_PINNED_AT = 0.5;

const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);

/** The sticky top of a block of height `h` leaving a row of `row` px under `before` px of stacked tops. */
export function collapseTop(h: number, row: number = COLLAPSE_ROW_H, before = 0): number {
  return before + row - h;
}

/**
 * The progress from what the browser says: `rectTop` the block's top on screen now, `stickyTop` the top it locks at.
 * Before the last `fade` px: 0. Locked: 1. Linear between (the content under it moves 1 px per scrolled px, always).
 */
export function collapseProgress(rectTop: number, stickyTop: number, fade = COLLAPSE_FADE_PX): number {
  if (!Number.isFinite(rectTop) || !Number.isFinite(stickyTop) || fade <= 0) return 0;
  return clamp01(1 - (rectTop - stickyTop) / fade);
}

/**
 * The same progress from the scroll offset (the spec's form): `natural` is the block's top in the document,
 * `before` the stacked tops (T), `h` its height (H), `row` its pinned row (R).
 *   q = clamp((scroll − (natural − T) − (H − R − fade)) / fade)
 */
export function collapseProgressAt(o: { scroll: number; natural: number; before: number; h: number; row?: number; fade?: number }): number {
  const row = o.row ?? COLLAPSE_ROW_H;
  const fade = o.fade ?? COLLAPSE_FADE_PX;
  if (fade <= 0) return 0;
  return clamp01((o.scroll - (o.natural - o.before) - (o.h - row - fade)) / fade);
}

/** Each block's T in a stack: the bar, then every earlier block's pinned row (Today: row 1 at 44, row 2 at 88). */
export function stackBefore(rows: number[]): number[] {
  let sum = 0;
  return rows.map((r) => {
    const t = sum;
    sum += r;
    return t;
  });
}

/** Is a sticky block stuck? The page has scrolled and its top sits at (or within 1 px of) its sticky top. */
export function isStuck(scrollY: number, rectTop: number, stickyTop: number): boolean {
  return scrollY > 0 && Number.isFinite(stickyTop) && rectTop <= stickyTop + 1;
}
