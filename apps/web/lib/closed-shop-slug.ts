import { SLUG_FORWARDING_MONTHS } from '@/lib/slug-forwarding-window';

/**
 * A closed shop keeps its address for TWO YEARS.
 *
 * Owner-locked 2026-08-10, verbatim: *"their old shop's name will never be
 * deleted (unless manual delete by admin). so the slug will be kept for the
 * closed shop. slug will be available again after 1 year from date of
 * deletion."*
 *
 * ⚠ **THAT ONE-YEAR FIGURE IS SUPERSEDED — owner 2026-08-12: "make it 2
 * years."** The quote above is kept because it is the origin of the rule, not
 * because the number in it is current. The live figure is
 * `RETIRED_SLUG_HOLD_MONTHS`, derived from the forwarding window, and it is the
 * only place the duration exists.
 *
 * ── WHY A LONG HOLD, IN PRODUCT TERMS ───────────────────────────────────────
 * A shop's address goes on printed material and into messages months before
 * anyone visits it. Freeing it the minute a business closes points every one of
 * those links at a **different company** — which reads to the person following
 * the link not as "that shop closed" but as "this platform gave my supplier's
 * page to someone else."
 *
 * ── WHY THERE IS NO TABLE, NO SWEEP AND NO SCHEDULED JOB ────────────────────
 * RULE 0. `slug_change_log` already holds a word until `redirect_until` passes,
 * and `findSlugConflict` already refuses anything it covers. A held address is
 * one row with a later expiry. **The word releases itself** — expiry is a
 * timestamp comparison at the moment somebody asks for it, so there is nothing
 * to run on a schedule and nothing that can silently stop running.
 *
 * ── WHY ITS OWN ENTITY TYPE ─────────────────────────────────────────────────
 * A rename and a closure mean different things to every future reader. A rename
 * forwards visitors to where the shop went; a closure forwards nobody anywhere
 * and is only holding the word so nobody else takes it. Encoding a closure as a
 * rename-to-itself would have worked and would have lied — and this repo has
 * already paid for a stored value whose NAME misled two independent readers.
 */

/** The `slug_change_log.entity_type` that means "closed shop, address held". */
export const CLOSED_SHOP_SLUG_ENTITY_TYPE = 'vendor_closed';

/**
 * How long a RETIRED address stays out of circulation — closed shop, deleted
 * wedding, or any other retirement.
 *
 * ⚠ WAS ONE YEAR (owner-locked 2026-08-10). **Owner 2026-08-12 raised it to two
 * and that supersedes the earlier lock:** first *"a retired website address will
 * only be usable again after 1 year"*, then, on being shown that this left it
 * shorter than the forwarding window, *"make it 2 years."*
 *
 * 🔑 DERIVED, SO THERE IS EXACTLY ONE NUMBER. A retired address is now out of
 * circulation for precisely as long as a renamed one keeps forwarding. Two
 * separate constants for "how long is an address unavailable" is how a
 * correction at one site becomes a contradiction at the other — this repo has
 * paid for that shape more than once.
 */
export const RETIRED_SLUG_HOLD_MONTHS = SLUG_FORWARDING_MONTHS;

/**
 * When a shop closing *now* releases its address.
 *
 * Takes `now` so the rule can be tested at a fixed instant instead of being
 * asserted against a moving target — a test that computes the same arithmetic
 * as the code and compares the two agrees with itself no matter what either
 * one says.
 *
 * Month arithmetic, not days: "two years" must mean the same calendar date, and
 * 365-day steps drift through a leap year. `setUTCMonth` rolls a day that does
 * not exist in the target month forward (29 Feb + 24 months → 1 Mar), which is
 * pinned in the tests rather than left as a surprise.
 */
export function closedShopSlugHeldUntil(now: Date = new Date()): string {
  const until = new Date(now.getTime());
  until.setUTCMonth(until.getUTCMonth() + RETIRED_SLUG_HOLD_MONTHS);
  return until.toISOString();
}

/**
 * The `slug_change_log.entity_type` that means "wedding deleted, address held".
 *
 * Owner 2026-08-12: *"a retired website address will only be usable again after
 * 1 year"*, then *"make it 2 years"* — so every retirement now holds for
 * RETIRED_SLUG_HOLD_MONTHS, the same span a renamed address keeps forwarding.
 * **Deletion was the hole**: measured in prod, the final address of a deleted
 * wedding was claimable the same second, so every invitation and QR code
 * carrying it could have been handed to a stranger.
 *
 * Same shape as a closed shop, and for the same reason: it forwards NOBODY (the
 * event is gone — there is nothing to forward to), it only stops the word being
 * reissued. `resolveRenamedPath` filters to the forwarding types, so this is
 * inert there by construction; `findSlugConflict` matches on `old_slug` with no
 * entity_type filter, so it blocks reuse everywhere a word is handed out.
 */
export const CLOSED_EVENT_SLUG_ENTITY_TYPE = 'event_closed';

/** Shared with the closed-shop hold — ONE rule, not two numbers that can drift. */
export function closedEventSlugHeldUntil(now: Date = new Date()): string {
  return closedShopSlugHeldUntil(now);
}
