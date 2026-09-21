/**
 * card-headline-service.ts — WHICH trade an Explore card names.
 *
 * ── THE DEFECT, measured 2026-09-22 (CTRL-B3 build 7) ───────────────────────
 * `vendor-card.tsx` took `vendor.services[0]` unconditionally, and nothing
 * passed the active filter in. So a couple who filters Explore by Florist could
 * be shown a card headed **"Photography by X"** — because photography happens to
 * be first in that shop's list. The card's own docblock promises an instant
 * *is this what I'm shopping for* read, which is precisely what that breaks.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 * With a filter active, name the service that MATCHED. With no filter, today's
 * behaviour is correct and is left exactly as it was — a shop's own first
 * service is a reasonable headline when the visitor has not said what they want.
 *
 * Pure and total, so a test executes it rather than describing it.
 */

/**
 * The service a card should name.
 *
 * @param services the shop's services, in its own order
 * @param activeCategory the filter the visitor has applied, or null/'' for none
 */
export function headlineServiceFor(
  services: readonly (string | null | undefined)[] | null | undefined,
  activeCategory: string | null | undefined,
): string | null {
  const list = (services ?? []).filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  );
  if (list.length === 0) return null;

  const wanted = typeof activeCategory === 'string' ? activeCategory.trim().toLowerCase() : '';
  if (wanted === '') return list[0] ?? null;

  // 🔑 EXACT MATCH ONLY, AND FALL BACK RATHER THAN GUESS. The filter's
  // vocabulary and `vendor_profiles.services` overlap but are not the same
  // list — `/v/[slug]`'s own SUP-14 comment records that `serviceGroupOf`
  // returns UNDEFINED for a leaf like `live_band`. A fuzzy match here would
  // invent a trade the shop never claimed, which is worse than naming their
  // first one; a shop that survived the filter for a reason this rule cannot
  // see still gets an honest headline.
  const hit = list.find((s) => s.trim().toLowerCase() === wanted);
  return hit ?? list[0] ?? null;
}
