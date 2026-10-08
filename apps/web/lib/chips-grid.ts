/**
 * lib/chips-grid.ts — HOW MANY ACROSS: the Chips' even grid, pure (`INTERACTION_RULES.md` § 9, kind 11).
 *
 * Owner, 2026-10-08, on Studio › RSVP's six asks (they hugged their words: 99 · 84 · 84 on one line, 121 · 84 · 84
 * on the next, a ragged right edge): *"make RSVP ask buttons even"*. ⇒ a set of chips is an EVEN GRID — every chip
 * the same width and the same height, the columns filling the row edge to edge with equal gaps.
 *
 * How many columns (controller's ruling, the same hour):
 *   · ALL ON ONE LINE when the row is wide enough for every chip at the widest chip's width;
 *   · otherwise WHAT A 375-PX PHONE GETS — three across if the longest label fits on one line three across in a
 *     phone's row, else two — and the same count on a wider screen (never four on a tablet and two on a phone);
 *   · never a chip narrower than its words: a label is never shrunk, cut or wrapped — a row too narrow for the
 *     phone's count gets fewer columns.
 *
 * No React, no DOM: `app/_components/chips.tsx` measures and draws. Held by `lib/the-chips.test.ts`.
 */

/** The gap between chips, both ways (the gallery's 8). */
export const CHIP_GAP_PX = 8;
/** A chip is never narrower than this (the gallery's `min-width: 84px`). */
export const CHIP_MIN_PX = 84;
/** A chip's own sides: 18 px of padding and a 1-px border, each side. */
export const CHIP_SIDES_PX = 38;
/** A 375-px phone's row: the screen less a 16-px gutter each side. */
export const CHIP_PHONE_ROW_PX = 343;
/** The most a phone shows across. */
export const CHIP_PHONE_MOST = 3;

/** A chip's width for a label this wide. */
export function chipWidthFor(labelPx: number): number {
  return Math.max(CHIP_MIN_PX, Math.ceil(labelPx) + CHIP_SIDES_PX);
}

/**
 * A label's width BEFORE the browser has measured it (the server's render, the first paint): its letters at the
 * chip's 14-px semibold. Deliberately a little generous — a guess that is too wide costs a column for one frame, one
 * that is too narrow would cut a word.
 */
export function guessLabelPx(text: string): number {
  return text.length * 7.6;
}

const fits = (n: number, widest: number, row: number) => n * widest + (n - 1) * CHIP_GAP_PX <= row;

/** What a 375-px phone shows across for chips this wide: three if they fit, else two, else one. */
export function chipPhoneColumns(count: number, widest: number): number {
  for (let n = Math.min(count, CHIP_PHONE_MOST); n > 1; n -= 1) if (fits(n, widest, CHIP_PHONE_ROW_PX)) return n;
  return 1;
}

/** How many columns `count` chips take in a row `row` px wide, the widest chip being `widest` px. */
export function chipColumns(input: { count: number; widest: number; row: number }): number {
  const { count, widest, row } = input;
  if (count <= 1) return Math.max(1, count);
  if (fits(count, widest, row)) return count;
  let n = chipPhoneColumns(count, widest);
  while (n > 1 && !fits(n, widest, row)) n -= 1;
  return n;
}
