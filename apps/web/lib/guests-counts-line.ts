/**
 * 📌 A7-35 (final check 25 Nov; drawing `prototypes/final-check-area-7_2026-11-25/`, section 1, approved): the Guests
 * pinned row holds the place menu · the view's counts · its rounds (⋯ · ⓘ · ⚙). At 375 on Seats › 3D the three counts
 * (seated · unseated · tables) need about 138 px and the row leaves about 73, so the last count slid under the ⋯ round.
 *
 * THE RULE — a container rule on the row, not a screen width: the counts take their own second line ONLY when they do
 * not fit beside the menu and the rounds; when they fit, the row is today's one line. Pure, so it is tested without a
 * browser; the screen measures the row and writes `data-counts-wrap`.
 */
export type CountsLineInput = {
  /** The row's inner width. */
  rowWidth: number;
  /** The place menu's width (it shares line 1 with the counts). */
  menuWidth: number;
  /** Every other item on line 1: the view's rounds, the ⓘ, the ⚙. */
  otherWidths: readonly number[];
  /** The space between the row's items. */
  rowGap: number;
  /** Each count door's own width, as drawn. */
  countWidths: readonly number[];
  /** The space between two count doors. */
  countGap: number;
};

/** True when the counts do not fit beside the menu and the rounds, so they go to their own line. */
export function countsNeedOwnLine(i: CountsLineInput): boolean {
  if (i.countWidths.length === 0) return false;
  const needed = i.countWidths.reduce((n, w) => n + w, 0) + i.countGap * (i.countWidths.length - 1);
  const items = 1 + i.otherWidths.length; // the menu + counts block, then each other item
  const available = i.rowWidth - i.menuWidth - i.otherWidths.reduce((n, w) => n + w, 0) - i.rowGap * items;
  // Half a pixel of rounding never flips the row back and forth.
  return needed > available + 0.5;
}
