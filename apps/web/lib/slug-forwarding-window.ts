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
 * 🔒 THE RETIREMENT HOLD IS THE SAME NUMBER — `RETIRED_SLUG_HOLD_MONTHS` in
 * `lib/closed-shop-slug.ts` is DERIVED FROM THIS ONE. A closed shop, a deleted
 * wedding and a corrected shop address are all out of circulation for exactly
 * as long as a renamed address keeps forwarding.
 *
 * ⚠ THIS PARAGRAPH SAID THE OPPOSITE, IN THREE WAYS AT ONCE — that the hold was
 * ONE YEAR, that it "never reads this", and it named `CLOSED_SHOP_SLUG_HOLD_DAYS`,
 * a constant that no longer exists. Owner 2026-08-12 (*"make it 2 years"*)
 * superseded the one-year lock of 2026-08-10, and in the file whose entire
 * purpose is to be THE ONE NUMBER, a stale figure is the worst possible place
 * for one.
 *
 * What IS still true, and is what that warning was really protecting: each
 * retirement path writes `redirect_until` EXPLICITLY rather than inheriting the
 * column default. Now that the two numbers match, an inheriting path would be
 * invisible — and would silently follow any future change to this window.
 * `tests/db/slug-forwarding-window.db.test.ts` asserts the explicit write.
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
