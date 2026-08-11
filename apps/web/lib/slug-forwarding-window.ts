// ============================================================================
// HOW LONG A RETIRED ADDRESS KEEPS POINTING AT WHERE IT WENT — the ONE number.
//
// Pure and dependency-free on purpose: the two screens that PROMISE this window
// are client components, and the resolver that honours it is a server module
// that talks to the database. Both read the number from here, so the promise
// and the mechanism cannot drift.
// ============================================================================

/**
 * ⚠ WAS 90 DAYS, WHICH COULD NOT COVER THE THING IT EXISTS FOR. Save-the-dates
 * go out 6–12 months before the day, and the printed QR on one is exactly the
 * link this window protects — so a wedding invited in January and renamed in
 * March went dark months before the guests travelled.
 *
 * Two years covers a save-the-date sent a year out, the celebration itself, and
 * a year of afterwards, which is when people still open the link for the
 * photos. A held word costs nothing but the word.
 *
 * The database default is DERIVED from this by migration
 * `20271132344178_old_addresses_forward_for_two_years.sql`, and
 * `tests/db/slug-forwarding-window.db.test.ts` reads that default back out of
 * the catalog and compares it to this constant.
 *
 * 🔒 NOT the closed-shop hold. A closed shop's address is held ONE YEAR
 * (`CLOSED_SHOP_SLUG_HOLD_DAYS`, owner-locked 2026-08-10) and is written with
 * an explicit expiry — it never reads this.
 */
export const SLUG_FORWARDING_MONTHS = 24;

/**
 * The window as a phrase for a couple or a vendor, DERIVED — never typed beside
 * the number. "90 days" sat on two screens and in three comments; a correction
 * at one site is not a correction, and this repo has already paid for that
 * exact shape more than once.
 */
export function slugForwardingLabel(months: number = SLUG_FORWARDING_MONTHS): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? '1 year' : `${years} years`;
  }
  return months === 1 ? '1 month' : `${months} months`;
}
