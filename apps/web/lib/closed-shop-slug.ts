/**
 * A closed shop keeps its address for a year.
 *
 * Owner-locked 2026-08-10, verbatim: *"their old shop's name will never be
 * deleted (unless manual delete by admin). so the slug will be kept for the
 * closed shop. slug will be available again after 1 year from date of
 * deletion."*
 *
 * ── WHY A YEAR, IN PRODUCT TERMS ────────────────────────────────────────────
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

/** One year, in days. Owner-locked; not a tunable. */
export const CLOSED_SHOP_SLUG_HOLD_DAYS = 365;

/**
 * When a shop closing *now* releases its address.
 *
 * Takes `now` so the rule can be tested at a fixed instant instead of being
 * asserted against a moving target — a test that computes the same arithmetic
 * as the code and compares the two agrees with itself no matter what either
 * one says.
 */
export function closedShopSlugHeldUntil(now: Date = new Date()): string {
  const until = new Date(now.getTime());
  until.setUTCDate(until.getUTCDate() + CLOSED_SHOP_SLUG_HOLD_DAYS);
  return until.toISOString();
}

/**
 * The `slug_change_log.entity_type` that means "wedding deleted, address held".
 *
 * Owner 2026-08-12: *"a retired website address will only be usable again after
 * 1 year."* Every other retirement already honoured that — a renamed wedding or
 * handle is held for the 24-month forwarding window, a closed shop for a year.
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

/** One year, shared with the closed-shop hold — one rule, not two numbers. */
export function closedEventSlugHeldUntil(now: Date = new Date()): string {
  return closedShopSlugHeldUntil(now);
}
