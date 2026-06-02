/**
 * Personalization-conflict types + helpers.
 *
 * WHAT (CLAUDE.md 2026-06-02 directive 4 — owner: "When the data are changed
 * on their personalization. we must notify which vendors will be in conflict
 * if they proceed with these changes. show the cards of each services
 * picked."). Owner scope answer: "All four fields now" → ceremony · venue ·
 * guest-count · date all trigger the conflict warning before the change
 * commits.
 *
 * This module holds the server-safe SHARED pieces (no 'use server', no client
 * code) so both the preview server action (in dashboard/[eventId]/actions.ts)
 * and the client editor (governed-fields.tsx) import one source of truth:
 *
 *   - ConflictField   — which governed field is being changed.
 *   - ConflictService — a picked service that would conflict, as a card.
 *   - isCapacityBound — the pax best-effort heuristic (no capacity model
 *     exists, so guest-count conflicts are an approximate "may re-quote"
 *     note rather than a precise per-vendor check — see the owner's
 *     acknowledgement in the directive-4 scope answer).
 *
 * The ceremony/venue conflict math itself is `computeCompatibilityIssue`
 * (lib/wedding-plan-groups.ts) run against the PROPOSED value; the date
 * conflict is the vendor-availability engine (lib/vendor-availability.ts).
 * Both live in the server action because they touch the DB.
 */

export type ConflictField = 'ceremony' | 'venue' | 'date' | 'pax';

/**
 * A picked service (event_vendors row) that would be in conflict if the
 * host proceeds with the proposed personalization change. Rendered as a
 * card on the Personalization page's confirm step, with a per-card Remove
 * (→ deleteVendor) so the host can resolve the conflict in place.
 */
export type ConflictService = {
  /** event_vendors.vendor_id — the key deleteVendor() removes by. */
  vendor_id: string;
  /** Resolved display name (marketplace business_name → vendor_name). */
  vendor_name: string;
  /** VendorCategory string (for the card's category tag). */
  category: string;
  /** Raw event_vendors.status (considering / inquiring / etc.). */
  raw_status: string | null;
  /** Marketplace logo URL when linked, else null (initials fallback). */
  logo_url: string | null;
  /** Human-readable reason this pick conflicts with the proposed value. */
  reason: string;
};

/**
 * Categories whose price/headcount scales with guest count, so a pax change
 * means "the vendor may need to re-quote." Best-effort substring match on
 * the VendorCategory string — there is NO capacity model in V1
 * (daily_booking_capacity is Schedule-Matrix spec, not built), so this is
 * an approximate warning, not a precise availability conflict. Owner
 * acknowledged the approximation in the directive-4 scope answer.
 */
const CAPACITY_BOUND_HINTS = [
  'cater',
  'food',
  'mobile_bar',
  'cake',
  'station',
  'lechon',
  'buffet',
  'dessert',
  'beverage',
  'drink',
] as const;

export function isCapacityBound(category: string | null | undefined): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return CAPACITY_BOUND_HINTS.some((hint) => c.includes(hint));
}
