/**
 * vendor-lead-time-tier.ts — the EARLY-BOOKING LADDER resolver.
 *
 * Owner ruling 2026-07-27 (DECISION_LOG "🧙 THE MAKER IS ZERO STEPS", ruling ②):
 * discounts depend on how far away the couple's event is. A vendor authors an
 * editable ladder on one service — several `early_booking` rows in
 * `vendor_service_discounts`, each with its own `min_lead_months` threshold
 * (12+ months → −15%, 6+ → −10%) — and **the couple's event date picks the tier
 * automatically**. It is never negotiated in chat.
 *
 * This module is the whole rule, and nothing else:
 *
 *   • PURE. No I/O, no `Date.now()`, no imports. `now` is a PARAMETER — the
 *     repo's determinism idiom — so a test can stand anywhere on the calendar
 *     and the render path can pass one clock to every card on a page.
 *   • MONTHS = DAYS / 30.44 (the mean Gregorian month). One definition, here,
 *     so the editor's "≥ N months ahead" and the couple's badge can never drift.
 *   • The LARGEST applicable rung wins. A couple 13 months out satisfies both
 *     the 12+ and the 6+ rung; they get the 12+ one. That is the only sane
 *     reading of a ladder, and `pickLargest` below is the single place it lives.
 *   • Rows with a NULL threshold are NOT ladder rungs. They are legacy /
 *     thresholdless early-booking offers that apply unconditionally, and this
 *     resolver deliberately ignores them so it can never *downgrade* one. The
 *     caller keeps showing them exactly as it does today.
 *
 * DISPLAY ONLY. Services are inquiry-based: the tier is copy on a card, and the
 * vendor confirms the final price in their reply. Nothing here touches a charge
 * path, package/lock pricing, or the booking fee.
 */

/** Mean Gregorian month in days — the ONE conversion used everywhere. */
export const DAYS_PER_MONTH = 30.44;

const MS_PER_DAY = 86_400_000;

/**
 * Tolerance, in months, on the ">= threshold" comparison — about 2.6 seconds.
 *
 * `months` is a float derived by two divisions, so an event date that is
 * EXACTLY twelve 30.44-day months out can land at 11.999999999999998 and lose
 * the 12+ rung to a rounding error nobody can see or explain. An event date is
 * a calendar day; sub-second float noise must never decide which tier a couple
 * gets. The epsilon is ~7 orders of magnitude smaller than the smallest gap a
 * vendor can author (1 month), so it can only ever rescue the exact boundary.
 */
const MONTH_EPSILON = 1e-6;

/**
 * The shape this resolver needs from a `vendor_service_discounts` row. Kept
 * structural (rather than importing `VendorServiceDiscount`) so both the
 * vendor-write module and the public read path can feed it their own row type,
 * and so the tests need no Supabase types at all.
 */
export type LeadTimeCandidate = {
  discount_type: string;
  /** Threshold in months; NULL/undefined = not a ladder rung (see above). */
  min_lead_months?: number | null;
};

/**
 * How many months away `eventDate` is from `now`. Negative when the event has
 * already passed. Returns null when the date is missing or unparseable, which
 * the caller must read as "no event date in context" (the anonymous case).
 *
 * `eventDate` is the `events.event_date` shape — an ISO date-only string
 * (YYYY-MM-DD) — but any Date-parseable string is accepted.
 */
export function monthsUntil(
  eventDate: string | null | undefined,
  now: Date,
): number | null {
  if (!eventDate) return null;
  // Date-only strings parse as UTC midnight; `now` is an instant. Both land on
  // the same axis, and a fractional day either way cannot move a whole-month
  // threshold enough to matter (the boundary tests below pin the behaviour).
  const at = Date.parse(eventDate);
  if (!Number.isFinite(at)) return null;
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return null;
  return (at - nowMs) / MS_PER_DAY / DAYS_PER_MONTH;
}

/**
 * The early-booking tier a couple qualifies for, given their event date.
 *
 * Returns the `early_booking` row with the LARGEST `min_lead_months` that is
 * still ≤ the months between `now` and `eventDate` — or null when there is no
 * event date, no ladder, or the couple is booking too late for any rung.
 *
 * Rows without a threshold (`min_lead_months` null) are ignored: they are not
 * rungs, and the caller handles them unchanged.
 *
 * @param discounts every discount row on the service (any type; filtered here)
 * @param eventDate the couple's event date (ISO YYYY-MM-DD) or null/undefined
 * @param now       the clock, injected — never read from the ambient system
 */
export function applicableLeadTimeTier<T extends LeadTimeCandidate>(
  discounts: ReadonlyArray<T> | null | undefined,
  eventDate: string | null | undefined,
  now: Date,
): T | null {
  if (!discounts || discounts.length === 0) return null;
  const months = monthsUntil(eventDate, now);
  if (months === null) return null;

  let best: T | null = null;
  let bestThreshold = -Infinity;
  for (const d of discounts) {
    if (d.discount_type !== 'early_booking') continue;
    const threshold = d.min_lead_months;
    // Not a rung (legacy thresholdless row) or a corrupt value → skip.
    if (threshold === null || threshold === undefined) continue;
    if (!Number.isFinite(threshold) || threshold < 1) continue;
    // Too late for this rung (epsilon so the exact boundary counts as "reached").
    if (months < threshold - MONTH_EPSILON) continue;
    // LARGEST applicable rung wins; a tie keeps the FIRST row, which the fetch
    // already ordered by the vendor's own sort_order.
    if (threshold > bestThreshold) {
      bestThreshold = threshold;
      best = d;
    }
  }
  return best;
}

/**
 * Is this row a LADDER RUNG (an early_booking row carrying a real threshold)?
 * A rung is subject to the couple's event date; everything else — the other four
 * discount types, and a thresholdless legacy early_booking row — is not, and the
 * caller must keep showing it exactly as it does today.
 */
export function isLeadTimeTier(d: LeadTimeCandidate): boolean {
  if (d.discount_type !== 'early_booking') return false;
  const threshold = d.min_lead_months;
  if (threshold === null || threshold === undefined) return false;
  return Number.isFinite(threshold) && threshold >= 1;
}

/**
 * Couple-facing name for a rung, in the owner's own words:
 *   "Booked 6+ months ahead"
 * Used as the left half of the service-card badge when the tier applies to the
 * couple's real event date.
 */
export function leadTimeTierLabel(minLeadMonths: number): string {
  const n = Math.round(minLeadMonths);
  return `Booked ${n}+ month${n === 1 ? '' : 's'} ahead`;
}
