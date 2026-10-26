/**
 * papic-card-counts.ts — THE PAPIC CARD'S ONE LINE OF NUMBERS (owner 2026-10-26: *"the count of the total, taken,
 * remaining"*). Credits, from the one pot read Home already makes (`papicGlance` → `total` / `count`), never a second
 * read. Taken = what the pot held less what it has left. Pure — `papic-lives-on-home.test.ts`.
 *
 * 🔴 null when EITHER number was not measured: the card then says "Couldn't check" — never "0 remaining" over a
 * refused read, which would tell a couple their guests' cameras are empty.
 */
export function papicCountsWords(total: number | null, left: number | null): Array<['Total' | 'Taken' | 'Remaining', number]> | null {
  if (total === null || left === null || !Number.isFinite(total) || !Number.isFinite(left)) return null;
  return [
    ['Total', total],
    ['Taken', Math.max(0, total - left)],
    ['Remaining', left],
  ];
}
