/**
 * The one-line summary under "See your whole life — while you're still in it."
 * on the launcher's Alaala tile.
 *
 * Pure, and out of the tile on purpose: the tile is an async server component,
 * so the unit runner cannot import it and the line it prints could not be
 * asserted. This is the assertable half.
 *
 * 🔑 A ZERO IS NOT A FACT WORTH PRINTING. The first cut always named the people
 * count, so an account whose photos carry no tags read
 * "14 moments · 0 people who made them". The owner met exactly that sentence on
 * the day Life-Flash was switched on (2026-08-12) — and it is wrong twice over:
 * it reads as though the people are missing, when the truth is that nobody has
 * been tagged yet, and it prints a zero next to a feature whose whole promise is
 * the people who kept showing up. The clause is OMITTED rather than zeroed.
 *
 * `life-story-summary-line.test.ts` fails if any count reaches the copy as a
 * zero. Do not "simplify" it back into one template literal.
 */
export function lifeFlashSummaryLine(momentCount: number, peopleCount: number): string {
  if (momentCount <= 0) {
    return 'Moments gather here live, from every celebration you’re part of.';
  }
  const moments = `${momentCount} ${momentCount === 1 ? 'moment' : 'moments'}`;
  const people =
    peopleCount > 0
      ? ` · ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} who made them`
      : '';
  return `${moments}${people} — gathered while you’re living them`;
}
