/**
 * lib/centre-in-row.ts — A PICKED ITEM IN A ROW THAT SCROLLS SIDEWAYS CENTRES ITSELF.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, on a picked style card left half
 * off the edge): *"when something is selected, must center as much as possible"*.
 * On a pick the row scrolls so the picked item sits in the middle, as far as the
 * row's ends allow (the first and last stop at their edge); on opening, the row
 * starts at its current pick. Smooth — instant under "reduce motion", and
 * instant on opening (nothing should be seen travelling into place).
 *
 * One rule for every sideways row (the approved gallery's own `centre()`); the
 * Background strip is the first to use it. Held by
 * `lib/a-loading-pick-is-honest.test.ts` (7).
 */

/** Where the row must be scrolled for the item to sit in its middle — never past either end. */
export function centredScrollLeft(item: { left: number; width: number }, row: { width: number; scrollWidth: number }): number {
  const want = item.left + item.width / 2 - row.width / 2;
  const max = Math.max(0, row.scrollWidth - row.width);
  return Math.round(Math.max(0, Math.min(max, want)));
}

/** Scroll `row` so `item` is centred. `travel: false` = at once (opening the row, or "reduce motion"). */
export function centreInRow(row: HTMLElement, item: HTMLElement, travel: boolean): void {
  const r = row.getBoundingClientRect();
  const i = item.getBoundingClientRect();
  /* The item's place INSIDE the row's scrolled content, whatever the row's own offset parent is. */
  const left = centredScrollLeft({ left: i.left - r.left + row.scrollLeft, width: i.width }, { width: row.clientWidth, scrollWidth: row.scrollWidth });
  const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.scrollTo({ left, behavior: travel && !still ? 'smooth' : 'auto' });
}
