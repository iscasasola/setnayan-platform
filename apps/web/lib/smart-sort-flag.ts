/**
 * Smart-sort feature flag.
 *
 * When enabled, the couple's vendor category search becomes PROGRESSIVE — it
 * tightens as the couple's plan gets more defined:
 *   • PAX  → the vendor's "starts at" adapts to the couple's LIVE headcount for
 *            pax-oriented services (per-head × pax), and that adapted price is
 *            what feeds ranking (lib/smart-sort · paxAdjustedStartsAtPhp).
 *   • BUDGET → a SOFT price-fit signal re-ranks toward what the couple can still
 *            afford (remaining budget); it only HARD-filters when the couple asks
 *            for a strict budget, and surfaces a "raise your budget?" nudge when
 *            the best options all sit above the remaining budget.
 *   • DATE → vendors whose SERVICE CALENDAR is blocked on the couple's date are
 *            down-ranked (existing) and, in strict mode, hidden.
 *
 * NEXT_PUBLIC_ so the server search action and the client overlay agree on one
 * value. Off by default — the current owner-locked sort ladder is unchanged
 * until NEXT_PUBLIC_SMART_SORT_ENABLED=true.
 */
export function isSmartSortEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_SMART_SORT_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
